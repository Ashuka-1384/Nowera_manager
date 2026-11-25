import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/estedad/wght.css';
import '@fontsource-variable/dm-sans/index.css';
import App from './App.jsx';
import './styles.css';
import './styles-refined.css';
import './styles-luxury.css';
import './styles-studio.css';
import './styles-nova.css';
import './styles-mobile.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Offline shell + instant repeat visits (production only, so local dev is never cached).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
