<h1 dir="rtl" align="right">🛰️ TWP-CF | پروکسی تلگرام روی Cloudflare</h1>

<p dir="rtl" align="right">
  <a href="README-En.md" dir="ltr">English documentation</a>
  |
  <a href="https://github.com/MHDLabs/TWP-CF" dir="ltr">GitHub</a>
  |
  <a href="https://twp-wizard.mhdlab.workers.dev" dir="ltr">Web Wizard</a>
</p>

<p dir="rtl" align="right">
  TWP-CF ترافیک MTProto تلگرام را از طریق Cloudflare Workers به دیتاسنترهای تلگرام منتقل می‌کند. برای راه‌اندازی آن به VPS سنتی نیاز ندارید.
</p>

<p dir="rtl" align="right">
  برای نصب سریع، از راه‌انداز آنلاین پروژه استفاده کنید. اگر ترجیح می‌دهید کنترل بیشتری روی فرایند نصب داشته باشید، روش Cloudflare یا Wrangler هم در ادامه آمده است.
</p>

<blockquote dir="rtl" align="right">
  <p dir="rtl" align="right">⚠️ وضعیت اتصال به Cloudflare و دیتاسنترهای تلگرام به شرایط شبکه بستگی دارد. در ایران ممکن است با اختلال یا قطعی روبه‌رو شوید. پروژه دسترسی دائمی را تضمین نمی‌کند.</p>
</blockquote>

<h2 dir="rtl" align="right">⚙️ TWP-CF چطور کار می‌کند؟</h2>

<p dir="rtl" align="right">
  Worker درخواست را دریافت می‌کند، یک نشست در Durable Objects می‌سازد و ارتباط WebSocket را به رله‌ی TCP وصل می‌کند.
</p>

<pre dir="ltr"><code>Telegram client
      │ HTTPS
      ▼
Cloudflare Worker
      │ WebSocket
      ▼
Durable Object (WebProxySession)
      │ TCP
      ▼
Telegram Data Center</code></pre>

<h2 dir="rtl" align="right">✨ امکانات اصلی</h2>

<ul dir="rtl" align="right">
  <li>اجرای هسته‌ی پروکسی روی Cloudflare Workers</li>
  <li>انتقال ترافیک MTProto با WebSocket و TCP</li>
  <li>مدیریت نشست‌ها با Durable Objects و فضای ذخیره‌سازی SQLite</li>
  <li>کنترل جریان داده و محدودیت تعداد استریم‌های هم‌زمان</li>
  <li>ساخت خودکار لینک اتصال تلگرام</li>
  <li>راه‌اندازی و مدیریت Worker از طریق Web Wizard</li>
  <li>امکان نصب با دکمه‌ی Cloudflare یا ابزار Wrangler</li>
</ul>

<h2 dir="rtl" align="right">🚀 نصب سریع با Web Wizard</h2>

<p dir="rtl" align="right">
  این روش برای بیشتر کاربران ساده‌تر است و به ترمینال نیاز ندارد.
</p>

<p dir="rtl" align="right">
  <a href="https://twp-wizard.mhdlab.workers.dev" dir="ltr">باز کردن TWP-CF Web Wizard ↗</a>
</p>

<ol dir="rtl" align="right">
  <li>
    از <a href="https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22user_details%22%2C%22type%22%3A%22read%22%7D%5D&amp;accountId=%2A&amp;zoneId=all&amp;name=TWP-CF-Deployer" dir="ltr">صفحه‌ی ساخت API Token</a> یک Token بسازید. قبل از تأیید، دسترسی‌ها و محدوده‌ی حساب را در Cloudflare بررسی کنید.
  </li>
  <li>Token را در Wizard وارد کنید. می‌توانید نام Worker را خودتان انتخاب کنید یا نام پیشنهادی را نگه دارید.</li>
  <li>روی شروع دیپلوی بزنید و مراحل را در لاگ زنده دنبال کنید.</li>
  <li>بعد از پایان موفق، لینک اتصال تلگرام را کپی کنید و روی دستگاهی که تلگرام دارد باز کنید.</li>
</ol>

<p dir="rtl" align="right">
  Wizard خودش یک مقدار تصادفی برای <code dir="ltr">PROXY_SECRET</code> می‌سازد و آن را در Cloudflare ثبت می‌کند.
