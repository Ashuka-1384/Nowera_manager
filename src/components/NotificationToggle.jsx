import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { enablePush, disablePush, getPushState, sendTestPush } from '../lib/push.js';

// این کامپوننت را در صفحه تنظیمات/پروفایل بگذار:  <NotificationToggle />
export default function NotificationToggle() {
  const [state, setState] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getPushState().then(setState).catch(() => {}); }, []);

  const toggle = async () => {
    setBusy(true); setMsg('');
    try {
      if (state === 'subscribed') { await disablePush(); setState('idle'); }
      else { await enablePush(); setState('subscribed'); }
    } catch (e) {
      setMsg(e.message);
      getPushState().then(setState);
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMsg('');
    try {
      const { delivered } = await sendTestPush();
      setMsg(delivered ? 'اعلان آزمایشی ارسال شد.' : 'دستگاهی برای ارسال پیدا نشد.');
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  if (state === 'unsupported')
    return <p className="muted">این مرورگر از اعلان پشتیبانی نمی‌کند. در آیفون ابتدا برنامه را به صفحه اصلی اضافه کنید.</p>;
  if (state === 'denied')
    return <p className="muted">اعلان‌ها در تنظیمات مرورگر یا گوشی مسدود شده‌اند. از تنظیمات سایت اجازه را فعال کنید.</p>;

  const on = state === 'subscribed';
  return (
    <div className="notif-toggle">
      <button className="button button-primary" onClick={toggle} disabled={busy}>
        {on ? <BellOff size={16} /> : <Bell size={16} />}
        <span>{on ? 'خاموش کردن اعلان‌ها' : 'فعال‌سازی اعلان‌ها'}</span>
      </button>
      {on && (
        <button className="button" onClick={test} disabled={busy} style={{ marginInlineStart: 8 }}>
          <Send size={16} /><span>ارسال اعلان آزمایشی</span>
        </button>
      )}
      {msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
