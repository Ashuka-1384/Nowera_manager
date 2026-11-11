import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, Check, ClipboardList, FolderKanban, MessageSquareWarning, Pencil, Send, ShieldCheck, X } from 'lucide-react';
import { DEPARTMENTS, PROJECT_STATUS, PRIORITY, ROLE_LABELS, TASK_STATUS, getDepartment, isManager } from '../lib/helpers';

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const TITLES = { project: 'ساخت پروژه جدید', editProject: 'ویرایش پروژه', task: 'تعریف تسک جدید', editTask: 'ویرایش تسک', event: 'ثبت رویداد در تقویم', editEvent: 'ویرایش رویداد', report: 'ثبت گزارش محرمانه' };
const DESCRIPTIONS = {
  project: 'اطلاعات پایه پروژه و تیم مسئول را وارد کن.', editProject: 'عنوان، شرح، وضعیت، مهلت و (برای مدیر اصلی) بخش پروژه را به‌روزرسانی کن.',
  task: 'تسک را به یکی از پروژه‌های قابل مدیریت متصل کن.', editTask: 'جزئیات اجرایی و وضعیت تسک را اصلاح کن.',
  event: 'جلسه، ددلاین یا رویداد مهم را ثبت کن.', editEvent: 'عنوان، زمان و جزئیات رویداد را اصلاح کن.', report: 'گزارش شما فقط برای مدیر اصلی قابل مشاهده خواهد بود.',
};