</p>

<h3 dir="rtl" align="right">🧰 مدیریت Workerها</h3>

<p dir="rtl" align="right">بعد از نصب، تاریخچه‌ی دیپلوی‌ها در همان مرورگر نمایش داده می‌شود. از کارت هر Worker این کارها را انجام دهید:</p>

<ul dir="rtl" align="right">
  <li>کپی لینک اتصال تلگرام</li>
  <li>بررسی پاسخ‌گویی HTTP با گزینه‌ی تست زنده</li>
  <li>ساخت و ثبت <code dir="ltr">PROXY_SECRET</code> جدید</li>
  <li>حذف Worker از حساب Cloudflare</li>
</ul>

<p dir="rtl" align="right">
  تست زنده فقط بررسی می‌کند که میزبان Worker پاسخ HTTP می‌دهد یا نه. این تست، اتصال MTProto تا تلگرام را بررسی نمی‌کند. با تغییر Secret، لینک‌های قبلی همان Worker هم از اعتبار خارج می‌شوند.
</p>

<h2 dir="rtl" align="right">🛠️ روش‌های نصب دیگر</h2>

<h3 dir="rtl" align="right">۱. نصب با دکمه‌ی رسمی Cloudflare</h3>

<p dir="rtl" align="right">روی دکمه‌ی زیر بزنید و مراحل Cloudflare را ادامه دهید.</p>

<p dir="ltr" align="left">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/MHDLabs/TWP-CF.git">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare">
  </a>
</p>

<p dir="rtl" align="right">
  هنگام تنظیم Worker، مقدار <code dir="ltr">PROXY_SECRET</code> را به‌صورت Secret ثبت کنید. مقدار باید ۳۲ کاراکتر hex کوچک باشد. برای ساخت مقدار تصادفی از این دستور استفاده کنید:
</p>

<pre dir="ltr"><code>openssl rand -hex 16</code></pre>

<h3 dir="rtl" align="right">۲. نصب دستی با Wrangler</h3>

<p dir="rtl" align="right">
  به Node.js نسخه‌ی ۱۸ یا بالاتر و یک حساب Cloudflare نیاز دارید.
</p>

<pre dir="ltr"><code>git clone https://github.com/MHDLabs/TWP-CF.git
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

<p dir="rtl" align="right">
  وقتی Wrangler مقدار Secret را خواست، خروجی دستور <code dir="ltr">openssl</code> را وارد کنید. این مقدار را در فایل عمومی یا مخزن Git قرار ندهید.
</p>

<h3 dir="rtl" align="right">🧪 اجرای محلی برای توسعه</h3>

<p dir="rtl" align="right">
  فایل نمونه را کپی کنید و مقدار نمونه‌ی <code dir="ltr">PROXY_SECRET</code> را با یک مقدار تصادفی مخصوص خودتان عوض کنید.
</p>

<pre dir="ltr"><code>cp .dev.vars.example .dev.vars
npm install
npm run dev</code></pre>

<p dir="rtl" align="right">
  فایل <code dir="ltr">.dev.vars</code> شامل اطلاعات محرمانه است. آن را در Git ثبت نکنید.
</p>

<h2 dir="rtl" align="right">📲 اتصال تلگرام</h2>

<p dir="rtl" align="right">
  بعد از نصب، لینک اختصاصی پروکسی را از Wizard بردارید. ساختار لینک به این شکل است:
</p>

<pre dir="ltr"><code>https://t.me/webproxy?server=&lt;worker-host&gt;&amp;secret=&lt;PROXY_SECRET&gt;</code></pre>

<p dir="rtl" align="right">
  لینک را در دستگاهی که تلگرام روی آن نصب است باز کنید و افزودن پروکسی را تأیید کنید.
</p>

<p dir="rtl" align="right">
  🔒 لینک اتصال و مقدار <code dir="ltr">PROXY_SECRET</code> را عمومی نکنید. هر کسی این اطلاعات را داشته باشد، امکان استفاده از پروکسی شما را دارد.
</p>

<h2 dir="rtl" align="right">🔧 تنظیمات</h2>

<p dir="rtl" align="right">
  مقادیر زیر در <code dir="ltr">wrangler.toml</code> تعریف شده‌اند. برای ثبت Secret در Cloudflare از دستور <code dir="ltr">npx wrangler secret put PROXY_SECRET</code> استفاده کنید.
