import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, ArrowUpLeft, Bell, CalendarDays, Check, CheckCheck,
  ChevronDown, ChevronLeft, CircleHelp, Clock3, Crown, Flag, FolderKanban,
  Gem, LayoutDashboard, LogIn, LogOut, Menu, MessageSquareWarning, Plus, Send,
  Settings2, ShieldCheck, Sparkles, Target, Users, X, Zap, Ban, CalendarPlus, UserPlus,
  ClipboardList, CircleDot, Search, Layers3, Briefcase, BarChart3,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  DEPARTMENTS, ROLE_LABELS, PROJECT_STATUS, TASK_STATUS, PRIORITY, REQUEST_STATUS,
  normalizePhone, phoneToAuthEmail, getDepartment, initials, faDate, isManager,
} from './lib/helpers';

const EMPTY_DATA = { profiles: [], publicMembers: [], projects: [], tasks: [], events: [], reports: [], projectMembers: [], taskMembers: [] };

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [data, setData] = useState(EMPTY_DATA);
  const [dataLoading, setDataLoading] = useState(false);
  const [landingMembers, setLandingMembers] = useState([]);
  const [activePage, setActivePage] = useState('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) return;
    setProfileLoading(true);
    setProfileError('');
    try {
      const [{ data: row, error }, { data: privatePhone }] = await Promise.all([
        supabase.from('profiles').select('id,full_name,department,role,is_active,avatar_url,created_at').eq('id', userId).maybeSingle(),
        supabase.rpc('my_profile_phone'),
      ]);
      if (row) row.phone = privatePhone || null;
      if (error) {
        setProfile(null);
        setProfileError(/fetch|network|timeout/i.test(error.message || '')
          ? 'ارتباط با Supabase برقرار نشد. آدرس پروژه و اتصال اینترنت/VPN را بررسی کنید.'
          : 'دریافت پروفایل ممکن نشد. مطمئن شوید supabase/schema.sql کامل اجرا شده است.');
      } else if (!row) {
        setProfile(null);
        setProfileError('پروفایل این حساب پیدا نشد. اگر schema را تازه اجرا کرده‌اید، حساب را دوباره ثبت کنید یا پروفایل همین حساب را در دیتابیس بررسی کنید.');
      } else {
        setProfile(row);
        if (!row.is_active) setProfileError('دسترسی این حساب غیرفعال شده است. برای پیگیری با مدیر اصلی تماس بگیرید.');
      }
    } catch (error) {
      setProfile(null);
      setProfileError(/fetch|network|timeout/i.test(error?.message || '')
        ? 'ارتباط با Supabase برقرار نشد. از دستور npm run diagnose برای بررسی URL، کلید و دیتابیس استفاده کنید.'
        : 'در دریافت پروفایل خطایی رخ داد. تنظیمات Supabase را بررسی کنید.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !session?.user?.id || !profile?.is_active) return;
    setDataLoading(true);
    try {
      const results = await Promise.all([
        supabase.from('profiles').select('id,full_name,department,role,is_active,avatar_url,created_at').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('project_members').select('*').order('requested_at', { ascending: false }),
        supabase.from('task_members').select('*').order('requested_at', { ascending: false }),
        supabase.rpc('list_public_members'),
      ]);
      const next = { ...EMPTY_DATA };
      const keys = ['profiles', 'projects', 'tasks', 'events', 'reports', 'projectMembers', 'taskMembers', 'publicMembers'];
      results.forEach((result, index) => {
        if (!result.error && Array.isArray(result.data)) next[keys[index]] = result.data;
        else if (result.error && index === 0) console.warn('profiles query:', result.error.message);
      });
      setData(next);
    } catch (error) {
      console.error('Could not load NOWERA data:', error);
      notify('دریافت داده‌ها از Supabase ناموفق بود. اتصال را بررسی و دوباره تلاش کن.', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [session?.user?.id, profile?.id, profile?.is_active, notify]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined; }
    supabase.auth.getSession().then(({ data: result }) => {
      setSession(result.session);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadProfile(session.user.id);
    else { setProfile(null); setProfileError(''); setData(EMPTY_DATA); }
  }, [session?.user?.id, loadProfile]);

  useEffect(() => { if (profile?.id && profile.is_active) loadData(); }, [profile?.id, profile?.is_active, loadData]);

  const loadLandingMembers = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: rows, error } = await supabase.rpc('list_public_members');
      if (!error && Array.isArray(rows)) setLandingMembers(rows);
      else if (error) console.warn('Public member directory is unavailable:', error.message);
    } catch (error) {
      console.warn('Could not connect to Supabase for the public member directory:', error);
    }
  }, []);
  useEffect(() => { loadLandingMembers(); }, [loadLandingMembers]);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setProfile(null); setData(EMPTY_DATA); setActivePage('overview');
    notify('با موفقیت خارج شدید.');
  };

  const refresh = async () => {
    await loadData();
    await loadLandingMembers();
  };

  const runMutation = async (operation, successMessage) => {
    if (!supabase) { notify('ابتدا اتصال Supabase را در فایل .env تنظیم کنید.', 'error'); return false; }
    try {
      const { error } = await operation();
      if (error) { notify(explainError(error), 'error'); return false; }
      notify(successMessage);
      await refresh();
      return true;
    } catch (error) {
      notify(explainError(error), 'error');
      return false;
    }
  };

  const createProject = async (form) => runMutation(() => supabase.from('projects').insert({
    department: form.department, title: form.title.trim(), description: form.description.trim(),
    status: form.status, deadline: form.deadline || null, created_by: profile.id,
  }), 'پروژه جدید ساخته شد.');

  const createTask = async (form) => runMutation(() => supabase.from('tasks').insert({
    project_id: form.project_id, title: form.title.trim(), description: form.description.trim(),
    priority: form.priority, status: 'todo', due_date: form.due_date || null, created_by: profile.id,
  }), 'تسک جدید ساخته شد.');

  const createEvent = async (form) => runMutation(() => supabase.from('events').insert({
    department: form.department, title: form.title.trim(), details: form.details.trim(),
    event_date: new Date(form.event_date).toISOString(), created_by: profile.id,
  }), 'رویداد به تقویم اضافه شد.');

  const createReport = async (form) => runMutation(() => supabase.from('reports').insert({
    reporter_id: profile.id, department: form.department, target_admin_id: form.target_admin_id || null,
    title: form.title.trim(), message: form.message.trim(),
  }), 'گزارش شما به‌صورت محرمانه ثبت شد.');

  const requestProject = async (projectId) => {
    const existing = data.projectMembers.find((row) => row.project_id === projectId && row.user_id === profile.id);
    if (existing?.status === 'approved') return notify('عضویت شما در این پروژه تأیید شده است.', 'info');
    if (existing?.status === 'pending') return notify('درخواست شما هنوز بررسی نشده است.', 'info');
    if (existing?.status === 'rejected') {
      const removed = await supabase.from('project_members').delete().eq('id', existing.id);
      if (removed.error) return notify(explainError(removed.error), 'error');
    }
    await runMutation(() => supabase.from('project_members').insert({ project_id: projectId, user_id: profile.id, status: 'pending' }), 'درخواست همکاری برای مدیر بخش ارسال شد.');
  };

  const requestTask = async (taskId) => {
    const existing = data.taskMembers.find((row) => row.task_id === taskId && row.user_id === profile.id);
    if (existing?.status === 'approved') return notify('این تسک به شما تخصیص داده شده است.', 'info');
    if (existing?.status === 'pending') return notify('درخواست تسک در انتظار بررسی است.', 'info');
    if (existing?.status === 'rejected') {
      const removed = await supabase.from('task_members').delete().eq('id', existing.id);
      if (removed.error) return notify(explainError(removed.error), 'error');
    }
    await runMutation(() => supabase.from('task_members').insert({ task_id: taskId, user_id: profile.id, status: 'pending' }), 'درخواست دریافت تسک ثبت شد.');
  };

  const decideRequest = async (kind, id, status) => {
    const table = kind === 'project' ? 'project_members' : 'task_members';
    const result = await runMutation(() => supabase.from(table).update({ status, decided_by: profile.id, decided_at: new Date().toISOString() }).eq('id', id), status === 'approved' ? 'درخواست تأیید شد.' : 'درخواست رد شد.');
    return result;
  };

  const updateTask = async (taskId, patch) => runMutation(() => supabase.from('tasks').update(patch).eq('id', taskId), 'تغییرات تسک ذخیره شد.');
  const updateProject = async (projectId, patch) => runMutation(() => supabase.from('projects').update(patch).eq('id', projectId), 'وضعیت پروژه به‌روزرسانی شد.');
  const deleteEvent = async (eventId) => runMutation(() => supabase.from('events').delete().eq('id', eventId), 'رویداد حذف شد.');
  const updateReport = async (reportId, status) => runMutation(() => supabase.from('reports').update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', reportId), 'وضعیت گزارش تغییر کرد.');

  const assignAdmin = async (userId, department) => runMutation(() => supabase.from('profiles').update({ role: 'department_admin', department }).eq('id', userId), 'دسترسی مدیریت بخش اعطا شد.');
  const revokeAdmin = async (userId, department) => runMutation(() => supabase.from('profiles').update({ role: 'member', department }).eq('id', userId), 'دسترسی مدیریت لغو شد.');
  const deactivateMember = async (userId) => runMutation(() => supabase.from('profiles').update({ is_active: false }).eq('id', userId), 'دسترسی عضو غیرفعال شد.');

  const commonProps = {
    profile, data, notify, refresh, openDialog: setDialog, requestProject, requestTask, decideRequest,
    updateTask, updateProject, deleteEvent, updateReport, assignAdmin, revokeAdmin, deactivateMember,
    searchTerm, setSearchTerm,
  };

  if (authLoading || (session?.user?.id && profileLoading)) return <LoadingScreen />;

  if (session && (!profile || profileError || !profile.is_active)) {
    return <div className="auth-state-shell"><BrandMark /><div className="auth-state-card"><div className="notice-icon"><ShieldCheck size={28} /></div><h2>وضعیت حساب</h2><p>{profileError || 'اطلاعات حساب در دسترس نیست.'}</p><button className="button button-primary" onClick={signOut}><LogOut size={16} /> خروج از حساب</button></div></div>;
  }

  if (!session || !profile) {
    return <>
      <Landing members={landingMembers} openAuth={setAuthMode} connectionReady={isSupabaseConfigured} />
      {authMode && <AuthModal mode={authMode} setMode={setAuthMode} close={() => setAuthMode(null)} notify={notify} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>;
  }

  return <div className="app-shell">
    <Sidebar activePage={activePage} setActivePage={(page) => { setActivePage(page); setMobileNav(false); }} profile={profile} mobileNav={mobileNav} setMobileNav={setMobileNav} signOut={signOut} />
    {mobileNav && <button className="nav-scrim" aria-label="بستن منو" onClick={() => setMobileNav(false)} />}
    <main className="workspace">
      <Topbar profile={profile} dataLoading={dataLoading} setMobileNav={setMobileNav} onRefresh={refresh} activePage={activePage} />
      {profileError && <div className="inline-error">{profileError}</div>}
      <div className="page-wrap">
        {activePage === 'overview' && <OverviewPage {...commonProps} setActivePage={setActivePage} />}
        {activePage === 'projects' && <ProjectsPage {...commonProps} />}
        {activePage === 'tasks' && <TasksPage {...commonProps} />}
        {activePage === 'calendar' && <CalendarPage {...commonProps} />}
        {activePage === 'teams' && <TeamsPage {...commonProps} />}
        {activePage === 'reports' && <ReportsPage {...commonProps} />}
        {activePage === 'members' && <MembersPage {...commonProps} />}
        {activePage === 'settings' && <SettingsPage {...commonProps} signOut={signOut} />}
      </div>
      <footer className="app-footer"><span>NOWERA WORKSPACE</span><span>یک چشم‌انداز، چندین قدرت.</span><span>v1.0 · فضای یکپارچه تیم</span></footer>
    </main>
    {dialog && <ActionDialog dialog={dialog} close={() => setDialog(null)} profile={profile} data={data} handlers={{ createProject, createTask, createEvent, createReport }} />}
    {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
  </div>;
}

function explainError(error) {
  const message = error?.message || String(error || 'خطای نامشخص');
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout/i.test(message)) return 'ارتباط با Supabase برقرار نشد. اینترنت/VPN، آدرس پروژه و کلید را بررسی کن و npm run diagnose را اجرا کن.';
  if (/row-level security|permission denied/i.test(message)) return 'دسترسی این عملیات برای نقش فعلی مجاز نیست.';
  if (/duplicate key|already exists/i.test(message)) return 'این درخواست قبلاً ثبت شده است.';
  if (/JWT|session/i.test(message)) return 'نشست شما معتبر نیست؛ خارج شو و دوباره وارد شو.';
  return message;
}

function BrandMark({ small = false }) {
  return <div className={`brand-lockup ${small ? 'brand-lockup-small' : ''}`}><img src="/brands/nowera-symbol.png" alt="NOWERA" /><div><b>NOWERA</b><span>MANAGEMENT SPACE</span></div></div>;
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-orbit"><span /></div><BrandMark /><p>در حال آماده‌سازی فضای کاری شما…</p></div>;
}

function Landing({ members, openAuth, connectionReady }) {
  const [activeDept, setActiveDept] = useState('Technoplus');
  return <div className="landing-page">
    <header className="landing-nav">
      <BrandMark small />
      <nav><a href="#about">درباره نَوِرا</a><a href="#departments">تیم‌ها</a><a href="#members">اعضا</a></nav>
      <div className="landing-actions"><button className="button button-ghost" onClick={() => openAuth('login')}><LogIn size={16} /> ورود</button><button className="button button-primary" onClick={() => openAuth('signup')}>عضویت در نَوِرا <ArrowUpLeft size={16} /></button></div>
    </header>
    {!connectionReady && <div className="connection-notice"><AlertCircle size={17} /><span><strong>اتصال دیتابیس هنوز تنظیم نشده است.</strong> در پوشه پروژه دستور <code>npm run setup</code> را اجرا کن؛ سپس <code>npm run diagnose</code> اتصال را بررسی می‌کند.</span></div>}
    <section className="hero-section" id="about">
      <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> یک ساختار، چهار تخصص، یک مسیر</div><h1>با هم می‌سازیم؛<br /><span>بزرگ‌تر از مجموع</span><br />توانایی‌هایمان.</h1><p className="hero-description">NOWERA خانه‌ی تیم‌هایی‌ست که با تخصص‌های متفاوت، برای یک چشم‌انداز مشترک کار می‌کنند. از ایده تا اجرا، همه‌چیز در یک فضای هماهنگ.</p>
        <div className="hero-buttons"><button className="button button-primary button-large" onClick={() => openAuth('signup')}>شروع همکاری <ArrowLeft size={17} /></button><a href="#departments" className="button button-ghost button-large">کشف تیم‌ها <ChevronDown size={16} /></a></div>
        <div className="hero-proof"><div className="proof-avatars">{['N','L','T','A'].map((s, i) => <span key={s} style={{ '--i': i }}>{s}</span>)}</div><div><strong>{members.length ? toFaDigits(members.length) : '۴'} <small>+</small></strong><span>تخصص‌های مکمل، یک تیم</span></div><div className="proof-divider" /><div><strong>۰۱</strong><span>چشم‌انداز مشترک</span></div></div>
      </div>
      <div className="hero-visual"><div className="visual-grid" /><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="hero-logo-frame"><img src="/brands/nowera.png" alt="نشان نَوِرا" /></div><div className="floating-card float-card-top"><span className="float-spark"><Sparkles size={16} /></span><div><b>One Vision</b><small>هم‌جهت، هم‌قدم</small></div></div><div className="floating-card float-card-bottom"><div className="mini-bars"><i /><i /><i /><i /></div><div><b>Multiple Powers</b><small>چهار بازوی تخصصی</small></div></div><span className="visual-caption">EST. FOR WHAT'S NEXT</span></div>
      <div className="hero-bottom-line"><span>01 / 04</span><div><i /></div><span>SCROLL TO EXPLORE</span></div>
    </section>
    <section className="values-section"><div className="section-heading"><span className="section-kicker">HOW WE WORK</span><h2>ساختار منظم برای <span>ایده‌های بزرگ</span></h2><p>از هماهنگی روزانه تا تحویل پروژه؛ هر بخش ابزار مناسب خودش را دارد و در عین حال با بقیه تیم‌ها در ارتباط است.</p></div><div className="values-grid"><ValueCard number="01" icon={<Target />} title="هدف مشترک" desc="همه تیم‌ها در یک مسیر و با اولویت‌های شفاف حرکت می‌کنند." /><ValueCard number="02" icon={<Layers3 />} title="تخصص مستقل" desc="هر بخش هویت، فرآیند و فضای کاری متناسب با خودش را دارد." /><ValueCard number="03" icon={<BarChart3 />} title="پیشرفت قابل پیگیری" desc="پروژه، تسک، ضرب‌الاجل و رویدادها در یک نمای یکپارچه." /></div></section>
    <section className="departments-section" id="departments"><div className="section-heading section-heading-row"><div><span className="section-kicker">THE FOUR DIVISIONS</span><h2>چهار تیم. <span>یک نَوِرا.</span></h2></div><p>تخصصت را پیدا کن و به تیمی بپیوند که برای رشدت فضا می‌سازد.</p></div><div className="department-showcase">{DEPARTMENTS.map((department, i) => <DepartmentCard key={department.id} department={department} index={i} active={activeDept === department.id} setActive={() => setActiveDept(department.id)} openAuth={openAuth} />)}</div><div className="department-detail-strip" style={{ '--dept-color': getDepartment(activeDept).color }}><div className="detail-mark"><img src={getDepartment(activeDept).logo} alt="" /></div><div><span className="section-kicker">MEET {getDepartment(activeDept).english.toUpperCase()}</span><h3>{getDepartment(activeDept).name}</h3><p>{getDepartment(activeDept).tagline}؛ بخشی از یک سیستم هماهنگ که برای خروجی بهتر کنار هم قرار گرفته‌اند.</p></div><button className="button button-outline" onClick={() => openAuth('signup')}>عضویت در {getDepartment(activeDept).name} <ArrowLeft size={16} /></button></div></section>
    <section className="members-section" id="members"><div className="section-heading section-heading-row"><div><span className="section-kicker">THE PEOPLE BEHIND IT</span><h2>آدم‌ها، <span>مهم‌ترین بخش ما</span></h2></div><p>هر پروژه با آدم‌هایی جلو می‌رود که دانش و مسئولیتشان را با هم به اشتراک می‌گذارند.</p></div>{members.length ? <div className="public-members-grid">{members.slice(0, 8).map((member) => <MemberMiniCard key={member.id} member={member} />)}</div> : <div className="members-empty"><div className="empty-icon"><Users size={25} /></div><h3>جای تو هم اینجاست</h3><p>بعد از راه‌اندازی سیستم، اعضای فعال نَوِرا در این بخش نمایش داده می‌شوند.</p><button className="text-button" onClick={() => openAuth('signup')}>اولین قدم را بردار <ArrowLeft size={15} /></button></div>}</section>
    <section className="closing-cta"><div className="cta-glow" /><div className="cta-content"><span className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</span><h2>برای ساختن چیزهای <span>بزرگ‌تر</span><br />به ما بپیوند.</h2><p>حضور هر عضو، یک قدرت تازه به این مجموعه اضافه می‌کند.</p><button className="button button-primary button-large" onClick={() => openAuth('signup')}>عضویت در نَوِرا <ArrowLeft size={17} /></button></div><div className="cta-watermark">N.</div></section>
    <footer className="landing-footer"><BrandMark small /><span>© NOWERA · ONE VISION. MULTIPLE POWERS.</span><div><a href="#about">درباره ما</a><button onClick={() => openAuth('login')}>ورود اعضا</button></div></footer>
  </div>;
}

function ValueCard({ number, icon, title, desc }) {
  return <article className="value-card"><div className="value-card-top"><span>{number}</span><div className="value-icon">{icon}</div></div><h3>{title}</h3><p>{desc}</p><div className="value-card-line" /></article>;
}

function DepartmentCard({ department, index, active, setActive, openAuth }) {
  return <article className={`department-card ${active ? 'department-card-active' : ''}`} style={{ '--dept-color': department.color, '--dept-glow': department.glow }} onClick={setActive}>
    <div className="department-card-top"><span>0{index + 1}</span><span className="dept-dot" /></div><div className="dept-logo-holder"><img src={department.logo} alt={`${department.english} logo`} /></div><div className="dept-card-copy"><span className="dept-english">{department.english}</span><h3>{department.name}</h3><p>{department.tagline}</p></div><div className="dept-card-bottom"><span>EXPLORE TEAM</span><button aria-label={`عضویت در ${department.name}`} onClick={(e) => { e.stopPropagation(); openAuth('signup'); }}><ArrowLeft size={17} /></button></div>
  </article>;
}

function MemberMiniCard({ member }) {
  const department = getDepartment(member.department);
  return <article className="public-member-card"><div className="member-avatar" style={{ '--dept-color': department.color }}>{initials(member.full_name)}</div><div className="member-mini-data"><strong>{member.full_name}</strong><span>{ROLE_LABELS[member.role] || 'عضو تیم'}</span></div><span className="member-team-dot" style={{ '--dept-color': department.color }} title={department.name} /><div className="member-department-label">{department.name}</div></article>;
}

function AuthModal({ mode, setMode, close, notify }) {
  const [form, setForm] = useState({ full_name: '', phone: '', password: '', department: 'Technoplus' });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === 'signup';
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return notify('اتصال Supabase تنظیم نشده است. ابتدا مراحل راه‌اندازی README را انجام دهید.', 'error');
    const phone = normalizePhone(form.phone);
    if (!/^\+989\d{9}$/.test(phone)) return notify('شماره موبایل را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.', 'error');
    if (form.password.length < 8) return notify('رمز عبور باید حداقل ۸ کاراکتر باشد.', 'error');
    if (isSignup && form.full_name.trim().length < 2) return notify('نام و نام خانوادگی را وارد کنید.', 'error');
    setBusy(true);
    try {
      let result;
      // The UI still asks for a phone number, but Supabase Auth uses a
      // deterministic non-deliverable email alias so no SMS provider is needed.
      const authEmail = phoneToAuthEmail(phone);
      if (isSignup) {
        result = await supabase.auth.signUp({
          email: authEmail,
          password: form.password,
          options: { data: { full_name: form.full_name.trim(), department: form.department, phone } },
        });
      } else {
        result = await supabase.auth.signInWithPassword({ email: authEmail, password: form.password });
      }
      if (result.error) return notify(explainAuthError(result.error), 'error');
      if (isSignup && !result.data.session) {
        notify('حساب ایجاد شد، اما ورود فوری فعال نیست. در Supabase بخش Authentication → Sign In / Providers → Email، گزینه Confirm email را خاموش کن.', 'error');
        return;
      }
      notify(isSignup ? 'عضویت شما در نَوِرا انجام شد؛ خوش آمدید!' : 'با موفقیت وارد شدید.');
      close();
    } catch (error) {
      notify(explainAuthError(error), 'error');
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-scrim" onClick={close}><section className="auth-modal" onClick={(e) => e.stopPropagation()}>
    <button className="modal-close" onClick={close} aria-label="بستن"><X size={18} /></button><div className="auth-modal-brand"><BrandMark /><span className="auth-vertical-line" /></div>
    <div className="auth-heading"><span className="section-kicker">{isSignup ? 'BECOME A PART OF NOWERA' : 'WELCOME BACK'}</span><h2>{isSignup ? 'به نَوِرا خوش آمدی.' : 'دوباره خوش آمدی.'}</h2><p>{isSignup ? 'پروفایل خودت را بساز و مسیر همکاری را شروع کن.' : 'با شماره موبایل و رمز عبورت وارد فضای کاری شو.'}</p></div>
    <form className="auth-form" onSubmit={submit}>
      {isSignup && <label>نام و نام خانوادگی<input autoComplete="name" required minLength={2} maxLength={100} value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="مثلاً آرمین رضایی" /></label>}
      <label>شماره موبایل<div className="phone-field"><span>+98</span><input dir="ltr" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="09123456789" /></div></label>
      <label>رمز عبور<div className="password-field"><input dir="ltr" type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="حداقل ۸ کاراکتر" /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'پنهان' : 'نمایش'}</button></div></label>
      {isSignup && <label>بخش موردعلاقه‌ات<select value={form.department} onChange={(e) => update('department', e.target.value)}>{DEPARTMENTS.map((department) => <option value={department.id} key={department.id}>{department.name} · {department.english}</option>)}</select></label>}
      <button disabled={busy} className="button button-primary auth-submit" type="submit">{busy ? <span className="button-spinner" /> : isSignup ? <UserPlus size={17} /> : <LogIn size={17} />}{busy ? 'در حال پردازش…' : isSignup ? 'ساخت حساب و عضویت' : 'ورود به فضای کاری'}<ArrowLeft size={16} /></button>
    </form>
    <div className="auth-switch">{isSignup ? 'قبلاً عضو شده‌ای؟' : 'هنوز حساب کاربری نداری؟'} <button onClick={() => setMode(isSignup ? 'login' : 'signup')}>{isSignup ? 'وارد شو' : 'عضویت در نَوِرا'}</button></div>
    <div className="auth-security"><ShieldCheck size={15} /><span>دسترسی‌ها به‌صورت نقش‌محور کنترل می‌شوند.</span></div>
  </section></div>;
}

function explainAuthError(error) {
  const message = error?.message || String(error || '');
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout/i.test(message)) {
    return 'به Supabase وصل نشدیم. آدرس VITE_SUPABASE_URL و کلید Publishable/anon را بررسی کن؛ مطمئن شو پروژه Supabase فعال است و اینترنت/VPN به supabase.co دسترسی دارد. برای بررسی دقیق در ترمینال npm run diagnose را اجرا کن.';
  }
  if (/invalid login credentials/i.test(message)) return 'شماره موبایل یا رمز عبور اشتباه است.';
  if (/email provider is disabled|email logins are disabled|unsupported provider.*email/i.test(message)) return 'در Supabase به Authentication → Sign In / Providers → Email برو و ورود ایمیلی را فعال کن؛ نیازی به فعال‌کردن Phone یا SMS نیست.';
  if (/password should be at least/i.test(message)) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  if (/user already registered|already been registered/i.test(message)) return 'این شماره قبلاً ثبت شده است؛ از بخش ورود استفاده کن.';
  if (/email.*invalid|invalid.*email/i.test(message)) return 'Supabase شناسهٔ داخلی ورود را نپذیرفت. مطمئن شو Email provider فعال و Confirm email خاموش است؛ اگر خطا ادامه داشت متن دقیق خطا را بررسی کن.';
  if (/signups not allowed/i.test(message)) return 'ثبت‌نام عمومی در تنظیمات Auth غیرفعال است.';
  if (/rate limit/i.test(message)) return 'تعداد تلاش‌ها زیاد شده است؛ کمی بعد دوباره امتحان کن.';
  return message || 'ورود یا ثبت‌نام انجام نشد.';
}