export default function ActionDialog({ dialog, close, profile, data, handlers }) {
  const record = dialog.record || {};
  const type = dialog.type;
  const isEditing = type.startsWith('edit');
  const [form, setForm] = useState(() => ({
    department: record.department || (profile.role === 'department_admin' ? profile.department : profile.department || 'Technoplus'),
    title: record.title || '', description: record.description || '', details: record.details || '',
    status: record.status || (type.toLowerCase().includes('task') ? 'todo' : 'active'), priority: record.priority || 'medium',
    deadline: record.deadline || '', due_date: record.due_date || '', project_id: record.project_id || '',
    event_date: record.event_date ? toLocalInput(record.event_date) : dialog.date ? `${dialog.date}T10:00` : '',
    message: '', target_admin_id: '',
  }));
  const [busy, setBusy] = useState(false);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const projects = data.projects.filter((p) => isManager(profile, p.department));
  const admins = data.profiles.filter((m) => m.is_active && m.role !== 'member');
  const departments = DEPARTMENTS.filter((d) => profile.role !== 'department_admin' || d.id === profile.department);
  const isProject = type === 'project' || type === 'editProject';
  const isTask = type === 'task' || type === 'editTask';
  const isEvent = type === 'event' || type === 'editEvent';

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    let ok = false;
    try {
      if (type === 'project') ok = await handlers.createProject(form);
      else if (type === 'task') ok = await handlers.createTask(form);
      else if (type === 'event') ok = await handlers.createEvent(form);
      else if (type === 'report') ok = await handlers.createReport(form);
      else if (type === 'editProject') ok = await handlers.updateProject(record.id, { title: form.title.trim(), description: form.description.trim(), status: form.status, deadline: form.deadline || null, ...(profile.role === 'super_admin' ? { department: form.department } : {}) });
      else if (type === 'editTask') ok = await handlers.updateTask(record.id, { title: form.title.trim(), description: form.description.trim(), status: form.status, priority: form.priority, due_date: form.due_date || null });
      else if (type === 'editEvent') ok = await handlers.updateEvent(record.id, { title: form.title.trim(), details: form.details.trim(), department: form.department, event_date: new Date(form.event_date).toISOString() });
    } finally { setBusy(false); }
    if (ok) close();
  };

  const icon = isProject ? <FolderKanban size={20} /> : isTask ? <ClipboardList size={20} /> : isEvent ? <CalendarDays size={20} /> : <MessageSquareWarning size={20} />;
  return <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}>
    <section className="action-modal" role="dialog" aria-modal="true" aria-label={TITLES[type]}>
      <div className="action-modal-header"><div className="action-modal-icon">{icon}</div><div><span className="section-kicker">NOWERA WORKSPACE</span><h2>{TITLES[type]}</h2><p>{DESCRIPTIONS[type]}</p></div><button className="modal-close" onClick={close} aria-label="بستن"><X size={18} /></button></div>
      <form className="action-form" onSubmit={submit}>
        {isProject && <>
          <label>عنوان پروژه<input required minLength={2} maxLength={140} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="نام مشخص و کوتاه پروژه" autoFocus /></label>
          <label>توضیحات<textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="هدف پروژه، خروجی مورد انتظار و توضیحات…" /></label>
          <div className="form-grid-two">
            {(!isEditing || profile.role === 'super_admin') && <label>تیم مسئول<select value={form.department} onChange={(e) => update('department', e.target.value)}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
            <label>وضعیت پروژه<select value={form.status} onChange={(e) => update('status', e.target.value)}>{Object.entries(PROJECT_STATUS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          </div>
          <label>ددلاین پروژه<input type="date" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} /></label>
        </>}
        {isTask && <>
          {!isEditing && <label>پروژه مرتبط<select required value={form.project_id} onChange={(e) => update('project_id', e.target.value)}><option value="">انتخاب پروژه…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title} · {getDepartment(p.department).name}</option>)}</select></label>}
          <label>عنوان تسک<input required minLength={2} maxLength={160} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="مثلاً طراحی نسخه اولیه صفحه اصلی" autoFocus /></label>
          <label>شرح و خروجی مورد انتظار<textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="جزئیات اجرا، معیار تکمیل و نکات مهم…" /></label>
          <div className="form-grid-two">
            <label>اولویت<select value={form.priority} onChange={(e) => update('priority', e.target.value)}>{Object.entries(PRIORITY).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label>وضعیت<select value={form.status} onChange={(e) => update('status', e.target.value)}>{Object.entries(TASK_STATUS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          </div>
          <label>ددلاین<input type="date" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} /></label>
        </>}
        {isEvent && <>
          <label>عنوان رویداد<input required minLength={2} maxLength={140} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="مثلاً جلسه هفتگی تیم" autoFocus /></label>
          <div className="form-grid-two">
            <label>تیم برگزارکننده<select value={form.department} onChange={(e) => update('department', e.target.value)}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label>تاریخ و ساعت<input required type="datetime-local" value={form.event_date} onChange={(e) => update('event_date', e.target.value)} /></label>
          </div>
          <label>جزئیات<textarea rows={3} value={form.details} onChange={(e) => update('details', e.target.value)} placeholder="محل جلسه، دستور کار یا توضیحات تکمیلی…" /></label>
        </>}
        {type === 'report' && <>
          <div className="form-note-private"><ShieldCheck size={17} /><span>نام و مشخصات حساب برای پیگیری نزد مدیر اصلی محفوظ است. مدیر بخش گزارش را نمی‌بیند.</span></div>
          <label>موضوع گزارش<input required minLength={3} maxLength={160} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="خلاصه‌ای از موضوع" autoFocus /></label>
          <div className="form-grid-two">
            <label>بخش مرتبط<select value={form.department} onChange={(e) => update('department', e.target.value)}>{DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label>مدیر مرتبط (اختیاری)<select value={form.target_admin_id} onChange={(e) => update('target_admin_id', e.target.value)}><option value="">مشخص نشده</option>{admins.map((a) => <option value={a.id} key={a.id}>{a.full_name} · {ROLE_LABELS[a.role]}</option>)}</select></label>
          </div>
          <label>شرح گزارش<textarea rows={5} required minLength={5} maxLength={5000} value={form.message} onChange={(e) => update('message', e.target.value)} placeholder="موضوع را با جزئیات کافی، زمان تقریبی و هر زمینه لازم توضیح بده…" /></label>
        </>}
        <div className="action-form-footer">
          <button type="button" className="button button-ghost" onClick={close}>انصراف</button>
          <button type="submit" disabled={busy} className="button button-primary">{busy ? <span className="button-spinner" /> : type === 'report' ? <Send size={16} /> : isEditing ? <Pencil size={16} /> : <Check size={16} />}{busy ? 'در حال ذخیره…' : type === 'report' ? 'ارسال محرمانه گزارش' : isEditing ? 'ذخیره تغییرات' : 'ذخیره و ثبت'}<ArrowLeft size={15} /></button>
        </div>
      </form>
    </section>
  </div>;
}
