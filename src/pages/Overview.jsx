import React, { useMemo } from 'react';
import {
  ArrowLeft, Bell, Briefcase, CalendarDays, CheckCheck, ClipboardList, Clock3, Flag, FolderKanban,
  Plus, Sparkles, Users,
} from 'lucide-react';
import { DEPARTMENTS, PRIORITY, dueState, faDate, getDepartment, isManager, parseDate, progressOf, toFaDigits } from '../lib/helpers';
import { EmptyState, PageHeader, ProgressBar, ProgressRing, StatCard, StatusPill } from '../components/ui';
import { RequestRow } from './shared';

export default function OverviewPage({ profile, data, setActivePage, decideRequest }) {
  const manager = profile.role !== 'member';
  const projectById = useMemo(() => Object.fromEntries(data.projects.map((p) => [p.id, p])), [data.projects]);

  const view = useMemo(() => {
    const approvedProject = new Set(data.projectMembers.filter((m) => m.user_id === profile.id && m.status === 'approved').map((m) => m.project_id));
    const approvedTask = new Set(data.taskMembers.filter((m) => m.user_id === profile.id && m.status === 'approved').map((m) => m.task_id));
    const myProjects = data.projects.filter((p) => isManager(profile, p.department) || approvedProject.has(p.id));
    const myTasks = data.tasks.filter((t) => isManager(profile, projectById[t.project_id]?.department) || approvedTask.has(t.id));
    const openTasks = myTasks.filter((t) => t.status !== 'done');
    const upcomingTasks = [...openTasks].sort((a, b) => {
      const da = parseDate(a.due_date)?.getTime() ?? Infinity; const db = parseDate(b.due_date)?.getTime() ?? Infinity;
      return da - db;
    }).slice(0, 5);
    const events = data.events.filter((e) => e.event_date && new Date(e.event_date) >= new Date(Date.now() - 86400000)).slice(0, 5);
    const pendingProjects = data.projectMembers.filter((r) => r.status === 'pending' && isManager(profile, projectById[r.project_id]?.department));
    const taskById = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
    const pendingTasks = data.taskMembers.filter((r) => r.status === 'pending' && isManager(profile, projectById[taskById[r.task_id]?.project_id]?.department));
    return { myProjects, myTasks, openTasks, upcomingTasks, events, pendingProjects, pendingTasks, overdue: openTasks.filter((t) => dueState(t) === 'overdue').length };
  }, [data, profile, projectById]);

  const overall = progressOf(view.myTasks);
  const pendingCount = view.pendingProjects.length + view.pendingTasks.length;
  const firstName = profile.full_name.split(' ')[0];

  return <div className="nv-stack">
    <PageHeader eyebrow="YOUR WORKSPACE / OVERVIEW" title={`روزت بخیر، ${firstName}`} description="تصویر کلی از پروژه‌ها، کارهای در جریان و اتفاق‌های پیش روی تو."
      action={<button className="button button-primary" onClick={() => setActivePage('projects')}><Plus size={16} /> مشاهده پروژه‌ها</button>} />

    <section className="nv-hero nv-rise" style={{ '--i': 1 }}>
      <div className="nv-hero-copy">
        <span className="nv-chip"><Sparkles size={13} /> SPACE FOR BIG IDEAS</span>
        <h2>قدرت‌ها کنار هم،<br /><span>نتیجه‌ها فراتر.</span></h2>
        <p>{view.overdue ? `${toFaDigits(view.overdue)} تسک از ددلاین گذشته؛ اول سراغ آن‌ها برو.` : view.openTasks.length ? `${toFaDigits(view.openTasks.length)} تسک باز داری؛ قدم بعدی مشخص است.` : 'همه‌چیز مرتب است؛ وقت خوبی برای برنامه‌ریزی قدم بعدی است.'}</p>
        <div className="nv-hero-actions">
          <button className="button button-primary button-small" onClick={() => setActivePage('tasks')}>تسک‌های من <ArrowLeft size={14} /></button>
          <button className="button button-ghost button-small" onClick={() => setActivePage('teams')}>تیم‌های نَوِرا</button>
        </div>
      </div>
      <div className="nv-hero-visual">
        <ProgressRing pct={overall.pct}><strong>{toFaDigits(overall.pct)}٪</strong><small>پیشرفت کلی</small></ProgressRing>
        <div className="nv-hero-legend"><span><i className="is-done" />{toFaDigits(overall.done)} انجام‌شده</span><span><i />{toFaDigits(overall.total - overall.done)} باقی‌مانده</span></div>
      </div>
      <img className="nv-hero-mark" src="/brands/nowera.png" alt="" aria-hidden="true" loading="lazy" decoding="async" />
    </section>

    <div className="nv-stats">
      <StatCard index={2} tone="blue" label="پروژه‌های در دسترس" value={view.myProjects.length} icon={<FolderKanban size={18} />} foot={`${data.projects.filter((p) => p.status === 'active').length} پروژه فعال در نَوِرا`} />
      <StatCard index={3} tone="purple" label="تسک‌های در دست اقدام" value={view.openTasks.length} icon={<ClipboardList size={18} />} foot={`${view.myTasks.length - view.openTasks.length} تسک تکمیل‌شده`} />
      <StatCard index={4} tone="gold" label="رویدادهای پیش‌رو" value={view.events.length} icon={<CalendarDays size={18} />} foot="جلسه‌ها و ددلاین‌ها" />
      <StatCard index={5} tone="green" label={manager ? 'درخواست‌های بررسی‌نشده' : 'اعضای فعال نَوِرا'} value={manager ? pendingCount : data.publicMembers.length} icon={manager ? <Bell size={18} /> : <Users size={18} />} foot={manager ? 'نیازمند تصمیم شما' : 'در چهار بخش تخصصی'} />
    </div>

    <div className="nv-grid">
      <section className="nv-card nv-span-7 nv-rise" style={{ '--i': 6 }}>
        <CardHead kicker="RECENT ACTIVITY" title="پروژه‌های اخیر" action={<button className="nv-link" onClick={() => setActivePage('projects')}>همه پروژه‌ها <ArrowLeft size={14} /></button>} />
        {view.myProjects.length ? <div className="nv-list">{view.myProjects.slice(0, 5).map((project) => {
          const dept = getDepartment(project.department); const prog = progressOf(data.tasks.filter((t) => t.project_id === project.id));
          return <div className="nv-list-row" key={project.id} style={{ '--dept-color': dept.color }}>
            <span className="nv-dot-icon"><Briefcase size={16} /></span>
            <div className="nv-list-main"><strong>{project.title}</strong><small>{dept.name} · {project.deadline ? `ددلاین ${faDate(project.deadline)}` : 'بدون ددلاین'}</small><ProgressBar pct={prog.pct} label="پیشرفت پروژه" /></div>
            <div className="nv-list-end"><StatusPill status={project.status} type="project" /><small>{prog.total ? `${toFaDigits(prog.done)}/${toFaDigits(prog.total)} تسک` : 'بدون تسک'}</small></div>
          </div>;
        })}</div> : <EmptyState icon={<FolderKanban size={22} />} title="هنوز پروژه‌ای در فضای تو نیست" description="از بخش پروژه‌ها درخواست همکاری خودت را ثبت کن." action={<button className="button button-secondary button-small" onClick={() => setActivePage('projects')}>کشف پروژه‌ها <ArrowLeft size={14} /></button>} />}
      </section>

      <section className="nv-card nv-span-5 nv-rise" style={{ '--i': 7 }}>
        <CardHead kicker="FOCUS" title="تسک‌های نزدیک ددلاین" action={<button className="nv-link" onClick={() => setActivePage('tasks')}>همه تسک‌ها <ArrowLeft size={14} /></button>} />
        {view.upcomingTasks.length ? <div className="nv-list">{view.upcomingTasks.map((task) => {
          const state = dueState(task); const project = projectById[task.project_id];
          return <div className="nv-list-row is-compact" key={task.id}>
            <span className={`nv-prio nv-prio-${task.priority}`} title={`اولویت ${PRIORITY[task.priority]}`}><Flag size={14} /></span>
            <div className="nv-list-main"><strong>{task.title}</strong><small>{project?.title}</small></div>
            <div className="nv-list-end"><span className={`nv-due ${state ? `is-${state}` : ''}`}><Clock3 size={12} />{task.due_date ? faDate(task.due_date) : 'بدون ددلاین'}</span></div>
          </div>;
        })}</div> : <EmptyState icon={<CheckCheck size={22} />} title="تسک بازی نداری" description="وقتی تسکی به تو تخصیص داده شود، اینجا می‌بینی‌اش." />}
      </section>

      <section className="nv-card nv-span-5 nv-rise" style={{ '--i': 8 }}>
        <CardHead kicker="UP NEXT" title="تقویم نزدیک" action={<button className="nv-icon-btn" onClick={() => setActivePage('calendar')} aria-label="باز کردن تقویم"><ArrowLeft size={16} /></button>} />
        {view.events.length ? <div className="nv-list">{view.events.map((event) => {
          const date = new Date(event.event_date); const dept = getDepartment(event.department);
          return <div className="nv-list-row is-compact" key={event.id} style={{ '--dept-color': dept.color }}>
            <div className="nv-date-tile"><strong>{new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(date)}</strong><small>{new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(date)}</small></div>
            <div className="nv-list-main"><strong>{event.title}</strong><small>{dept.name} · {new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date)}</small></div>
          </div>;
        })}</div> : <EmptyState icon={<CalendarDays size={22} />} title="رویدادی ثبت نشده" description="جلسه‌ها و ددلاین‌های تیم اینجا نمایش داده می‌شوند." />}
      </section>

      <section className="nv-card nv-span-7 nv-rise" style={{ '--i': 9 }}>
        <CardHead kicker="DIVISIONS" title="وضعیت بخش‌ها" action={<button className="nv-link" onClick={() => setActivePage('teams')}>تیم‌ها <ArrowLeft size={14} /></button>} />
        <div className="nv-dept-grid">{DEPARTMENTS.map((dept) => {
          const projects = data.projects.filter((p) => p.department === dept.id);
          const prog = progressOf(data.tasks.filter((t) => projects.some((p) => p.id === t.project_id)));
          return <div className="nv-dept-tile" key={dept.id} style={{ '--dept-color': dept.color }}>
            <img src={dept.logo} alt="" width="40" height="40" loading="lazy" decoding="async" />
            <div><strong>{dept.name}</strong><small>{toFaDigits(projects.length)} پروژه · {toFaDigits(data.publicMembers.filter((m) => m.department === dept.id).length)} عضو</small></div>
            <ProgressBar pct={prog.pct} color={dept.color} label={`پیشرفت ${dept.name}`} />
          </div>;
        })}</div>
      </section>

      {manager && <section className="nv-card nv-span-12 nv-rise" style={{ '--i': 10 }}>
        <CardHead kicker="NEEDS YOUR ATTENTION" title={<>درخواست‌های همکاری <span className="nv-count">{toFaDigits(pendingCount)}</span></>} action={<span className="nv-muted"><Clock3 size={14} /> منتظر تصمیم شما</span>} />
        {pendingCount ? <div className="nv-requests">{view.pendingProjects.slice(0, 4).map((row) => <RequestRow key={`p-${row.id}`} row={row} kind="project" data={data} decideRequest={decideRequest} />)}{view.pendingTasks.slice(0, 4).map((row) => <RequestRow key={`t-${row.id}`} row={row} kind="task" data={data} decideRequest={decideRequest} />)}</div>
          : <p className="nv-muted-text"><CheckCheck size={16} /> درخواست معوقی برای بررسی وجود ندارد.</p>}
      </section>}
    </div>
  </div>;
}

export function CardHead({ kicker, title, action }) {
  return <div className="nv-card-head"><div><span className="nv-kicker">{kicker}</span><h3>{title}</h3></div>{action}</div>;
}
