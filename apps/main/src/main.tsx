import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fonction d'initialisation ultra-simple
function init() {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    // Si root n'existe pas, créer un message d'erreur simple
    document.body.innerHTML = '<div style="padding:2rem;text-align:center"><h1>Erreur</h1><p>Élément root introuvable</p><button onclick="location.reload()">Recharger</button></div>';
    return;
  }

  try {
    // Rendre React - c'est la seule chose critique
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    // En cas d'erreur, afficher un message simple
    rootElement.innerHTML = '<div style="padding:2rem;text-align:center"><h1>Erreur de chargement</h1><p>Veuillez recharger la page</p><button onclick="location.reload()">Recharger</button></div>';
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
