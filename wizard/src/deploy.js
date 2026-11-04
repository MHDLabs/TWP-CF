/**
 * Cloudflare API helpers for deploying TWP-CF Worker with Durable Objects.
 */

const CF_API = "https://api.cloudflare.com/client/v4";
const REPO_RAW = "https://raw.githubusercontent.com/MHDLabs/TWP-CF/main";

const MODULES = ["index.js", "session.js", "mtproxy.js", "protocol.js", "bridge.js"];

export async function verifyToken(token) {
  const res = await fetch(`${CF_API}/user/tokens/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.success || data.result?.status !== "active") {
    throw new Error("API Token نامعتبر یا غیرفعال است");
  }
  return data.result;
}

export async function getAccount(token) {
  const [accountsRes, userRes] = await Promise.all([
    fetch(`${CF_API}/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${CF_API}/user`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const accounts = await accountsRes.json();
  const user = await userRes.json();
  if (!accounts.success || !accounts.result?.length) {
    throw new Error("هیچ اکانتی با این Token پیدا نشد");
  }
  return {
    id: accounts.result[0].id,
    email: (user.result?.email || "").toLowerCase(),
  };
}

export async function nameTaken(token, accountId, name) {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${name}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.status === 200;
}

export function randomName() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "twp-";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function randomSecret() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchModule(name) {
  const res = await fetch(`${REPO_RAW}/${name}`);
  if (!res.ok) throw new Error(`نتوانستم فایل ${name} را از GitHub بگیرم (${res.status})`);
  return res.text();
}

export async function deployWorker(token, accountId, workerName, secret, onProgress) {
  onProgress?.("در حال دریافت کد پروژه از GitHub...");
  const modules = {};
  for (const name of MODULES) {
    modules[name] = await fetchModule(name);
  }

  onProgress?.("در حال آماده‌سازی metadata...");
  const metadata = {
    main_module: "index.js",
    compatibility_date: "2025-01-01",
    bindings: [
      { type: "durable_object_namespace", name: "SESSIONS", class_name: "WebProxySession" },
      { type: "plain_text", name: "SESSION_TTL_SECONDS", text: "300" },
      { type: "plain_text", name: "MAX_STREAMS", text: "64" },
      { type: "plain_text", name: "DIAGNOSTICS", text: "0" },
    ],
    migrations: {
      new_tag: "v1",
      new_sqlite_classes: ["WebProxySession"],
    },
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  for (const [name, content] of Object.entries(modules)) {
    form.append(name, new Blob([content], { type: "application/javascript+module" }), name);
  }

  onProgress?.(`در حال دیپلوی Worker به نام «${workerName}»...`);
  const uploadRes = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  const uploadData = await uploadRes.json();
  if (!uploadData.success) {
    const msg = uploadData.errors?.map((e) => e.message).join("; ") || "خطای ناشناخته در آپلود";
    throw new Error(msg);
  }

  onProgress?.("در حال تنظیم PROXY_SECRET...");
  const secretRes = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "PROXY_SECRET", text: secret, type: "secret_text" }),
    }
  );
  const secretData = await secretRes.json();
  if (!secretData.success) {
    throw new Error("تنظیم Secret ناموفق بود: " + (secretData.errors?.[0]?.message || "unknown"));
  }

  onProgress?.("در حال فعال‌سازی subdomain...");
  // Enable workers.dev
  await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    }
  ).catch(() => {}); // non-fatal on some accounts

  // Get workers.dev subdomain
  let subdomain = "workers.dev";
  try {
    const subRes = await fetch(
      `${CF_API}/accounts/${accountId}/workers/subdomain`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const subData = await subRes.json();
    if (subData.success && subData.result?.subdomain) {
      subdomain = `${subData.result.subdomain}.workers.dev`;
    }
  } catch {}

  const url = `https://${workerName}.${subdomain}`;
  return { url, workerName, secret, subdomain };
}

export async function resetSecret(token, accountId, workerName) {
  const secret = randomSecret();
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "PROXY_SECRET", text: secret, type: "secret_text" }),
    }
  );
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || "ریست Secret ناموفق بود");
  }
  return secret;
}

export async function deleteWorker(token, accountId, workerName) {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || "حذف Worker ناموفق بود");
  }
  return true;
}

export async function probeWorker(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timer);
    // Any HTTP response means the worker is reachable (404 is expected for root)
    return { ok: true, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.name === "AbortError" ? "timeout" : (err.message || "unreachable") };
  }
}
