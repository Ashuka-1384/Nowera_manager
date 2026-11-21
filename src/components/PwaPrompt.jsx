import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { subscribePwa, promptInstall, applyUpdate } from '../lib/pwa.js';

const DISMISS_KEY = 'nowera:pwa-install-dismissed';

export default function PwaPrompt() {
  const [pwa, setPwa] = useState({});
  const [dismissed, setDismissed] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 7 * 864e5;
    } catch {
      return false;
    }
  });

  useEffect(() => subscribePwa(setPwa), []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  if (pwa.updateReady) {
    return (
      <div className="pwa-banner" role="status">
        <RefreshCw size={18} />
        <span>نسخه جدید NOWERA آماده است.</span>
        <button className="button button-primary button-small" onClick={applyUpdate}>به‌روزرسانی</button>
      </div>
    );
  }

  if (pwa.installEvent && !pwa.installed && !dismissed) {
    return (
      <div className="pwa-banner" role="dialog" aria-label="نصب برنامه">
        <Download size={18} />
        <span>NOWERA را روی گوشی نصب کن تا مثل یک اپ باز شود.</span>
        <button className="button button-primary button-small" onClick={promptInstall}>نصب</button>
        <button className="pwa-banner-close" onClick={dismiss} aria-label="بستن"><X size={15} /></button>
      </div>
    );
  }

  return null;
}