function Toast({ toast, onClose }) {
  return <div className={`toast toast-${toast.type || 'success'}`} key={toast.key}><span className="toast-icon">{toast.type === 'error' ? <AlertCircle size={18} /> : toast.type === 'info' ? <CircleHelp size={18} /> : <Check size={18} />}</span><span>{toast.message}</span><button aria-label="بستن پیام" onClick={onClose}><X size={15} /></button></div>;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard, group: 'workspace' },
  { id: 'projects', label: 'پروژه‌ها', icon: FolderKanban, group: 'workspace' },
  { id: 'tasks', label: 'مدیریت تسک‌ها', icon: ClipboardList, group: 'workspace' },
  { id: 'calendar', label: 'تقویم تیم‌ها', icon: CalendarDays, group: 'workspace' },
  { id: 'teams', label: 'تیم‌های نَوِرا', icon: Layers3, group: 'organization' },
  { id: 'reports', label: 'گزارش و بازخورد', icon: MessageSquareWarning, group: 'organization' },
  { id: 'members', label: 'اعضا و دسترسی‌ها', icon: Users, group: 'management', managersOnly: true },
  { id: 'settings', label: 'حساب کاربری', icon: Settings2, group: 'management' },
];

function Sidebar({ activePage, setActivePage, profile, mobileNav, setMobileNav, signOut }) {
  const [collapsed, setCollapsed] = useState(false);
  const manager = profile.role !== 'member';
  const groups = [
    { id: 'workspace', label: 'فضای کاری' }, { id: 'organization', label: 'سازمان' }, { id: 'management', label: 'مدیریت' },
  ];
  return <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileNav ? 'sidebar-mobile-open' : ''}`}>
    <div className="sidebar-brand"><BrandMark small /><button className="sidebar-collapse" onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}><ChevronLeft size={17} /></button><button className="sidebar-mobile-close" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
    <div className="workspace-switcher"><div className="workspace-symbol"><Gem size={16} /></div><div className="workspace-switch-copy"><strong>نَوِرا هولدینگ</strong><span>فضای کاری اصلی</span></div><ChevronDown size={15} /></div>
    <div className="sidebar-nav">{groups.map((group) => <div className="nav-group" key={group.id}><span className="nav-group-label">{group.label}</span>{NAV_ITEMS.filter((item) => item.group === group.id && (!item.managersOnly || manager)).map((item) => { const Icon = item.icon; const isActive = item.id === activePage; const count = item.id === 'projects' ? null : item.id === 'reports' && profile.role === 'super_admin' ? undefined : null; return <button key={item.id} title={collapsed ? item.label : undefined} className={`nav-item ${isActive ? 'nav-item-active' : ''}`} onClick={() => setActivePage(item.id)}><Icon size={18} strokeWidth={isActive ? 2.1 : 1.7} /><span>{item.label}</span>{count !== null && count !== undefined ? <i>{count}</i> : null}{isActive && <span className="nav-active-edge" />}</button>; })}</div>)}</div>
    <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><CircleHelp size={17} /></div><div><b>نیاز به راهنمایی داری؟</b><span>از گزارش و بازخورد استفاده کن.</span></div></div><div className="sidebar-profile"><Avatar profile={profile} size="medium" /><div className="sidebar-user"><strong>{profile.full_name}</strong><span>{ROLE_LABELS[profile.role]}</span></div><button title="خروج" onClick={signOut}><LogOut size={16} /></button></div><div className="sidebar-version">NOWERA OS <span>1.0.0</span></div></div>
  </aside>;
}

function Topbar({ profile, dataLoading, setMobileNav, onRefresh, activePage }) {
  const today = faDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  return <header className="topbar"><button className="topbar-mobile-menu" onClick={() => setMobileNav(true)} aria-label="باز کردن منو"><Menu size={21} /></button><div className="breadcrumb"><span>فضای کاری</span><ChevronLeft size={14} /><strong>{NAV_ITEMS.find((item) => item.id === activePage)?.label || 'نَوِرا'}</strong><span className="live-status"><i /> آنلاین</span></div><div className="topbar-actions"><span className="topbar-date"><CalendarDays size={15} />{today}</span><button className={`topbar-icon-button ${dataLoading ? 'is-spinning' : ''}`} title="به‌روزرسانی داده‌ها" onClick={onRefresh}><Activity size={18} /></button><div className="topbar-divider" /><div className="topbar-user"><div><strong>{profile.full_name}</strong><span>{getDepartment(profile.department).name}</span></div><Avatar profile={profile} size="small" /></div></div></header>;
}

function Avatar({ profile, size = 'medium' }) {
  const department = getDepartment(profile?.department);
  return <div className={`avatar avatar-${size}`} style={{ '--dept-color': department.color }}>{initials(profile?.full_name)}</div>;
}

function PageHeader({ eyebrow, title, description, action, badge }) {
  return <div className="page-heading"><div><div className="page-eyebrow"><span />{eyebrow}</div><h1>{title} {badge && <span className="page-heading-badge">{badge}</span>}</h1><p>{description}</p></div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

function OverviewPage({ profile, data, setActivePage, openDialog, decideRequest, updateTask, updateProject }) {
  const manager = profile.role !== 'member';
  const myProjects = data.projects.filter((project) => isManager(profile, project.department) || data.projectMembers.some((membership) => membership.project_id === project.id && membership.user_id === profile.id && membership.status === 'approved'));
  const myTasks = data.tasks.filter((task) => isManager(profile, data.projects.find((project) => project.id === task.project_id)?.department) || data.taskMembers.some((membership) => membership.task_id === task.id && membership.user_id === profile.id && membership.status === 'approved'));
  const myEvents = data.events.filter((event) => event.event_date && new Date(event.event_date) >= new Date(Date.now() - 86400000)).slice(0, 4);
  const pendingProjects = data.projectMembers.filter((row) => row.status === 'pending' && isManager(profile, data.projects.find((project) => project.id === row.project_id)?.department));
  const pendingTasks = data.taskMembers.filter((row) => row.status === 'pending' && isManager(profile, data.projects.find((project) => project.id === data.tasks.find((task) => task.id === row.task_id)?.project_id)?.department));
  const pendingCount = pendingProjects.length + pendingTasks.length;
  return <div className="page-content overview-page">
    <PageHeader eyebrow="YOUR WORKSPACE / OVERVIEW" title={`روزت بخیر، ${profile.full_name.split(' ')[0]}`} description="اینجا تصویر کلی از پروژه‌ها، کارهای در جریان و اتفاق‌های پیش روی توست." action={<button className="button button-primary" onClick={() => setActivePage('projects')}><Plus size={16} /> مشاهده پروژه‌ها</button>} />
    <div className="welcome-banner"><div className="welcome-banner-copy"><span className="welcome-chip"><Sparkles size={13} /> SPACE FOR BIG IDEAS</span><h2>قدرت‌ها کنار هم،<br /><span>نتیجه‌ها فراتر.</span></h2><p>برای جلو رفتن فقط کافی‌ست قدم بعدی مشخص باشد؛ بقیه مسیر را با هم می‌سازیم.</p><button className="welcome-link" onClick={() => setActivePage('teams')}>تیم‌های نَوِرا را بشناس <ArrowLeft size={16} /></button></div><div className="welcome-illustration"><div className="welcome-ring ring-one" /><div className="welcome-ring ring-two" /><div className="welcome-diamond"><img src="/brands/nowera.png" alt="" /></div><span className="welcome-orbit-label orbit-label-a">FOCUS</span><span className="welcome-orbit-label orbit-label-b">CREATE</span><span className="welcome-orbit-label orbit-label-c">GROW</span></div></div>
    <div className="stats-grid"><StatCard label="پروژه‌های در دسترس" value={myProjects.length} icon={<FolderKanban size={18} />} tone="blue" foot={`${data.projects.filter((p) => p.status === 'active').length} پروژه فعال در نَوِرا`} /><StatCard label="تسک‌های در دست اقدام" value={myTasks.filter((t) => t.status !== 'done').length} icon={<ClipboardList size={18} />} tone="purple" foot={`${myTasks.filter((t) => t.status === 'done').length} تسک تکمیل‌شده`} /><StatCard label="رویدادهای پیش‌رو" value={myEvents.length} icon={<CalendarDays size={18} />} tone="gold" foot="جلسه‌ها و ددلاین‌ها" /><StatCard label={manager ? 'درخواست‌های بررسی‌نشده' : 'اعضای فعال نَوِرا'} value={manager ? pendingCount : data.publicMembers.filter((p) => p.id !== profile.id || p.is_active).length} icon={manager ? <Bell size={18} /> : <Users size={18} />} tone="green" foot={manager ? 'نیازمند بررسی مدیر' : 'اعضای فعال در نَوِرا'} /> </div>
    <div className="overview-columns"><section className="panel-card projects-panel"><div className="panel-heading"><div><span className="panel-kicker">RECENT ACTIVITY</span><h3>پروژه‌های اخیر</h3></div><button className="subtle-link" onClick={() => setActivePage('projects')}>همه پروژه‌ها <ArrowLeft size={14} /></button></div>
      {myProjects.length ? <div className="compact-project-list">{myProjects.slice(0, 4).map((project) => <CompactProject key={project.id} project={project} />)}</div> : <EmptyState icon={<FolderKanban size={23} />} title="هنوز پروژه‌ای در فضای تو نیست" description="با بررسی پروژه‌ها، درخواست همکاری خودت را ثبت کن." action={<button className="button button-secondary button-small" onClick={() => setActivePage('projects')}>کشف پروژه‌ها <ArrowLeft size={14} /></button>} />}
    </section><section className="panel-card agenda-panel"><div className="panel-heading"><div><span className="panel-kicker">UP NEXT</span><h3>تقویم نزدیک</h3></div><button className="panel-icon-button" onClick={() => setActivePage('calendar')}><ArrowLeft size={16} /></button></div>{myEvents.length ? <div className="agenda-list">{myEvents.map((event) => <AgendaRow key={event.id} event={event} />)}</div> : <EmptyState icon={<CalendarDays size={22} />} title="رویدادی ثبت نشده" description="جلسه‌ها و ددلاین‌های تیم در اینجا نمایش داده می‌شوند." />}</section></div>
    {manager && <section className="panel-card review-panel"><div className="panel-heading"><div><span className="panel-kicker">NEEDS YOUR ATTENTION</span><h3>درخواست‌های همکاری <span className="tiny-count">{toFaDigits(pendingCount)}</span></h3></div><span className="review-note"><Clock3 size={14} /> منتظر تصمیم شما</span></div>{pendingCount ? <div className="review-requests">{pendingProjects.slice(0, 3).map((row) => <RequestRow key={`p-${row.id}`} row={row} kind="project" data={data} decideRequest={decideRequest} />)}{pendingTasks.slice(0, 3).map((row) => <RequestRow key={`t-${row.id}`} row={row} kind="task" data={data} decideRequest={decideRequest} />)}</div> : <div className="review-empty"><CheckCheck size={20} /> درخواست معوقی برای بررسی وجود ندارد.</div>}</section>}
  </div>;
}

function StatCard({ label, value, icon, tone, foot }) {
  return <article className={`stat-card stat-${tone}`}><div className="stat-card-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{toFaDigits(value)}</div><div className="stat-card-foot"><span className="stat-foot-dot" />{foot}</div></article>;
}

function CompactProject({ project }) {
  const department = getDepartment(project.department);
  return <div className="compact-project"><div className="compact-project-avatar" style={{ '--dept-color': department.color }}><Briefcase size={17} /></div><div className="compact-project-main"><strong>{project.title}</strong><span>{department.name} · {project.deadline ? `ددلاین ${faDate(project.deadline)}` : 'بدون ددلاین'}</span></div><StatusPill status={project.status} type="project" /></div>;
}

function AgendaRow({ event, canEdit = false, deleteEvent }) {
  const date = new Date(event.event_date);
  return <div className="agenda-row"><div className="agenda-date"><strong>{toFaDigits(date.getDate())}</strong><span>{new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(date)}</span></div><div className="agenda-event-copy"><strong>{event.title}</strong><span>{getDepartment(event.department).name} · {new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date)}</span>{event.details && <p>{event.details}</p>}</div>{canEdit && <button className="icon-button danger-icon" title="حذف رویداد" onClick={() => deleteEvent(event.id)}><X size={15} /></button>}</div>;
}

function ProjectsPage({ profile, data, openDialog, requestProject, decideRequest, updateProject, searchTerm, setSearchTerm }) {
  const [departmentFilter, setDepartmentFilter] = useState(profile.role === 'department_admin' ? profile.department : 'all');
  const visibleProjects = data.projects.filter((project) => (departmentFilter === 'all' || project.department === departmentFilter) && `${project.title} ${project.description}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const manager = profile.role !== 'member';
  const pendingRows = data.projectMembers.filter((row) => row.status === 'pending' && isManager(profile, data.projects.find((project) => project.id === row.project_id)?.department));
  return <div className="page-content"><PageHeader eyebrow="PROJECT HUB / PORTFOLIO" title="پروژه‌های نَوِرا" description="پروژه‌ها را کشف کن، برای همکاری درخواست بده و پیشرفت کارها را دنبال کن." action={manager && <button className="button button-primary" onClick={() => openDialog({ type: 'project' })}><Plus size={16} /> پروژه جدید</button>} />
    <div className="filter-toolbar"><div className="search-field"><Search size={17} /><input placeholder="جست‌وجوی پروژه…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><kbd>⌘ K</kbd></div><div className="department-filter"><span>نمایش:</span><select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>{profile.role === 'super_admin' && <option value="all">همه تیم‌ها</option>}{DEPARTMENTS.filter((d) => profile.role !== 'department_admin' || d.id === profile.department).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div></div>
    {visibleProjects.length ? <div className="projects-grid">{visibleProjects.map((project) => <ProjectCard key={project.id} project={project} profile={profile} data={data} requestProject={requestProject} updateProject={updateProject} />)}</div> : <EmptyState icon={<FolderKanban size={25} />} title="پروژه‌ای پیدا نشد" description={manager ? 'با ساخت اولین پروژه، مسیر همکاری اعضا را شروع کنید.' : 'پروژه جدیدی مطابق این فیلتر وجود ندارد. بعداً دوباره بررسی کن.'} action={manager && <button className="button button-primary button-small" onClick={() => openDialog({ type: 'project' })}><Plus size={15} /> ساخت پروژه</button>} />}
    {manager && <section className="panel-card approvals-panel"><div className="panel-heading"><div><span className="panel-kicker">JOIN REQUESTS</span><h3>درخواست‌های عضویت پروژه</h3></div><span className="tiny-count">{toFaDigits(pendingRows.length)}</span></div>{pendingRows.length ? <div className="review-requests">{pendingRows.map((row) => <RequestRow key={row.id} row={row} kind="project" data={data} decideRequest={decideRequest} />)}</div> : <p className="muted-empty-text">در حال حاضر درخواست جدیدی وجود ندارد.</p>}</section>}
  </div>;
}

