import { connect } from "cloudflare:sockets";
import { RelaySession } from "./session.js";
import { FRAME, encodeFrame, parseFrames, clampInt } from "./protocol.js";
import { bridgePage } from "./bridge.js";

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error("unhandled request error", error);
      return camouflage();
    }
  },
};

export class WebProxySession extends RelaySession {
  constructor(ctx, env) { super(ctx, env, connect); }
}

// Dedicated Durable Object for the panel's persistent security state, kept
// separate from per-connection proxy sessions. It is only reachable through
// the Worker's routing logic; no public route exposes this class directly.
export class PanelSettings {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/state" && request.method === "GET") {
      const stored = (await this.ctx.storage.get("panel")) || {};
      return Response.json({ disabled: Boolean(stored.disabled), fingerprint: String(stored.fingerprint || "") });
    }
    if (url.pathname === "/state" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const fingerprint = String(body && body.fingerprint || "");
      if (!body || typeof body.disabled !== "boolean" || !/^[0-9a-f]{64}$/.test(fingerprint)) {
        return new Response("bad state", { status: 400 });
      }
      // Only a SHA-256 fingerprint of PANEL_ADMIN_TOKEN is persisted —
      // never the raw token itself.
      await this.ctx.storage.put("panel", { disabled: body.disabled, fingerprint });
      return new Response(null, { status: 204 });
    }
    return new Response("not found", { status: 404 });
  }
}

const PANEL = Object.freeze({ ENABLED: "enabled", DISABLED: "disabled", UNAVAILABLE: "unavailable" });

function panelStub(env) {
  const namespace = env.PANEL_SETTINGS;
  if (!namespace || typeof namespace.get !== "function") throw new Error("PANEL_SETTINGS binding is not configured");
  return namespace.get(namespace.idFromName("panel"));
}

async function tokenFingerprint(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(token || "")));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Decides whether the public information page may be rendered. The comparison
// is always between the configured Worker secret and the stored fingerprint —
// never against request data — so an omitted Authorization header cannot
// influence recovery. If the stored state cannot be read or cleared safely,
// the page stays hidden (fail closed) while proxy routes are unaffected.
async function panelState(env) {
  const adminToken = String(env.PANEL_ADMIN_TOKEN || "");
  if (!adminToken || !env.PANEL_SETTINGS) return PANEL.ENABLED;

  let stored;
  try {
    const response = await panelStub(env).fetch("https://panel/state");
    if (!response.ok) throw new Error(`panel state read failed (${response.status})`);
    stored = await response.json();
  } catch (error) {
    console.error("panel state check failed", error);
    return PANEL.UNAVAILABLE;
  }

  if (!stored || !stored.disabled) return PANEL.ENABLED;
  const currentFingerprint = await tokenFingerprint(adminToken);
  const storedFingerprint = String(stored.fingerprint || "");
  if (storedFingerprint === currentFingerprint) return PANEL.DISABLED;

  // Recovery: the owner replaced PANEL_ADMIN_TOKEN in the Cloudflare dashboard,
  // so the stored fingerprint no longer matches the configured secret and the
  // disabled state is deliberately cleared.
  try {
    const response = await panelStub(env).fetch("https://panel/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: false, fingerprint: currentFingerprint }),
    });
    if (!response.ok) throw new Error(`panel state clear failed (${response.status})`);
  } catch (error) {
    console.error("panel state recovery failed", error);
    return PANEL.UNAVAILABLE;
  }
  return PANEL.ENABLED;
}

async function disablePanel(request, env) {
  const adminToken = String(env.PANEL_ADMIN_TOKEN || "");
  const provided = bearer(request);
  // Reject missing, empty or malformed credentials with the generic
  // camouflage response instead of an informative error.
  if (!adminToken || !provided || provided.length > 512 || !constantTimeEqual(provided, adminToken)) return camouflage();
  try {
    const response = await panelStub(env).fetch("https://panel/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: true, fingerprint: await tokenFingerprint(adminToken) }),
    });
    if (!response.ok) return camouflage();
  } catch (error) {
    console.error("panel disable failed", error);
    return camouflage();
  }
  return new Response(null, { status: 204, headers: noStore() });
}

