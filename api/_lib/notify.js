import webpush from 'web-push';
import { sb } from './supabase.js';
import { SCHEMA as S } from './schema.js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@nowera.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

/**
 * ارسال نوتیفیکیشن به چند کاربر (روی همه دستگاه‌های ثبت‌شده‌شان).
 * dedupeKey: هر رویداد فقط یک‌بار برای هر کاربر ارسال می‌شود.
 * @returns تعداد پیام‌های تحویل‌داده‌شده
 */
export async function notifyUsers({ userIds, title, body, url = '/', dedupeKey }) {
  let targets = [...new Set((userIds || []).filter(Boolean))];
  if (!targets.length) return 0;

  if (dedupeKey) {
    const { data: sent } = await sb.from(S.notificationLog.table)
      .select('user_id').eq('dedupe_key', dedupeKey).in('user_id', targets);
    const done = new Set((sent || []).map((r) => r.user_id));
    targets = targets.filter((id) => !done.has(id));
    if (!targets.length) return 0;
  }

  const { data: subs } = await sb.from(S.pushSubs.table)
    .select('id, user_id, endpoint, p256dh, auth').in('user_id', targets);

  const payload = JSON.stringify({ title, body, url, tag: dedupeKey });
  const reached = new Set();
  let delivered = 0;

  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 24 },
      );
      delivered++;
      reached.add(s.user_id);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await sb.from(S.pushSubs.table).delete().eq('id', s.id); // اشتراک منقضی
      } else {
        console.warn('push failed', err.statusCode, err.body);
      }
    }
  }));

  // فقط برای کاربرانی که واقعاً پیام گرفته‌اند ثبت می‌کنیم؛ بقیه بار بعد دوباره امتحان می‌شوند
  if (dedupeKey && reached.size) {
    await sb.from(S.notificationLog.table).upsert(
      [...reached].map((user_id) => ({ user_id, dedupe_key: dedupeKey })),
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
    );
  }
  return delivered;
}
