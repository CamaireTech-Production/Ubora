import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Firebase messaging service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('🔔 [SW] Firebase messaging service worker registered:', registration);
    })
    .catch((error) => {
      console.error('🔔 [SW] Firebase messaging service worker registration failed:', error);
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
