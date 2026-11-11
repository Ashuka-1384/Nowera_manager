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
