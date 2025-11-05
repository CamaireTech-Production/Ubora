import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import '@ubora/shared/firebaseConfig';
import './index.css';

// Service worker registration is handled by Vite PWA plugin

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