function ProjectCard({ project, profile, data, requestProject, updateProject }) {
  const department = getDepartment(project.department);
  const manager = isManager(profile, project.department);
  const membership = data.projectMembers.find((row) => row.project_id === project.id && row.user_id === profile.id);
  const count = data.projectMembers.filter((row) => row.project_id === project.id && row.status === 'approved').length;
  const taskCount = data.tasks.filter((task) => task.project_id === project.id).length;
  return <article className="project-card" style={{ '--dept-color': department.color, '--dept-glow': department.glow }}><div className="project-card-glow" /><div className="project-card-top"><div className="project-department-chip"><span />{department.name}</div><StatusPill status={project.status} type="project" /></div><div className="project-card-icon"><img src={department.logo} alt="" /></div><h3>{project.title}</h3><p className="project-card-desc">{project.description || 'برای این پروژه هنوز توضیحی ثبت نشده است.'}</p><div className="project-card-meta"><span><Users size={14} />{toFaDigits(count)} همکار</span><span><ClipboardList size={14} />{toFaDigits(taskCount)} تسک</span>{project.deadline && <span><CalendarDays size={14} />{faDate(project.deadline)}</span>}</div><div className="project-card-bottom">{manager ? <div className="project-manager-actions"><select value={project.status} onChange={(e) => updateProject(project.id, { status: e.target.value })} aria-label="وضعیت پروژه"><option value="planning">برنامه‌ریزی</option><option value="active">در حال اجرا</option><option value="paused">متوقف</option><option value="completed">تکمیل‌شده</option></select></div> : <span className={`membership-state membership-${membership?.status || 'none'}`}>{membership ? REQUEST_STATUS[membership.status] : 'به همکار نیاز داریم'}</span>}{!manager && <button disabled={membership?.status === 'pending' || membership?.status === 'approved'} className={`button ${membership?.status === 'approved' ? 'button-secondary' : 'button-outline'} button-small`} onClick={() => requestProject(project.id)}>{membership?.status === 'pending' ? 'در انتظار' : membership?.status === 'approved' ? 'عضو پروژه' : membership?.status === 'rejected' ? 'ارسال دوباره' : 'درخواست همکاری'}<ArrowLeft size={14} /></button>}{manager && <span className="project-manager-label"><ShieldCheck size={14} /> دسترسی مدیر</span>}</div></article>;
}

