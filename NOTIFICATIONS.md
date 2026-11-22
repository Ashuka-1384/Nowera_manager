# راه‌اندازی نوتیفیکیشن NOWERA

## ۱) فایل‌ها را در پروژه کپی کن
محتوای این zip را روی پوشه پروژه بریز (فایل‌های موجود مثل sw.js و main.jsx و vercel.json جایگزین می‌شوند)، سپس:

    npm i web-push @supabase/supabase-js

## ۲) متغیرهای Vercel
Settings → Environment Variables؛ همه موارد `.env.example` را (با مقادیر خودت) اضافه کن.
هر متغیر را جدا و فقط با مقدار خودش وارد کن (بدون توضیح و کامنت جلویش).

## ۳) دیتابیس
فایل `supabase/migrations/20260101_notifications.sql` را باز کن، در «بخش ۱» سه مقدار را عوض کن:
`site_url`، `webhook_secret`، `cron_secret` — و کل فایل را در SQL Editor اجرا کن.

## ۴) Deploy
بعد از ست کردن متغیرها، یک Redeploy بزن.

## ۵) تست
1. در اپ وارد شو؛ نوار «فعال‌سازی اعلان» ظاهر می‌شود. قبولش کن.
2. (اختیاری) `<NotificationToggle />` را در صفحه تنظیمات بگذار تا دکمه «ارسال اعلان آزمایشی» هم داشته باشی.
3. با حساب دیگر (همان دپارتمان) یک پروژه/تسک/رویداد بساز.
4. تست یادآورها:
   curl -H "Authorization: Bearer CRON_SECRET" "https://دامنه/api/cron/reminders?force=1"
5. لاگ: `select * from notification_log order by created_at desc;`
   پاسخ‌های وب‌هوک: `select * from net._http_response order by created desc limit 10;`
