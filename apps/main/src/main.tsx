import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fonction d'initialisation
function init() {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    document.body.innerHTML = '<div style="padding:2rem;text-align:center"><h1>Erreur</h1><p>Élément root introuvable</p><button onclick="location.reload()">Recharger</button></div>';
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    rootElement.innerHTML = '<div style="padding:2rem;text-align:center"><h1>Erreur de chargement</h1><p>' + String(error) + '</p><button onclick="location.reload()">Recharger</button></div>';
  }
}

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Service worker - enregistrement optionnel et non-bloquant
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignorer silencieusement les erreurs
      });
    }, 2000);
  });
}
