export const DEPARTMENTS = [
  { id: 'Lumen', name: 'لومن', english: 'Lumen', tagline: 'تولید محتوا و تبلیغات', color: '#a855f7', glow: 'rgba(168,85,247,.18)', logo: '/brands/lumen.jpg' },
  { id: 'Technoplus', name: 'تکنوپلاس', english: 'Technoplus', tagline: 'توسعه نرم‌افزار و خدمات فنی', color: '#22b8f0', glow: 'rgba(34,184,240,.18)', logo: '/brands/technoplus.jpg' },
  { id: 'Atlas', name: 'اطلس', english: 'Atlas', tagline: 'ترید و خدمات مالی', color: '#e9b85b', glow: 'rgba(233,184,91,.18)', logo: '/brands/atlas.jpg' },
  { id: 'Horizen', name: 'هورایزن', english: 'Horizen', tagline: 'طراحی سه‌بعدی و تصویرسازی', color: '#647cff', glow: 'rgba(100,124,255,.18)', logo: '/brands/horizen.svg' },
];

export const ROLE_LABELS = { member: 'عضو تیم', department_admin: 'مدیر بخش', super_admin: 'مدیر اصلی' };
export const PROJECT_STATUS = { planning: 'در برنامه‌ریزی', active: 'در حال اجرا', paused: 'متوقف', completed: 'تکمیل‌شده' };
export const TASK_STATUS = { todo: 'شروع‌نشده', in_progress: 'در حال انجام', review: 'در انتظار بررسی', done: 'تکمیل‌شده' };
export const PRIORITY = { low: 'کم', medium: 'متوسط', high: 'زیاد', urgent: 'فوری' };
export const REQUEST_STATUS = { pending: 'در انتظار تأیید', approved: 'تأییدشده', rejected: 'ردشده' };

// Built-in super admin. Whoever signs up / logs in with this number is the owner (see also is_owner_account() in schema.sql).
export const OWNER_PHONE = '09333167279';
export function isOwnerPhone(value) {
  const digits = String(value || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  return digits.length >= 10 && digits.endsWith(OWNER_PHONE.slice(1));
}

export function normalizePhone(input) {
  // Accept Persian and Arabic-Indic digits as well as ASCII digits.
  let value = String(input || '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[^\d+]/g, '');
  if (value.startsWith('0098')) value = `+${value.slice(2)}`;
  else if (value.startsWith('98') && !value.startsWith('+')) value = `+${value}`;
  else if (value.startsWith('09')) value = `+98${value.slice(1)}`;
  else if (/^9\d{9}$/.test(value)) value = `+98${value}`;
  return value;
}

// Supabase Email/Password Auth is used as the password identity so Phone/SMS
// provider can stay disabled. This alias is not a real mailbox; confirmation
// must be disabled in Supabase for immediate sign-up without sending email.
export function phoneToAuthEmail(input) {
  const digits = normalizePhone(input).replace(/[^\d]/g, '');
  return `phone-${digits}@login.nowera.invalid`;
}

export function getDepartment(id) { return DEPARTMENTS.find((d) => d.id === id) || DEPARTMENTS[1]; }
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0] || ''}${parts[1][0] || ''}` : (parts[0] || '?').slice(0, 2);
}
// Date-only values ("2026-11-10") must be read as LOCAL dates. new Date('2026-11-10') is UTC
// midnight, which shows up as the previous day in every timezone behind UTC.
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
export function faDate(date, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  const parsed = parseDate(date);
  if (!parsed) return '—';
  try { return new Intl.DateTimeFormat('fa-IR', options).format(parsed); } catch { return '—'; }
}
export function toFaDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}
export function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// 'overdue' | 'today' | 'soon' (<= 3 days) | 'ok' | null
export function dueState(task) {
  if (!task?.due_date || task.status === 'done') return null;
  const due = parseDate(task.due_date);
  if (!due) return null;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const diff = Math.round((new Date(due).setHours(12, 0, 0, 0) - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return diff <= 3 ? 'soon' : 'ok';
}
export function progressOf(tasks) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === 'done').length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
export function isManager(profile, department) {
  return profile?.role === 'super_admin' || (profile?.role === 'department_admin' && (!department || profile.department === department));
}
