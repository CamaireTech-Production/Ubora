import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service workers
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register main service worker first
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('🔔 [SW] Main service worker registered:', registration);
        
        // Then register Firebase messaging service worker
        return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      })
      .then((registration) => {
        console.log('🔔 [SW] Firebase messaging service worker registered:', registration);
      })
      .catch((error) => {
        console.error('🔔 [SW] Service worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
