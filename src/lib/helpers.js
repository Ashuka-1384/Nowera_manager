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

export function normalizePhone(input) {
  let value = String(input || '').replace(/[^\d+]/g, '');
  if (value.startsWith('0098')) value = `+${value.slice(2)}`;
  else if (value.startsWith('98') && !value.startsWith('+')) value = `+${value}`;
  else if (value.startsWith('09')) value = `+98${value.slice(1)}`;
  else if (/^9\d{9}$/.test(value)) value = `+98${value}`;
  return value;
}

export function getDepartment(id) { return DEPARTMENTS.find((d) => d.id === id) || DEPARTMENTS[1]; }
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0] || ''}${parts[1][0] || ''}` : (parts[0] || '?').slice(0, 2);
}
export function faDate(date, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!date) return '—';
  try { return new Intl.DateTimeFormat('fa-IR', options).format(new Date(date)); } catch { return '—'; }
}
export function isManager(profile, department) {
  return profile?.role === 'super_admin' || (profile?.role === 'department_admin' && (!department || profile.department === department));
}
