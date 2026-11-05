<h1>🛰️ TWP-CF | Telegram Proxy on Cloudflare</h1>

<p>
  <a href="README.md">فارسی</a>
  |
  <a href="https://github.com/MHDLabs/TWP-CF">GitHub</a>
  |
  <a href="https://twp-wizard.mhdlab.workers.dev">Web Wizard</a>
</p>

<p>
  TWP-CF relays Telegram MTProto traffic through Cloudflare Workers to Telegram data centers. You do not need a traditional VPS to run it.
</p>

<p>
  The online Wizard provides the simplest deployment path. Use Cloudflare's deploy button or Wrangler for a manual setup.
</p>

<blockquote>
  ⚠️ Connectivity to Cloudflare and Telegram data centers depends on your network. Users connecting from Iran sometimes face interruptions. TWP-CF does not promise permanent availability.
</blockquote>

<h2>⚙️ How it works</h2>

<p>
  The Worker receives the request, creates a session in a Durable Object, and connects the WebSocket relay to Telegram over TCP.
</p>

<pre><code>Telegram client
      │ HTTPS
      ▼
Cloudflare Worker
      │ WebSocket
      ▼
Durable Object (WebProxySession)
      │ TCP
      ▼
Telegram Data Center</code></pre>

<h2>✨ Features</h2>

<ul>
  <li>Runs the proxy core on Cloudflare Workers.</li>
  <li>Relays MTProto traffic over WebSocket and TCP.</li>
  <li>Manages sessions with Durable Objects and SQLite-backed storage.</li>
  <li>Controls data flow and limits concurrent streams.</li>
  <li>Generates a Telegram connection link for your Worker.</li>
  <li>Deploys and manages Workers through the Web Wizard.</li>
  <li>Supports Cloudflare's deploy button and manual Wrangler deployment.</li>
</ul>

<h2>🚀 Quick setup with the Web Wizard</h2>

<p>
  This is the recommended setup for most users. You do not need a terminal.
</p>

<p><a href="https://twp-wizard.mhdlab.workers.dev">Open TWP-CF Web Wizard ↗</a></p>

<ol>
  <li>
    Create an API Token from the <a href="https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22user_details%22%2C%22type%22%3A%22read%22%7D%5D&amp;accountId=%2A&amp;zoneId=all&amp;name=TWP-CF-Deployer">Cloudflare token page</a>. Review the permissions and account scope before you create it.
  </li>
  <li>Paste the token into the Wizard. Choose a Worker name or keep the suggested name.</li>
  <li>Start deployment and follow the live progress log.</li>
  <li>When deployment completes, copy your Telegram connection link and open it on a device with Telegram installed.</li>
</ol>

<p>
  The Wizard generates a random <code>PROXY_SECRET</code> and saves it as a Cloudflare secret for your Worker.
</p>

<h3>🧰 Manage your Workers</h3>

<p>After deployment, the Wizard shows your deployment history in the same browser. Each Worker card gives you these actions:</p>

<ul>
  <li>Copy the Telegram connection link.</li>
  <li>Check HTTP reachability with Live Probe.</li>
  <li>Generate and set a new <code>PROXY_SECRET</code>.</li>
  <li>Delete the Worker from your Cloudflare account.</li>
</ul>

<p>
  Live Probe checks whether the Worker host returns an HTTP response. It does not test the full MTProto connection to Telegram. Resetting the secret also invalidates the previous connection links for the Worker.
</p>

<h2>🛠️ Other deployment options</h2>

<h3>1. Deploy with Cloudflare</h3>

<p>Use the button below and follow the Cloudflare setup steps.</p>

<p>
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/MHDLabs/TWP-CF.git">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare">
  </a>
</p>

<p>
  Set <code>PROXY_SECRET</code> as a Worker secret. It must contain exactly 32 lowercase hexadecimal characters. Generate one with:
</p>

<pre><code>openssl rand -hex 16</code></pre>

<h3>2. Deploy with Wrangler</h3>

<p>You need Node.js 18 or later and a Cloudflare account.</p>

<pre><code>git clone https://github.com/MHDLabs/TWP-CF.git
cd TWP-CF
npm install

# Generate a random secret
openssl rand -hex 16

# Sign in to Cloudflare
npx wrangler login

# Save the secret
npx wrangler secret put PROXY_SECRET

# Deploy
npm run deploy</code></pre>

<p>
  Enter the value printed by <code>openssl</code> when Wrangler asks for the secret. Do not put it in a public file or commit it to Git.
</p>

<h3>🧪 Local development</h3>

<p>Copy the example file and replace its sample <code>PROXY_SECRET</code> with a random value of your own.</p>

<pre><code>cp .dev.vars.example .dev.vars
npm install
npm run dev</code></pre>

<p>The <code>.dev.vars</code> file contains a secret. Keep it out of Git.</p>

<h2>📲 Connect Telegram</h2>

<p>After deployment, copy the personal connection link from the Wizard. It follows this format:</p>

<pre><code>https://t.me/webproxy?server=&lt;worker-host&gt;&amp;secret=&lt;PROXY_SECRET&gt;</code></pre>

<p>Open the link on a device with Telegram installed, then confirm the prompt to add the proxy.</p>

<p>🔒 Keep your connection link and <code>PROXY_SECRET</code> private. Anyone with this link and secret has the credentials needed to use your proxy.</p>

<h2>🔧 Configuration</h2>

<p>
  The following settings are defined in <code>wrangler.toml</code>. Store <code>PROXY_SECRET</code> with <code>npx wrangler secret put PROXY_SECRET</code>.