function TasksPage({ profile, data, openDialog, requestTask, decideRequest, updateTask }) {
  const [filter, setFilter] = useState('all');
  const projectMap = useMemo(() => Object.fromEntries(data.projects.map((p) => [p.id, p])), [data.projects]);
  const visibleTasks = data.tasks.filter((task) => filter === 'all' || task.status === filter);
  const manager = profile.role !== 'member';
  const pendingRows = data.taskMembers.filter((row) => row.status === 'pending' && isManager(profile, projectMap[data.tasks.find((task) => task.id === row.task_id)?.project_id]?.department));
  return <div className="page-content"><PageHeader eyebrow="TASK CONTROL / EXECUTION" title="مدیریت تسک‌ها" description="هر تسک بخشی از یک مسیر بزرگ‌تر است؛ مسئولیت‌ها و وضعیت اجرا را اینجا پیگیری کن." action={manager && <button className="button button-primary" onClick={() => openDialog({ type: 'task' })}><Plus size={16} /> تعریف تسک</button>} />
    <div className="task-intro-strip"><div className="task-intro-icon"><Zap size={19} /></div><div><strong>هم‌کاری چندنفره فعال است</strong><p>چند عضو می‌توانند هم‌زمان روی یک تسک کار کنند؛ درخواست‌ها پس از تأیید مدیر به اعضای تسک اضافه می‌شوند.</p></div></div>
    <div className="task-filter-tabs">{[{ id: 'all', label: 'همه تسک‌ها' }, { id: 'todo', label: 'شروع‌نشده' }, { id: 'in_progress', label: 'در حال انجام' }, { id: 'review', label: 'در انتظار بررسی' }, { id: 'done', label: 'تکمیل‌شده' }].map((item) => <button key={item.id} className={filter === item.id ? 'task-filter-active' : ''} onClick={() => setFilter(item.id)}>{item.label}<span>{toFaDigits(item.id === 'all' ? data.tasks.length : data.tasks.filter((t) => t.status === item.id).length)}</span></button>)}</div>
    {visibleTasks.length ? <div className="tasks-list">{visibleTasks.map((task) => <TaskRow key={task.id} task={task} project={projectMap[task.project_id]} profile={profile} data={data} requestTask={requestTask} updateTask={updateTask} />)}</div> : <EmptyState icon={<ClipboardList size={24} />} title="تسکی در این فهرست نیست" description={manager ? 'از تعریف تسک، کارهای پروژه را به قدم‌های کوچک‌تر تبدیل کن.' : 'برای مشاهده تسک‌ها ابتدا باید عضو تأییدشده یک پروژه باشی. از بخش پروژه‌ها درخواست همکاری بفرست.'} />}
    {manager && <section className="panel-card approvals-panel"><div className="panel-heading"><div><span className="panel-kicker">TASK ASSIGNMENTS</span><h3>درخواست‌های دریافت تسک</h3></div><span className="tiny-count">{toFaDigits(pendingRows.length)}</span></div>{pendingRows.length ? <div className="review-requests">{pendingRows.map((row) => <RequestRow key={row.id} row={row} kind="task" data={data} decideRequest={decideRequest} />)}</div> : <p className="muted-empty-text">درخواست معوقی برای بررسی وجود ندارد.</p>}</section>}
  </div>;
}

