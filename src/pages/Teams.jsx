import React from 'react';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { DEPARTMENTS, progressOf, toFaDigits } from '../lib/helpers';
import { Avatar, PageHeader, ProgressBar } from '../components/ui';

export default function TeamsPage({ profile, data, setActivePage }) {
  return <div className="nv-stack">
    <PageHeader eyebrow="ORGANIZATION / DIVISIONS" title="تیم‌های نَوِرا" description="چهار بخش تخصصی با هویت مستقل که برای یک چشم‌انداز مشترک هم‌افزایی می‌کنند." />
    <div className="nv-team-grid">{DEPARTMENTS.map((dept, index) => {
      const members = data.publicMembers.filter((p) => p.department === dept.id);
      const projects = data.projects.filter((p) => p.department === dept.id);
      const prog = progressOf(data.tasks.filter((t) => projects.some((p) => p.id === t.project_id)));
      const manages = profile.role === 'super_admin' || (profile.role === 'department_admin' && profile.department === dept.id);
      return <article className="nv-team nv-rise" key={dept.id} style={{ '--dept-color': dept.color, '--dept-glow': dept.glow, '--i': index + 1 }}>
        <div className="nv-team-top"><span>DIVISION 0{index + 1}</span>{profile.department === dept.id && <em>تیم شما</em>}</div>
        <div className="nv-team-logo"><img src={dept.logo} alt={`${dept.english} logo`} width="84" height="84" loading="lazy" decoding="async" /></div>
        <h2>{dept.name}</h2><span className="nv-team-en">{dept.english}</span><p>{dept.tagline}</p>
        <div className="nv-mini-stats">
          <div><strong>{toFaDigits(members.length)}</strong><small>عضو فعال</small></div>
          <div><strong>{toFaDigits(projects.length)}</strong><small>پروژه</small></div>
          <div><strong>{toFaDigits(projects.filter((p) => p.status === 'completed').length)}</strong><small>تکمیل‌شده</small></div>
        </div>
        <div className="nv-team-progress"><span>پیشرفت تسک‌ها</span><b>{prog.total ? `${toFaDigits(prog.pct)}٪` : '—'}</b></div>
        <ProgressBar pct={prog.pct} color={dept.color} label={`پیشرفت ${dept.name}`} />
        <div className="nv-team-foot">
          <div className="nv-avatars">{members.slice(0, 4).map((m) => <Avatar profile={m} size="tiny" key={m.id} />)}{members.length > 4 && <span>+{toFaDigits(members.length - 4)}</span>}</div>
          <button className="button button-secondary button-small" onClick={() => setActivePage('projects')}>پروژه‌های تیم <ArrowLeft size={14} /></button>
        </div>
        {manages && <div className="nv-note"><ShieldCheck size={13} /> دسترسی مدیریت این بخش</div>}
      </article>;
    })}</div>
    <section className="nv-card nv-principles nv-rise" style={{ '--i': 6 }}>
      <div><span className="nv-kicker">ONE ORGANIZATION</span><h3>تخصص‌های متفاوت، استانداردهای مشترک.</h3><p>فرآیندها، تقویم‌ها و مسئولیت‌ها شفاف‌اند تا هر تیم با تمرکز خودش کار کند و نتیجه در سطح نَوِرا دیده شود.</p></div>
      <div className="nv-checks"><span><Check size={15} /> مسئولیت‌پذیری شفاف</span><span><Check size={15} /> همکاری بین‌تیمی</span><span><Check size={15} /> گزارش‌پذیری و پیگیری</span></div>
    </section>
  </div>;
}
