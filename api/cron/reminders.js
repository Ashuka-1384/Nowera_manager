import { sb } from '../_lib/supabase.js';
import { notifyUsers } from '../_lib/notify.js';
import { departmentUsers, loadProjects } from '../_lib/recipients.js';
import { SCHEMA as S, TIMEZONE, DIGEST_HOUR } from '../_lib/schema.js';

const dayStr = (d) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const hourOf = (d) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(d)) % 24;
const clock = (iso) =>
  new Intl.DateTimeFormat('fa-IR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// هر ساعت توسط pg_cron در Supabase صدا زده می‌شود (Authorization: Bearer CRON_SECRET)
//  • یادآورهای رویداد: هر اجرا
//  • یادآورهای روزانه (تسک/پروژه): فقط در ساعت DIGEST_HOUR به وقت تهران  (برای تست: ?force=1)
export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const now = new Date();
  const today = dayStr(now);
  const tomorrow = dayStr(new Date(now.getTime() + 864e5));
  const force = req.query?.force === '1';
  const counts = {};

  // ───── یادآورهای روزانه ─────
  if (force || hourOf(now) === DIGEST_HOUR) {
    const taskFields = `${S.tasks.id}, ${S.tasks.title}, ${S.tasks.projectId}`;

    const { data: overdueTasks } = await sb.from(S.tasks.table).select(taskFields)
      .lt(S.tasks.dueDate, today).neq(S.tasks.status, S.tasks.doneValue);
    const { data: dueTasks } = await sb.from(S.tasks.table).select(taskFields)
      .eq(S.tasks.dueDate, tomorrow).neq(S.tasks.status, S.tasks.doneValue);
    const { data: overdueProjects } = await sb.from(S.projects.table).select('id')
      .lt(S.projects.deadline, today).neq(S.projects.status, S.projects.completedValue);
    const { data: dueProjects } = await sb.from(S.projects.table).select('id')
      .eq(S.projects.deadline, tomorrow).neq(S.projects.status, S.projects.completedValue);

    const projects = await loadProjects([
      ...(overdueTasks || []).map((t) => t[S.tasks.projectId]),
      ...(dueTasks || []).map((t) => t[S.tasks.projectId]),
      ...(overdueProjects || []).map((p) => p.id),
      ...(dueProjects || []).map((p) => p.id),
    ]);
    const open = (p) => p && p.status !== S.projects.completedValue; // تسک‌های پروژه‌های تمام‌شده نادیده گرفته می‌شوند

    const sendTasks = async (tasks, title, bodyFn, key) => {
      for (const t of tasks || []) {
        const p = projects.get(t[S.tasks.projectId]);
        if (!open(p)) continue;
        await notifyUsers({
          userIds: [...p.recipients], title, body: bodyFn(t, p),
          url: `/?open=project&id=${p.id}`, dedupeKey: `${key}:${t[S.tasks.id]}:${today}`,
        });
      }
    };
    await sendTasks(overdueTasks, 'تسک عقب افتاده',
      (t, p) => `«${t[S.tasks.title]}» در پروژه «${p.title}» از موعد گذشته است.`, 'task:overdue');
    await sendTasks(dueTasks, 'نزدیک شدن ددلاین تسک',
      (t, p) => `مهلت «${t[S.tasks.title]}» در پروژه «${p.title}» فردا است.`, 'task:due');

    const sendProjects = async (rows, title, bodyFn, key) => {
      for (const row of rows || []) {
        const p = projects.get(row.id);
        if (!open(p)) continue;
        await notifyUsers({
          userIds: [...p.recipients], title, body: bodyFn(p),
          url: `/?open=project&id=${p.id}`, dedupeKey: `${key}:${p.id}:${today}`,
        });
      }
    };
    await sendProjects(overdueProjects, 'پروژه عقب افتاده',
      (p) => `مهلت پروژه «${p.title}» تمام شده است.`, 'project:overdue');
    await sendProjects(dueProjects, 'نزدیک شدن ددلاین پروژه',
      (p) => `مهلت پروژه «${p.title}» فردا است.`, 'project:due');

    Object.assign(counts, {
      overdueTasks: overdueTasks?.length || 0, dueTasks: dueTasks?.length || 0,
      overdueProjects: overdueProjects?.length || 0, dueProjects: dueProjects?.length || 0,
    });
  }

  // ───── یادآور رویدادهای تقویم ─────
  const in1h = new Date(now.getTime() + 3600e3).toISOString();
  const in24h = new Date(now.getTime() + 24 * 3600e3).toISOString();
  const evFields = `${S.events.id}, ${S.events.title}, ${S.events.eventDate}, ${S.events.department}, ${S.events.createdBy}`;

  const remindEvents = async (events, title, bodyFn, key) => {
    for (const e of events || []) {
      const users = await departmentUsers(e[S.events.department]);
      await notifyUsers({
        userIds: users.length ? users : [e[S.events.createdBy]],
        title, body: bodyFn(e), url: '/?open=calendar', dedupeKey: `${key}:${e[S.events.id]}`,
      });
    }
  };

  const { data: soon } = await sb.from(S.events.table).select(evFields)
    .gte(S.events.eventDate, now.toISOString()).lte(S.events.eventDate, in1h);
  await remindEvents(soon, 'رویداد کمتر از یک ساعت دیگر',
    (e) => `«${e[S.events.title]}» ساعت ${clock(e[S.events.eventDate])} شروع می‌شود.`, 'event:soon');

  const { data: day } = await sb.from(S.events.table).select(evFields)
    .gt(S.events.eventDate, in1h).lte(S.events.eventDate, in24h);
  await remindEvents(day, 'رویداد در ۲۴ ساعت آینده',
    (e) => `«${e[S.events.title]}» ساعت ${clock(e[S.events.eventDate])} برگزار می‌شود.`, 'event:day');

  counts.eventsSoon = soon?.length || 0;
  counts.eventsDay = day?.length || 0;
  return res.status(200).json({ ok: true, counts });
}
