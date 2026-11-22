-- ════════════════════════════════════════════════════════════════════
--  NOWERA · نوتیفیکیشن  — این فایل را کامل در Supabase → SQL Editor اجرا کن.
--  قابل اجرای مجدد است (idempotent).
--
--  ⚠️ فقط سه مقدار «بخش ۱» را قبل از اجرا ویرایش کن.
-- ════════════════════════════════════════════════════════════════════

-- ───── بخش ۰: جدول‌ها ─────
create table if not exists public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

create table if not exists public.notification_log (
  user_id     uuid not null references auth.users(id) on delete cascade,
  dedupe_key  text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, dedupe_key)
);

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

-- فعال‌سازی RLS بدون هیچ policy: فقط سرور (service role) دسترسی دارد
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;
alter table public.app_config         enable row level security;

-- ───── بخش ۱: مقادیر را ویرایش کن ─────
insert into public.app_config (key, value) values
  ('site_url',       'https://YOUR-DOMAIN.vercel.app'),   -- آدرس سایت در Vercel، بدون / آخر
  ('webhook_secret', 'PUT-WEBHOOK_SECRET-HERE'),          -- همان WEBHOOK_SECRET در Vercel
  ('cron_secret',    'PUT-CRON_SECRET-HERE')              -- همان CRON_SECRET در Vercel
on conflict (key) do update set value = excluded.value;

-- ───── بخش ۲: توابع و تریگرها (نیازی به ویرایش نیست) ─────
create extension if not exists pg_net;

create or replace function public.app_cfg(k text) returns text
language sql security definer stable set search_path = public as $$
  select value from public.app_config where key = k
$$;
revoke all on function public.app_cfg(text) from public, anon, authenticated;

create or replace function public.notify_webhook() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := public.app_cfg('site_url') || '/api/webhooks/db',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', public.app_cfg('webhook_secret')),
    body    := jsonb_build_object(
                 'table', TG_TABLE_NAME,
                 'type', TG_OP,
                 'record', to_jsonb(NEW),
                 'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end)
  );
  return NEW;
exception when others then
  -- خطای اعلان هرگز نباید ثبت پروژه/تسک را خراب کند
  raise warning 'notify_webhook failed: %', sqlerrm;
  return NEW;
end $$;

drop trigger if exists trg_notify_projects on public.projects;
create trigger trg_notify_projects after insert on public.projects
  for each row execute function public.notify_webhook();

drop trigger if exists trg_notify_tasks on public.tasks;
create trigger trg_notify_tasks after insert on public.tasks
  for each row execute function public.notify_webhook();

drop trigger if exists trg_notify_events on public.events;
create trigger trg_notify_events after insert on public.events
  for each row execute function public.notify_webhook();

drop trigger if exists trg_notify_members on public.project_members;
create trigger trg_notify_members after insert or update of status on public.project_members
  for each row execute function public.notify_webhook();

-- ───── بخش ۳: زمان‌بندی ساعتی یادآورها (رایگان، با pg_cron) ─────
create extension if not exists pg_cron;

do $$ begin perform cron.unschedule('nowera-reminders');
exception when others then null; end $$;

select cron.schedule(
  'nowera-reminders',
  '0 * * * *',
  $cron$
    select net.http_post(
      url     := public.app_cfg('site_url') || '/api/cron/reminders',
      headers := jsonb_build_object('Authorization', 'Bearer ' || public.app_cfg('cron_secret')),
      body    := '{}'::jsonb
    );
  $cron$
);
