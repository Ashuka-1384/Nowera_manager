# NOWERA Management Workspace

سامانه مدیریت داخلی نَوِرا برای چهار بخش **Lumen، Technoplus، Atlas و Horizen**؛ ساخته‌شده با React، Vite، Supabase Auth و PostgreSQL. رابط فارسی و راست‌چین است.

## راه‌اندازی سریع

### ۱. دیتابیس Supabase را آماده کن

1. در [Supabase](https://supabase.com/) یک پروژه بساز یا پروژه فعلی‌ات را باز کن.
2. وارد **SQL Editor → New query** شو، فایل `supabase/schema.sql` این پروژه را باز کن، کل محتوایش را کپی کن و در SQL Editor اجرا کن. اسکریپت با `CREATE ... IF NOT EXISTS` و بازسازی policyها طراحی شده تا در صورت اجرای ناقص بتوانی دوباره اجرا کنی.
3. در **Authentication → Sign In / Providers → Email** ارائه‌دهنده‌ی **Email** را روشن نگه دار و گزینه‌ی **Confirm email** را خاموش کن تا بعد از ثبت‌نام ورود فوری ممکن باشد. ثبت‌نام عمومی (**Allow new users to sign up**) نیز باید روشن باشد.
4. ارائه‌دهنده‌ی **Phone** می‌تواند خاموش بماند؛ این نسخه برای ورود به SMS یا سرویس ارسال پیامک نیاز ندارد. فرم سایت همچنان شماره موبایل می‌گیرد و کد یک شناسه‌ی داخلی ایمیلی بر اساس آن تولید می‌کند.
5. از **Project Settings → API**، مقدار **Project URL** و کلید **Publishable** یا کلید قدیمی **anon** را بردار. کلید `service_role` یا `secret` را در این پروژه وارد نکن.

### ۲. اجرا روی کامپیوتر خودت

نصب [Node.js](https://nodejs.org/) نسخه ۲۰ یا جدیدتر کافی است. در ترمینال داخل پوشه پروژه این دستورات را اجرا کن:

```bash
npm install
npm run setup
npm run diagnose
npm run dev
```

- دستور `npm run setup` آدرس و کلید Supabase را از تو می‌گیرد و فایل خصوصی `.env.local` می‌سازد.
- دستور `npm run diagnose` اتصال را واقعاً آزمایش می‌کند و مشخص می‌کند مشکل از URL/کلید، شبکه یا اجرا نشدن schema است.
- بعد از اجرای موفق، آدرس محلی را که Vite در ترمینال چاپ می‌کند باز کن.

اگر `npm run diagnose` اتصال را تأیید کرد ولی ورود یا عضویت مشکل داشت، این موارد را بررسی کن: Email provider روشن باشد، Confirm email خاموش باشد، ثبت‌نام عمومی فعال باشد و نسخه‌ی جدید `supabase/schema.sql` به‌طور کامل اجرا شده باشد.

## مدیر اصلی

**مهم:** چون SMS و تأیید شماره عمداً غیرفعال هستند، سیستم مالکیت شماره موبایل را اثبات نمی‌کند. حساب شماره `09333167279` را خودت زودتر از کاربران دیگر ثبت کن؛ اولین ثبت‌نام با آن شماره می‌تواند نقش مدیر اصلی بگیرد.

بعد از آماده شدن دیتابیس، از سایت با شماره **09333167279** ثبت‌نام کن. trigger سمت دیتابیس نقش مدیر اصلی را با تطبیق دقیق شماره بین‌المللی تنظیم می‌کند؛ فرم ثبت‌نام فیلد انتخاب نقش ندارد. اجرای مجدد schema هم حساب‌های phone-auth قبلیِ بدون پروفایل را تا حد ممکن تکمیل می‌کند.

اگر قبلاً ثبت‌نام با خطای `Failed to fetch` مواجه شده، این پرس‌وجو را در SQL Editor اجرا کن:

```sql
select id, phone
from auth.users
where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = '989333167279';
```

اگر نتیجه‌ای ندارد، حساب اصلاً در Supabase Auth ساخته نشده است؛ اول `npm run diagnose` را موفق کن و سپس دوباره ثبت‌نام کن. اگر حساب وجود دارد اما پروفایل ندارد، فایل `supabase/schema.sql` را دوباره اجرا کن تا backfill انجام شود.

## انتشار با GitHub و Vercel

1. پوشه پروژه را به یک repository در GitHub ارسال کن. فایل `.env.local` به‌وسیله `.gitignore` از Git خارج می‌ماند.
2. در [Vercel](https://vercel.com/) پروژه GitHub را از **Add New → Project** وارد کن.
3. در **Project Settings → Environment Variables** این دو متغیر را اضافه کن:
   - `VITE_SUPABASE_URL` = Project URL در Supabase
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = کلید Publishable یا anon
4. Build command را `npm run build` و Output Directory را `dist` بگذار. Vercel معمولاً این مقادیر را خودکار تشخیص می‌دهد.
5. Deploy کن. هر وقت متغیر محیطی را عوض کردی، یک redeploy انجام بده.

## امکانات

- لندینگ برندمحور، نمایش اعضای فعال، ورود و عضویت با نام، شماره موبایل، رمز عبور و انتخاب بخش.
- مدیر اصلی و مدیران بخش؛ مدیر اصلی می‌تواند مدیر بخش منصوب یا عزل کند.
- مدیریت پروژه و درخواست عضویت در پروژه.
- چندنفره بودن تسک‌ها، اولویت، وضعیت و مهلت انجام.
- تقویم رویدادهای مجزا برای بخش‌ها.
- گزارش محرمانه به مدیر اصلی.
- لوگوها و رنگ‌بندی اختصاصی تیم‌ها.

## چند نکته فنی

- شماره ورود به قالب بین‌المللی `+98...` نرمال می‌شود؛ برای Auth، همین شماره به شناسه‌ی داخلی ثابت `phone-…@login.nowera.invalid` تبدیل می‌شود.
- شماره‌های موبایل در فهرست عمومی نمایش داده نمی‌شوند.
- ورود با شماره و رمز انجام می‌شود؛ در پس‌زمینه از شناسه‌ی ایمیلی غیرقابل‌دریافت (`.invalid`) استفاده می‌شود و هیچ ایمیل یا SMS برای ثبت‌نام لازم نیست. به همین دلیل **Confirm email باید خاموش باشد**.
- عملیات «حذف عضو» حساب را غیرفعال می‌کند؛ حذف کامل کاربر از Supabase Auth از مرورگر انجام نمی‌شود.
- برای تست ساخت پروژه: `npm run check` و سپس `npm run build`.

## ساختار اصلی

```text
NOWERA-Management/
├── api/health.js
├── public/brands/           # لوگوها
├── scripts/setup.mjs        # ساخت .env.local
├── scripts/diagnose.mjs     # تست اتصال دیتابیس
├── src/App.jsx              # لندینگ و داشبورد
├── src/lib/supabase.js      # اتصال Supabase
├── src/lib/helpers.js
├── src/styles.css
├── supabase/schema.sql      # جداول، triggerها، توابع و RLS
├── .env.example
├── vercel.json
└── package.json
```


## عملیات امن مدیریت اعضا در Vercel

برای قابلیت «افزودن عضو» از پنل و «حذف دائمی عضو»، سه متغیر زیر را در **Vercel → Project → Settings → Environment Variables** برای محیط Production (و در صورت نیاز Preview) تنظیم کنید:

- `SUPABASE_URL`: آدرس پروژه Supabase
- `SUPABASE_ANON_KEY`: کلید Publishable/anon عمومی
- `SUPABASE_SERVICE_ROLE_KEY`: کلید service role فقط سمت سرور؛ هرگز آن را با پیشوند `VITE_` تعریف نکنید و در کد مرورگر قرار ندهید.

پس از افزودن متغیرها، یک deployment جدید انجام دهید. APIهای `api/admin-create-member.js` و `api/admin-delete-member.js` توکن نشست را بررسی می‌کنند و فقط برای مدیر اصلی فعال اجرا می‌شوند. افزودن عضو از پنل به فعال بودن ثبت‌نام عمومی Supabase وابسته نیست. حذف دائمی، حساب Auth را حذف می‌کند؛ سوابق ساخته‌شده توسط عضو به مدیر اصلی منتقل می‌شوند و عضویت‌های وابسته حذف می‌شوند. این عملیات قابل بازگشت نیست.

اگر ثبت‌نام عمومی صفحه ورود همچنان باید فعال باشد، در Supabase به **Authentication → Settings** بروید و گزینه **Allow new users to sign up** را فعال کنید. این تنظیم یک گزینهٔ Dashboard است و از داخل فایل‌های این پروژه قابل تغییر نیست.
