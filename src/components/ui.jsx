import React, { useState } from 'react';
import { AlertCircle, Check, CircleHelp, Trash2, X } from 'lucide-react';
import { getDepartment, initials, toFaDigits } from '../lib/helpers';
import { PROJECT_STATUS, TASK_STATUS } from '../lib/helpers';
import { useCountUp } from '../lib/hooks';

export function BrandMark({ small = false }) {
  return <div className={`brand-lockup ${small ? 'brand-lockup-small' : ''}`}><img src="/brands/nowera-symbol.png" alt="NOWERA" width="44" height="41" /><div><b>NOWERA</b><span>MANAGEMENT SPACE</span></div></div>;
}

export function Avatar({ profile, size = 'medium' }) {
  const department = getDepartment(profile?.department);
  return <div className={`avatar avatar-${size}`} style={{ '--dept-color': department.color }}>{initials(profile?.full_name)}</div>;
}

export function PageHeader({ eyebrow, title, description, action, badge }) {
  return <header className="nv-page-head nv-rise">
    <div className="nv-page-head-copy">
      <span className="nv-eyebrow"><i />{eyebrow}</span>
      <h1>{title}{badge && <span className="nv-head-badge">{badge}</span>}</h1>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="nv-page-head-action">{action}</div>}
  </header>;
}

export function StatusPill({ status, type = 'task' }) {
  let label = status;
  if (type === 'project') label = PROJECT_STATUS[status] || status;
  else if (type === 'task') label = TASK_STATUS[status] || status;
  else if (type === 'report') label = ({ new: 'جدید', reviewing: 'در حال بررسی', resolved: 'رسیدگی‌شده' })[status] || status;
  return <span className={`nv-pill nv-pill-${type}-${status || 'unknown'}`}><i />{label}</span>;
}

export function EmptyState({ icon, title, description, action }) {
  return <div className="nv-empty"><div className="nv-empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action && <div className="nv-empty-action">{action}</div>}</div>;
}

export function ProgressBar({ pct, color, label }) {
  return <div className="nv-progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={label}><span style={{ '--pct': `${pct}%`, ...(color ? { '--bar': color } : {}) }} /></div>;
}

export function ProgressRing({ pct, size = 132, stroke = 11, children }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return <div className="nv-ring" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs><linearGradient id="nvRingGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9b85b" /><stop offset="1" stopColor="#aa7cff" /></linearGradient></defs>
      <circle className="nv-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
      <circle className="nv-ring-value" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" strokeLinecap="round" stroke="url(#nvRingGradient)"
        strokeDasharray={circumference} style={{ '--ring-offset': circumference * (1 - pct / 100), '--ring-full': circumference }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <div className="nv-ring-center">{children}</div>
  </div>;
}

export function StatCard({ label, value, icon, tone = 'gold', foot, index = 0 }) {
  const shown = useCountUp(Number(value) || 0);
  return <article className={`nv-stat nv-tone-${tone} nv-rise`} style={{ '--i': index }}>
    <div className="nv-stat-top"><span>{label}</span><span className="nv-stat-icon">{icon}</span></div>
    <strong className="nv-stat-value">{toFaDigits(shown)}</strong>
    <small>{foot}</small>
  </article>;
}

export function Toast({ toast, onClose }) {
  return <div className={`toast toast-${toast.type || 'success'}`} key={toast.key} role="status">
    <span className="toast-icon">{toast.type === 'error' ? <AlertCircle size={18} /> : toast.type === 'info' ? <CircleHelp size={18} /> : <Check size={18} />}</span>
    <span>{toast.message}</span>
    <button aria-label="بستن پیام" onClick={onClose}><X size={15} /></button>
  </div>;
}

export function ConfirmDialog({ dialog, close }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const success = await dialog.onConfirm?.();
      if (success) close();
    } finally { setBusy(false); }
  };
  const Icon = dialog.icon || Trash2;
  return <div className="member-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section className="member-confirm-dialog confirm-action-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-description">
      <button className="member-confirm-close" type="button" aria-label="بستن" disabled={busy} onClick={close}><X size={18} /></button>
      <div className={`member-confirm-icon ${dialog.tone === 'safe' ? 'is-safe' : ''}`}><Icon size={23} /></div>
      <span className="section-kicker">CONFIRM ACTION</span>
      <h2 id="confirm-action-title">{dialog.title}</h2>
      <p id="confirm-action-description">{dialog.description}</p>
      <div className="member-confirm-actions">
        <button className="button button-secondary" type="button" disabled={busy} onClick={close}>انصراف</button>
        <button className={`button ${dialog.tone === 'safe' ? 'button-primary' : 'button-danger-ghost'} member-confirm-submit`} type="button" disabled={busy} onClick={confirm}>{busy ? 'در حال انجام…' : dialog.confirmLabel || 'تأیید'} <Icon size={15} /></button>
      </div>
    </section>
  </div>;
}

export function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-orbit"><span /></div><BrandMark /><p>در حال آماده‌سازی فضای کاری شما…</p></div>;
}

// A render error in one page must never blank the whole app.
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('NOWERA render error:', error, info?.componentStack); }
  componentDidUpdate(prev) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="nv-card nv-error-card"><AlertCircle size={26} /><h3>مشکلی در نمایش این صفحه پیش آمد</h3><p>اطلاعات شما سالم است. صفحه را دوباره بارگذاری کن یا به بخش دیگری برو.</p><button className="button button-primary" onClick={() => window.location.reload()}>بارگذاری دوباره</button></div>;
  }
}
