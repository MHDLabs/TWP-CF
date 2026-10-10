> ⚠️ **WARNING — Iran internet disruptions**
> Due to severe and ongoing internet disruptions in Iran, this proxy may not work correctly and may experience outages or instability. Please take this into account before relying on it.

# TWP-CF — Telegram Web Proxy on Cloudflare Workers

A self-contained Telegram web proxy that runs on Cloudflare Workers with a Durable Object relaying traffic between the Telegram client and Telegram data centers over MTProto. Deploy it from your browser with the included static deployer, or use `wrangler` manually.

**Architecture:**

```
Telegram client → HTTPS → Worker → WebSocket → Durable Object → TCP → Telegram DC
```

## 🚀 Quick Start

Pick the path that fits you:

### 🟢 Path A — Static browser deployer (fastest, recommended)

The repository ships a single static page, [`index.html`](index.html), that deploys the proxy **directly from your browser** to your Cloudflare account. It runs on GitHub Pages: no terminal, no server, no build step. Your API token stays in browser memory and is never stored or sent anywhere except Cloudflare's own API.

**Step-by-step:**

1. **Open the repository** on GitHub: [github.com/MHDLabs/TWP-CF](https://github.com/MHDLabs/TWP-CF).
2. **Enable GitHub Pages** (only once per repository): open **Settings → Pages** in the repository, choose **Source: Deploy from a branch**, pick the `main` branch and `/ (root)`, and save.
   > Adding `index.html` to Git does **not** publish Pages by itself — you must enable it in Settings as above.
3. Wait for Pages to build, then open the published page at:
   `https://mhdlabs.github.io/TWP-CF/`
   > This URL format is the standard GitHub Pages layout for this repository. If Pages has not been enabled yet, the link will return a 404 — complete step 2 first. This project does not guarantee that Pages is currently published.
4. **Create a Cloudflare API token**: the page includes a **Create token** link that pre-fills the required permissions (Account Settings Read, Workers Scripts Edit, Workers Subdomain Edit). Finish creating the token in the Cloudflare dashboard and copy it.
5. **Paste the token** into the deployer's password field and press **Verify Access**.
6. **Choose your account** (if the token can access several) and optionally set a Worker name. Leave the proxy secret empty to generate one automatically.
7. Press **Deploy Worker** and wait for the progress steps to finish.
8. **Save the results immediately**: the deployer shows your **proxy secret** and **admin token** once. Copy both somewhere safe — Cloudflare does not let you read a secret back later.
9. **Copy the Telegram proxy link** and open it on the device with Telegram, or add the server/port/secret manually (see below).
10. **Check the deployment**: press **Open Worker** or visit `https://<worker>.<subdomain>.workers.dev/healthz` — you should get a small JSON `ok` response.
11. **Add the proxy in Telegram** using the link shown in the result panel.
12. **Disable the public information page** once you have saved your credentials: open the Worker's root URL in your browser, use the *Hide this page* control, and enter your admin token. Details in [Public information page & disabling](#-public-information-page--disabling).

> ⚠️ **CORS limitation — please read**: as of this writing, `api.cloudflare.com` does **not** return `Access-Control-Allow-Origin` headers for browser origins other than the Cloudflare dashboard (an `OPTIONS` preflight returns HTTP 400, code 7001, with no CORS headers). That means browsers on GitHub Pages are typically **blocked from calling the Cloudflare API directly**, and the deployer will show an explicit CORS error instead of pretending to succeed. This is a verified Cloudflare-side restriction, not a bug in `index.html`, and it cannot be fixed from a static page (no backend/proxy is allowed or included). If you hit it, use **Path B** (wrangler) instead — it performs exactly the same API calls from your machine, where CORS does not apply.

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

3. **Generate two independent secrets:**

   ```sh
   openssl rand -hex 16   # → PROXY_SECRET (32 hex characters)
   openssl rand -hex 32   # → PANEL_ADMIN_TOKEN (64 hex characters)
   ```

   Copy both values somewhere safe.

4. **Log in to Cloudflare:**

   ```sh
   npx wrangler login
   ```

5. **Set both secrets** (paste the corresponding value when prompted):

   ```sh
   npx wrangler secret put PROXY_SECRET
   npx wrangler secret put PANEL_ADMIN_TOKEN
   ```

6. **Deploy:**

   ```sh
   npm run deploy
   ```

   The bundled `wrangler.toml` already declares the `SESSIONS` and `PANEL_SETTINGS` Durable Object bindings, their SQLite migrations, and the plain-text variables — the deploy command provisions everything.

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

> 💡 Opening `https://<worker-host>/` in a browser also shows a ready-made page with your proxy link to copy. Remember to [disable it](#-public-information-page--disabling) after setup — it exposes the proxy secret to every visitor.

## 🔒 Public information page & disabling

### What the page shows — and why it is not private

By default, opening your Worker's root URL (`/`) shows a small information page with your server, port, **proxy secret**, and a ready-made Telegram proxy link. That is convenient for setup, but **anyone who can guess or discover the URL can read the proxy secret** and use your proxy. Treat the page as public until you disable it.

### Disabling the page

The page includes a minimal **Hide this page** control. It requires your **admin token** (`PANEL_ADMIN_TOKEN`), asks for confirmation, and calls a dedicated authenticated endpoint (`POST /api/v1/panel/disable`). After a successful disable:

- Ordinary visits to `/` return a plain `404` "Not found" page (the same camouflage response used for all unknown paths), with no secret, no proxy URL, and no management controls.
- **The proxy itself keeps working**: valid Telegram links, session/WebSocket routes, and `/healthz` are unaffected.
- The disabled state is stored **persistently server-side** in a dedicated Durable Object (`PanelSettings`), so it survives new visitors, other devices, and Worker restarts.

### The three different credentials

| Credential | What it is | Where it lives |
| --- | --- | --- |
| `PROXY_SECRET` | Authenticates MTProxy connections (32 hex chars) | Cloudflare Worker secret |
| `PANEL_ADMIN_TOKEN` | Authenticates the disable control (≥32 random bytes) | Cloudflare Worker secret |
| Cloudflare API token | Used only by the deployer/wrangler to upload code | Yours, entered at deploy time |

They are independent. The public page never displays `PANEL_ADMIN_TOKEN`, and changing `PROXY_SECRET` does **not** restore a disabled page.

### Recovery — I forgot my admin token

There is deliberately **no public re-enable button**. To restore the information page, replace the secret with a new value in the Cloudflare dashboard:

1. Open **Workers & Pages → your worker → Settings → Variables and Secrets**.
2. Find `PANEL_ADMIN_TOKEN` under *Secrets*, press **Edit**, and paste a new secure value (e.g. `openssl rand -hex 32`).
3. Save, then open the Worker's root URL again — the page returns automatically.

How it works: when the page is disabled, the Worker stores only a SHA-256 **fingerprint** of the admin token (never the raw token). On each visit it compares the fingerprint of the *currently configured* secret with the stored one; a mismatch means the owner rotated the token, so the disabled state is cleared. If the state store cannot be read at all, the page stays hidden (fail closed) — but the proxy keeps running.

### Rotation caveats

- A secret already handed to Cloudflare **cannot be read back** — that is why the deployer shows it only once. If you lose `PROXY_SECRET`, set a new one with `wrangler secret put PROXY_SECRET` and update your Telegram proxy configuration.
- **Hiding the page does not un-share the secret.** Anyone who loaded the page while it was visible may have copied the proxy secret. If the page was public for a while, rotate `PROXY_SECRET` after disabling it.
- Rotate `PANEL_ADMIN_TOKEN` at least once if you suspect it leaked; rotation also restores the public page (see recovery above), so disable the page again afterwards if desired.

## Updating your proxy

Manual updates anytime: `npm run deploy` from a fresh clone. The static deployer can also redeploy over an existing Worker by entering the same Worker name.

## Project components

| File | Purpose |
| --- | --- |
| `index.html` | Static browser deployer for GitHub Pages (fetches runtime sources from this repository and calls the Cloudflare API directly) |
| `index.js` | Worker entrypoint: HTTP routing, authentication, bootstrap/session tokens, `publicPage`, `camouflage`, panel disable endpoint, and the `WebProxySession` and `PanelSettings` Durable Object classes |
| `session.js` | `RelaySession`: relays frames between the WebSocket and Telegram TCP sockets, stream lifecycle, flow control, queue limits |
| `mtproxy.js` | AES-CTR implementation, MTProto client/Telegram handshakes, Telegram DC address list, proxy secret parsing |
| `protocol.js` | Frame definitions (`OPEN`, `DATA`, `CLOSE`, `WINDOW`, …), `encodeFrame`/`parseFrames`, protocol constants |
| `bridge.js` | The bridge HTML page loaded inside the Telegram client's iframe; connects the app port to the Worker's session/WebSocket |

## How it works

The Telegram client first opens the `bridge` page inside its iframe. The bridge page makes a short `POST` to `/api/v1/session`, receives a valid bootstrap token and a `WELCOME` frame, then connects to `/api/v1/ws` over WebSocket. Every data frame is forwarded by the Worker to a Durable Object (`WebProxySession`), which performs the MTProxy handshake using `PROXY_SECRET` and then opens a direct TCP connection to one of Telegram's data centers. Traffic is encrypted with AES-CTR in both directions and managed with flow control via `WINDOW` frames. The root page shows the public information page (unless disabled) and all other paths are hidden behind a plain `404` response (`camouflage`).

## Environment variables & secrets

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `PROXY_SECRET` | secret | **Yes** | — | 32 hex characters, or `dd` + 32 hex characters. `wrangler secret put PROXY_SECRET` |
| `PANEL_ADMIN_TOKEN` | secret | No* | — | ≥32 random bytes (e.g. `openssl rand -hex 32`). Enables the *Hide this page* control. `wrangler secret put PANEL_ADMIN_TOKEN` |
| `SESSION_TTL_SECONDS` | var | No | `300` | Lifetime of a session token (30–600) |
| `MAX_STREAMS` | var | No | `64` | Maximum concurrent streams per session (1–128) |
| `DIAGNOSTICS` | var | No | `0` | `1` enables verbose relay logging |

\* Without `PANEL_ADMIN_TOKEN` the information page always renders and shows no disable control — the proxy still works. Set it to be able to hide the page.

Vars are declared in `wrangler.toml` under `[vars]`; the two secrets must be registered separately.

## Security notes

- **Never share `PROXY_SECRET`** — anyone with it can use your proxy.
- **Never commit secrets** — `.dev.vars` and `.env` are git-ignored; secrets live only in Cloudflare's secret store.
- **Disable the public page after setup** — the information page exposes the proxy secret to every visitor.
- **The admin token cannot be read back** — Cloudflare stores it write-only; recovery works by replacing it.
- **Traffic passes through Cloudflare** — the Worker relays your Telegram traffic between the client and Telegram DCs.

## Local development

```sh
cp .dev.vars.example .dev.vars   # then edit PROXY_SECRET and PANEL_ADMIN_TOKEN
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
