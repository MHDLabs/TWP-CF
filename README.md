# TWP-CF — پروکسی وب تلگرام روی Cloudflare Workers

> ⚠️ **هشدار — اختلالات اینترنت ایران**  
> به‌خاطر اختلالات اینترنت ایران ممکن است این پروکسی ناپایدار باشد.

پروکسی خودکفا برای تلگرام که روی Cloudflare Workers + Durable Objects اجرا می‌شود و ترافیک MTProto را رله می‌کند.

```
کلاینت تلگرام → HTTPS → Worker → WebSocket → Durable Object → TCP → DC تلگرام
```

---

## روش‌های نصب

### ۱) دیپلوی خودکار (پیشنهادی)

بدون ترمینال، با یک کلیک:

**https://twp-wizard.mhdlab.workers.dev**

1. روی [ساخت Token آماده‌شده](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22user_details%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A&zoneId=all&name=TWP-CF-Deployer) کلیک کنید  
2. Continue to summary → Create Token  
3. Token را در Wizard وارد کنید و دیپلوی کنید  

بعد از موفقیت، فقط **لینک اتصال تلگرام** را کپی کنید. Token و تاریخچه دیپلوی‌ها فقط در مرورگر شما ذخیره می‌شوند.

---

### ۲) دیپلوی با لینک GitHub (دکمه رسمی Cloudflare)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MHDLabs/TWP-CF.git)

1. روی دکمه بالا کلیک کنید  
2. وارد Cloudflare شوید  
3. برای `PROXY_SECRET` دقیقاً **۳۲ کاراکتر hex** بگذارید (`openssl rand -hex 16`)  
4. منتظر اتمام دیپلوی بمانید  

آدرس نهایی:

```
https://<worker-name>.<subdomain>.workers.dev
```

لینک تلگرام:

```
https://t.me/webproxy?server=<hostname>&secret=<PROXY_SECRET>
```

---

### ۳) دیپلوی دستی با ترمینال (توسعه‌دهنده)

پیش‌نیاز: Node.js 18+ و اکانت Cloudflare.

```sh
git clone https://github.com/MHDLabs/TWP-CF.git
cd TWP-CF
npm install
openssl rand -hex 16          # خروجی را برای PROXY_SECRET نگه دارید
npx wrangler login
npx wrangler secret put PROXY_SECRET
npm run deploy
```

متغیرهای اختیاری در `wrangler.toml`:

| متغیر | پیش‌فرض | توضیح |
|--------|---------|--------|
| `SESSION_TTL_SECONDS` | `300` | عمر session (۳۰–۶۰۰) |
| `MAX_STREAMS` | `64` | حداکثر استریم همزمان (۱–۱۲۸) |
| `DIAGNOSTICS` | `0` | `1` برای لاگ مفصل |

توسعه محلی:

```sh
cp .dev.vars.example .dev.vars
npm run dev
```

---

## امنیت

- `PROXY_SECRET` را با کسی به اشتراک نگذارید  
- Secret را در Git commit نکنید  
- ترافیک از Cloudflare عبور می‌کند  

## مجوز

مجوز اوپن‌سورس سفارشی — فایل [LICENSE](LICENSE).  
نسخه‌های تغییر‌یافته باید به مخزن اصلی ارجاع دهند: https://github.com/MHDLabs/TWP-CF

## نویسنده

- **MHDLabs** — [GitHub](https://github.com/MHDLabs) · [Telegram](https://t.me/MHDLabs)

English docs: [README-En.md](README-En.md)