async function route(request, env) {
  const url = new URL(request.url);
  const expectedHost = canonicalHost(env.PUBLIC_HOSTNAME || url.hostname);
  if (canonicalHost(url.hostname) !== expectedHost) return camouflage();

  if (url.pathname === "/" && request.method === "GET") {
    const capability = exactBridgeQuery(url);
    const telegram = exactTelegramQuery(url, expectedHost, env.PROXY_SECRET);
    const clientIp = request.headers.get("CF-Connecting-IP") || "";
    // Valid Telegram links and valid bridge capabilities keep working regardless
    // of the panel state: disabling the information page never disables the proxy.
    if (telegram || (capability && (await capabilityMatches(capability, expectedHost, env.PROXY_SECRET)))) {
      const bootstrap = await createBootstrap(env, clientIp);
      return bridgePage(expectedHost, bootstrap);
    }
    // Plain visits and invalid capabilities render the public page only when the
    // persisted panel state allows it. Any state uncertainty fails closed.
    const state = await panelState(env);
    if (state !== PANEL.ENABLED) return camouflage();
    return publicPage(expectedHost, env.PROXY_SECRET, Boolean(env.PANEL_ADMIN_TOKEN));
  }

  if (url.pathname === "/api/v1/session") {
    if (request.headers.has("Cookie")) return camouflage();
    if (request.method === "DELETE") {
      const token = bearer(request);
      if (!(await verifySessionToken(env, expectedHost, token))) return camouflage();
      const stub = env.SESSIONS.get(env.SESSIONS.idFromName(token));
      await stub.fetch("https://session/internal/close", { method: "POST" });
      return new Response(null, { status: 204, headers: noStore() });
    }
    if (request.method !== "POST" || !isBinary(request.headers.get("Content-Type"))) return camouflage();
    const bootstrap = bearer(request);
    if (!bootstrap || !(await verifyBootstrap(env, bootstrap, request.headers.get("CF-Connecting-IP") || ""))) return camouflage();
    const hello = await readHello(request);
    if (!isHello(hello)) return camouflage();

    const sessionToken = await createSessionToken(env, expectedHost);
    const stub = env.SESSIONS.get(env.SESSIONS.idFromName(sessionToken));
    const init = await stub.fetch("https://session/internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!init.ok) return camouflage();

    const welcome = encodeFrame(FRAME.WELCOME, 0);
    return new Response(welcome, {
      status: 200,
      headers: {
        ...noStore(),
        "Content-Type": "application/octet-stream",
        "X-Session-Token": sessionToken,
        "X-Carrier-Mode": "websocket",
        "X-Down-Cursor": "0",
      },
    });
  }

  if (url.pathname === "/api/v1/ws" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    const protocols = (request.headers.get("Sec-WebSocket-Protocol") || "").split(",").map((v) => v.trim());
    const protocol = protocols.find((v) => v.startsWith("tproxy-v1."));
    const token = protocol?.slice("tproxy-v1.".length);
    if (!(await verifySessionToken(env, expectedHost, token))) return camouflage();
    const stub = env.SESSIONS.get(env.SESSIONS.idFromName(token));
    return stub.fetch("https://session/internal/ws", {
      headers: { Upgrade: "websocket", "X-TProxy-Protocol": protocol },
    });
  }

  if (url.pathname === "/healthz" && request.method === "GET") {
    return Response.json({ ok: true, carrier: "websocket", relay: "direct-telegram-dc" }, { headers: noStore() });
  }

  // POST-only authenticated endpoint that permanently hides the public
  // information page. There is deliberately no GET variant and no public
  // re-enable endpoint: restoring the page requires rotating PANEL_ADMIN_TOKEN.
  if (url.pathname === "/api/v1/panel/disable") {
    if (request.method !== "POST") return camouflage();
    return disablePanel(request, env);
  }

  return camouflage();
}

function publicPage(host, secret, canDisable) {
  const safeHost = String(host || "").replace(/[&<>"']/g, "");
  const safeSecret = String(secret || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
  const telegramUrl = `https://t.me/webproxy?server=${encodeURIComponent(safeHost)}&secret=${encodeURIComponent(safeSecret)}`;
  const html = `<!doctype html><html data-theme="system" lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TWP-CF Proxy</title><style>
:root{color-scheme:light;--bg:#eaeef4;--bg2:#f6f8fc;--panel:rgba(255,255,255,.62);--panel-edge:rgba(255,255,255,.8);--field:rgba(255,255,255,.72);--line:rgba(22,31,46,.12);--line2:rgba(22,31,46,.22);--text:#182131;--muted:#59647599;--mutedc:#596475;--accent:#2f6fe4;--accent-ink:#fff;--green:#1f9d5f;--red:#c8384a;--shadow:0 14px 34px rgba(23,33,49,.1)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#0a0e15;--bg2:#0d1320;--panel:rgba(19,26,37,.58);--panel-edge:rgba(255,255,255,.08);--field:rgba(9,13,20,.6);--line:rgba(255,255,255,.1);--line2:rgba(255,255,255,.2);--text:#e7edf4;--mutedc:#96a2b2;--accent:#5aa2ff;--accent-ink:#08111f;--green:#46d98b;--red:#ff7a85;--shadow:0 16px 38px rgba(0,0,0,.38)}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#0a0e15;--bg2:#0d1320;--panel:rgba(19,26,37,.58);--panel-edge:rgba(255,255,255,.08);--field:rgba(9,13,20,.6);--line:rgba(255,255,255,.1);--line2:rgba(255,255,255,.2);--text:#e7edf4;--mutedc:#96a2b2;--accent:#5aa2ff;--accent-ink:#08111f;--green:#46d98b;--red:#ff7a85;--shadow:0 16px 38px rgba(0,0,0,.38)}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;background:radial-gradient(1200px 600px at 85% -10%,var(--accent-soft,rgba(47,111,228,.1)),transparent 60%),linear-gradient(180deg,var(--bg2),var(--bg));color:var(--text);font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;transition:background .25s,color .25s}
.wrap{width:min(720px,calc(100% - 24px));margin:0 auto;padding:28px 0 38px}
.top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px;padding:12px 14px;background:var(--panel);border:1px solid var(--panel-edge);border-radius:14px;box-shadow:var(--shadow);backdrop-filter:blur(14px) saturate(150%);-webkit-backdrop-filter:blur(14px) saturate(150%)}
.brand{display:flex;gap:10px;align-items:center;min-width:0}.mark{width:34px;height:34px;flex:none;display:grid;place-items:center;border:1px solid var(--line2);border-radius:9px;background:var(--field);color:var(--accent)}.mark svg{width:18px;height:18px}.brand h1{font-size:15px;margin:0;line-height:1.1}.brand p{font-size:9px;color:var(--mutedc);margin:4px 0 0}
.controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.picker{height:30px;padding:0 8px;background:var(--field);border:1px solid var(--line);border-radius:8px;color:var(--text);font:10px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;outline:none;transition:border-color .15s,box-shadow .15s}
.picker:hover{border-color:var(--line2)}.picker:focus-visible{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
h2{font-size:17px;margin:0 0 3px}.intro{color:var(--mutedc);font-size:10px;margin:0 0 13px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.card{position:relative;background:var(--panel);border:1px solid var(--panel-edge);border-radius:14px;padding:15px;box-shadow:var(--shadow);backdrop-filter:blur(14px) saturate(150%);-webkit-backdrop-filter:blur(14px) saturate(150%);animation:cardIn .22s ease both}
.card:before{content:"";position:absolute;inset:9px auto 9px -1px;width:2px;border-radius:2px;background:var(--accent);opacity:.7}
.card:nth-child(2){animation-delay:.03s}.card:nth-child(3){animation-delay:.06s}.card:nth-child(4){animation-delay:.09s}.card:nth-child(5){animation-delay:.12s}
.wide{grid-column:1/-1}.label{font-size:9px;color:var(--mutedc);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.mono{font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;direction:ltr;text-align:left;unicode-bidi:isolate;word-break:break-all}
[dir="rtl"] .label{text-align:right}[dir="rtl"] .intro,[dir="rtl"] .note{text-align:right}
.value{font-size:11px;word-break:break-all;min-width:0;flex:1}
.row{display:flex;gap:7px;align-items:center}
.btn{height:32px;border:1px solid var(--line2);background:var(--field);color:var(--text);border-radius:9px;padding:0 11px;font:600 9px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,transform .15s,box-shadow .15s}
.btn:hover{border-color:var(--accent);transform:translateY(-1px)}.btn:active{transform:none}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);box-shadow:0 5px 16px var(--accent-soft)}
.btn.danger{color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)}
.btn.danger:hover{border-color:var(--red);background:color-mix(in srgb,var(--red) 10%,transparent)}
.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.note{color:var(--mutedc);font-size:8px;margin-top:5px}
.input{width:100%;height:36px;padding:0 11px;background:var(--field);border:1px solid var(--line);border-radius:9px;color:var(--text);font:12px ui-monospace,SFMono-Regular,Menlo,monospace;outline:none;transition:border-color .15s,box-shadow .15s}
.input::placeholder{color:var(--mutedc);opacity:.8}.input:hover{border-color:var(--line2)}.input:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.status{display:none;margin-top:10px;font-size:9px;padding:9px 11px;border-radius:9px;border:1px solid var(--line);background:var(--field);overflow-wrap:anywhere}
.status.show{display:block}.status.ok{border-color:color-mix(in srgb,var(--green) 50%,transparent);color:var(--green)}.status.error{border-color:color-mix(in srgb,var(--red) 50%,transparent);color:var(--red)}
.warn{margin-top:9px;font-size:8px;color:var(--mutedc)}
.footer{text-align:center;color:var(--mutedc);font-size:8px;margin-top:18px}.social{display:flex;justify-content:center;gap:14px;margin-bottom:5px}.social a{display:inline-flex;align-items:center;gap:5px;color:var(--mutedc);text-decoration:none}.social a:hover{color:var(--text)}.social svg{width:13px;height:13px}
@keyframes cardIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media (max-width:620px){.wrap{width:calc(100% - 16px);padding:17px 0 26px}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.card{padding:13px}.row{flex-wrap:wrap}.actions .btn{flex:1}.top{flex-wrap:wrap}.controls{justify-content:flex-start;width:100%}}
</style><script>try{var __p=JSON.parse(localStorage.getItem("twp-ui")||"null");var __t=__p&&__p.theme;if(__t!=="light"&&__t!=="dark")__t="system";document.documentElement.dataset.theme=__t;var __l=__p&&__p.lang;if(__l!=="fa"&&__l!=="en")__l=(navigator.language||"").toLowerCase().indexOf("fa")===0?"fa":"en";document.documentElement.lang=__l;document.documentElement.dir=__l==="fa"?"rtl":"ltr"}catch(e){}</script></head><body><main class="wrap"><header class="top"><div class="brand"><div class="mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.5 3.2 2.9 10.4c-.9.35-.88 1.62.03 1.94l4.65 1.63 1.74 5.5c.28.88 1.4 1.08 1.97.36l2.55-3.22 4.8 3.52c.78.57 1.9.15 2.1-.8l2.63-14.8c.17-.98-.75-1.68-1.87-1.33ZM9.15 13.42l8.98-5.66-7.07 7.1-.64 2.14-1.27 3.58Zm2.9 4.24.42-1.43 1.03-1.03 1.9 1.39-3.35 1.07Z"/></svg></div><div><h1>TWP-CF</h1><p data-i18n="subtitle">Telegram web proxy</p></div></div><div class="controls"><select class="picker" id="themePick" aria-label="Theme"><option value="system" data-i18n="themeSystem">System</option><option value="light" data-i18n="themeLight">Light</option><option value="dark" data-i18n="themeDark">Dark</option></select><select class="picker" id="langPick" aria-label="Language"><option value="en">English</option><option value="fa">فارسی</option></select></div></header><h2 data-i18n="heading">Proxy</h2><p class="intro" data-i18n="intro">Your deployed Telegram web proxy is ready.</p><section class="grid"><div class="card"><div class="label" data-i18n="server">Server</div><div class="value mono">${safeHost}</div></div><div class="card"><div class="label" data-i18n="port">Port</div><div class="value mono">443</div></div><div class="card wide"><div class="label" data-i18n="secretLabel">Proxy secret</div><div class="row"><div class="value mono" id="secret">${safeSecret}</div><button class="btn" id="copySecret" data-i18n="copy">Copy</button></div><div class="note" data-i18n="keepPrivate">Keep this value private. It authenticates the proxy.</div></div><div class="card wide"><div class="label" data-i18n="addressLabel">Telegram proxy address</div><div class="row"><div class="value mono" id="proxyAddress">${telegramUrl}</div><button class="btn" id="copyAddress" data-i18n="copy">Copy</button></div><div class="actions"><button class="btn primary" id="openProxy" data-i18n="openProxy">Open proxy</button><a class="btn" href="/healthz" data-i18n="health">Health</a></div><div class="note" data-i18n="addressNote">Use this Telegram Web Proxy address directly. No panel page is required.</div></div>${canDisable ? `<div class="card wide"><div class="label" data-i18n="adminTitle">Hide this page</div><div class="note" data-i18n="adminNote">Permanently hides this public page for everyone. The proxy itself keeps working.</div><div class="row" style="margin-top:9px"><input class="input" id="adminToken" type="password" autocomplete="off" spellcheck="false" data-i18n-ph="adminPlaceholder" placeholder="Admin token"><button class="btn danger" id="disableBtn" data-i18n="disableBtn">Disable this page</button></div><div class="status" id="adminStatus"></div><div class="warn" data-i18n="adminWarning">Keep the admin token safe; if forgotten, replace it in the Cloudflare dashboard.</div></div>` : ``}</section><div class="footer"><div class="social"><a href="https://github.com/MHDLabs/TWP-CF" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.23.68-.49v-1.72c-2.78.62-3.37-1.2-3.37-1.2-.46-1.2-1.12-1.52-1.12-1.52-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.5 9.5 0 0 1 12 6.85c.85.004 1.7.115 2.5.337 1.9-1.3 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.25 10.25 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"/></svg>GitHub</a><a href="https://t.me/MHDLabs" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.5 3.2 2.9 10.4c-.9.35-.88 1.62.03 1.94l4.65 1.63 1.74 5.5c.28.88 1.4 1.08 1.97.36l2.55-3.22 4.8 3.52c.78.57 1.9.15 2.1-.8l2.63-14.8c.17-.98-.75-1.68-1.87-1.33ZM9.15 13.42l8.98-5.66-7.07 7.1-.64 2.14-1.27 3.58Zm2.9 4.24.42-1.43 1.03-1.03 1.9 1.39-3.35 1.07Z"/></svg>Telegram</a></div><span data-i18n="footer">TWP-CF · Telegram web proxy</span></div></main><script>
(()=>{"use strict";
const I18N={en:{subtitle:"Telegram web proxy",heading:"Proxy",intro:"Your deployed Telegram web proxy is ready.",server:"Server",port:"Port",secretLabel:"Proxy secret",addressLabel:"Telegram proxy address",copy:"Copy",copied:"Copied",keepPrivate:"Keep this value private. It authenticates the proxy.",openProxy:"Open proxy",health:"Health",addressNote:"Use this Telegram Web Proxy address directly. No panel page is required.",adminTitle:"Hide this page",adminNote:"Permanently hides this public page for everyone. The proxy itself keeps working.",adminTokenLabel:"Admin token",adminPlaceholder:"Enter admin token",disableBtn:"Disable this page",disableConfirm:"Hide the public page for everyone? Restoring it requires changing the admin token in the Cloudflare dashboard.",disabledOk:"Page disabled. Reloading…",tokenRequired:"Enter the admin token first.",denied:"Invalid admin token.",disableFailed:"Could not disable the page. Try again.",adminWarning:"Keep the admin token safe; if forgotten, replace it in the Cloudflare dashboard.",themeSystem:"System",themeLight:"Light",themeDark:"Dark",footer:"TWP-CF · Telegram web proxy"},fa:{subtitle:"پروکسی وب تلگرام",heading:"پروکسی",intro:"پروکسی وب تلگرام شما آماده است.",server:"سرور",port:"پورت",secretLabel:"کلید پروکسی",addressLabel:"آدرس پروکسی تلگرام",copy:"کپی",copied:"کپی شد",keepPrivate:"این مقدار را محرمانه نگه دارید؛ با آن احراز هویت پروکسی انجام می‌شود.",openProxy:"باز کردن پروکسی",health:"سلامت",addressNote:"این آدرس را مستقیم در تلگرام وارد کنید؛ به صفحه‌ی پنل نیازی نیست.",adminTitle:"پنهان کردن این صفحه",adminNote:"این صفحه‌ی عمومی را برای همه به‌صورت دائمی پنهان می‌کند؛ خود پروکسی همچنان کار می‌کند.",adminTokenLabel:"توکن مدیریت",adminPlaceholder:"توکن مدیریت را وارد کنید",disableBtn:"غیرفعال کردن صفحه",disableConfirm:"صفحه‌ی عمومی برای همه پنهان شود؟ بازگرداندن آن فقط با تغییر توکن مدیریت در داشبورد Cloudflare ممکن است.",disabledOk:"صفحه غیرفعال شد. در حال بارگذاری مجدد…",tokenRequired:"ابتدا توکن مدیریت را وارد کنید.",denied:"توکن مدیریت نامعتبر است.",disableFailed:"غیرفعال‌سازی انجام نشد؛ دوباره تلاش کنید.",adminWarning:"توکن مدیریت را امن نگه دار؛ در صورت فراموشی، آن را از داشبورد Cloudflare تغییر بده.",themeSystem:"سیستم",themeLight:"روشن",themeDark:"تاریک",footer:"TWP-CF · پروکسی وب تلگрам"}};
const telegram=${JSON.stringify(telegramUrl)};
const root=document.documentElement;
const themePick=document.getElementById("themePick");
const langPick=document.getElementById("langPick");
const hasAdmin=document.getElementById("disableBtn")!==null;
let lang=root.lang==="fa"?"fa":"en";
function pref(key,value){try{if(value===undefined){const p=JSON.parse(localStorage.getItem("twp-ui")||"null");return p&&p[key]||null}const p=JSON.parse(localStorage.getItem("twp-ui")||"null")||{};p[key]=value;localStorage.setItem("twp-ui",JSON.stringify(p))}catch(e){return null}}
function t(key){return I18N[lang][key]||I18N.en[key]||key}
function applyLang(){root.lang=lang;root.dir=lang==="fa"?"rtl":"ltr";document.title=lang==="fa"?"پروکسی TWP-CF":"TWP-CF Proxy";for(const el of document.querySelectorAll("[data-i18n]")){const key=el.getAttribute("data-i18n");if(I18N[lang][key])el.textContent=I18N[lang][key]}for(const el of document.querySelectorAll("[data-i18n-ph]")){const key=el.getAttribute("data-i18n-ph");if(I18N[lang][key])el.setAttribute("placeholder",I18N[lang][key])}langPick.value=lang}
function applyTheme(theme){root.dataset.theme=theme;themePick.value=theme}
themePick.onchange=()=>{pref("theme",themePick.value);applyTheme(themePick.value)};
langPick.onchange=()=>{lang=langPick.value;pref("lang",lang);applyLang()};
try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(pref("theme")!=="light"&&pref("theme")!=="dark")applyTheme("system")})}catch(e){}
function copyText(value,button){if(!value)return;const done=()=>{const old=button.textContent;button.textContent=t("copied");setTimeout(()=>{button.textContent=t("copy")},900)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(done).catch(()=>{})}else{const area=document.createElement("textarea");area.value=value;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();try{document.execCommand("copy");done()}catch(e){}area.remove()}}
document.getElementById("copySecret").onclick=e=>copyText(document.getElementById("secret").textContent,e.currentTarget);
document.getElementById("copyAddress").onclick=e=>copyText(document.getElementById("proxyAddress").textContent,e.currentTarget);
document.getElementById("openProxy").onclick=()=>{location.href=telegram};
if(hasAdmin){
 const input=document.getElementById("adminToken");
 const button=document.getElementById("disableBtn");
 const statusBox=document.getElementById("adminStatus");
 const say=(text,kind)=>{statusBox.textContent=text;statusBox.className="status show "+kind};
 button.onclick=async()=>{
  const token=input.value.trim();
  if(!token){say(t("tokenRequired"),"error");return}
  if(!confirm(t("disableConfirm")))return;
  button.disabled=true;
  try{
   const response=await fetch("/api/v1/panel/disable",{method:"POST",headers:{"Authorization":"Bearer "+token},cache:"no-store",credentials:"omit",redirect:"error",referrerPolicy:"no-referrer"});
   if(response.status===204){
    document.getElementById("secret").textContent="••••••••";
    document.getElementById("proxyAddress").textContent="••••••••";
    input.value="";token="";say(t("disabledOk"),"ok");
    setTimeout(()=>{location.replace(location.origin+"/")},900);
    return;
   }
   if(response.status===404){say(t("denied"),"error");input.value="";button.disabled=false;return}
   say(t("disableFailed"),"error");button.disabled=false;
  }catch(e){say(t("disableFailed"),"error");button.disabled=false}
 };
}
applyLang();applyTheme(pref("theme")||"system");
})();
</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

function camouflage() {
  return new Response("<!doctype html><meta charset=utf-8><title>Not found</title><h1>Not found</h1>", {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function exactTelegramQuery(url, host, secret) {
  if (url.searchParams.size !== 2 || !url.searchParams.has("server") || !url.searchParams.has("secret")) return false;
  return canonicalHost(url.searchParams.get("server")) === canonicalHost(host) && url.searchParams.get("secret") === String(secret || "");
}

function exactBridgeQuery(url) {
  if (url.searchParams.size !== 1 || !url.searchParams.has("bridge")) return null;
  const value = url.searchParams.get("bridge");
  return /^[A-Za-z0-9_-]{43}$/.test(value || "") && url.search === `?bridge=${value}` ? value : null;
}

async function capabilityMatches(candidate, host, hexSecret) {
  if (!/^(?:[0-9a-f]{32}|dd[0-9a-f]{32})$/.test(String(hexSecret || ""))) return false;
  const secret = hexToBytes(hexSecret);
  const context = new TextEncoder().encode(`tdesktop-web-proxy-bridge-v1\n${host}`);
  const expected = base64url(await hmac(secret, context));
  return constantTimeEqual(candidate, expected);
}

async function createBootstrap(env, _ip) {
  const ttl = clampInt(env.SESSION_TTL_SECONDS, 30, 600, 300);
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttl, n: randomToken(16) })));
  const signature = base64url(await hmac(signingKey(env), new TextEncoder().encode(payload)));
  return `${payload}.${signature}`;
}

async function verifyBootstrap(env, token, _ip) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = base64url(await hmac(signingKey(env), new TextEncoder().encode(payload)));
  if (!constantTimeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64urlDecode(payload)));
    return Number.isInteger(data.exp) && data.exp >= Math.floor(Date.now() / 1000);
  } catch { return false; }
}

function signingKey(env) {
  // Domain separation lets one user-supplied proxy secret safely serve both
  // MTProxy authentication and short-lived bootstrap-token signing.
  return new TextEncoder().encode(`twp-cf/session-signing/v1\n${String(env.PROXY_SECRET || "")}`);
}

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

// Keep the opaque 43-character wire format, but reject fabricated credentials
// before they can allocate or address a Durable Object.
async function createSessionToken(env, host) {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const mac = await sessionMac(env, host, nonce);
  const bytes = new Uint8Array(32); bytes.set(nonce); bytes.set(mac.subarray(0, 16), 16);
  return base64url(bytes);
}
async function verifySessionToken(env, host, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || "")) return false;
  const bytes = base64urlDecode(token);
  if (base64url(bytes) !== token) return false;
  const mac = await sessionMac(env, host, bytes.subarray(0, 16));
  return constantTimeEqual(base64url(bytes.subarray(16)), base64url(mac.subarray(0, 16)));
}
function sessionMac(env, host, nonce) {
  const context = new TextEncoder().encode("twp-cf/session-token/v1\n" + host + "\n");
  const bytes = new Uint8Array(context.length + nonce.length); bytes.set(context); bytes.set(nonce, context.length);
  return hmac(signingKey(env), bytes);
}
async function readHello(request) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), bytes = new Uint8Array(9);
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return bytes.subarray(0, length);
      if (length + value.length > bytes.length) {
        await reader.cancel(); return new Uint8Array();
      }
      bytes.set(value, length); length += value.length;
    }
  } finally { reader.releaseLock(); }
}

function isHello(bytes) {
  try {
    const frames = parseFrames(bytes);
    return frames.length === 1 && frames[0].type === FRAME.HELLO && frames[0].streamId === 0 && frames[0].payload.length === 1 && frames[0].payload[0] === 1;
  } catch { return false; }
}

function bearer(request) {
  const value = request.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function isBinary(value) {
  return /^application\/octet-stream(?:\s*;.*)?$/i.test(value || "");
}
function noStore() { return { "Cache-Control": "no-store" }; }
function canonicalHost(value) { return String(value || "").trim().toLowerCase().replace(/\.$/, ""); }
function randomToken(bytes) { const value = new Uint8Array(bytes); crypto.getRandomValues(value); return base64url(value); }
function hexToBytes(hex) { const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16); return out; }
function base64url(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function base64urlDecode(value) { const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4); const raw = atob(padded); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); }
function constantTimeEqual(a, b) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }

export const _test = { FRAME, encodeFrame, parseFrames, isHello, exactBridgeQuery, exactTelegramQuery, capabilityMatches, tokenFingerprint, PANEL };
