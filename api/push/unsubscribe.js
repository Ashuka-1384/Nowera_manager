import { sb, userFromRequest } from '../_lib/supabase.js';
import { SCHEMA as S } from '../_lib/schema.js';

// POST /api/push/unsubscribe — حذف اشتراک این دستگاه
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  await sb.from(S.pushSubs.table).delete()
    .eq('user_id', user.id).eq('endpoint', req.body?.endpoint || '');
  return res.status(200).json({ ok: true });
}
