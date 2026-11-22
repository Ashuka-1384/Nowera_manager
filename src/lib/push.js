// مدیریت اشتراک Web Push. توکن کاربر از نشست Supabase که خود اپ در localStorage نگه می‌دارد خوانده می‌شود،
// پس نیازی به تغییر App.jsx نیست.
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const b64ToUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// توکن دسترسی نشست فعلی (یا null اگر کاربر وارد نشده)
export function getAccessToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!/^sb-.+-auth-token$/.test(key)) continue;
      const s = JSON.parse(localStorage.getItem(key));
      const session = s?.currentSession || s;
      if (session?.access_token) return session.access_token;
    }
  } catch {}
  return null;
}

export async function getPushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'subscribed' : 'idle';
}

async function api(path, body) {
  const token = getAccessToken();
  if (!token) throw new Error('ابتدا وارد حساب خود شوید.');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'نشست منقضی شده؛ دوباره وارد شوید.' : 'خطا در ارتباط با سرور.');
  return res.json();
}

// ثبت (یا به‌روزرسانی) اشتراک این دستگاه برای کاربر فعلی. اگر اجازه از قبل داده شده، بدون پرسش انجام می‌شود.
export async function syncSubscription() {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC) }));
  await api('/api/push/subscribe', { subscription: sub.toJSON() });
}

// باید مستقیماً از کلیک کاربر صدا زده شود (الزام iOS و Android)
export async function enablePush() {
  if (!pushSupported()) throw new Error('این دستگاه از اعلان پشتیبانی نمی‌کند.');
  if (!VAPID_PUBLIC) throw new Error('کلید VAPID تنظیم نشده است.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('دسترسی اعلان داده نشد.');
  await syncSubscription();
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try { await api('/api/push/unsubscribe', { endpoint: sub.endpoint }); } catch {}
  await sub.unsubscribe();
}

export const sendTestPush = () => api('/api/push/test');
