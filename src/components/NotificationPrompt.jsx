import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { enablePush, syncSubscription, getAccessToken, pushSupported } from '../lib/push.js';

const DISMISS_KEY = 'nowera:notif-prompt-dismissed';
const DAYS = 3;

// بعد از ورود کاربر، یک نوار کوچک برای فعال‌سازی اعلان نشان می‌دهد.
// اگر اجازه قبلاً داده شده باشد، اشتراک دستگاه بی‌صدا به کاربر فعلی وصل می‌شود.
export default function NotificationPrompt() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DAYS * 864e5; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // وضعیت ورود را سبک و دوره‌ای بررسی می‌کنیم (بدون وابستگی به App.jsx)
  useEffect(() => {
    const check = () => setLoggedIn(Boolean(getAccessToken()));
    check();
    const t = setInterval(check, 3000);
    window.addEventListener('storage', check);
    return () => { clearInterval(t); window.removeEventListener('storage', check); };
  }, []);

  // اجازه قبلاً داده شده → اشتراک را با کاربر فعلی همگام کن
  useEffect(() => {
    if (!loggedIn || !pushSupported() || Notification.permission !== 'granted') return;
    syncSubscription().catch(() => {});
  }, [loggedIn]);

  // اگر مرورگر اشتراک را تازه کرد
  useEffect(() => {
    if (!pushSupported()) return;
    const onMsg = (e) => { if (e.data?.type === 'PUSH_RESUBSCRIBE') syncSubscription().catch(() => {}); };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  const enable = async () => {
    setBusy(true);
    try { await enablePush(); setDone(true); } catch { dismiss(); } finally { setBusy(false); }
  };

  if (!loggedIn || hidden || done || !pushSupported() || Notification.permission !== 'default') return null;

  return (
    <div className="pwa-banner" role="dialog" aria-label="فعال‌سازی اعلان"
         style={{ bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 68px)' }}>
      <Bell size={18} />
      <span>برای دریافت اعلان پروژه‌ها، تسک‌ها و رویدادها اعلان را فعال کن.</span>
      <button className="button button-primary button-small" onClick={enable} disabled={busy}>فعال‌سازی</button>
      <button className="pwa-banner-close" onClick={dismiss} aria-label="بستن"><X size={15} /></button>
    </div>
  );
}
