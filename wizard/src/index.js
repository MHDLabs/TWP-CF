import {
  verifyToken,
  getAccount,
  nameTaken,
  randomName,
  randomSecret,
  deployWorker,
  resetSecret,
  deleteWorker,
  probeWorker,
} from "./deploy.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": url.origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (url.pathname === "/api/deploy" && request.method === "POST") {
      return streamDeploy(request, url);
    }

    if (url.pathname === "/api/reset-secret" && request.method === "POST") {
      return jsonAction(request, async (body) => {
        const { token, accountId, workerName } = body;
        if (!token || !accountId || !workerName) throw new Error("پارامتر ناقص");
        const secret = await resetSecret(token, accountId, workerName);
        return { secret };
      });
    }

    if (url.pathname === "/api/delete" && request.method === "POST") {
      return jsonAction(request, async (body) => {
        const { token, accountId, workerName } = body;
        if (!token || !accountId || !workerName) throw new Error("پارامتر ناقص");
        await deleteWorker(token, accountId, workerName);
        return { deleted: true };
      });
    }

    if (url.pathname === "/api/probe" && request.method === "POST") {
      return jsonAction(request, async (body) => {
        if (!body.url) throw new Error("url الزامی است");
        return probeWorker(body.url);
      });
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};

async function jsonAction(request, fn) {
  try {
    const body = await request.json();
    const result = await fn(body);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ ok: false, error: err.message || String(err) }, { status: 400 });
  }
}

function streamDeploy(request, url) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) {
    return new Response("Forbidden", { status: 403 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (obj) => writer.write(encoder.encode(JSON.stringify(obj) + "\n"));

  (async () => {
    try {
      const body = await request.json();
      const token = (body.token || "").trim();
      if (!token) {
        await send({ type: "error", message: "API Token الزامی است" });
        return;
      }

      await send({ type: "info", message: "در حال بررسی Token..." });
      await verifyToken(token);

      await send({ type: "info", message: "در حال دریافت اطلاعات اکانت..." });
      const account = await getAccount(token);
      await send({ type: "info", message: `اکانت: ${account.email}` });

      let workerName = (body.name || "").trim().toLowerCase();
      if (workerName) {
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(workerName)) {
          await send({ type: "error", message: "نام Worker نامعتبر است" });
          return;
        }
        if (await nameTaken(token, account.id, workerName)) {
          await send({ type: "error", message: `نام «${workerName}» قبلاً استفاده شده` });
          return;
        }
      } else {
        do {
          workerName = randomName();
        } while (await nameTaken(token, account.id, workerName));
      }

      const secret = randomSecret();
      await send({ type: "info", message: `نام Worker: ${workerName}` });

      const result = await deployWorker(token, account.id, workerName, secret, async (msg) => {
        await send({ type: "info", message: msg });
      });

      await send({
        type: "complete",
        url: result.url,
        secret: result.secret,
        workerName: result.workerName,
        email: account.email,
        accountId: account.id,
      });
    } catch (err) {
      await send({ type: "error", message: err.message || String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Access-Control-Allow-Origin": url.origin,
      "Cache-Control": "no-store",
    },
  });
}

const HTML = `PLACEHOLDER`;
