import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarDays, ChevronDown, ClipboardList, Eraser, FolderKanban, Pencil, Plus, Search,
  ShieldCheck, Trash2, UserMinus, UserPlus, Users,
} from 'lucide-react';
import { DEPARTMENTS, PROJECT_STATUS, REQUEST_STATUS, faDate, getDepartment, isManager, progressOf, toFaDigits } from '../lib/helpers';
import { useDebouncedValue } from '../lib/hooks';
import { Avatar, EmptyState, PageHeader, ProgressBar, StatusPill } from '../components/ui';
import { RequestRow } from './shared';

const STATUS_TABS = [{ id: 'all', label: 'همه' }, ...Object.entries(PROJECT_STATUS).map(([id, label]) => ({ id, label }))];

export default function ProjectsPage(props) {
  const { profile, data, openDialog, decideRequest } = props;
  const [department, setDepartment] = useState(profile.role === 'department_admin' ? profile.department : 'all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query).trim().toLocaleLowerCase();
  const manager = profile.role !== 'member';

  const projectsInScope = useMemo(() => data.projects.filter((p) => department === 'all' || p.department === department), [data.projects, department]);
  const visible = useMemo(() => projectsInScope.filter((p) => (status === 'all' || p.status === status) && `${p.title} ${p.description}`.toLocaleLowerCase().includes(q)), [projectsInScope, status, q]);
  const pendingRows = data.projectMembers.filter((r) => r.status === 'pending' && isManager(profile, data.projects.find((p) => p.id === r.project_id)?.department));
  const counts = (id) => id === 'all' ? projectsInScope.length : projectsInScope.filter((p) => p.status === id).length;

  return <div className="nv-stack">
    <PageHeader eyebrow="PROJECT HUB / PORTFOLIO" title="پروژه‌های نَوِرا" description="پروژه‌ها، اعضا و مسیر پیشرفت را از یک نمای یکپارچه مدیریت کن."
      action={manager && <button className="button button-primary" onClick={() => openDialog({ type: 'project' })}><Plus size={16} /> پروژه جدید</button>} />

    <div className="nv-toolbar nv-rise" style={{ '--i': 1 }}>
      <label className="nv-search"><Search size={17} /><input placeholder="جست‌وجوی نام یا شرح پروژه…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="جست‌وجوی پروژه" /></label>
      <div className="nv-tabs" role="tablist">{STATUS_TABS.map((tab) => <button role="tab" aria-selected={status === tab.id} key={tab.id} className={status === tab.id ? 'is-active' : ''} onClick={() => setStatus(tab.id)}>{tab.label}<span>{toFaDigits(counts(tab.id))}</span></button>)}</div>
      <select className="nv-select" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="فیلتر بخش">
        {profile.role !== 'department_admin' && <option value="all">همه تیم‌ها</option>}
        {DEPARTMENTS.filter((d) => profile.role !== 'department_admin' || d.id === profile.department).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </div>

    <div className={`nv-split ${manager ? 'has-aside' : ''}`}>
      <div className="nv-main-col">
        {visible.length ? <div className="nv-cards">{visible.map((project, i) => <ProjectCard key={project.id} index={i} project={project} {...props} />)}</div>
          : <EmptyState icon={<FolderKanban size={25} />} title="پروژه‌ای پیدا نشد" description={manager ? 'فیلترها را تغییر بده یا اولین پروژه را بساز.' : 'پروژه‌ای مطابق این فیلتر وجود ندارد.'} action={manager && <button className="button button-primary button-small" onClick={() => openDialog({ type: 'project' })}><Plus size={15} /> ساخت پروژه</button>} />}
      </div>
      {manager && <aside className="nv-aside">
        <section className="nv-card nv-rise" style={{ '--i': 2 }}>
          <div className="nv-card-head"><div><span className="nv-kicker">OVERVIEW</span><h3>خلاصه وضعیت</h3></div></div>
          <div className="nv-mini-stats">
            <div><strong>{toFaDigits(projectsInScope.length)}</strong><small>کل پروژه‌ها</small></div>
            <div><strong>{toFaDigits(counts('active'))}</strong><small>در حال اجرا</small></div>
            <div><strong>{toFaDigits(counts('completed'))}</strong><small>تکمیل‌شده</small></div>
          </div>
          <p className="nv-note"><ShieldCheck size={15} /> مدیریت پروژه‌های {profile.role === 'super_admin' ? 'تمام بخش‌ها' : getDepartment(profile.department).name}</p>
        </section>
        <section className="nv-card nv-rise" style={{ '--i': 3 }}>
          <div className="nv-card-head"><div><span className="nv-kicker">JOIN REQUESTS</span><h3>درخواست‌های عضویت <span className="nv-count">{toFaDigits(pendingRows.length)}</span></h3></div></div>
          {pendingRows.length ? <div className="nv-requests">{pendingRows.map((row) => <RequestRow key={row.id} row={row} kind="project" data={data} decideRequest={decideRequest} />)}</div> : <p className="nv-muted-text">درخواست جدیدی وجود ندارد.</p>}
        </section>
      </aside>}
    </div>
  </div>;
}

function ProjectCard({ index, project, profile, data, openDialog, confirmAction, requestProject, updateProject, deleteProject, clearDoneTasks, assignProjectMember, removeProjectMember }) {
  const [open, setOpen] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState('');
  const dept = getDepartment(project.department);
  const manager = isManager(profile, project.department);
  const membership = data.projectMembers.find((r) => r.project_id === project.id && r.user_id === profile.id);
  // People whose access was closed stay in the history tables but must not clutter the team list or counts.
  const isDeactivated = (userId) => data.profiles.find((p) => p.id === userId)?.is_active === false;
  const approved = data.projectMembers.filter((r) => r.project_id === project.id && r.status === 'approved' && !isDeactivated(r.user_id));
  const pending = data.projectMembers.filter((r) => r.project_id === project.id && r.status === 'pending' && !isDeactivated(r.user_id));
  const tasks = data.tasks.filter((t) => t.project_id === project.id);
  const prog = progressOf(tasks);
  const eligible = data.profiles.filter((m) => m.is_active && m.role === 'member' && !approved.some((r) => r.user_id === m.id));
  const askDelete = () => confirmAction({
    title: 'حذف کامل پروژه؟',
    description: `پروژه «${project.title}» به‌همراه ${toFaDigits(tasks.length)} تسک، درخواست‌ها و عضویت‌های وابسته برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.`,
    confirmLabel: 'حذف پروژه', onConfirm: () => deleteProject(project.id),
  });
  const askClear = () => confirmAction({
    title: 'پاک‌سازی تسک‌های تکمیل‌شده؟', icon: Eraser,
    description: `${toFaDigits(prog.done)} تسک تکمیل‌شده‌ی «${project.title}» حذف می‌شوند. بقیه‌ی تسک‌ها دست‌نخورده می‌مانند.`,
    confirmLabel: 'پاک‌سازی', onConfirm: () => clearDoneTasks(project.id),
  });
  return <article className="nv-project nv-rise" style={{ '--dept-color': dept.color, '--dept-glow': dept.glow, '--i': Math.min(index, 8) + 2 }}>
    <div className="nv-project-top">
      <span className="nv-project-logo"><img src={dept.logo} alt="" width="38" height="38" loading="lazy" decoding="async" /></span>
      <div className="nv-project-dept"><b>{dept.name}</b><small>{dept.english}</small></div>
      <StatusPill status={project.status} type="project" />
    </div>
    <h3>{project.title}</h3>
    <p className="nv-clamp">{project.description || 'برای این پروژه هنوز توضیحی ثبت نشده است.'}</p>
    <div className="nv-project-progress">
      <div><span>پیشرفت</span><b>{prog.total ? `${toFaDigits(prog.pct)}٪` : '—'}</b></div>
      <ProgressBar pct={prog.pct} color={dept.color} label="پیشرفت پروژه" />
    </div>
    <div className="nv-meta">
      <span><Users size={14} />{toFaDigits(approved.length)} همکار</span>
      <span><ClipboardList size={14} />{toFaDigits(prog.total)} تسک</span>
      {project.deadline && <span><CalendarDays size={14} />{faDate(project.deadline)}</span>}
    </div>
    <div className="nv-project-foot">
      {manager ? <>
        <select className="nv-select is-small" value={project.status} onChange={(e) => updateProject(project.id, { status: e.target.value })} aria-label="وضعیت پروژه">{Object.entries(PROJECT_STATUS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <div className="nv-actions">
          <button className="nv-icon-btn" title="ویرایش پروژه" aria-label="ویرایش پروژه" onClick={() => openDialog({ type: 'editProject', record: project })}><Pencil size={15} /></button>
          {prog.done > 0 && <button className="nv-icon-btn" title="پاک‌سازی تسک‌های تکمیل‌شده" aria-label="پاک‌سازی تسک‌های تکمیل‌شده" onClick={askClear}><Eraser size={15} /></button>}
          <button className="nv-icon-btn is-danger" title="حذف پروژه" aria-label="حذف پروژه" onClick={askDelete}><Trash2 size={15} /></button>
        </div>
      </> : <>
        <span className={`nv-membership is-${membership?.status || 'none'}`}>{membership ? REQUEST_STATUS[membership.status] : 'به همکار نیاز داریم'}</span>
        <button disabled={membership?.status === 'pending' || membership?.status === 'approved'} className="button button-outline button-small" onClick={() => requestProject(project.id)}>
          {membership?.status === 'pending' ? 'در انتظار' : membership?.status === 'approved' ? 'عضو پروژه' : membership?.status === 'rejected' ? 'ارسال دوباره' : 'درخواست همکاری'}<ArrowLeft size={14} />
        </button>
      </>}
    </div>
    {manager && <button className="nv-expander" onClick={() => setOpen((v) => !v)} aria-expanded={open}><Users size={14} /> مدیریت اعضا <span>{toFaDigits(approved.length + pending.length)}</span><ChevronDown size={14} className={open ? 'is-flipped' : ''} /></button>}
    {manager && open && <div className="nv-team-panel">
      {approved.length ? <div className="nv-chips">{approved.map((row) => {
        const member = data.profiles.find((p) => p.id === row.user_id);
        return <span className="nv-person" key={row.id}><Avatar profile={member || { full_name: 'عضو', department: project.department }} size="tiny" />{member?.full_name || 'عضو پروژه'}
          <button title="حذف از پروژه" aria-label="حذف عضو از پروژه" onClick={() => confirmAction({ title: 'حذف عضو از پروژه؟', icon: UserMinus, description: `عضویت این فرد در «${project.title}» و تخصیص‌های تسک او نیز لغو می‌شود.`, confirmLabel: 'حذف عضویت', onConfirm: () => removeProjectMember(project.id, row.user_id) })}><UserMinus size={13} /></button></span>;
      })}</div> : <p className="nv-muted-text">هنوز عضوی به این پروژه اضافه نشده است.</p>}
      <div className="nv-assign"><select className="nv-select is-small" value={memberToAdd} onChange={(e) => setMemberToAdd(e.target.value)} aria-label="انتخاب عضو برای افزودن"><option value="">{eligible.length ? 'افزودن عضو فعال…' : 'عضو فعالی برای افزودن وجود ندارد'}</option>{eligible.map((m) => <option key={m.id} value={m.id}>{m.full_name} · {getDepartment(m.department).name}</option>)}</select>
        <button className="button button-primary button-small" disabled={!memberToAdd} onClick={async () => { if (await assignProjectMember(project.id, memberToAdd)) setMemberToAdd(''); }}><UserPlus size={14} /> افزودن</button></div>
      {pending.length > 0 && <p className="nv-note">{toFaDigits(pending.length)} درخواست در انتظار بررسی در ستون کناری است.</p>}
    </div>}
  </article>;
}
