import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import PwaPrompt from './components/PwaPrompt.jsx';
import { initPwa } from './lib/pwa.js';
import './styles.css';
import './styles-refined.css';
import './styles-luxury.css';
import './styles-studio.css';
import './styles-nova.css';
import './styles-pwa.css';

initPwa();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <PwaPrompt />
  </React.StrictMode>,
);