function TaskRow({ task, project, profile, data, requestTask, updateTask }) {
  if (!project) return null;
  const department = getDepartment(project.department);
  const manager = isManager(profile, project.department);
  const taskMembership = data.taskMembers.find((row) => row.task_id === task.id && row.user_id === profile.id);
  const projectMembership = data.projectMembers.find((row) => row.project_id === project.id && row.user_id === profile.id);
  const canRequest = projectMembership?.status === 'approved';
  const membersCount = data.taskMembers.filter((row) => row.task_id === task.id && row.status === 'approved').length;
  return <article className="task-row"><div className={`task-priority-line priority-${task.priority}`} /><div className="task-checkbox-visual" data-done={task.status === 'done'}>{task.status === 'done' ? <Check size={16} /> : <CircleDot size={16} />}</div><div className="task-main"><div className="task-row-title"><h3>{task.title}</h3><StatusPill status={task.status} type="task" /></div><div className="task-row-meta"><span className="task-project-name" style={{ '--dept-color': department.color }}>{project.title}</span><span className="meta-separator" /><span><Flag size={13} /> اولویت {PRIORITY[task.priority]}</span>{task.due_date && <><span className="meta-separator" /><span><CalendarDays size={13} />{faDate(task.due_date)}</span></>}</div>{task.description && <p className="task-row-desc">{task.description}</p>}</div><div className="task-row-end"><span className="task-assignees"><Users size={14} />{toFaDigits(membersCount)} نفر</span>{manager || taskMembership?.status === 'approved' ? <select className="task-status-select" value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value })} aria-label="وضعیت تسک"><option value="todo">شروع‌نشده</option><option value="in_progress">در حال انجام</option><option value="review">بررسی</option><option value="done">تکمیل‌شده</option></select> : <button disabled={!canRequest || taskMembership?.status === 'pending' || taskMembership?.status === 'approved'} className="button button-outline button-small" onClick={() => requestTask(task.id)}>{!canRequest ? 'ابتدا عضویت پروژه' : taskMembership?.status === 'pending' ? 'در انتظار' : taskMembership?.status === 'approved' ? 'عضو تسک' : taskMembership?.status === 'rejected' ? 'درخواست مجدد' : 'درخواست تسک'}</button>}</div></article>;
}

