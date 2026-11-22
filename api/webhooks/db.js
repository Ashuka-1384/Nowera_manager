import { notifyUsers } from '../_lib/notify.js';
import { departmentUsers, loadProjects } from '../_lib/recipients.js';
import { SCHEMA as S } from '../_lib/schema.js';

// POST /api/webhooks/db — توسط تریگرهای Postgres (pg_net) صدا زده می‌شود
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).end();
  }

  const { table, type, record: r, old_record: o } = req.body || {};
  if (!r) return res.status(400).end();

  try {
    // ۱) پروژه جدید → کاربران همان دپارتمان
    if (table === S.projects.table && type === 'INSERT') {
      const users = (await departmentUsers(r[S.projects.department]))
        .filter((u) => u !== r[S.projects.createdBy]);
      await notifyUsers({
        userIds: users,
        title: 'پروژه جدید',
        body: `پروژه «${r[S.projects.title]}» ثبت شد.`,
        url: `/?open=project&id=${r[S.projects.id]}`,
        dedupeKey: `project:created:${r.id}`,
      });
    }

    // ۲) تسک جدید → سازنده و اعضای تأییدشده پروژه (به جز کسی که تسک را ساخته)
    if (table === S.tasks.table && type === 'INSERT') {
      const pid = r[S.tasks.projectId];
      const project = (await loadProjects([pid])).get(pid);
      const users = [...(project?.recipients || [])].filter((u) => u !== r[S.tasks.createdBy]);
      await notifyUsers({
        userIds: users,
        title: 'تسک جدید',
        body: `«${r[S.tasks.title]}» به پروژه «${project?.title || ''}» اضافه شد.`,
        url: `/?open=project&id=${pid}`,
        dedupeKey: `task:created:${r[S.tasks.id]}`,
      });
    }

    // ۳) عضویت در پروژه تأیید شد → خود کاربر
    if (table === S.members.table && r[S.members.status] === S.members.approvedValue) {
      const becameApproved = type === 'INSERT' || o?.[S.members.status] !== S.members.approvedValue;
      if (becameApproved) {
        const pid = r[S.members.projectId];
        const project = (await loadProjects([pid])).get(pid);
        await notifyUsers({
          userIds: [r[S.members.userId]],
          title: 'به پروژه اضافه شدید',
          body: `شما عضو پروژه «${project?.title || ''}» شدید.`,
          url: `/?open=project&id=${pid}`,
          dedupeKey: `member:approved:${pid}:${r[S.members.userId]}`,
        });
      }
    }

    // ۴) رویداد جدید تقویم → کاربران همان دپارتمان
    if (table === S.events.table && type === 'INSERT') {
      const users = (await departmentUsers(r[S.events.department]))
        .filter((u) => u !== r[S.events.createdBy]);
      await notifyUsers({
        userIds: users,
        title: 'رویداد جدید در تقویم',
        body: `«${r[S.events.title]}» ثبت شد.`,
        url: '/?open=calendar',
        dedupeKey: `event:created:${r[S.events.id]}`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook error', err);
    return res.status(500).json({ error: 'failed' });
  }
}
