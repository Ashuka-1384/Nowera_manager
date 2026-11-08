import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { isManager } from './lib/helpers';
import { BrandMark, ConfirmDialog, ErrorBoundary, LoadingScreen, Toast } from './components/ui';
import { Landing, AuthModal } from './components/Landing';
import { Sidebar, Topbar } from './components/Shell';
import ActionDialog from './components/Dialogs';
import OverviewPage from './pages/Overview';
import ProjectsPage from './pages/Projects';
import TasksPage from './pages/Tasks';
import CalendarPage from './pages/Calendar';
import TeamsPage from './pages/Teams';
import ReportsPage from './pages/Reports';
import MembersPage from './pages/Members';
import SettingsPage from './pages/Settings';

const EMPTY_DATA = { profiles: [], publicMembers: [], projects: [], tasks: [], events: [], reports: [], projectMembers: [], taskMembers: [] };
const PAGES = ['overview', 'projects', 'tasks', 'calendar', 'teams', 'reports', 'members', 'settings'];
const STALE_AFTER_MS = 45000;
const pageFromHash = () => { const id = window.location.hash.replace('#', ''); return PAGES.includes(id) ? id : 'overview'; };

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [data, setData] = useState(EMPTY_DATA);
  const [dataLoading, setDataLoading] = useState(false);
  const [landingMembers, setLandingMembers] = useState([]);
  const [activePage, setActivePageState] = useState(pageFromHash);
  const [mobileNav, setMobileNav] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const lastLoadedAt = useRef(0);

  // The previous timer was never cleared, so an old toast could dismiss a newer one early.
  const notify = useCallback((message, type = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, type, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const setActivePage = useCallback((page) => {
    setActivePageState(page);
    setMobileNav(false);
    if (window.location.hash !== `#${page}`) window.history.replaceState(null, '', `#${page}`);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onHash = () => setActivePageState(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!mobileNav) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMobileNav(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNav]);

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
      const keys = ['profiles', 'projects', 'tasks', 'events', 'reports', 'projectMembers', 'taskMembers', 'publicMembers'];
      // Keep the previous rows for any query that failed instead of silently emptying that section.
      setData((previous) => {
        const next = { ...previous };
        results.forEach((result, index) => {
          if (!result.error && Array.isArray(result.data)) next[keys[index]] = result.data;
          else if (result.error) console.warn(`${keys[index]} query:`, result.error.message);
        });
        return next;
      });
      lastLoadedAt.current = Date.now();
    } catch (error) {
      console.error('Could not load NOWERA data:', error);
      notify('دریافت داده‌ها از Supabase ناموفق بود. اتصال را بررسی و دوباره تلاش کن.', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [session?.user?.id, profile?.id, profile?.is_active, notify]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return undefined; }
    supabase.auth.getSession().then(({ data: result }) => { setSession(result.session); setAuthLoading(false); }).catch(() => setAuthLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadProfile(session.user.id);
    else { setProfile(null); setProfileError(''); setData(EMPTY_DATA); }
  }, [session?.user?.id, loadProfile]);

  useEffect(() => { if (profile?.id && profile.is_active) loadData(); }, [profile?.id, profile?.is_active, loadData]);

  // Pull fresh data when the user comes back to the tab, so two admins stay roughly in sync.
  useEffect(() => {
    if (!profile?.is_active) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - lastLoadedAt.current > STALE_AFTER_MS) loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [profile?.is_active, loadData]);

  const loadLandingMembers = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: rows, error } = await supabase.rpc('list_public_members');
      if (!error && Array.isArray(rows)) setLandingMembers(rows);
      else if (error) console.warn('Public member directory is unavailable:', error.message);
    } catch (error) { console.warn('Could not connect to Supabase for the public member directory:', error); }
  }, []);
  useEffect(() => { loadLandingMembers(); }, [loadLandingMembers]);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setProfile(null); setData(EMPTY_DATA); setActivePage('overview');
    notify('با موفقیت خارج شدید.');
  };
  const refresh = useCallback(async () => { await loadData(); }, [loadData]);

  const runMutation = async (operation, successMessage, requireAffectedRow = false) => {
    if (!supabase) { notify('ابتدا اتصال Supabase را در فایل .env تنظیم کنید.', 'error'); return false; }
    try {
      const { data: result, error } = await operation();
      if (error) { notify(explainError(error), 'error'); return false; }
      if (requireAffectedRow && !result) { notify('هیچ موردی تغییر نکرد؛ ممکن است دسترسی لازم را نداشته باشی یا مورد قبلاً تغییر کرده باشد.', 'error'); return false; }
      if (successMessage) notify(successMessage);
      await refresh();
      return true;
    } catch (error) { notify(explainError(error), 'error'); return false; }
  };

  // A zero-row delete must never look successful.
  const runDelete = (operation, successMessage) => runMutation(operation, successMessage, true);

  const createProject = (form) => runMutation(() => supabase.from('projects').insert({ department: form.department, title: form.title.trim(), description: form.description.trim(), status: form.status, deadline: form.deadline || null, created_by: profile.id }), 'پروژه جدید ساخته شد.');
  const createTask = (form) => runMutation(() => supabase.from('tasks').insert({ project_id: form.project_id, title: form.title.trim(), description: form.description.trim(), priority: form.priority, status: form.status || 'todo', due_date: form.due_date || null, created_by: profile.id }), 'تسک جدید ساخته شد.');
  const createEvent = (form) => runMutation(() => supabase.from('events').insert({ department: form.department, title: form.title.trim(), details: form.details.trim(), event_date: new Date(form.event_date).toISOString(), created_by: profile.id }), 'رویداد به تقویم اضافه شد.');
  const createReport = (form) => runMutation(() => supabase.from('reports').insert({ reporter_id: profile.id, department: form.department, target_admin_id: form.target_admin_id || null, title: form.title.trim(), message: form.message.trim() }), 'گزارش شما به‌صورت محرمانه ثبت شد.');

  const requestMembership = async (table, column, id, existingRow, messages) => {
    if (existingRow?.status === 'approved') return notify(messages.approved, 'info');
    if (existingRow?.status === 'pending') return notify(messages.pending, 'info');
    if (existingRow?.status === 'rejected') {
      const removed = await supabase.from(table).delete().eq('id', existingRow.id);
      if (removed.error) return notify(explainError(removed.error), 'error');
    }
    return runMutation(() => supabase.from(table).insert({ [column]: id, user_id: profile.id, status: 'pending' }), messages.sent);
  };
  const requestProject = (projectId) => requestMembership('project_members', 'project_id', projectId, data.projectMembers.find((r) => r.project_id === projectId && r.user_id === profile.id), { approved: 'عضویت شما در این پروژه تأیید شده است.', pending: 'درخواست شما هنوز بررسی نشده است.', sent: 'درخواست همکاری برای مدیر بخش ارسال شد.' });
  const requestTask = (taskId) => requestMembership('task_members', 'task_id', taskId, data.taskMembers.find((r) => r.task_id === taskId && r.user_id === profile.id), { approved: 'این تسک به شما تخصیص داده شده است.', pending: 'درخواست تسک در انتظار بررسی است.', sent: 'درخواست دریافت تسک ثبت شد.' });

  const decideRequest = (kind, id, status) => runMutation(
    () => supabase.from(kind === 'project' ? 'project_members' : 'task_members').update({ status, decided_by: profile.id, decided_at: new Date().toISOString() }).eq('id', id).select('id').maybeSingle(),
    status === 'approved' ? 'درخواست تأیید شد.' : 'درخواست رد شد.', true);

  const updateTask = (taskId, patch) => runMutation(() => supabase.from('tasks').update(patch).eq('id', taskId).select('id').maybeSingle(), 'تغییرات تسک ذخیره شد.', true);
  const updateProject = (projectId, patch) => runMutation(() => supabase.from('projects').update(patch).eq('id', projectId).select('id').maybeSingle(), 'اطلاعات پروژه به‌روزرسانی شد.', true);
  const updateEvent = (eventId, patch) => runMutation(() => supabase.from('events').update(patch).eq('id', eventId).select('id').maybeSingle(), 'رویداد به‌روزرسانی شد.', true);
  const updateReport = (reportId, status) => runMutation(() => supabase.from('reports').update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', reportId).select('id').maybeSingle(), 'وضعیت گزارش تغییر کرد.', true);

  // Optimistic: the card moves instantly; if the database refuses, it snaps back.
  const moveTask = async (taskId, status) => {
    const before = data.tasks.find((t) => t.id === taskId);
    if (!before || before.status === status) return;
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }));
    const ok = await runMutation(() => supabase.from('tasks').update({ status }).eq('id', taskId).select('id').maybeSingle(), 'وضعیت تسک تغییر کرد.', true);
    if (!ok) setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? before : t)) }));
  };

  const deleteProject = (id) => runDelete(() => supabase.from('projects').delete().eq('id', id).select('id').maybeSingle(), 'پروژه و تسک‌ها و عضویت‌های وابسته حذف شدند.');
  const deleteTask = (id) => runDelete(() => supabase.from('tasks').delete().eq('id', id).select('id').maybeSingle(), 'تسک حذف شد.');
  const deleteEvent = (id) => runDelete(() => supabase.from('events').delete().eq('id', id).select('id').maybeSingle(), 'رویداد حذف شد.');
  const deleteReport = (id) => runDelete(() => supabase.from('reports').delete().eq('id', id).select('id').maybeSingle(), 'گزارش حذف شد.');
  const clearDoneTasks = (projectId) => runMutation(async () => {
    const result = await supabase.from('tasks').delete().eq('project_id', projectId).eq('status', 'done').select('id');
    if (!result.error && !(result.data || []).length) return { data: null, error: { message: 'تسک تکمیل‌شده‌ای برای پاک‌سازی وجود نداشت.' } };
    return result;
  }, 'تسک‌های تکمیل‌شده پاک شدند.');

  const rpc = (name, args, message) => runMutation(() => supabase.rpc(name, args), message);
  const assignProjectMember = (projectId, userId) => rpc('assign_project_member', { p_project_id: projectId, p_user_id: userId }, 'عضو مستقیماً به پروژه اضافه شد.');
  const assignTaskMember = (taskId, userId) => rpc('assign_task_member', { p_task_id: taskId, p_user_id: userId }, 'عضو مستقیماً به تسک تخصیص داده شد.');
  const removeProjectMember = (projectId, userId) => rpc('remove_project_member', { p_project_id: projectId, p_user_id: userId }, 'عضو و تخصیص‌های تسک او از این پروژه برداشته شد.');
  const removeTaskMember = (taskId, userId) => rpc('remove_task_member', { p_task_id: taskId, p_user_id: userId }, 'عضو از این تسک خارج شد.');
  const deactivateMember = (userId) => rpc('deactivate_member', { p_user_id: userId }, 'دسترسی عضو بسته شد.');
  const reactivateMember = (userId) => rpc('reactivate_member', { p_user_id: userId }, 'دسترسی عضو بازگردانده شد.');
  const changeMemberDepartment = (userId, department) => rpc('change_member_department', { p_user_id: userId, p_department: department }, 'عضو به بخش جدید منتقل شد.');
  const assignAdmin = (userId, department) => runMutation(() => supabase.from('profiles').update({ role: 'department_admin', department }).eq('id', userId).select('id').maybeSingle(), 'دسترسی مدیریت بخش اعطا شد.', true);
  const revokeAdmin = (userId, department) => runMutation(() => supabase.from('profiles').update({ role: 'member', department }).eq('id', userId).select('id').maybeSingle(), 'دسترسی مدیریت لغو شد.', true);

  const commonProps = {
    profile, data, notify, refresh, openDialog: setDialog, confirmAction: setConfirmDialog, setActivePage,
    requestProject, requestTask, decideRequest, updateTask, updateProject, updateEvent, moveTask,
    deleteProject, deleteTask, deleteEvent, deleteReport, clearDoneTasks,
    assignProjectMember, assignTaskMember, removeProjectMember, removeTaskMember,
    updateReport, assignAdmin, revokeAdmin, deactivateMember, reactivateMember, changeMemberDepartment, signOut,
  };

  const badges = useMemo(() => {
    if (!profile || profile.role === 'member') return {};
    const projectById = Object.fromEntries(data.projects.map((p) => [p.id, p]));
    const taskById = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
    const pendingProjects = data.projectMembers.filter((r) => r.status === 'pending' && isManager(profile, projectById[r.project_id]?.department)).length;
    const pendingTasks = data.taskMembers.filter((r) => r.status === 'pending' && isManager(profile, projectById[taskById[r.task_id]?.project_id]?.department)).length;
    const newReports = profile.role === 'super_admin' ? data.reports.filter((r) => r.status === 'new').length : 0;
    return { projects: pendingProjects || null, tasks: pendingTasks || null, reports: newReports || null };
  }, [data, profile]);

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

  const Page = { overview: OverviewPage, projects: ProjectsPage, tasks: TasksPage, calendar: CalendarPage, teams: TeamsPage, reports: ReportsPage, members: MembersPage, settings: SettingsPage }[activePage] || OverviewPage;
  const allowed = activePage !== 'members' || profile.role !== 'member';

  return <div className="nv-app">
    <Sidebar activePage={activePage} setActivePage={setActivePage} profile={profile} mobileNav={mobileNav} setMobileNav={setMobileNav} signOut={signOut} badges={badges} />
    {mobileNav && <button className="nv-scrim" aria-label="بستن منو" onClick={() => setMobileNav(false)} />}
    <main className="nv-main">
      <Topbar profile={profile} dataLoading={dataLoading} setMobileNav={setMobileNav} onRefresh={refresh} activePage={activePage} />
      {profileError && <div className="inline-error">{profileError}</div>}
      <div className="nv-page">
        <ErrorBoundary resetKey={activePage}>
          <div key={activePage} className="nv-page-enter">{allowed ? <Page {...commonProps} /> : <OverviewPage {...commonProps} />}</div>
        </ErrorBoundary>
      </div>
      <footer className="nv-footer"><span>NOWERA WORKSPACE</span><span>یک چشم‌انداز، چندین قدرت.</span><span>v1.3 · فضای یکپارچه تیم</span></footer>
    </main>
    {dialog && <ActionDialog key={`${dialog.type}-${dialog.record?.id || 'new'}`} dialog={dialog} close={() => setDialog(null)} profile={profile} data={data} handlers={{ createProject, createTask, createEvent, createReport, updateProject, updateTask, updateEvent }} />}
    {confirmDialog && <ConfirmDialog dialog={confirmDialog} close={() => setConfirmDialog(null)} />}
    {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
  </div>;
}

