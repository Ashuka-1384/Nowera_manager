import React from 'react';
import { Bell, LogOut, ShieldCheck } from 'lucide-react';
import { ROLE_LABELS, faDate, getDepartment } from '../lib/helpers';
import { Avatar, PageHeader } from '../components/ui';

export default function SettingsPage({ profile, signOut }) {
  const dept = getDepartment(profile.department);
  return <div className="nv-stack">
    <PageHeader eyebrow="ACCOUNT / PREFERENCES" title="حساب کاربری" description="اطلاعات اصلی حساب و وضعیت دسترسی خودت را بررسی کن." />
    <div className="nv-settings">
      <section className="nv-card nv-profile-card nv-rise" style={{ '--i': 1, '--dept-color': dept.color }}>
        <div className="nv-profile-cover"><span>NOWERA MEMBER PROFILE</span></div>
        <div className="nv-profile-id"><Avatar profile={profile} size="large" /><div><h2>{profile.full_name}</h2><p dir="ltr">{profile.phone}</p></div></div>
        <dl className="nv-facts">
          <div><dt>بخش تخصصی</dt><dd>{dept.name} · {dept.english}</dd></div>
          <div><dt>سطح دسترسی</dt><dd>{ROLE_LABELS[profile.role]}</dd></div>
          <div><dt>تاریخ عضویت</dt><dd>{faDate(profile.created_at)}</dd></div>
          <div><dt>وضعیت حساب</dt><dd className="is-active"><i />فعال</dd></div>
        </dl>
      </section>
      <div className="nv-aside">
        <article className="nv-card nv-info nv-rise" style={{ '--i': 2 }}><span className="nv-banner-icon"><ShieldCheck size={20} /></span><div><h3>امنیت و دسترسی</h3><p>دسترسی هر بخش بر اساس نقش کاربر و سیاست‌های امنیتی پایگاه‌داده کنترل می‌شود. تغییر نقش فقط از طریق مدیر اصلی ممکن است.</p></div></article>
        <article className="nv-card nv-info nv-rise" style={{ '--i': 3 }}><span className="nv-banner-icon is-gold"><Bell size={20} /></span><div><h3>اعلان‌ها و پیگیری</h3><p>برای بررسی درخواست‌ها، وضعیت پروژه‌ها و رویدادهای تازه از صفحه‌های پروژه، تسک و تقویم استفاده کن.</p></div></article>
        <article className="nv-card nv-info nv-rise" style={{ '--i': 4 }}><div><h3>پایان این نشست</h3><p>هنگام استفاده از دستگاه مشترک از حساب خارج شو.</p></div><button className="button button-danger-ghost" onClick={signOut}><LogOut size={15} /> خروج از حساب</button></article>
      </div>
    </div>
  </div>;
}
