import React, { useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowUpLeft, BarChart3, ChevronDown, Layers3, LogIn, ShieldCheck,
  Sparkles, Target, UserPlus, Users, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  DEPARTMENTS, ROLE_LABELS, normalizePhone, phoneToAuthEmail, getDepartment, initials, toFaDigits,
} from '../lib/helpers';
import { BrandMark } from './ui';

export function Landing({ members, openAuth, connectionReady }) {
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

export function AuthModal({ mode, setMode, close, notify }) {
  const [form, setForm] = useState({ full_name: '', phone: '', password: '', department: 'Technoplus' });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === 'signup';
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return notify('اتصال Supabase تنظیم نشده است. ابتدا مراحل راه‌اندازی README را انجام دهید.', 'error');
    const phone = normalizePhone(form.phone);
    if (!/^\+989\d{9}$/.test(phone)) return notify('شماره موبایل را بدون صفر ابتدایی و به شکل 9123456789 وارد کنید.', 'error');
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
  return <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}><section className="auth-modal">
    <button className="modal-close" onClick={close} aria-label="بستن"><X size={18} /></button><div className="auth-modal-brand"><BrandMark /><span className="auth-vertical-line" /></div>
    <div className="auth-heading"><span className="section-kicker">{isSignup ? 'BECOME A PART OF NOWERA' : 'WELCOME BACK'}</span><h2>{isSignup ? 'به نَوِرا خوش آمدی.' : 'دوباره خوش آمدی.'}</h2><p>{isSignup ? 'پروفایل خودت را بساز و مسیر همکاری را شروع کن.' : 'با شماره موبایل و رمز عبورت وارد فضای کاری شو.'}</p></div>
    <form className="auth-form" onSubmit={submit}>
      {isSignup && <label>نام و نام خانوادگی<input autoComplete="name" required minLength={2} maxLength={100} value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="مثلاً آرمین رضایی" /></label>}
      <label>شماره موبایل<div className="phone-field"><span>+98</span><input dir="ltr" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="9123456789" /></div></label>
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

