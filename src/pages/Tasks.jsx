import React, { useMemo, useState } from 'react';
import {
  CalendarDays, Check, ChevronDown, CircleDot, ClipboardList, Flag, KanbanSquare, List, Pencil, Plus,
  Search, Trash2, UserMinus, UserPlus, Users,
} from 'lucide-react';
import { PRIORITY, TASK_STATUS, dueState, faDate, getDepartment, isManager, toFaDigits } from '../lib/helpers';
import { useDebouncedValue } from '../lib/hooks';
import { Avatar, EmptyState, PageHeader } from '../components/ui';
import { RequestRow } from './shared';

const COLUMNS = ['todo', 'in_progress', 'review', 'done'];
const DUE_LABEL = { overdue: 'عقب‌افتاده', today: 'امروز', soon: 'به‌زودی' };

export default function TasksPage(props) {
  const { profile, data, openDialog, decideRequest, moveTask } = props;
  const [view, setView] = useState('board');
  const [projectFilter, setProjectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(null);
  const q = useDebouncedValue(query).trim().toLocaleLowerCase();
  const manager = profile.role !== 'member';
  const projectMap = useMemo(() => Object.fromEntries(data.projects.map((p) => [p.id, p])), [data.projects]);
  const myTaskIds = useMemo(() => new Set(data.taskMembers.filter((m) => m.user_id === profile.id && m.status === 'approved').map((m) => m.task_id)), [data.taskMembers, profile.id]);

  const visible = useMemo(() => data.tasks.filter((t) => (projectFilter === 'all' || t.project_id === projectFilter)
    && (priorityFilter === 'all' || t.priority === priorityFilter)
    && (!mine || myTaskIds.has(t.id))
    && `${t.title} ${t.description} ${projectMap[t.project_id]?.title || ''}`.toLocaleLowerCase().includes(q)), [data.tasks, projectFilter, priorityFilter, mine, myTaskIds, q, projectMap]);
  const pendingRows = data.taskMembers.filter((r) => r.status === 'pending' && isManager(profile, projectMap[data.tasks.find((t) => t.id === r.task_id)?.project_id]?.department));
  const canMove = (task) => { const project = projectMap[task.project_id]; return project && (isManager(profile, project.department) || myTaskIds.has(task.id)); };

  const onDrop = (event, status) => {
    event.preventDefault(); setDragOver(null);
    const task = data.tasks.find((t) => t.id === event.dataTransfer.getData('text/plain'));
    if (task && task.status !== status && canMove(task)) moveTask(task.id, status);
  };

  return <div className="nv-stack">
    <PageHeader eyebrow="TASK CONTROL / EXECUTION" title="مدیریت تسک‌ها" description="مسئولیت‌ها را شفاف کن و با کشیدن کارت‌ها، وضعیت تسک‌ها را تغییر بده."
      action={manager && <button className="button button-primary" onClick={() => openDialog({ type: 'task' })}><Plus size={16} /> تعریف تسک</button>} />

    <div className="nv-toolbar nv-rise" style={{ '--i': 1 }}>
      <label className="nv-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی تسک یا پروژه…" aria-label="جست‌وجوی تسک" /></label>
      <select className="nv-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="فیلتر پروژه"><option value="all">همه پروژه‌ها</option>{data.projects.map((p) => <option value={p.id} key={p.id}>{p.title}</option>)}</select>
      <select className="nv-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="فیلتر اولویت"><option value="all">همه اولویت‌ها</option>{Object.entries(PRIORITY).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <button className={`nv-toggle ${mine ? 'is-on' : ''}`} aria-pressed={mine} onClick={() => setMine((v) => !v)}><Users size={14} /> تسک‌های من</button>
      <div className="nv-segment" role="group" aria-label="نوع نمایش">
        <button className={view === 'board' ? 'is-active' : ''} onClick={() => setView('board')} title="نمای بُرد" aria-label="نمای بُرد"><KanbanSquare size={16} /></button>
        <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} title="نمای فهرست" aria-label="نمای فهرست"><List size={16} /></button>
      </div>
    </div>

    {!visible.length ? <EmptyState icon={<ClipboardList size={24} />} title="تسکی در این فهرست نیست" description={manager ? 'فیلترها را تغییر بده یا یک تسک جدید تعریف کن.' : 'برای دیدن تسک‌ها باید عضو تأییدشده‌ی یک پروژه باشی؛ از بخش پروژه‌ها درخواست بده.'} />
      : view === 'board' ? <div className="nv-board">{COLUMNS.map((status, ci) => {
        const items = visible.filter((t) => t.status === status);
        return <section key={status} className={`nv-column nv-col-${status} ${dragOver === status ? 'is-over' : ''} nv-rise`} style={{ '--i': ci + 2 }}
          onDragOver={(e) => { e.preventDefault(); if (dragOver !== status) setDragOver(status); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }} onDrop={(e) => onDrop(e, status)}>
          <header><span><i />{TASK_STATUS[status]}</span><b>{toFaDigits(items.length)}</b></header>
          <div className="nv-column-body">{items.length ? items.map((task) => <TaskCard key={task.id} task={task} {...props} movable={canMove(task)} />) : <p className="nv-column-empty">کارتی اینجا نیست</p>}</div>
        </section>;
      })}</div>
        : <div className="nv-cards is-wide">{visible.map((task, i) => <TaskCard key={task.id} task={task} index={i} {...props} movable={canMove(task)} showStatus />)}</div>}

    {manager && <section className="nv-card nv-rise">
      <div className="nv-card-head"><div><span className="nv-kicker">TASK ASSIGNMENTS</span><h3>درخواست‌های دریافت تسک <span className="nv-count">{toFaDigits(pendingRows.length)}</span></h3></div></div>
      {pendingRows.length ? <div className="nv-requests">{pendingRows.map((row) => <RequestRow key={row.id} row={row} kind="task" data={data} decideRequest={decideRequest} />)}</div> : <p className="nv-muted-text">درخواست معوقی برای بررسی وجود ندارد.</p>}
    </section>}
  </div>;
}