function CalendarPage({ profile, data, openDialog, deleteEvent }) {
  const [department, setDepartment] = useState(profile.role === 'department_admin' ? profile.department : 'all');
  const [view, setView] = useState('upcoming');
  const events = data.events.filter((event) => (department === 'all' || event.department === department) && (view === 'all' || new Date(event.event_date) >= new Date(new Date().setHours(0, 0, 0, 0)))).sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  const manager = profile.role !== 'member';
  return <div className="page-content"><PageHeader eyebrow="TEAM CALENDAR / SCHEDULE" title="تقویم نَوِرا" description="جلسه‌ها، ددلاین پروژه‌ها و رویدادهای تیمی را در یک نگاه دنبال کن." action={manager && <button className="button button-primary" onClick={() => openDialog({ type: 'event' })}><CalendarPlus size={16} /> ثبت رویداد</button>} />
    <div className="calendar-toolbar"><div className="calendar-month-label"><div className="calendar-month-icon"><CalendarDays size={19} /></div><div><span>تقویم برنامه‌ها</span><strong>{new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(new Date())}</strong></div></div><div className="calendar-controls"><select value={department} onChange={(e) => setDepartment(e.target.value)}>{profile.role === 'super_admin' && <option value="all">همه تیم‌ها</option>}{DEPARTMENTS.filter((d) => profile.role !== 'department_admin' || d.id === profile.department).map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}</select><div className="segmented-control"><button className={view === 'upcoming' ? 'selected' : ''} onClick={() => setView('upcoming')}>پیش‌رو</button><button className={view === 'all' ? 'selected' : ''} onClick={() => setView('all')}>همه رویدادها</button></div></div></div>
    {events.length ? <div className="calendar-content"><div className="calendar-timeline"><div className="timeline-line" />{events.map((event, index) => <div className="timeline-event" key={event.id}><div className="timeline-marker" style={{ '--dept-color': getDepartment(event.department).color }}><span /></div><div className="timeline-date"><span>{new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(new Date(event.event_date))}</span><strong>{faDate(event.event_date, { day: 'numeric', month: 'long' })}</strong><small>{new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.event_date))}</small></div><div className="timeline-card"><div className="timeline-card-top"><span className="department-inline" style={{ '--dept-color': getDepartment(event.department).color }}><i />{getDepartment(event.department).name}</span>{manager && isManager(profile, event.department) && <button className="icon-button danger-icon" onClick={() => deleteEvent(event.id)} title="حذف رویداد"><X size={15} /></button>}</div><h3>{event.title}</h3>{event.details && <p>{event.details}</p>}</div></div>)}</div></div> : <EmptyState icon={<CalendarDays size={25} />} title="تقویم هنوز خلوت است" description={manager ? 'اولین جلسه یا ددلاین را ثبت کنید تا اعضا از برنامه‌ها باخبر باشند.' : 'هنوز رویدادی برای این بازه ثبت نشده است.'} action={manager && <button className="button button-primary button-small" onClick={() => openDialog({ type: 'event' })}><Plus size={15} /> ثبت رویداد</button>} />}
  </div>;
}

