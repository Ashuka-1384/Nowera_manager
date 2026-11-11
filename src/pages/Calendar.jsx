import React, { useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import { DEPARTMENTS, getDepartment, isManager, localDateKey, toFaDigits } from '../lib/helpers';
import { EmptyState, PageHeader } from '../components/ui';

// Intl formatter construction is expensive; build each one once for the whole module.
const F = {
  monthKey: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'numeric' }),
  monthName: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric' }),
  day: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }),
  dayLabel: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }),
  time: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }),
  upDay: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }),
  upMonth: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short' }),
};
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function persianMonthStart(value) {
  const date = new Date(value); date.setHours(12, 0, 0, 0);
  const key = F.monthKey.format(date);
  for (let i = 0; i < 32; i += 1) {
    const prev = new Date(date); prev.setDate(prev.getDate() - 1);
    if (F.monthKey.format(prev) !== key) break;
    date.setDate(date.getDate() - 1);
  }
  return date;
}

export default function CalendarPage({ profile, data, openDialog, deleteEvent, confirmAction }) {
  const [department, setDepartment] = useState(profile.role === 'department_admin' ? profile.department : 'all');
  const [month, setMonth] = useState(() => persianMonthStart(new Date()));
  const [selected, setSelected] = useState(() => localDateKey(new Date()));
  const manager = profile.role !== 'member';
  const todayKey = localDateKey(new Date());

  const events = useMemo(() => data.events.filter((e) => department === 'all' || e.department === department).sort((a, b) => new Date(a.event_date) - new Date(b.event_date)), [data.events, department]);
  const byDay = useMemo(() => { const map = new Map(); events.forEach((e) => { const k = localDateKey(new Date(e.event_date)); (map.get(k) || map.set(k, []).get(k)).push(e); }); return map; }, [events]);
  const monthKey = F.monthKey.format(month);
  const cells = useMemo(() => {
    const first = persianMonthStart(month);
    const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 1) % 7));
    return Array.from({ length: 42 }, (_, i) => { const date = new Date(start); date.setDate(start.getDate() + i); return { date, key: localDateKey(date), inMonth: F.monthKey.format(date) === monthKey, day: F.day.format(date) }; });
  }, [month, monthKey]);
  const rows = cells.slice(35).some((c) => c.inMonth) ? 6 : 5;
  const selectedEvents = byDay.get(selected) || [];
  const upcoming = events.filter((e) => new Date(e.event_date) >= new Date(Date.now() - 3600000) && localDateKey(new Date(e.event_date)) !== selected).slice(0, 4);

  const go = (offset) => { const t = persianMonthStart(month); t.setDate(t.getDate() + (offset > 0 ? 35 : -1)); const next = persianMonthStart(t); setMonth(next); setSelected(localDateKey(next)); };
  const goToday = () => { const now = new Date(); setMonth(persianMonthStart(now)); setSelected(localDateKey(now)); };
  const selectedLabel = F.dayLabel.format(new Date(`${selected}T12:00:00`));
  const canEdit = (event) => manager && isManager(profile, event.department);

  return <div className="nv-stack">
    <PageHeader eyebrow="TEAM CALENDAR / SCHEDULE" title="تقویم نَوِرا" description="برنامه‌ی تیم‌ها را در نمای ماهانه ببین و جزئیات هر روز را کنار تقویم دنبال کن."
      action={manager && <button className="button button-primary" onClick={() => openDialog({ type: 'event', date: selected })}><CalendarPlus size={16} /> ثبت رویداد</button>} />

    <div className="nv-toolbar nv-rise" style={{ '--i': 1 }}>
      <div className="nv-month-title"><span className="nv-dot-icon"><CalendarDays size={18} /></span><div><small>برنامه‌ریزی ماهانه</small><strong>{F.monthName.format(month)}</strong></div></div>
      <div className="nv-legend">{DEPARTMENTS.map((d) => <span key={d.id} style={{ '--c': d.color }}><i />{d.name}</span>)}</div>
      <select className="nv-select" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="فیلتر تیم">
        {profile.role !== 'department_admin' && <option value="all">همه تیم‌ها</option>}
        {DEPARTMENTS.filter((d) => profile.role !== 'department_admin' || d.id === profile.department).map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}
      </select>
      <div className="nv-month-nav">
        <button className="nv-icon-btn" onClick={() => go(-1)} title="ماه قبل" aria-label="ماه قبل"><ChevronRight size={17} /></button>
        <button className="button button-secondary button-small" onClick={goToday}>امروز</button>
        <button className="nv-icon-btn" onClick={() => go(1)} title="ماه بعد" aria-label="ماه بعد"><ChevronLeft size={17} /></button>
      </div>
    </div>

    <div className="nv-calendar-layout">
      <section className="nv-card nv-calendar nv-rise" style={{ '--i': 2, '--rows': rows }}>
        <div className="nv-weekdays">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="nv-month-grid" key={monthKey}>{cells.slice(0, rows * 7).map(({ date, key, inMonth, day }) => {
          const list = byDay.get(key) || [];
          return <button key={key} className={`nv-day ${inMonth ? '' : 'is-muted'} ${key === selected ? 'is-selected' : ''} ${key === todayKey ? 'is-today' : ''}`} aria-pressed={key === selected}
            onClick={() => { setSelected(key); if (!inMonth) setMonth(persianMonthStart(date)); }}>
            <span className="nv-day-num">{day}</span>
            <span className="nv-day-events">{list.slice(0, 2).map((e) => <i key={e.id} style={{ '--c': getDepartment(e.department).color }}>{e.title}</i>)}{list.length > 2 && <em>+{toFaDigits(list.length - 2)}</em>}</span>
          </button>;
        })}</div>
      </section>

      <aside className="nv-aside">
        <section className="nv-card nv-rise" style={{ '--i': 3 }}>
          <div className="nv-card-head"><div><span className="nv-kicker">DAY AGENDA</span><h3>{selectedLabel}</h3></div><span className="nv-count">{toFaDigits(selectedEvents.length)}</span></div>
          {selectedEvents.length ? <div className="nv-list" key={selected}>{selectedEvents.map((event) => {
            const dept = getDepartment(event.department);
            return <article className="nv-event nv-rise" key={event.id} style={{ '--dept-color': dept.color }}>
              <span className="nv-event-time"><Clock3 size={12} />{F.time.format(new Date(event.event_date))}</span>
              <div className="nv-list-main"><small className="nv-event-dept"><i />{dept.name}</small><strong>{event.title}</strong>{event.details && <p className="nv-clamp">{event.details}</p>}</div>
              {canEdit(event) && <div className="nv-actions is-col">
                <button className="nv-icon-btn" title="ویرایش رویداد" aria-label="ویرایش رویداد" onClick={() => openDialog({ type: 'editEvent', record: event })}><Pencil size={14} /></button>
                <button className="nv-icon-btn is-danger" title="حذف رویداد" aria-label="حذف رویداد" onClick={() => confirmAction({ title: 'حذف رویداد؟', description: `رویداد «${event.title}» از تقویم حذف می‌شود.`, confirmLabel: 'حذف رویداد', onConfirm: () => deleteEvent(event.id) })}><Trash2 size={14} /></button>
              </div>}
            </article>;
          })}</div> : <EmptyState icon={<CalendarDays size={22} />} title="روز خلوتی است" description={manager ? 'برای این روز رویدادی ثبت نشده است.' : 'برای این روز رویدادی ثبت نشده است.'} action={manager && <button className="button button-secondary button-small" onClick={() => openDialog({ type: 'event', date: selected })}><Plus size={14} /> ثبت رویداد</button>} />}
        </section>
        {upcoming.length > 0 && <section className="nv-card nv-rise" style={{ '--i': 4 }}>
          <div className="nv-card-head"><div><span className="nv-kicker">COMING UP</span><h3>رویدادهای پیش‌رو</h3></div></div>
          <div className="nv-list">{upcoming.map((event) => { const d = new Date(event.event_date); const dept = getDepartment(event.department); return <button key={event.id} className="nv-list-row is-compact is-button" style={{ '--dept-color': dept.color }} onClick={() => { setMonth(persianMonthStart(d)); setSelected(localDateKey(d)); }}>
            <div className="nv-date-tile"><strong>{F.upDay.format(d)}</strong><small>{F.upMonth.format(d)}</small></div>
            <div className="nv-list-main"><strong>{event.title}</strong><small>{dept.name} · {F.time.format(d)}</small></div></button>; })}</div>
        </section>}
      </aside>
    </div>
  </div>;
}
