import { sb, userFromRequest } from '../_lib/supabase.js';
import { SCHEMA as S } from '../_lib/schema.js';

// POST /api/push/subscribe — ثبت اشتراک این دستگاه برای کاربر واردشده
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'invalid subscription' });
  }

  // endpoint یکتاست؛ اگر کاربر دیگری با همین دستگاه وارد شود، مالکیت به او منتقل می‌شود
  const { error } = await sb.from(S.pushSubs.table).upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: req.headers['user-agent'] || null,
  }, { onConflict: 'endpoint' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
