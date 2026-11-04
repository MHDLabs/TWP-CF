import { verifyToken, getAccount, nameTaken, randomName, randomSecret, deployWorker } from "./deploy.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
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

    // Serve static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
