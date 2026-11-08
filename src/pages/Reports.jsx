import React, { useState } from 'react';
import { MessageSquareWarning, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { faDate, getDepartment, toFaDigits } from '../lib/helpers';
import { EmptyState, PageHeader, StatusPill } from '../components/ui';

const TABS = [{ id: 'all', label: 'همه' }, { id: 'new', label: 'جدید' }, { id: 'reviewing', label: 'در حال بررسی' }, { id: 'resolved', label: 'رسیدگی‌شده' }];

export default function ReportsPage({ profile, data, openDialog, updateReport, deleteReport, confirmAction }) {
  const [tab, setTab] = useState('all');
  const canReview = profile.role === 'super_admin';
  const list = data.reports.filter((r) => tab === 'all' || r.status === tab);
  return <div className="nv-stack">
    <PageHeader eyebrow="TRUST / FEEDBACK CHANNEL" title="گزارش و بازخورد" description="اگر درباره‌ی روند کار یا عملکرد مدیریتی مسئله‌ای وجود دارد، گزارش را محرمانه و مستقیم ثبت کن."
      action={<button className="button button-primary" onClick={() => openDialog({ type: 'report' })}><Send size={16} /> ثبت گزارش</button>} />
    <div className="nv-banner nv-rise" style={{ '--i': 1 }}>
      <span className="nv-banner-icon"><ShieldCheck size={22} /></span>
      <div><strong>حریم خصوصی گزارش‌دهنده</strong><p>گزارش‌ها فقط برای ثبت‌کننده و مدیر اصلی قابل مشاهده‌اند؛ مدیر بخش به گزارش ثبت‌شده درباره‌ی خودش دسترسی ندارد.</p></div>
      <span className="nv-confidential"><i />CONFIDENTIAL</span>
    </div>
    {data.reports.length > 0 && <div className="nv-tabs nv-rise" style={{ '--i': 2 }} role="tablist">{TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>{t.label}<span>{toFaDigits(t.id === 'all' ? data.reports.length : data.reports.filter((r) => r.status === t.id).length)}</span></button>)}</div>}
    {list.length ? <div className="nv-cards is-wide">{list.map((report, i) => <article className="nv-report nv-rise" key={report.id} style={{ '--i': Math.min(i, 8) + 2, '--dept-color': getDepartment(report.department).color }}>
      <div className="nv-report-top"><span className="nv-tag" style={{ '--tag': getDepartment(report.department).color }}>{getDepartment(report.department).name}</span><small>{faDate(report.created_at)}</small></div>
      <h3>{report.title}</h3><p>{report.message}</p>
      <div className="nv-report-foot"><StatusPill status={report.status} type="report" />
        {canReview && <div className="nv-actions">
          <select className="nv-select is-small" value={report.status} onChange={(e) => updateReport(report.id, e.target.value)} aria-label="وضعیت گزارش"><option value="new">جدید</option><option value="reviewing">در حال بررسی</option><option value="resolved">رسیدگی‌شده</option></select>
          <button className="nv-icon-btn is-danger" title="حذف گزارش" aria-label="حذف گزارش" onClick={() => confirmAction({ title: 'حذف گزارش؟', description: `گزارش «${report.title}» برای همیشه حذف می‌شود.`, confirmLabel: 'حذف گزارش', onConfirm: () => deleteReport(report.id) })}><Trash2 size={14} /></button>
        </div>}
      </div>
    </article>)}</div>
      : <EmptyState icon={<MessageSquareWarning size={25} />} title={data.reports.length ? 'گزارشی در این دسته نیست' : canReview ? 'گزارشی ثبت نشده است' : 'هنوز گزارشی ثبت نکرده‌ای'} description={canReview ? 'در صورت ثبت گزارش توسط اعضا، موارد محرمانه اینجا نمایش داده می‌شوند.' : 'این کانال برای مطرح‌کردن دغدغه‌ها و بازخوردهای مهم است.'} action={<button className="button button-secondary button-small" onClick={() => openDialog({ type: 'report' })}><Plus size={15} /> ثبت گزارش محرمانه</button>} />}
  </div>;
}