</p>

<table dir="rtl" align="right">
  <thead>
    <tr>
      <th align="right">متغیر</th>
      <th align="right">پیش‌فرض</th>
      <th align="right">توضیح</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code dir="ltr">PROXY_SECRET</code></td>
      <td>ندارد</td>
      <td>الزامی است. ۳۲ کاراکتر hex کوچک یا پیشوند <code dir="ltr">dd</code> به‌همراه ۳۲ کاراکتر hex</td>
    </tr>
    <tr>
      <td><code dir="ltr">SESSION_TTL_SECONDS</code></td>
      <td><code dir="ltr">300</code></td>
      <td>عمر نشست اولیه، از ۳۰ تا ۶۰۰ ثانیه</td>
    </tr>
    <tr>
      <td><code dir="ltr">MAX_STREAMS</code></td>
      <td><code dir="ltr">64</code></td>
      <td>حداکثر استریم هم‌زمان در هر نشست، از ۱ تا ۱۲۸</td>
    </tr>
    <tr>
      <td><code dir="ltr">DIAGNOSTICS</code></td>
      <td><code dir="ltr">0</code></td>
      <td>با مقدار <code dir="ltr">1</code> لاگ تشخیصی فعال می‌شود</td>
    </tr>
  </tbody>
</table>

<p dir="rtl" align="right">
  مقدار <code dir="ltr">PROXY_SECRET</code> را داخل بخش <code dir="ltr">[vars]</code> یا فایل‌های عمومی قرار ندهید.
</p>

<h3 dir="rtl" align="right">قالب‌های Secret</h3>

<ul dir="rtl" align="right">
  <li><code dir="ltr">Plain</code>: دقیقاً ۳۲ کاراکتر hex کوچک</li>
  <li><code dir="ltr">DD</code>: پیشوند <code dir="ltr">dd</code> و سپس ۳۲ کاراکتر hex کوچک</li>
  <li><code dir="ltr">FakeTLS</code>: در حالت Web Proxy پشتیبانی نمی‌شود</li>
</ul>

<p dir="rtl" align="right">
  Wizard به‌صورت خودکار Secret از نوع Plain تولید می‌کند.
</p>

<h2 dir="rtl" align="right">📁 فایل‌های اصلی پروژه</h2>

<ul dir="rtl" align="right">
  <li><code dir="ltr">index.js</code>، ورودی Worker و مدیریت درخواست‌ها</li>
  <li><code dir="ltr">session.js</code>، مدیریت نشست‌ها و استریم‌های Durable Object</li>
  <li><code dir="ltr">mtproxy.js</code>، دست‌دهی MTProto و رمزنگاری AES-CTR</li>
  <li><code dir="ltr">protocol.js</code>، تعریف و پردازش فریم‌های پروتکل داخلی</li>
  <li><code dir="ltr">bridge.js</code>، ارتباط Bridge با نشست WebSocket</li>
  <li><code dir="ltr">wizard/</code>، رابط وب و API راه‌انداز</li>
  <li><code dir="ltr">wrangler.toml</code>، تنظیمات Cloudflare Workers و Durable Objects</li>
</ul>

<h2 dir="rtl" align="right">🔐 امنیت و حریم خصوصی</h2>

<h3 dir="rtl" align="right">API Token در Web Wizard</h3>

<p dir="rtl" align="right">
  Wizard برای ساخت Worker، تغییر Secret و حذف Worker از API حساب Cloudflare استفاده می‌کند. به همین دلیل Token واردشده در درخواست به Backend راه‌انداز فرستاده می‌شود تا عملیات Cloudflare انجام شود.
</p>

<ul dir="rtl" align="right">
  <li>رابط Wizard، Token را در <code dir="ltr">localStorage</code> مرورگر ذخیره می‌کند تا برای عملیات بعدی در دسترس باشد.</li>
  <li>تاریخچه‌ی دیپلوی‌ها، لینک اتصال و مقدار <code dir="ltr">PROXY_SECRET</code> هم در حافظه‌ی محلی همان مرورگر ذخیره می‌شوند.</li>
  <li>در کد فعلی Wizard، تاریخچه به پایگاه داده‌ی مرکزی کاربران منتقل نمی‌شود. بااین‌حال Token هنگام اجرای عملیات از Backend راه‌انداز عبور می‌کند.</li>