function TaskCard({ task, index = 0, movable, showStatus, profile, data, openDialog, confirmAction, requestTask, moveTask, deleteTask, assignTaskMember, removeTaskMember }) {
  const [open, setOpen] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState('');
  const project = data.projects.find((p) => p.id === task.project_id);
  if (!project) return null;
  const dept = getDepartment(project.department);
  const manager = isManager(profile, project.department);
  const state = dueState(task);
  const taskMembership = data.taskMembers.find((r) => r.task_id === task.id && r.user_id === profile.id);
  const canRequest = data.projectMembers.some((r) => r.project_id === project.id && r.user_id === profile.id && r.status === 'approved');
  const isDeactivated = (userId) => data.profiles.find((p) => p.id === userId)?.is_active === false;
  const approved = data.taskMembers.filter((r) => r.task_id === task.id && r.status === 'approved' && !isDeactivated(r.user_id));
  // Any active team member can be assigned; the database enrols them in the project first when needed.
  const inProject = new Set(data.projectMembers.filter((r) => r.project_id === project.id && r.status === 'approved').map((r) => r.user_id));
  const eligible = data.profiles
    .filter((m) => m.is_active && m.role === 'member' && !approved.some((a) => a.user_id === m.id))
    .sort((a, b) => Number(inProject.has(b.id)) - Number(inProject.has(a.id)));
  const askDelete = () => confirmAction({ title: 'حذف تسک؟', description: `تسک «${task.title}» و تمام درخواست‌ها و تخصیص‌های مرتبط با آن برای همیشه حذف می‌شوند.`, confirmLabel: 'حذف تسک', onConfirm: () => deleteTask(task.id) });

  return <article className={`nv-task ${movable ? 'is-movable' : ''} ${task.status === 'done' ? 'is-done' : ''} nv-rise`} style={{ '--dept-color': dept.color, '--i': Math.min(index, 8) }}
    draggable={movable} onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; }}>
    <div className={`nv-task-bar priority-${task.priority}`} />
    <div className="nv-task-head">
      <span className="nv-task-check" data-done={task.status === 'done'}>{task.status === 'done' ? <Check size={14} /> : <CircleDot size={14} />}</span>
      <h4>{task.title}</h4>
    </div>
    {task.description && <p className="nv-clamp">{task.description}</p>}
    <div className="nv-task-tags">
      <span className="nv-tag" style={{ '--tag': dept.color }}>{project.title}</span>
      <span className={`nv-tag nv-tag-prio-${task.priority}`}><Flag size={11} />{PRIORITY[task.priority]}</span>
      {showStatus && <span className={`nv-tag nv-tag-status-${task.status}`}>{TASK_STATUS[task.status]}</span>}
      {task.due_date && <span className={`nv-tag nv-tag-due ${state ? `is-${state}` : ''}`}><CalendarDays size={11} />{DUE_LABEL[state] ? `${DUE_LABEL[state]} · ` : ''}{faDate(task.due_date)}</span>}
    </div>
    <div className="nv-task-foot">
      <span className="nv-assignees"><Users size={13} />{toFaDigits(approved.length)} نفر</span>
      {movable ? <select className="nv-select is-small" value={task.status} onChange={(e) => moveTask(task.id, e.target.value)} aria-label="وضعیت تسک">{Object.entries(TASK_STATUS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        : <button disabled={!canRequest || taskMembership?.status === 'pending'} className="button button-outline button-small" onClick={() => requestTask(task.id)}>
          {!canRequest ? 'ابتدا عضویت پروژه' : taskMembership?.status === 'pending' ? 'در انتظار' : taskMembership?.status === 'rejected' ? 'درخواست مجدد' : 'درخواست تسک'}</button>}
      {manager && <div className="nv-actions">
        <button className="nv-icon-btn" title="ویرایش تسک" aria-label="ویرایش تسک" onClick={() => openDialog({ type: 'editTask', record: task })}><Pencil size={14} /></button>
        <button className="nv-icon-btn is-danger" title="حذف تسک" aria-label="حذف تسک" onClick={askDelete}><Trash2 size={14} /></button>
        <button className="nv-icon-btn" title="مدیریت اعضا" aria-label="مدیریت اعضای تسک" aria-expanded={open} onClick={() => setOpen((v) => !v)}><ChevronDown size={14} className={open ? 'is-flipped' : ''} /></button>
      </div>}
    </div>
    {manager && open && <div className="nv-team-panel">
      {approved.length ? <div className="nv-chips">{approved.map((row) => {
        const member = data.profiles.find((p) => p.id === row.user_id);
        return <span className="nv-person" key={row.id}><Avatar profile={member || { full_name: 'عضو', department: project.department }} size="tiny" />{member?.full_name || 'عضو تسک'}
          <button title="حذف از تسک" aria-label="حذف عضو از تسک" onClick={() => confirmAction({ title: 'حذف عضو از تسک؟', icon: UserMinus, description: `دسترسی این فرد به تسک «${task.title}» لغو می‌شود.`, confirmLabel: 'حذف تخصیص', onConfirm: () => removeTaskMember(task.id, row.user_id) })}><UserMinus size={13} /></button></span>;
      })}</div> : <p className="nv-muted-text">هنوز عضوی تخصیص داده نشده است.</p>}
      <div className="nv-assign"><select className="nv-select is-small" value={memberToAdd} onChange={(e) => setMemberToAdd(e.target.value)} aria-label="انتخاب عضو برای تسک"><option value="">{eligible.length ? 'انتخاب عضو…' : 'عضو فعالی برای تخصیص وجود ندارد'}</option>{eligible.map((m) => <option key={m.id} value={m.id}>{m.full_name}{inProject.has(m.id) ? '' : ' · (به پروژه هم اضافه می‌شود)'}</option>)}</select>
        <button className="button button-primary button-small" disabled={!memberToAdd} onClick={async () => { if (await assignTaskMember(task.id, memberToAdd)) setMemberToAdd(''); }}><UserPlus size={14} /> تخصیص</button></div>
    </div>}
  </article>;
}
