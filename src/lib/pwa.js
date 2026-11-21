// Registers the service worker and exposes install / update events to the UI.
const listeners = new Set();
const state = { installEvent: null, installed: false, updateReady: null };

const emit = () => listeners.forEach((fn) => fn({ ...state }));
export const subscribePwa = (fn) => {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
};

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export async function promptInstall() {
  const ev = state.installEvent;
  if (!ev) return false;
  ev.prompt();
  const { outcome } = await ev.userChoice;
  state.installEvent = null;
  emit();
  return outcome === 'accepted';
}

export function applyUpdate() {
  state.updateReady?.postMessage({ type: 'SKIP_WAITING' });
}

export function initPwa() {
  if (typeof window === 'undefined') return;
  state.installed = isStandalone();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installEvent = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    state.installEvent = null;
    state.installed = true;
    emit();
  });

  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const watch = (worker) =>
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            state.updateReady = worker;
            emit();
          }
        });
      if (reg.waiting && navigator.serviceWorker.controller) {
        state.updateReady = reg.waiting;
        emit();
      }
      reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch (err) {
      console.warn('Service worker registration failed', err);
    }
  });
}