</ul>

<p dir="rtl" align="right">
  روی سیستم عمومی یا مرورگر مشترک از Wizard استفاده نکنید. یک Token اختصاصی با دسترسی محدود بسازید و پس از پایان کار، آن را از حساب Cloudflare لغو کنید. با لغو Token، عملیات مدیریتی وابسته به آن دیگر کار نمی‌کنند.
</p>

<h3 dir="rtl" align="right">ترافیک پروکسی</h3>

<ul dir="rtl" align="right">
  <li>ترافیک کلاینت از زیرساخت Cloudflare عبور می‌کند.</li>
  <li>مقدار <code dir="ltr">PROXY_SECRET</code> را محرمانه نگه دارید و در Git ثبت نکنید.</li>
  <li>مسیر <code dir="ltr">/healthz</code> پاسخ‌گویی Worker را بررسی می‌کند، نه اتصال کامل به دیتاسنتر تلگرام.</li>
  <li>باز کردن آدرس اصلی Worker ممکن است پاسخ <code dir="ltr">404</code> بدهد. این پاسخ به‌تنهایی به معنی خرابی Worker نیست.</li>
</ul>

<h2 dir="rtl" align="right">🩺 عیب‌یابی سریع</h2>

<table dir="rtl" align="right">
  <thead>
    <tr>
      <th align="right">مشکل</th>
      <th align="right">چه چیزی را بررسی کنید؟</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>خطای Token یا Permission</td>
      <td>اعتبار Token، دسترسی‌ها و حساب انتخاب‌شده در Cloudflare را بررسی کنید.</td>
    </tr>
    <tr>
      <td>Worker باز نمی‌شود</td>
      <td>وضعیت دیپلوی و فعال بودن زیردامنه‌ی <code dir="ltr">workers.dev</code> را بررسی کنید.</td>
    </tr>
    <tr>
      <td>تست زنده موفق است، اما تلگرام وصل نمی‌شود</td>
      <td>تست زنده فقط HTTP را بررسی می‌کند. Secret، لینک اتصال و وضعیت شبکه را بررسی کنید.</td>
    </tr>
    <tr>
      <td>اتصال ناپایدار است</td>
      <td>محدودیت شبکه، دسترسی به Cloudflare و ارتباط با دیتاسنترهای تلگرام را بررسی کنید.</td>
    </tr>
  </tbody>
</table>

<h2 dir="rtl" align="right">📜 مجوز استفاده</h2>

<p dir="rtl" align="right">
  TWP-CF تحت مجوز <strong>GNU General Public License نسخهٔ ۳.۰ (GPL-3.0-only)</strong> منتشر می‌شود.
</p>

<p dir="rtl" align="right">
  Copyright © 2026 MHDLabs (Mahdi).
</p>

<p dir="rtl" align="right">
  استفاده، بررسی، تغییر و بازتوزیع این نرم‌افزار، از جمله برای اهداف تجاری، با رعایت شرایط GPL-3.0 مجاز است. هنگام توزیع نسخهٔ اصلی یا تغییریافته، باید اعلان‌های حق نشر و متن مجوز حفظ شوند و کد منبع متناظر مطابق GPL در اختیار دریافت‌کنندگان قرار گیرد. صرف اجرای نرم‌افزار به‌صورت یک سرویس شبکه‌ای، بدون انتقال نسخه‌ای از آن، به‌تنهایی الزام انتشار کد منبع تحت GPL-3.0 ایجاد نمی‌کند. متن کامل مجوز در فایل <a href="LICENSE" dir="ltr">LICENSE</a> قرار دارد.
</p>

<h2 dir="rtl" align="right">🤝 مشارکت و ارتباط</h2>

<ul dir="rtl" align="right">
  <li>مخزن پروژه: <a href="https://github.com/MHDLabs/TWP-CF" dir="ltr">MHDLabs/TWP-CF</a></li>
  <li>سازنده: <a href="https://github.com/MHDLabs" dir="ltr">MHDLabs</a></li>
  <li>تلگرام: <a href="https://t.me/MHDLabs" dir="ltr">@MHDLabs</a></li>
</ul>

<p dir="rtl" align="right">ساخته‌شده با ❤️ در MHDLabs</p>