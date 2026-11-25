import React, { useState } from 'react';
import {
  CalendarDays, ChevronDown, ChevronLeft, CircleHelp, ClipboardList, FolderKanban, Gem,
  Layers3, LayoutDashboard, LogOut, Menu, MessageSquareWarning, MoreHorizontal, RefreshCw, Settings2, Users, X,
} from 'lucide-react';
import { ROLE_LABELS, faDate, getDepartment } from '../lib/helpers';
import { Avatar, BrandMark } from './ui';
import { useModalBehavior } from '../lib/hooks';

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

export function Topbar({ profile, dataLoading, setMobileNav, onRefresh, activePage, onProfile }) {
  const today = faDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  const current = NAV_ITEMS.find((item) => item.id === activePage);
  return <header className="nv-topbar">
    <button className="nv-icon-btn nv-menu-btn" onClick={() => setMobileNav(true)} aria-label="باز کردن منو"><Menu size={20} /></button>
    <div className="nv-crumbs"><span>فضای کاری</span><ChevronLeft size={13} /><strong>{current?.label || 'نَوِرا'}</strong><span className="nv-live"><i />آنلاین</span></div>
    <div className="nv-topbar-end">
      <span className="nv-date"><CalendarDays size={15} />{today}</span>
      <button className={`nv-icon-btn ${dataLoading ? 'is-spinning' : ''}`} title="به‌روزرسانی داده‌ها" aria-label="به‌روزرسانی داده‌ها" onClick={onRefresh}><RefreshCw size={17} /></button>
      <span className="nv-divider" />
      <button type="button" className="nv-topbar-user" onClick={onProfile} aria-label="حساب کاربری"><div><strong>{profile.full_name}</strong><small>{getDepartment(profile.department).name}</small></div><Avatar profile={profile} size="small" /></button>
    </div>
  </header>;
}

const TABS = [
  { id: 'overview', label: 'خانه', icon: LayoutDashboard },
  { id: 'projects', label: 'پروژه‌ها', icon: FolderKanban },
  { id: 'tasks', label: 'تسک‌ها', icon: ClipboardList },
  { id: 'calendar', label: 'تقویم', icon: CalendarDays },
];
const MORE_PAGES = ['teams', 'reports', 'members', 'settings'];

// Phone navigation: a native-style tab bar. Secondary pages live in the "more" sheet.
export function BottomNav({ activePage, setActivePage, profile, badges = {}, onSignOut }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const manager = profile.role !== 'member';
  const moreActive = MORE_PAGES.includes(activePage);
  const moreBadge = manager ? badges.reports : null;
  const go = (id) => { setMoreOpen(false); setActivePage(id); };
  return <>
    <nav className="nv-tabbar" aria-label="ناوبری اصلی">
      {TABS.map((tab) => {
        const Icon = tab.icon; const active = tab.id === activePage; const badge = badges[tab.id];
        return <button key={tab.id} type="button" className={`nv-tab ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(tab.id)}>
          <span className="nv-tab-icon"><Icon size={22} strokeWidth={active ? 2.2 : 1.7} />{badge ? <em>{badge}</em> : null}</span><span className="nv-tab-label">{tab.label}</span>
        </button>;
      })}
      <button type="button" className={`nv-tab ${moreActive || moreOpen ? 'is-active' : ''}`} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
        <span className="nv-tab-icon"><MoreHorizontal size={22} strokeWidth={moreActive ? 2.2 : 1.7} />{moreBadge ? <em>{moreBadge}</em> : null}</span><span className="nv-tab-label">بیشتر</span>
      </button>
    </nav>
    {moreOpen && <MoreSheet profile={profile} manager={manager} badges={badges} activePage={activePage} onGo={go} onClose={() => setMoreOpen(false)} onSignOut={onSignOut} />}
  </>;
}

function MoreSheet({ profile, manager, badges, activePage, onGo, onClose, onSignOut }) {
  useModalBehavior(onClose);
  const items = NAV_ITEMS.filter((item) => MORE_PAGES.includes(item.id) && (!item.managersOnly || manager));
  return <div className="nv-sheet-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="nv-sheet" role="dialog" aria-modal="true" aria-label="منوی بیشتر">
      <span className="nv-sheet-handle" aria-hidden="true" />
      <div className="nv-sheet-profile"><Avatar profile={profile} size="medium" /><div><strong>{profile.full_name}</strong><small>{ROLE_LABELS[profile.role]} · {getDepartment(profile.department).name}</small></div></div>
      <div className="nv-sheet-list">
        {items.map((item) => {
          const Icon = item.icon; const badge = badges[item.id];
          return <button key={item.id} type="button" className={`nv-sheet-item ${activePage === item.id ? 'is-active' : ''}`} onClick={() => onGo(item.id)}>
            <span className="nv-sheet-icon"><Icon size={19} /></span><span>{item.label}</span>{badge ? <em>{badge}</em> : null}<ChevronLeft size={16} className="nv-sheet-chev" />
          </button>;
        })}
      </div>
      <button type="button" className="nv-sheet-item is-danger" onClick={() => { onClose(); onSignOut(); }}><span className="nv-sheet-icon"><LogOut size={19} /></span><span>خروج از حساب</span></button>
    </section>
  </div>;
}