function TeamsPage({ profile, data, setActivePage }) {
  return <div className="page-content"><PageHeader eyebrow="ORGANIZATION / DIVISIONS" title="تیم‌های نَوِرا" description="چهار بخش تخصصی با هویت مستقل که برای یک چشم‌انداز مشترک هم‌افزایی می‌کنند." />
    <div className="team-directory-grid">{DEPARTMENTS.map((department, index) => { const members = data.publicMembers.filter((p) => p.department === department.id); const projects = data.projects.filter((p) => p.department === department.id); const manager = profile.role === 'super_admin' || (profile.role === 'department_admin' && profile.department === department.id); return <article className="team-directory-card" key={department.id} style={{ '--dept-color': department.color, '--dept-glow': department.glow }}><div className="team-directory-head"><span>DIVISION 0{index + 1}</span>{profile.department === department.id && <span className="your-team-chip">تیم شما</span>}</div><div className="team-directory-logo"><img src={department.logo} alt={`${department.english} logo`} /></div><h2>{department.name}</h2><span className="team-directory-english">{department.english}</span><p>{department.tagline}</p><div className="team-directory-metrics"><div><strong>{toFaDigits(members.length)}</strong><span>عضو فعال</span></div><div><strong>{toFaDigits(projects.length)}</strong><span>پروژه</span></div><div><strong>{toFaDigits(projects.filter((p) => p.status === 'completed').length)}</strong><span>تکمیل‌شده</span></div></div><div className="team-directory-footer"><div className="avatar-stack">{members.slice(0, 4).map((member) => <Avatar profile={member} size="tiny" key={member.id} />)}{members.length > 4 && <span>+{toFaDigits(members.length - 4)}</span>}</div><button className="button button-secondary button-small" onClick={() => setActivePage('projects')}>پروژه‌های تیم <ArrowLeft size={14} /></button></div>{manager && <div className="team-manager-flag"><ShieldCheck size={13} /> دسترسی مدیریت این بخش</div>}</article>; })}</div>
    <section className="team-principles"><div><span className="section-kicker">ONE ORGANIZATION</span><h3>تخصص‌های متفاوت، استانداردهای مشترک.</h3><p>فرآیندها، تقویم‌ها و مسئولیت‌ها شفاف‌اند تا هر تیم با تمرکز خودش کار کند و نتیجه در سطح نَوِرا دیده شود.</p></div><div className="principle-points"><span><Check size={15} /> مسئولیت‌پذیری شفاف</span><span><Check size={15} /> همکاری بین‌تیمی</span><span><Check size={15} /> گزارش‌پذیری و پیگیری</span></div></section>
  </div>;
}

function ReportsPage({ profile, data, openDialog, updateReport }) {
  const canReview = profile.role === 'super_admin';
  const reports = data.reports;
  return <div className="page-content"><PageHeader eyebrow="TRUST / FEEDBACK CHANNEL" title="گزارش و بازخورد" description="اگر درباره روند کار یا عملکرد مدیریتی مسئله‌ای وجود دارد، گزارش را محرمانه و مستقیم ثبت کن." action={<button className="button button-primary" onClick={() => openDialog({ type: 'report' })}><Send size={16} /> ثبت گزارش</button>} />
    <div className="report-privacy-banner"><div className="privacy-lock"><ShieldCheck size={24} /></div><div><strong>حریم خصوصی گزارش‌دهنده</strong><p>گزارش‌ها فقط برای ثبت‌کننده و مدیر اصلی قابل مشاهده‌اند؛ مدیر بخش به گزارش ثبت‌شده درباره خودش دسترسی ندارد.</p></div><span className="privacy-tag"><span /> CONFIDENTIAL</span></div>
    {reports.length ? <div className="reports-list">{reports.map((report) => <article className="report-card" key={report.id}><div className="report-card-icon"><MessageSquareWarning size={19} /></div><div className="report-card-main"><div className="report-card-top"><span className="report-department">{getDepartment(report.department).name}</span><span className="report-date">{faDate(report.created_at)}</span></div><h3>{report.title}</h3><p>{report.message}</p><div className="report-card-bottom"><StatusPill status={report.status} type="report" />{canReview && <select value={report.status} onChange={(e) => updateReport(report.id, e.target.value)} aria-label="وضعیت گزارش"><option value="new">جدید</option><option value="reviewing">در حال بررسی</option><option value="resolved">رسیدگی‌شده</option></select>}</div></div></article>)}</div> : <EmptyState icon={<MessageSquareWarning size={25} />} title={canReview ? 'گزارشی ثبت نشده است' : 'هنوز گزارشی ثبت نکرده‌ای'} description={canReview ? 'در صورت ثبت گزارش توسط اعضا، موارد محرمانه در این بخش نمایش داده می‌شوند.' : 'این کانال برای مطرح کردن دغدغه‌ها و بازخوردهای مهم در نظر گرفته شده است.'} action={<button className="button button-secondary button-small" onClick={() => openDialog({ type: 'report' })}><Plus size={15} /> ثبت گزارش محرمانه</button>} />}
  </div>;
}

