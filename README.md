> ⚠️ **WARNING — Iran internet disruptions**
> Due to severe and ongoing internet disruptions in Iran, this proxy may not work correctly and may experience outages or instability. Please take this into account before relying on it.

# TWP-CF — Telegram Web Proxy on Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MHDLabs/TWP-CF.git)

A self-contained Telegram web proxy that runs on Cloudflare Workers with a Durable Object relaying traffic between the Telegram client and Telegram data centers over MTProto. **One click to deploy** — no terminal required — or use `wrangler` manually if you prefer.

**Architecture:**

```
Telegram client → HTTPS → Worker → WebSocket → Durable Object → TCP → Telegram DC
```

## 🚀 Quick Start

Pick the path that fits you:

### 🟢 Path A — One-click deploy (no terminal needed)

All you need is a free [Cloudflare](https://dash.cloudflare.com/) account.

1. Click the **Deploy to Cloudflare** button above ☝️
2. Log in to Cloudflare (create a free account if you don't have one yet).
3. Choose a Worker name (e.g. `twp-cf`) and continue.
4. 🔑 When the form asks for `PROXY_SECRET`, enter **your own** value:
   - exactly **32 hex characters** (`0-9` and `a-f`), e.g. `0123456789abcdef0123456789abcdef`;
   - no terminal? Use any trusted "random hex generator" online;
   - have a terminal? Run `openssl rand -hex 16`;
   - ⚠️ **If the field is pre-filled with an example value, replace it** — never keep the example;
   - copy your value somewhere safe — you need it in the next step 📝
5. ⏳ Wait for the deployment to finish — that's it! Your proxy is live at:

   ```
   https://<worker-name>.<your-subdomain>.workers.dev
   ```

### 🔵 Path B — Manual deploy with wrangler (advanced)

Prerequisites: [Node.js](https://nodejs.org/) 18+ and a Cloudflare account.

1. **Clone or download** this project:

   ```sh
   git clone https://github.com/MHDLabs/TWP-CF.git twp-cf
   cd twp-cf
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Generate `PROXY_SECRET`** (exactly 32 hex characters):

   ```sh
   openssl rand -hex 16
   ```

4. **Log in to Cloudflare:**

   ```sh
   npx wrangler login
   ```

5. **Set the secret** (paste the hex value from step 3 when prompted):

   ```sh
   npx wrangler secret put PROXY_SECRET
   ```

6. **Deploy:**

   ```sh
   npm run deploy
   ```

7. **Enable workers.dev** in the Cloudflare Dashboard (Workers & Pages → your worker → *Settings* → *Workers.dev*), so the proxy is reachable at `https://<worker-name>.<subdomain>.workers.dev`.

## 📱 Add the proxy to Telegram (manual step)

Cloudflare hosts the proxy — adding it to Telegram is done **manually on your device**:

1. **Build your personal proxy link** by replacing the two values in:

   ```
   https://t.me/webproxy?server=<worker-host>&secret=<PROXY_SECRET>
   ```

   Example (your values will be different 😉):

   ```
   https://t.me/webproxy?server=twp-cf.my-subdomain.workers.dev&secret=0123456789abcdef0123456789abcdef
   ```

2. **Open the link** on the device where Telegram is installed — Telegram will offer to add the proxy. Done 🎉

3. **Or add it manually** inside Telegram:
   - **Android:** Settings → Data and Storage → Proxy → ➕ Add proxy → type: **MTProto**
   - **Desktop:** Settings → Advanced → Proxy → Add proxy → type: **MTProto**
   - **Server:** `twp-cf.my-subdomain.workers.dev` · **Port:** `443` · **Secret:** your `PROXY_SECRET`

> 💡 Opening `https://<worker-host>/` in a browser also shows a ready-made page with your proxy link to copy.

## 🔄 Updating your proxy

The Deploy to Cloudflare button connects this repository to **Workers Builds**: every `git push` to the repo is re-deployed automatically ✅

Manual updates anytime: `npm run deploy`

## Project components

| File | Purpose |
| --- | --- |
| `index.js` | Worker entrypoint: HTTP routing, authentication, bootstrap/session tokens, `publicPage`, `camouflage`, and the `WebProxySession` Durable Object class |
| `session.js` | `RelaySession`: relays frames between the WebSocket and Telegram TCP sockets, stream lifecycle, flow control, queue limits |
| `mtproxy.js` | AES-CTR implementation, MTProto client/Telegram handshakes, Telegram DC address list, proxy secret parsing |
| `protocol.js` | Frame definitions (`OPEN`, `DATA`, `CLOSE`, `WINDOW`, …), `encodeFrame`/`parseFrames`, protocol constants |
| `bridge.js` | The bridge HTML page loaded inside the Telegram client's iframe; connects the app port to the Worker's session/WebSocket |

## How it works

The Telegram client first opens the `bridge` page inside its iframe. The bridge page makes a short `POST` to `/api/v1/session`, receives a valid bootstrap token and a `WELCOME` frame, then connects to `/api/v1/ws` over WebSocket. Every data frame is forwarded by the Worker to a Durable Object (`WebProxySession`), which performs the MTProxy handshake using `PROXY_SECRET` and then opens a direct TCP connection to one of Telegram's data centers. Traffic is encrypted with AES-CTR in both directions and managed with flow control via `WINDOW` frames. The root page requires no token and simply shows the public proxy page with the Telegram proxy link; all other paths are hidden behind a plain `404` response (`camouflage`).

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PROXY_SECRET` | **Yes** | — | 32 hex characters, or `dd` + 32 hex characters. Set in the Deploy form, or with `wrangler secret put PROXY_SECRET` |
| `SESSION_TTL_SECONDS` | No | `300` | Lifetime of a session token (30–600) |
| `MAX_STREAMS` | No | `64` | Maximum concurrent streams per session (1–128) |
| `DIAGNOSTICS` | No | `0` | `1` enables verbose relay logging |

Vars are declared in `wrangler.toml` under `[vars]` (except `PROXY_SECRET`, which is a secret).

## Security notes

- **Never share `PROXY_SECRET`** — anyone with it can use your proxy.
- **Never commit secrets** — `.dev.vars` and `.env` are git-ignored; `PROXY_SECRET` lives only in Cloudflare's secret store.
- **Traffic passes through Cloudflare** — the Worker relays your Telegram traffic between the client and Telegram DCs.

## Local development

```sh
cp .dev.vars.example .dev.vars   # then edit PROXY_SECRET
npm run dev
```

## License

Custom open-source license — see [LICENSE](LICENSE). Free to use, modify, and distribute; modified versions must reference the original repository: https://github.com/MHDLabs/TWP-CF.git

## Author

- Studio: **MHDLabs**
- GitHub: [github.com/MHDLabs](https://github.com/MHDLabs)
- Repository: [github.com/MHDLabs/TWP-CF](https://github.com/MHDLabs/TWP-CF)
- Telegram: [t.me/MHDLabs](https://t.me/MHDLabs)

---

Made with ❤️ in **MHDLabs**
