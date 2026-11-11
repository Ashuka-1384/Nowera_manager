import React, { useState } from 'react';
import {
  Activity, CalendarDays, ChevronDown, ChevronLeft, CircleHelp, ClipboardList, FolderKanban, Gem,
  Layers3, LayoutDashboard, LogOut, Menu, MessageSquareWarning, Settings2, Users, X,
} from 'lucide-react';
import { ROLE_LABELS, faDate, getDepartment } from '../lib/helpers';
import { Avatar, BrandMark } from './ui';

export const NAV_ITEMS = [
  { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard, group: 'workspace' },
  { id: 'projects', label: 'پروژه‌ها', icon: FolderKanban, group: 'workspace' },
  { id: 'tasks', label: 'مدیریت تسک‌ها', icon: ClipboardList, group: 'workspace' },
  { id: 'calendar', label: 'تقویم تیم‌ها', icon: CalendarDays, group: 'workspace' },
  { id: 'teams', label: 'تیم‌های نَوِرا', icon: Layers3, group: 'organization' },
  { id: 'reports', label: 'گزارش و بازخورد', icon: MessageSquareWarning, group: 'organization' },
  { id: 'members', label: 'اعضا و دسترسی‌ها', icon: Users, group: 'management', managersOnly: true },
  { id: 'settings', label: 'حساب کاربری', icon: Settings2, group: 'management' },
];
const GROUPS = [{ id: 'workspace', label: 'فضای کاری' }, { id: 'organization', label: 'سازمان' }, { id: 'management', label: 'مدیریت' }];

export function Sidebar({ activePage, setActivePage, profile, mobileNav, setMobileNav, signOut, badges = {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const manager = profile.role !== 'member';
  return <aside className={`nv-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileNav ? 'is-open' : ''}`}>
    <div className="nv-sidebar-brand">
      <BrandMark small />
      <button className="nv-icon-btn nv-collapse" onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'باز کردن منو' : 'جمع کردن منو'} aria-label="جمع/باز کردن منو"><ChevronLeft size={16} /></button>
      <button className="nv-icon-btn nv-mobile-close" onClick={() => setMobileNav(false)} aria-label="بستن منو"><X size={18} /></button>
    </div>
    <div className="nv-workspace"><span className="nv-workspace-symbol"><Gem size={16} /></span><div><strong>نَوِرا هولدینگ</strong><small>فضای کاری اصلی</small></div><ChevronDown size={14} /></div>
    <nav className="nv-nav" aria-label="ناوبری اصلی">
      {GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group.id && (!item.managersOnly || manager));
        return <div className="nv-nav-group" key={group.id}>
          <span className="nv-nav-label">{group.label}</span>
          {items.map((item) => {
            const Icon = item.icon; const active = item.id === activePage; const badge = badges[item.id];
            return <button key={item.id} title={collapsed ? item.label : undefined} className={`nv-nav-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => setActivePage(item.id)}>
              <Icon size={18} strokeWidth={active ? 2.1 : 1.7} /><span>{item.label}</span>{badge ? <em>{badge}</em> : null}
            </button>;
          })}
        </div>;
      })}
    </nav>
    <div className="nv-sidebar-bottom">
      <div className="nv-help"><span><CircleHelp size={16} /></span><div><b>نیاز به راهنمایی داری؟</b><small>از «گزارش و بازخورد» استفاده کن.</small></div></div>
      <div className="nv-profile-chip"><Avatar profile={profile} size="medium" /><div><strong>{profile.full_name}</strong><small>{ROLE_LABELS[profile.role]}</small></div><button className="nv-icon-btn" title="خروج" aria-label="خروج از حساب" onClick={signOut}><LogOut size={16} /></button></div>
    </div>
  </aside>;
}

export function Topbar({ profile, dataLoading, setMobileNav, onRefresh, activePage }) {
  const today = faDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  const current = NAV_ITEMS.find((item) => item.id === activePage);
  return <header className="nv-topbar">
    <button className="nv-icon-btn nv-menu-btn" onClick={() => setMobileNav(true)} aria-label="باز کردن منو"><Menu size={20} /></button>
    <div className="nv-crumbs"><span>فضای کاری</span><ChevronLeft size={13} /><strong>{current?.label || 'نَوِرا'}</strong><span className="nv-live"><i />آنلاین</span></div>
    <div className="nv-topbar-end">
      <span className="nv-date"><CalendarDays size={15} />{today}</span>
      <button className={`nv-icon-btn ${dataLoading ? 'is-spinning' : ''}`} title="به‌روزرسانی داده‌ها" aria-label="به‌روزرسانی داده‌ها" onClick={onRefresh}><Activity size={17} /></button>
      <span className="nv-divider" />
      <div className="nv-topbar-user"><div><strong>{profile.full_name}</strong><small>{getDepartment(profile.department).name}</small></div><Avatar profile={profile} size="small" /></div>
    </div>
  </header>;
}
