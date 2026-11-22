import { userFromRequest } from '../_lib/supabase.js';
import { notifyUsers } from '../_lib/notify.js';

// POST /api/push/test — ارسال اعلان آزمایشی به همه دستگاه‌های خود کاربر
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const delivered = await notifyUsers({
    userIds: [user.id],
    title: 'NOWERA',
    body: 'اعلان‌ها با موفقیت فعال شد ✅',
    url: '/',
  });
  return res.status(200).json({ ok: true, delivered });
}
