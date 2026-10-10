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

async function route(request, env) {
  const url = new URL(request.url);
  const expectedHost = canonicalHost(env.PUBLIC_HOSTNAME || url.hostname);
  if (canonicalHost(url.hostname) !== expectedHost) return camouflage();

  if (url.pathname === "/" && request.method === "GET") {
    const capability = exactBridgeQuery(url);
    const telegram = exactTelegramQuery(url, expectedHost, env.PROXY_SECRET);
    if (!capability && !telegram) {
      return publicPage(expectedHost, env.PROXY_SECRET);
    }
    if (capability && !(await capabilityMatches(capability, expectedHost, env.PROXY_SECRET))) {
      return publicPage(expectedHost, env.PROXY_SECRET);
    }
    const bootstrap = await createBootstrap(env, request.headers.get("CF-Connecting-IP") || "");
    return bridgePage(expectedHost, bootstrap);
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

  return camouflage();
}

function publicPage(host, secret) {
  const safeHost = String(host || "").replace(/[&<>"']/g, "");
  const safeSecret = String(secret || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
  const telegramUrl = `https://t.me/webproxy?server=${encodeURIComponent(safeHost)}&secret=${encodeURIComponent(safeSecret)}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TWP-CF Proxy</title><style>
:root{color-scheme:dark;--bg:#0b0e13;--panel:#141a22;--field:#090d12;--line:#29323e;--line2:#3b4858;--text:#e7edf4;--muted:#8793a2;--blue:#4d9fff;--blue2:#79b8ff;--green:#46d98b}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:linear-gradient(180deg,#090c11,#0d1117 50%,#090c11);color:var(--text);font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.14;background:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:32px 32px}
.wrap{width:min(720px,calc(100% - 24px));margin:0 auto;padding:28px 0 38px;position:relative}.top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:17px;padding:12px 14px;background:#10151c;border:1px solid var(--line);border-radius:7px;box-shadow:0 11px 30px rgba(0,0,0,.22)}.brand{display:flex;gap:10px;align-items:center}.mark{width:34px;height:34px;display:grid;place-items:center;border:1px solid #354252;border-radius:6px;background:#090d12;color:var(--blue2)}.mark svg{width:18px;height:18px}.brand h1{font-size:15px;margin:0;line-height:1.1}.brand p{font-size:9px;color:var(--muted);margin:4px 0 0}.state{display:flex;align-items:center;gap:6px;color:#94a0af;font-size:9px}.state i{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px rgba(70,217,139,.55)}
h2{font-size:17px;margin:17px 0 3px}.intro{color:var(--muted);font-size:10px;margin:0 0 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.card{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:15px;box-shadow:0 12px 32px rgba(0,0,0,.2)}.card:before{content:"";position:absolute;left:-1px;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--blue);opacity:.72}.wide{grid-column:1/-1}.label{font-size:9px;color:#a9b4c1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}.value{font-size:11px;word-break:break-all}.mono{font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.row{display:flex;gap:7px;align-items:center}.row .value{flex:1;min-width:0}.btn{height:32px;border:1px solid var(--line2);background:#0b1016;color:#dce4ed;border-radius:5px;padding:0 10px;font:600 9px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .15s,border-color .15s,transform .15s}.btn:hover{background:#121923;border-color:#526174;transform:translateY(-1px)}.btn.primary{background:var(--blue);border-color:var(--blue);color:#06111e;box-shadow:0 5px 15px rgba(77,159,255,.14)}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.note{color:#6e7a89;font-size:8px;margin-top:5px}.footer{text-align:center;color:#5f6b79;font-size:8px;margin-top:17px}.social{display:flex;justify-content:center;gap:14px;margin-bottom:5px}.social a{display:inline-flex;align-items:center;gap:5px;color:#7d8998;text-decoration:none}.social a:hover{color:#dfe8f1}.social svg{width:13px;height:13px}
@keyframes panelIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}.card{animation:panelIn .22s ease both}.card:nth-child(2){animation-delay:.03s}.card:nth-child(3){animation-delay:.06s}.card:nth-child(4){animation-delay:.09s}.card:nth-child(5){animation-delay:.12s}
@media(max-width:620px){.wrap{width:calc(100% - 16px);padding:17px 0 26px}.state{display:none}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.card{padding:13px}.row{align-items:stretch}.row .btn{flex:none}.actions .btn{flex:1}}
</style></head><body><main class="wrap"><header class="top"><div class="brand"><div class="mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.5 3.2 2.9 10.4c-.9.35-.88 1.62.03 1.94l4.65 1.63 1.74 5.5c.28.88 1.4 1.08 1.97.36l2.55-3.22 4.8 3.52c.78.57 1.9.15 2.1-.8l2.63-14.8c.17-.98-.75-1.68-1.87-1.33ZM9.15 13.42l8.98-5.66-7.07 7.1-.64 2.14-1.27 3.58Zm2.9 4.24.42-1.43 1.03-1.03 1.9 1.39-3.35 1.07Z"/></svg></div><div><h1>TWP-CF</h1><p>Telegram proxy panel</p></div></div><div class="state"><i></i>Online</div></header><h2>Proxy</h2><p class="intro">Your deployed Telegram web proxy is ready.</p><section class="grid"><div class="card"><div class="label">Server</div><div class="value mono">${safeHost}</div></div><div class="card"><div class="label">Port</div><div class="value mono">443</div></div><div class="card wide"><div class="label">Proxy secret</div><div class="row"><div class="value mono" id="secret">${safeSecret}</div><button class="btn" onclick="copyText(secret,this)">Copy</button></div><div class="note">Keep this value private. It authenticates the proxy.</div></div><div class="card wide"><div class="label">Web proxy address</div><div class="row"><div class="value mono" id="proxyAddress">${telegramUrl}</div><button class="btn" onclick="copyText(document.getElementById('proxyAddress').textContent,this)">Copy</button></div><div class="actions"><button class="btn primary" id="openProxy">Open proxy</button><a class="btn" href="/healthz">Health</a></div><div class="note">Use this Telegram Web Proxy address directly. No panel page is required.</div></div></section><div class="footer"><div class="social"><a href="https://github.com/MHDLabs/TWP-CF" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.23.68-.49v-1.72c-2.78.62-3.37-1.2-3.37-1.2-.46-1.2-1.12-1.52-1.12-1.52-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.59 2.36 1.13 2.94.86.09-.67.35-1.13.64-1.39-2.22-.26-4.56-1.15-4.56-5.08 0-1.12.39-2.03 1.03-2.75 0-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.2 9.2 0 0 1 12 7.85c.85 0 1.7.12 2.5.37 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.81-4.59 5.07.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.25 10.25 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"/></svg>GitHub</a><a href="https://t.me/MHDLabs" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.5 3.2 2.9 10.4c-.9.35-.88 1.62.03 1.94l4.65 1.63 1.74 5.5c.17-.98-.75-1.68-1.87-1.33ZM9.15 13.42l8.98-5.66-7.07 7.1-.64 2.14-1.27 3.58Zm2.9 4.24.42-1.43 1.03-1.03 1.9 1.39-3.35 1.07Z"/></svg>Telegram</a></div>TWP-CF · Telegram web proxy</div></main><script>const telegram=${JSON.stringify(telegramUrl)};document.getElementById("openProxy").onclick=()=>location.href=telegram;function copyText(value,button){if(!value)return;const done=()=>{const old=button.textContent;button.textContent="Copied";setTimeout(()=>button.textContent=old,900)};if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(done).catch(()=>{})}else{const area=document.createElement("textarea");area.value=value;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();try{document.execCommand("copy");done()}catch{}area.remove()}}</script></body></html>`;
  return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
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

export const _test = { FRAME, encodeFrame, parseFrames, isHello, exactBridgeQuery };
