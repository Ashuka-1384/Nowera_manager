import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Light count-up for dashboard numbers: one rAF loop, no dependencies.
export function useCountUp(target, duration = 650) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return undefined; }
    const from = fromRef.current;
    const delta = target - from;
    if (!delta) { setValue(target); return undefined; }
    let frame; let start;
    const tick = (now) => {
      if (start === undefined) start = now;
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick); else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); fromRef.current = target; };
  }, [target, duration]);
  return value;
}

export function useDebouncedValue(value, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Shared behaviour for dialogs / bottom sheets: Escape closes, the page behind stops scrolling,
// and focus returns to the control that opened the dialog.
export function useModalBehavior(close, locked = false) {
  const closeRef = useRef(close);
  const lockedRef = useRef(locked);
  closeRef.current = close;
  lockedRef.current = locked;
  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (event) => { if (event.key === 'Escape' && !lockedRef.current) closeRef.current?.(); };
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    const previous = { overflow: html.style.overflow, padding: html.style.paddingInlineEnd };
    html.style.overflow = 'hidden';
    if (scrollbar > 0) html.style.paddingInlineEnd = `${scrollbar}px`;
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = previous.overflow;
      html.style.paddingInlineEnd = previous.padding;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus?.({ preventScroll: true });
    };
  }, []);
}

// Pull-down-to-refresh for touch screens (installed app / phone browser). Pure React state lives in the
// small indicator component that calls this hook, so a drag never re-renders the whole app.
export function usePullToRefresh(onRefresh, { threshold = 74, max = 112 } = {}) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return undefined;
    const s = { startY: 0, startX: 0, active: false, pull: 0 };
    const blocked = () => window.scrollY > 2 || document.querySelector('.modal-scrim, .member-confirm-overlay, .nv-sheet-scrim, .nv-sidebar.is-open');
    const onStart = (event) => {
      if (event.touches.length !== 1 || blocked() || event.target.closest?.('.nv-board, .nv-month-grid, input, textarea, select')) { s.active = false; return; }
      s.startY = event.touches[0].clientY; s.startX = event.touches[0].clientX; s.active = true; s.pull = 0;
    };
    const onMove = (event) => {
      if (!s.active) return;
      const dy = event.touches[0].clientY - s.startY;
      const dx = Math.abs(event.touches[0].clientX - s.startX);
      if (dy <= 0 || dx > dy) { if (s.pull) { s.pull = 0; setPull(0); } if (dy < -6) s.active = false; return; }
      s.pull = Math.min(max, dy * 0.45);
      setPull(s.pull);
    };
    const onEnd = async () => {
      if (!s.active) return;
      s.active = false;
      const reached = s.pull >= threshold;
      s.pull = 0; setPull(0);
      if (!reached) return;
      setBusy(true);
      try { await refreshRef.current?.(); } finally { setBusy(false); }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart); document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd); document.removeEventListener('touchcancel', onEnd);
    };
  }, [threshold, max]);
  return { pull, busy, threshold };
}
