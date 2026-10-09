import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);

/* PWA: Service Worker nur im Produktions-Build registrieren (kein Dev-Caching). */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('Service-Worker-Registrierung fehlgeschlagen:', e);
    });
  });
}
