import React, { useMemo, useState } from 'react';
import { Ban, Crown, Layers3, RotateCcw, Search, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { DEPARTMENTS, ROLE_LABELS, faDate, getDepartment, toFaDigits } from '../lib/helpers';
import { useDebouncedValue } from '../lib/hooks';
import { Avatar, EmptyState, PageHeader, StatCard } from '../components/ui';

export default function MembersPage({ profile, data, confirmAction, assignAdmin, revokeAdmin, deactivateMember, reactivateMember, changeMemberDepartment }) {
  const superAdmin = profile.role === 'super_admin';
  const [tab, setTab] = useState('active');
  const [departmentFilter, setDepartmentFilter] = useState(profile.role === 'department_admin' ? profile.department : 'all');
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [adminDepartment, setAdminDepartment] = useState('Technoplus');
  const q = useDebouncedValue(query).trim().toLocaleLowerCase();

  const active = useMemo(() => data.profiles.filter((m) => m.is_active), [data.profiles]);
  const inactive = useMemo(() => data.profiles.filter((m) => !m.is_active && m.id !== profile.id && (superAdmin || (m.role === 'member' && m.department === profile.department))), [data.profiles, profile, superAdmin]);
  const source = tab === 'active' ? active : inactive;
  const rows = source.filter((m) => (departmentFilter === 'all' || m.department === departmentFilter)
    && (superAdmin || m.role === 'member' || m.id === profile.id)
    && `${m.full_name} ${getDepartment(m.department).name}`.toLocaleLowerCase().includes(q));
  const eligible = active.filter((m) => m.role === 'member');
  const admins = active.filter((m) => m.role !== 'member').length;
  const divisions = DEPARTMENTS.filter((d) => active.some((m) => m.department === d.id)).length;

  return <div className="nv-stack">
    <PageHeader eyebrow="PEOPLE / ACCESS CONTROL" title="اعضا و دسترسی‌ها" badge={`${toFaDigits(active.length)} عضو فعال`}
      description={superAdmin ? 'ترکیب تیم‌ها، سطح دسترسی و عضویت افراد را از یک فضای یکپارچه مدیریت کن.' : `اعضای فعال ${getDepartment(profile.department).name} و دسترسی‌های مربوط به بخش شما.`} />

    <div className="nv-stats is-three">
      <StatCard index={1} tone="gold" label="اعضای فعال" value={active.length} icon={<Users size={18} />} foot="دارای دسترسی فعال" />
      <StatCard index={2} tone="purple" label="دسترسی مدیریتی" value={admins} icon={<ShieldCheck size={18} />} foot="مدیر اصلی و مدیران بخش" />
      <StatCard index={3} tone="blue" label="بخش‌های دارای عضو" value={divisions} icon={<Layers3 size={18} />} foot="از چهار بخش تخصصی" />
    </div>

    {superAdmin && <section className="nv-card nv-assign-card nv-rise" style={{ '--i': 4 }}>
      <span className="nv-banner-icon is-gold"><Crown size={22} /></span>
      <div className="nv-assign-copy"><span className="nv-kicker">SUPER ADMIN CONTROL</span><h3>واگذاری دسترسی مدیریتی</h3><p>یک عضو فعال را انتخاب کن و مسئولیت یکی از بخش‌ها را به او بسپار.</p></div>
      <div className="nv-assign-controls">
        <select className="nv-select" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} aria-label="انتخاب عضو"><option value="">انتخاب عضو…</option>{eligible.map((m) => <option key={m.id} value={m.id}>{m.full_name} · {getDepartment(m.department).name}</option>)}</select>
        <select className="nv-select" value={adminDepartment} onChange={(e) => setAdminDepartment(e.target.value)} aria-label="انتخاب بخش">{DEPARTMENTS.map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}</select>
        <button className="button button-primary" disabled={!selectedUser} onClick={async () => { if (await assignAdmin(selectedUser, adminDepartment)) setSelectedUser(''); }}>اعطای دسترسی <ShieldCheck size={15} /></button>
      </div>
    </section>}

    <section className="nv-card nv-rise" style={{ '--i': 5 }}>
      <div className="nv-card-head"><div><span className="nv-kicker">TEAM DIRECTORY</span><h3>فهرست اعضا</h3></div><span className="nv-count">{toFaDigits(rows.length)} نتیجه</span></div>
      <div className="nv-toolbar is-flat">
        <label className="nv-search"><Search size={17} /><input placeholder="جست‌وجوی نام یا تیم…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="جست‌وجوی اعضا" /></label>
        <div className="nv-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'is-active' : ''} onClick={() => setTab('active')}>فعال<span>{toFaDigits(active.length)}</span></button>
          <button role="tab" aria-selected={tab === 'inactive'} className={tab === 'inactive' ? 'is-active' : ''} onClick={() => setTab('inactive')}>دسترسی‌بسته<span>{toFaDigits(inactive.length)}</span></button>
        </div>
        <select className="nv-select" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} aria-label="فیلتر تیم">
          {superAdmin && <option value="all">همه تیم‌ها</option>}
          {DEPARTMENTS.filter((d) => profile.role !== 'department_admin' || d.id === profile.department).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {rows.length ? <div className="nv-table" role="table">
        <div className="nv-table-head" role="row"><span>عضو</span><span>بخش</span><span>سطح دسترسی</span><span>عضویت</span><span>عملیات</span></div>
        {rows.map((m) => {
          const dept = getDepartment(m.department);
          const self = m.id === profile.id;
          const canManage = !self && m.role !== 'super_admin' && (superAdmin || (profile.role === 'department_admin' && m.role === 'member' && m.department === profile.department));
          return <div className="nv-table-row" role="row" key={m.id} style={{ '--dept-color': dept.color }}>
            <div className="nv-cell-person"><Avatar profile={m} size="medium" /><div><strong>{m.full_name}{self && <em>حساب شما</em>}</strong><small>{tab === 'active' ? (self ? 'عضو واردشده' : 'عضو فعال نَوِرا') : 'دسترسی بسته‌شده'}</small></div></div>
            <div className="nv-cell-dept" data-label="بخش"><i />{superAdmin && canManage && tab === 'active' ? <select className="nv-select is-small" value={m.department} aria-label={`بخش ${m.full_name}`} onChange={(e) => {
              const next = e.target.value; if (next === m.department) return;
              confirmAction({ title: 'انتقال عضو به بخش دیگر؟', icon: Layers3, tone: 'safe', description: `${m.full_name} به بخش ${getDepartment(next).name} منتقل می‌شود.${m.role === 'department_admin' ? ' دسترسی مدیریت بخش قبلی او برداشته می‌شود.' : ''}`, confirmLabel: 'انتقال', onConfirm: () => changeMemberDepartment(m.id, next) });
            }}>{DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select> : dept.name}</div>
            <div data-label="دسترسی"><span className={`nv-role nv-role-${m.role}`}>{m.role === 'super_admin' && <Crown size={12} />}{ROLE_LABELS[m.role]}</span></div>
            <div className="nv-cell-date" data-label="عضویت">{faDate(m.created_at)}</div>
            <div className="nv-actions">
              {tab === 'active' && superAdmin && m.role === 'department_admin' && <button className="button button-outline button-small" onClick={() => confirmAction({ title: 'عزل مدیر بخش؟', icon: Ban, description: `دسترسی مدیریتی ${m.full_name} برداشته می‌شود و او دوباره عضو عادی خواهد بود.`, confirmLabel: 'عزل مدیر', onConfirm: () => revokeAdmin(m.id, m.department) })}><Ban size={14} /> عزل مدیر</button>}
              {tab === 'active' && canManage && <button className="button button-danger-ghost button-small" onClick={() => confirmAction({ title: 'حذف عضو از فهرست فعال؟', icon: UserMinus, description: `${m.full_name} دیگر به فضای کاری نَوِرا دسترسی نخواهد داشت. سوابق و فعالیت‌های او برای حفظ تاریخچه باقی می‌مانند.`, confirmLabel: 'حذف دسترسی', onConfirm: () => deactivateMember(m.id) })}><UserMinus size={14} /> حذف دسترسی</button>}
              {tab === 'inactive' && <button className="button button-outline button-small" onClick={() => confirmAction({ title: 'بازگرداندن دسترسی؟', icon: RotateCcw, tone: 'safe', description: `${m.full_name} دوباره به فضای کاری دسترسی پیدا می‌کند.`, confirmLabel: 'بازگردانی', onConfirm: () => reactivateMember(m.id) })}><RotateCcw size={14} /> بازگردانی</button>}
              {!canManage && !(tab === 'active' && superAdmin && m.role === 'department_admin') && tab === 'active' && <span className="nv-muted">—</span>}
            </div>
          </div>;
        })}
      </div> : <EmptyState icon={<Users size={26} />} title={tab === 'active' ? 'عضوی با این مشخصات پیدا نشد' : 'عضو غیرفعالی وجود ندارد'} description={tab === 'active' ? 'عبارت جست‌وجو یا فیلتر تیم را تغییر بده.' : 'اعضایی که دسترسی‌شان بسته شود اینجا می‌مانند تا در صورت نیاز بازگردانده شوند.'} />}
    </section>
  </div>;
}