function explainError(error) {
  const message = error?.message || String(error || 'خطای نامشخص');
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout/i.test(message)) return 'ارتباط با Supabase برقرار نشد. اینترنت/VPN، آدرس پروژه و کلید را بررسی کن و npm run diagnose را اجرا کن.';
  if (/deactivate_member|reactivate_member|change_member_department|assign_project_member|assign_task_member|remove_project_member|remove_task_member|PGRST202|schema cache/i.test(message)) return 'نسخه دیتابیس هنوز به‌روز نشده است؛ فایل کامل supabase/schema.sql جدید را در SQL Editor اجرا کن و سپس دوباره تلاش کن.';
  if (/row-level security|permission denied|insufficient privilege|42501/i.test(message) && !/only the super admin|cannot/i.test(message)) return 'دسترسی این عملیات برای نقش فعلی مجاز نیست.';
  if (/only the super admin or the target department admin/i.test(message)) return 'این عملیات فقط برای مدیر اصلی یا مدیر همان بخش مجاز است.';
  if (/only the super admin|only super.admin/i.test(message)) return 'این عملیات فقط برای مدیر اصلی مجاز است.';
  if (/cannot remove your own|own account/i.test(message)) return 'برای جلوگیری از قفل‌شدن پنل، امکان تغییر دسترسی حساب خودت وجود ندارد.';
  if (/super admin account cannot be (removed|moved)|cannot deactivate a super.admin/i.test(message)) return 'حساب مدیر اصلی از داخل پنل قابل تغییر نیست.';
  if (/member not found|project not found|task not found|membership not found|could not be updated/i.test(message)) return 'عضو، پروژه یا تسک پیدا نشد یا وضعیت آن تغییر کرده است؛ فهرست را تازه‌سازی و دوباره بررسی کن.';
  if (/only an active team member/i.test(message)) return 'فقط اعضای فعال و عادی تیم قابل تخصیص هستند.';
  if (/must be an approved project participant/i.test(message)) return 'برای تخصیص تسک، ابتدا باید عضویت فرد در همان پروژه تأیید شده باشد.';
  if (/duplicate key|already exists/i.test(message)) return 'این درخواست قبلاً ثبت شده است.';
  if (/JWT|session/i.test(message)) return 'نشست شما معتبر نیست؛ خارج شو و دوباره وارد شو.';
  return message;
}