function MembersPage({ profile, data, assignAdmin, revokeAdmin, deactivateMember, searchTerm, setSearchTerm }) {
  const [departmentFilter, setDepartmentFilter] = useState(profile.role === 'department_admin' ? profile.department : 'all');
  const [selectedUser, setSelectedUser] = useState('');
  const [adminDepartment, setAdminDepartment] = useState('Technoplus');
  const superAdmin = profile.role === 'super_admin';
  const members = data.profiles.filter((member) => member.is_active && (departmentFilter === 'all' || member.department === departmentFilter) && `${member.full_name} ${member.department}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const eligible = data.profiles.filter((member) => member.is_active && member.role === 'member');
  return <div className="page-content"><PageHeader eyebrow="PEOPLE / ACCESS CONTROL" title="اعضا و دسترسی‌ها" description={superAdmin ? 'مدیریت اعضا، انتساب مدیر هر بخش و کنترل دسترسی در اختیار شماست.' : `اعضای فعال ${getDepartment(profile.department).name} و دسترسی‌های مربوط به بخش شما.`} badge={`${toFaDigits(data.profiles.filter((p) => p.is_active).length)} عضو`} />
    {superAdmin && <section className="admin-assignment-card"><div className="admin-assignment-icon"><Crown size={22} /></div><div className="admin-assignment-copy"><span className="panel-kicker">SUPER ADMIN CONTROL</span><h3>تعیین مدیر بخش</h3><p>فقط مدیر اصلی می‌تواند نقش مدیر بخش را اعطا یا لغو کند.</p></div><div className="admin-assignment-controls"><select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}><option value="">انتخاب عضو…</option>{eligible.map((member) => <option key={member.id} value={member.id}>{member.full_name} · {getDepartment(member.department).name}</option>)}</select><select value={adminDepartment} onChange={(e) => setAdminDepartment(e.target.value)}>{DEPARTMENTS.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select><button className="button button-primary button-small" disabled={!selectedUser} onClick={async () => { const ok = await assignAdmin(selectedUser, adminDepartment); if (ok) setSelectedUser(''); }}>اعطای دسترسی <ShieldCheck size={15} /></button></div></section>}
    <div className="filter-toolbar members-toolbar"><div className="search-field"><Search size={17} /><input placeholder="جست‌وجوی اعضا…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><kbd>NAME</kbd></div><div className="department-filter"><span>بخش:</span><select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>{profile.role === 'super_admin' && <option value="all">همه تیم‌ها</option>}{DEPARTMENTS.filter((d) => profile.role !== 'department_admin' || d.id === profile.department).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div></div>
    <div className="members-table-card"><div className="members-table-header"><span>عضو / نقش</span><span>بخش</span><span>وضعیت</span><span>تاریخ عضویت</span><span>عملیات</span></div>{members.filter((member) => superAdmin || member.role === 'member' || member.id === profile.id).map((member) => { const dept = getDepartment(member.department); const canDeactivate = member.id !== profile.id && member.role === 'member' && (superAdmin || (profile.role === 'department_admin' && profile.department === member.department)); return <div className="member-table-row" key={member.id}><div className="member-cell-primary"><Avatar profile={member} size="small" /><div><strong>{member.full_name}{member.id === profile.id && <small className="you-label">شما</small>}</strong><span>{member.id === profile.id ? (member.phone || 'حساب کاربری شما') : 'عضو فعال نَوِرا'}</span></div></div><div className="member-cell-dept"><i style={{ '--dept-color': dept.color }} />{dept.name}</div><div><span className={`role-chip role-${member.role}`}>{member.role === 'super_admin' && <Crown size={12} />}{ROLE_LABELS[member.role]}</span></div><div className="member-cell-date">{faDate(member.created_at)}</div><div className="member-cell-actions">{superAdmin && member.role === 'department_admin' && <button className="button button-outline button-small" onClick={() => revokeAdmin(member.id, member.department)}><Ban size={13} /> عزل مدیر</button>}{canDeactivate && <button title="غیرفعال کردن عضو" className="icon-button danger-icon" onClick={() => deactivateMember(member.id)}><X size={16} /></button>}{!canDeactivate && !(superAdmin && member.role === 'department_admin') && <span className="muted-dash">—</span>}</div></div>; })}</div>
    <div className="members-table-foot"><span><i /> نمایش اعضای فعال</span><span>{toFaDigits(members.filter((m) => superAdmin || m.role === 'member' || m.id === profile.id).length)} نتیجه</span></div>
  </div>;
}

function SettingsPage({ profile, signOut }) {
  const department = getDepartment(profile.department);
  return <div className="page-content"><PageHeader eyebrow="ACCOUNT / PREFERENCES" title="حساب کاربری" description="اطلاعات اصلی حساب و وضعیت دسترسی خودت را بررسی کن." />
    <div className="settings-grid"><section className="settings-profile-card"><div className="settings-cover" style={{ '--dept-color': department.color }}><div className="settings-cover-shape" /><div className="settings-cover-label">NOWERA MEMBER PROFILE</div></div><div className="settings-profile-info"><Avatar profile={profile} size="large" /><div><h2>{profile.full_name}</h2><p>{profile.phone}</p></div></div><div className="settings-profile-details"><div><span>بخش تخصصی</span><strong>{department.name} · {department.english}</strong></div><div><span>سطح دسترسی</span><strong>{ROLE_LABELS[profile.role]}</strong></div><div><span>تاریخ عضویت</span><strong>{faDate(profile.created_at)}</strong></div><div><span>وضعیت حساب</span><strong className="active-text"><i /> فعال</strong></div></div></section>
      <section className="settings-side-stack"><article className="settings-info-card"><div className="settings-info-icon"><ShieldCheck size={20} /></div><div><h3>امنیت و دسترسی</h3><p>دسترسی بخش‌ها بر اساس نقش کاربر و سیاست‌های امنیتی پایگاه‌داده کنترل می‌شود. تغییر نقش فقط از طریق مدیر اصلی امکان‌پذیر است.</p></div></article><article className="settings-info-card"><div className="settings-info-icon gold"><Bell size={20} /></div><div><h3>اعلان‌ها و پیگیری</h3><p>برای بررسی درخواست‌ها، وضعیت پروژه‌ها و رویدادهای جدید، از صفحه‌های پروژه، تسک و تقویم استفاده کن.</p></div></article><article className="settings-signout-card"><div><h3>پایان این نشست</h3><p>هنگام استفاده از دستگاه مشترک از حساب خارج شو.</p></div><button className="button button-danger-ghost" onClick={signOut}><LogOut size={15} /> خروج از حساب</button></article></section></div>
  </div>;
}

function StatusPill({ status, type = 'task' }) {
  let label = status;
  if (type === 'project') label = PROJECT_STATUS[status] || status;
  else if (type === 'task') label = TASK_STATUS[status] || status;
  else if (type === 'report') label = ({ new: 'جدید', reviewing: 'در حال بررسی', resolved: 'رسیدگی‌شده' })[status] || status;
  const classStatus = status || 'unknown';
  return <span className={`status-pill status-${classStatus}`}><i />{label}</span>;
}

function RequestRow({ row, kind, data, decideRequest }) {
  const project = kind === 'project' ? data.projects.find((p) => p.id === row.project_id) : data.projects.find((p) => p.id === data.tasks.find((t) => t.id === row.task_id)?.project_id);
  const task = kind === 'task' ? data.tasks.find((t) => t.id === row.task_id) : null;
  const person = data.profiles.find((p) => p.id === row.user_id);
  if (!project || !person) return null;
  return <div className="request-row"><Avatar profile={person} size="small" /><div className="request-row-main"><strong>{person.full_name}</strong><span>{kind === 'project' ? `درخواست عضویت در ${project.title}` : `درخواست تسک ${task?.title || ''}`} · {getDepartment(project.department).name}</span></div><span className="request-time">{faDate(row.requested_at)}</span><div className="request-row-actions"><button className="request-approve" title="تأیید" onClick={() => decideRequest(kind, row.id, 'approved')}><Check size={16} /></button><button className="request-reject" title="رد درخواست" onClick={() => decideRequest(kind, row.id, 'rejected')}><X size={16} /></button></div></div>;
}

function EmptyState({ icon, title, description, action }) {
  return <div className="empty-state"><div className="empty-state-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action && <div className="empty-state-action">{action}</div>}</div>;
}

function ActionDialog({ dialog, close, profile, data, handlers }) {
  const [form, setForm] = useState(() => ({
    department: profile.role === 'department_admin' ? profile.department : profile.department || 'Technoplus',
    title: '', description: '', details: '', status: 'active', priority: 'medium', deadline: '', due_date: '',
    project_id: '', event_date: '', message: '', target_admin_id: '',
  }));
  const [busy, setBusy] = useState(false);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const titleMap = { project: 'ساخت پروژه جدید', task: 'تعریف تسک جدید', event: 'ثبت رویداد در تقویم', report: 'ثبت گزارش محرمانه' };
  const descriptionMap = { project: 'اطلاعات پایه پروژه و تیم مسئول را وارد کنید.', task: 'تسک را به یکی از پروژه‌های قابل مدیریت متصل کنید.', event: 'جلسه، ددلاین یا رویداد مهم را ثبت کنید.', report: 'گزارش شما فقط برای مدیر اصلی قابل مشاهده خواهد بود.' };
  const projects = data.projects.filter((project) => isManager(profile, project.department));
  const admins = data.profiles.filter((member) => member.is_active && member.role !== 'member');
  const availableDepartments = DEPARTMENTS.filter((department) => profile.role !== 'department_admin' || department.id === profile.department);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    let success = false;
    if (dialog.type === 'project') success = await handlers.createProject(form);
    if (dialog.type === 'task') success = await handlers.createTask(form);
    if (dialog.type === 'event') success = await handlers.createEvent(form);
    if (dialog.type === 'report') success = await handlers.createReport(form);
    setBusy(false); if (success) close();
  };
  return <div className="modal-scrim" onClick={close}><section className="action-modal" onClick={(e) => e.stopPropagation()}><div className="action-modal-header"><div className="action-modal-icon">{dialog.type === 'project' ? <FolderKanban size={20} /> : dialog.type === 'task' ? <ClipboardList size={20} /> : dialog.type === 'event' ? <CalendarDays size={20} /> : <MessageSquareWarning size={20} />}</div><div><span className="section-kicker">NOWERA WORKSPACE</span><h2>{titleMap[dialog.type]}</h2><p>{descriptionMap[dialog.type]}</p></div><button className="modal-close" onClick={close} aria-label="بستن"><X size={18} /></button></div>
    <form className="action-form" onSubmit={submit}>
      {dialog.type === 'project' && <><label>عنوان پروژه<input required minLength={2} maxLength={140} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="نام مشخص و کوتاه پروژه" /></label><label>توضیحات<textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="هدف پروژه، خروجی مورد انتظار و توضیحات…" /></label><div className="form-grid-two"><label>تیم مسئول<select value={form.department} onChange={(e) => update('department', e.target.value)}>{availableDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>وضعیت اولیه<select value={form.status} onChange={(e) => update('status', e.target.value)}><option value="planning">در برنامه‌ریزی</option><option value="active">در حال اجرا</option><option value="paused">متوقف</option></select></label></div><label>ددلاین پروژه<input type="date" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} /></label></>}
      {dialog.type === 'task' && <><label>پروژه مرتبط<select required value={form.project_id} onChange={(e) => update('project_id', e.target.value)}><option value="">انتخاب پروژه…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title} · {getDepartment(p.department).name}</option>)}</select></label><label>عنوان تسک<input required minLength={2} maxLength={160} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="مثلاً طراحی نسخه اولیه صفحه اصلی" /></label><label>شرح و خروجی مورد انتظار<textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="جزئیات اجرا، معیار تکمیل و نکات مهم…" /></label><div className="form-grid-two"><label>اولویت<select value={form.priority} onChange={(e) => update('priority', e.target.value)}><option value="low">کم</option><option value="medium">متوسط</option><option value="high">زیاد</option><option value="urgent">فوری</option></select></label><label>ددلاین<input type="date" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} /></label></div></>}
      {dialog.type === 'event' && <><label>عنوان رویداد<input required minLength={2} maxLength={140} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="مثلاً جلسه هفتگی تیم" /></label><label>تیم برگزارکننده<select value={form.department} onChange={(e) => update('department', e.target.value)}>{availableDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>تاریخ و ساعت<input required type="datetime-local" value={form.event_date} onChange={(e) => update('event_date', e.target.value)} /></label><label>جزئیات<textarea rows={3} value={form.details} onChange={(e) => update('details', e.target.value)} placeholder="محل جلسه، دستور کار یا توضیحات تکمیلی…" /></label></>}
      {dialog.type === 'report' && <><div className="form-note-private"><ShieldCheck size={17} /><span>نام و مشخصات حساب برای پیگیری نزد مدیر اصلی محفوظ است. مدیر بخش گزارش را نمی‌بیند.</span></div><label>موضوع گزارش<input required minLength={3} maxLength={160} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="خلاصه‌ای از موضوع" /></label><div className="form-grid-two"><label>بخش مرتبط<select value={form.department} onChange={(e) => update('department', e.target.value)}>{DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>مدیر مرتبط (اختیاری)<select value={form.target_admin_id} onChange={(e) => update('target_admin_id', e.target.value)}><option value="">مشخص نشده</option>{admins.map((admin) => <option value={admin.id} key={admin.id}>{admin.full_name} · {ROLE_LABELS[admin.role]}</option>)}</select></label></div><label>شرح گزارش<textarea rows={5} required minLength={5} maxLength={5000} value={form.message} onChange={(e) => update('message', e.target.value)} placeholder="موضوع را با جزئیات کافی، زمان تقریبی و هر زمینه لازم توضیح دهید…" /></label></>}
      <div className="action-form-footer"><button type="button" className="button button-ghost" onClick={close}>انصراف</button><button type="submit" disabled={busy} className="button button-primary">{busy ? <span className="button-spinner" /> : dialog.type === 'report' ? <Send size={16} /> : <Check size={16} />}{busy ? 'در حال ذخیره…' : dialog.type === 'report' ? 'ارسال محرمانه گزارش' : 'ذخیره و ثبت'}<ArrowLeft size={15} /></button></div>
    </form></section></div>;
}

function toFaDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}