</p>

<table>
  <thead>
    <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>PROXY_SECRET</code></td><td>None</td><td>Required. 32 lowercase hex characters, or <code>dd</code> followed by 32 lowercase hex characters.</td></tr>
    <tr><td><code>SESSION_TTL_SECONDS</code></td><td><code>300</code></td><td>Bootstrap session lifetime, from 30 to 600 seconds.</td></tr>
    <tr><td><code>MAX_STREAMS</code></td><td><code>64</code></td><td>Maximum concurrent streams per session, from 1 to 128.</td></tr>
    <tr><td><code>DIAGNOSTICS</code></td><td><code>0</code></td><td>Set to <code>1</code> to enable diagnostic logs.</td></tr>
  </tbody>
</table>

<p>Do not put <code>PROXY_SECRET</code> under <code>[vars]</code> or commit it to the repository.</p>

<h3>Supported secret formats</h3>

<ul>
  <li><code>Plain</code>: exactly 32 lowercase hexadecimal characters.</li>
  <li><code>DD</code>: the <code>dd</code> prefix followed by 32 lowercase hexadecimal characters.</li>
  <li><code>FakeTLS</code>: not supported in Web Proxy mode.</li>
</ul>

<p>The Wizard generates a Plain secret automatically.</p>

<h2>📁 Project files</h2>

<table>
  <thead>
    <tr><th>Path</th><th>Purpose</th></tr>
  </thead>
  <tbody>
    <tr><td><code>index.js</code></td><td>Worker entry point and request handling.</td></tr>
    <tr><td><code>session.js</code></td><td>Durable Object sessions and streams.</td></tr>
    <tr><td><code>mtproxy.js</code></td><td>MTProto handshake and AES-CTR encryption.</td></tr>
    <tr><td><code>protocol.js</code></td><td>Internal protocol frames and parsing.</td></tr>
    <tr><td><code>bridge.js</code></td><td>Bridge between the client and WebSocket session.</td></tr>
    <tr><td><code>wizard/</code></td><td>Web deployer and its API.</td></tr>
    <tr><td><code>wrangler.toml</code></td><td>Cloudflare Workers and Durable Objects configuration.</td></tr>
  </tbody>
</table>

<h2>🔐 Security and privacy</h2>

<h3>API Tokens in the Web Wizard</h3>

<p>
  The Wizard uses the Cloudflare API to create Workers, update secrets, and delete Workers. The token you enter is sent in a request to the Wizard backend, which uses it to perform the requested Cloudflare operation.
</p>

<ul>
  <li>The Wizard UI saves the token in the current browser's <code>localStorage</code> so it is available for later actions.</li>
  <li>Deployment history, connection links, and <code>PROXY_SECRET</code> values are also stored in the browser's local storage.</li>
  <li>The current Wizard code does not send deployment history to a central user-history database. The token still passes through the Wizard backend during an operation.</li>
</ul>

<p>
  Do not use the Wizard on a public or shared computer. Create a dedicated API Token with limited permissions. Revoke it from Cloudflare when you no longer need the Wizard's management features. Token-based actions stop working after revocation.
</p>

<h3>Proxy traffic</h3>

<ul>
  <li>Client traffic passes through Cloudflare infrastructure.</li>
  <li>Keep <code>PROXY_SECRET</code> private and out of Git.</li>
  <li>The <code>/healthz</code> endpoint checks whether the Worker responds. It does not verify a full connection to a Telegram data center.</li>
  <li>The Worker root path returns <code>404</code> for requests without valid Telegram or bridge parameters. This response alone does not mean the Worker is down.</li>
</ul>

<h2>🩺 Troubleshooting</h2>

<table>
  <thead>
    <tr><th>Problem</th><th>What to check</th></tr>
  </thead>
  <tbody>
    <tr><td>Token or permission error</td><td>Check the token, its permissions, and the selected Cloudflare account.</td></tr>
    <tr><td>Worker does not respond</td><td>Check deployment status and whether the <code>workers.dev</code> subdomain is enabled.</td></tr>
    <tr><td>Live Probe succeeds, but Telegram does not connect</td><td>Live Probe checks HTTP only. Check the secret, connection link, and network access.</td></tr>
    <tr><td>Unstable connection</td><td>Check network restrictions, Cloudflare access, and connectivity to Telegram data centers.</td></tr>
  </tbody>
</table>

<h2>📜 License</h2>

<p>
  TWP-CF is licensed under the <strong>GNU General Public License v3.0 only (GPL-3.0-only)</strong>.
</p>

<p>
  Copyright © 2026 MHDLabs (Mahdi).
</p>

<p>
  You may use, study, modify, and redistribute this software, including for commercial purposes, subject to the terms of GPL-3.0. When distributing the original or a modified version, you must preserve applicable copyright and license notices and provide the Corresponding Source as required by the license. Merely running the software as a network service, without conveying a copy, does not by itself trigger GPL-3.0 source-distribution obligations. See <a href="LICENSE">LICENSE</a> for the complete license text.
</p>

<h2>🤝 Contributions and contact</h2>

<ul>
  <li>Repository: <a href="https://github.com/MHDLabs/TWP-CF">MHDLabs/TWP-CF</a></li>
  <li>Maintainer: <a href="https://github.com/MHDLabs">MHDLabs</a></li>
  <li>Telegram: <a href="https://t.me/MHDLabs">@MHDLabs</a></li>
</ul>

<p>Made with ❤️ by MHDLabs</p>