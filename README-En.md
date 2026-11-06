# TWP-CF — Telegram Web Proxy on Cloudflare Workers

> ⚠️ **WARNING — Iran internet disruptions**  
> Due to ongoing internet disruptions in Iran, this proxy may be unstable.

A self-contained Telegram web proxy on Cloudflare Workers with a Durable Object relaying MTProto traffic to Telegram data centers.

```
Telegram client → HTTPS → Worker → WebSocket → Durable Object → TCP → Telegram DC
```

---

## Install methods

### 1) Auto deployer (recommended)

No terminal required:

**https://twp-wizard.mhdlab.workers.dev**

1. Open the [pre-filled API Token link](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22user_details%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A&zoneId=all&name=TWP-CF-Deployer)  
2. Continue to summary → Create Token  
3. Paste the token into the wizard and deploy  

After success, copy only the **Telegram connection link**. The token and deploy history stay in your browser only.

---

### 2) Deploy via GitHub (official Cloudflare button)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MHDLabs/TWP-CF.git)

1. Click the button above  
2. Sign in to Cloudflare  
3. Set `PROXY_SECRET` to exactly **32 hex characters** (`openssl rand -hex 16`)  
4. Wait for deployment  

Final URL:

```
https://<worker-name>.<subdomain>.workers.dev
```

Telegram link:

```
https://t.me/webproxy?server=<hostname>&secret=<PROXY_SECRET>
```

---

### 3) Manual deploy with terminal (developers)

Requires Node.js 18+ and a Cloudflare account.

```sh
git clone https://github.com/MHDLabs/TWP-CF.git
cd TWP-CF
npm install
openssl rand -hex 16          # keep this for PROXY_SECRET
npx wrangler login
npx wrangler secret put PROXY_SECRET
npm run deploy
```

Optional vars in `wrangler.toml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_TTL_SECONDS` | `300` | Session lifetime (30–600) |
| `MAX_STREAMS` | `64` | Max concurrent streams (1–128) |
| `DIAGNOSTICS` | `0` | `1` enables verbose logs |

Local development:

```sh
cp .dev.vars.example .dev.vars
npm run dev
```

---

## Security

- Never share `PROXY_SECRET`  
- Never commit secrets  
- Traffic passes through Cloudflare  

## License

Custom open-source license — see [LICENSE](LICENSE).  
Modified versions must reference https://github.com/MHDLabs/TWP-CF

## Author

- **MHDLabs** — [GitHub](https://github.com/MHDLabs) · [Telegram](https://t.me/MHDLabs)

فارسی: [README.md](README.md)

---

Thanks to [jasaz](https://github.com/itsyebekhe/jasaz) for the obfuscation idea and deploy approach.
