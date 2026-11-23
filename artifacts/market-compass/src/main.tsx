import { createRoot } from 'react-dom/client';

import App from './App';
import {setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import { ErrorBoundary } from '@/components/error-boundary';

// Offline Bootstrap grid only; no reboot, JS or CDN. Tailwind owns forms and vault UI.
import './vendor/bootstrap/bootstrap-grid.min.css';
import './index.css';
import './ionic-shell.css';

setupIonicReact({mode:'ios'});

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Register static shell caching only; never store live API responses in the worker.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((e) => console.warn('PWA offline shell unavailable:', e));
  });
}
