> ⚠️ **هشدار — اختلالات اینترنت ایران**
> به دلیل اختلالات شدید و پیوسته‌ی اینترنت در ایران، ممکن است این پروکسی به‌درستی کار نکند و دچار اخلال یا قطعی شود. پیش از تکیه بر آن، این موضوع را حتماً در نظر بگیرید.

# TWP-CF — پروکسی وب تلگرام روی Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MHDLabs/TWP-CF.git)

یک پروکسی وب تلگرام خودکفا (self-contained) که روی Cloudflare Workers اجرا می‌شود و با کمک یک Durable Object ترافیک بین کلاینت تلگرام و دیتاسنترهای تلگرام را از طریق MTProto رله می‌کند. **با یک کلیک مستقر می‌شود** — بدون نیاز به ترمینال — یا اگر حرفه‌ای هستید، با `wrangler` دستی.

**معماری:**

```
کلاینت تلگرام → HTTPS → Worker → WebSocket → Durable Object → TCP → DC تلگرام
```

## 🚀 شروع سریع

مسیری که مناسب شماست را انتخاب کنید:

### 🟢 مسیر A — استقرار با یک کلیک (بدون ترمینال)

فقط به یک اکانت رایگان [Cloudflare](https://dash.cloudflare.com/) نیاز دارید.

1. روی دکمه‌ی **Deploy to Cloudflare** بالا کلیک کنید ☝️
2. وارد Cloudflare شوید (اگر حساب ندارید، یک حساب رایگان بسازید).
3. یک اسم برای Worker انتخاب کنید (مثلاً `twp-cf`) و ادامه دهید.
4. 🔑 وقتی فرم `PROXY_SECRET` را خواست، مقدار **شخصی خودت** را وارد کن:
   - دقیقاً **۳۲ کاراکتر hex** (`0-9` و `a-f`)، مثلاً `0123456789abcdef0123456789abcdef`;
   - ترمینال نداری؟ از هر ژنرатор تصادفی hex معتبر آنلاین استفاده کن;
   - ترمینال داری؟ دستور `openssl rand -hex 16` را اجرا کن;
   - ⚠️ **اگر فرم از قبل مقدار نمونه دارد، آن را عوض کن** — هرگز مقدار نمونه را نگه ندار;
   - مقدارت را جایی امن نگه دار — در مرحله‌ی بعد به آن نیاز داری 📝
5. ⏳ صبر کن تا استقرار تمام شود — تمام! پروکسی شما فعال است آدرس:

   ```
   https://<worker-name>.<your-subdomain>.workers.dev
   ```

### 🔵 مسیر B — استقرار دستی با wrangler (حرفه‌ای)

پیش‌نیازها: [Node.js](https://nodejs.org/) نسخه ۱۸ به بالا و یک اکانت Cloudflare.

1. **کلون یا دانلود پروژه:**

   ```sh
   git clone https://github.com/MHDLabs/TWP-CF.git twp-cf
   cd twp-cf
   ```

2. **نصب وابستگی‌ها:**

   ```sh
   npm install
   ```

3. **تولید `PROXY_SECRET`** (دقیقاً ۳۲ کاراکتر hex):

   ```sh
   openssl rand -hex 16
   ```

4. **ورود به Cloudflare:**

   ```sh
   npx wrangler login
   ```

5. **تعریف secret** (مقدار hex مرحله‌ی قبل را هنگام پرسش وارد کنید):

   ```sh
   npx wrangler secret put PROXY_SECRET
   ```

6. **استقرار:**

   ```sh
   npm run deploy
   ```

7. **فعال‌سازی workers.dev** در داشبورد Cloudflare (Workers & Pages → Worker شما → *Settings* → *Workers.dev*) تا پروکسی در آدرس `https://<worker-name>.<subdomain>.workers.dev` در دسترس باشد.

## 📱 اضافه کردن پروکسی به تلگرام (مرحله‌ی دستی)

Cloudflare میزبانی پروکسی را انجام می‌دهد — اضافه کردنش به تلگرام را **باید دستی روی دستگاه خودتان** انجام دهید:

1. **لینک شخصی پروکسی‌تان را بسازید** — دو مقدار زیر را جایگزین کنید:

   ```
   https://t.me/webproxy?server=<worker-host>&secret=<PROXY_SECRET>
   ```

   مثال (مقادیر شما متفاوت خواهد بود 😉):

   ```
   https://t.me/webproxy?server=twp-cf.my-subdomain.workers.dev&secret=0123456789abcdef0123456789abcdef
   ```

2. **لینک را روی دستگاهی که تلگرام روی آن نصب است باز کنید** — تلگرام خودش پیشنهاد اضافه کردن پروکسی را می‌دهد. تمام 🎉

3. **یا دستی اضافه کنید** داخل تلگرام:
   - **اندروید:** Settings → Data and Storage → Proxy → ➕ Add proxy → نوع: **MTProto**
   - **دسکتاپ:** Settings → Advanced → Proxy → Add proxy → نوع: **MTProto**
   - **سرور:** `twp-cf.my-subdomain.workers.dev` · **پورت:** `443` · **secret:** همان `PROXY_SECRET` شما

> 💡 باز کردن `https://<worker-host>/` در مرورگر هم صفحه‌ی آماده‌ای با لینک پروکسی شما نشان می‌دهد که فقط کافی است کپی کنید.

## 🔄 به‌روزرسانی پروکسی

دکمه‌ی Deploy to Cloudflare این مخزن را به **Workers Builds** وصل می‌کند: هر `git push` به مخزن به‌صورت خودکار دوباره مستقر می‌شود ✅

به‌روزرسانی دستی در هر زمان: `npm run deploy`

## اجزای پروژه

| فایل | کاربرد |
| --- | --- |
| `index.js` | نقطه‌ی ورود Worker: روتینگ HTTP، احراز هویت، توکن‌های bootstrap/session، تابع `publicPage`، تابع `camouflage` و کلاس Durable Object با نام `WebProxySession` |
| `session.js` | کلاس `RelaySession`: رله‌ی فریم‌ها بین WebSocket و TCP تلگرام، چرخه‌ی عمر استریم‌ها، flow control و محدودیت‌های صف |
| `mtproxy.js` | پیاده‌سازی AES-CTR، handshake های MTProto سمت کلاینت و تلگرام، لیست آدرس‌های DC تلگرام، پارس `PROXY_SECRET` |
| `protocol.js` | تعریف فریم‌ها (`OPEN`، `DATA`، `CLOSE`، `WINDOW`، …)، توابع `encodeFrame`/`parseFrames` و ثابت‌های پروکسی |
| `bridge.js` | صفحه‌ی HTML مخصوص bridge که در iframe کلاینت تلگرام بارگذاری می‌شود و پورت اپلیکیشن را به WebSocket سرور وصل می‌کند |

## نحوه‌ی کار پروکسی

کلاینت تلگرام ابتدا صفحه‌ی `bridge` را در iframe باز می‌کند. صفحه‌ی bridge با یک درخواست `POST` کوتاه به `/api/v1/session` یک bootstrap token معتبر می‌گیرد و یک فریم `WELCOME` دریافت می‌کند. سپس از طریق WebSocket به مسیر `/api/v1/ws` متصل می‌شود. هر فریم داده توسط Worker به یک Durable Object با نام `WebProxySession` فوروارد می‌شود؛ همان‌جا handshake مخصوص MTProxy با `PROXY_SECRET` انجام می‌شود و یک اتصال TCP مستقیم به یکی از دیتاسنترهای تلگرام برقرار می‌گردد. ترافیک در هر دو جهت با AES-CTR رمزگذاری شده و با استفاده از فریم‌های `WINDOW` مدیریت flow control می‌شود. صفحه‌ی ریشه بدون نیاز به توکن، یک صفحه‌ی عمومی ساده با لینک پروکسی تلگرام نمایش می‌دهد؛ سایر مسیرها با پاسخ `404` معمولی پنهان می‌شوند (`camouflage`).

## متغیرهای محیطی

| متغیر | اجباری | پیش‌فرض | توضیح |
| --- | --- | --- | --- |
| `PROXY_SECRET` | **بله** | — | ۳۲ کاراکتر hex، یا `dd` + ۳۲ کاراکتر hex. در فرم استقرار یا با `wrangler secret put PROXY_SECRET` ست می‌شود |
| `SESSION_TTL_SECONDS` | خیر | `300` | عمر توکن session (بین ۳۰ تا ۶۰۰ ثانیه) |
| `MAX_STREAMS` | خیر | `64` | حداکثر تعداد استریم همزمان در هر session (بین ۱ تا ۱۲۸) |
| `DIAGNOSTICS` | خیر | `0` | مقدار `1` لاگ‌های مفصل رله را فعال می‌کند |

متغیرها در فایل `wrangler.toml` و بخش `[vars]` تعریف شده‌اند (به‌جز `PROXY_SECRET` که یک secret است).

## نکات امنیتی

- **`PROXY_SECRET` را با کسی به اشتراک نگذارید** — هر کسی که این کلید را داشته باشد می‌تواند از پروکسی شما استفاده کند.
- **کلید را در Git commit نکنید** — فایل‌های `.dev.vars` و `.env` در `.gitignore` هستند؛ `PROXY_SECRET` فقط در secret store کلادفلر نگهداری می‌شود.
- **ترافیک از Cloudflare عبور می‌کند** — Worker ترافیک تلگرام شما را بین کلاینت و دیتاسنترهای تلگرام رله می‌کند.

## توسعه‌ی محلی

```sh
cp .dev.vars.example .dev.vars   # سپس PROXY_SECRET را ویرایش کنید
npm run dev
```

## مجوز

مجوز اوپن‌سورس سفارشی — فایل [LICENSE](LICENSE) را ببینید. استفاده، تغییر و انتشار آزاد است؛ اما نسخه‌های تغییر‌یافته باید به مخزن اصلی ارجاع دهند: https://github.com/MHDLabs/TWP-CF.git

## نویسنده

- استودیو: **MHDLabs**
- گیت‌هاب: [github.com/MHDLabs](https://github.com/MHDLabs)
- مخزن: [github.com/MHDLabs/TWP-CF](https://github.com/MHDLabs/TWP-CF)
- تلگرام: [t.me/MHDLabs](https://t.me/MHDLabs)

---

ساخته شده با ❤️ در **MHDLabs**