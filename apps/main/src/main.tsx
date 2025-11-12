import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Utiliser le système de debug depuis index.html
function debug(msg: string) {
  if (typeof (window as any).debugLog === 'function') {
    (window as any).debugLog(msg);
  }
  console.log(msg);
}

debug('🚀 main.tsx chargé et exécuté');
debug('📦 Imports React OK');

// Fonction d'initialisation avec logs
function init() {
  debug('📋 Étape 1: Vérification root');
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    debug('❌ Root introuvable');
    document.body.innerHTML = '<div style="padding:2rem;text-align:center"><h1>Erreur</h1><p>Élément root introuvable</p><button onclick="location.reload()">Recharger</button></div>';
    return;
  }
  debug('✅ Root trouvé');

  try {
    debug('🎨 Étape 2: Création root React');
    const root = createRoot(rootElement);
    debug('✅ Root React créé');
    
    debug('⚛️ Étape 3: Rendu App');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    debug('✅✅✅ APPLICATION RENDUE AVEC SUCCÈS');
  } catch (error) {
    debug('❌ ERREUR lors du rendu: ' + error);
    debug('❌ Type: ' + (error instanceof Error ? error.constructor.name : typeof error));
    if (error instanceof Error && error.stack) {
      debug('❌ Stack: ' + error.stack.substring(0, 500));
    }
    rootElement.innerHTML = '<div style="padding:2rem;text-align:center"><h1>Erreur de chargement</h1><p>' + String(error) + '</p><button onclick="location.reload()">Recharger</button></div>';
  }
}

// Initialiser quand le DOM est prêt
debug('📄 Vérification état DOM');
if (document.readyState === 'loading') {
  debug('⏳ DOM en chargement, attente DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    debug('✅ DOMContentLoaded déclenché');
    init();
  });
} else {
  debug('✅ DOM déjà prêt');
  init();
}

// Service worker - enregistrement optionnel et non-bloquant
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      debug('🔔 Enregistrement service worker');
      navigator.serviceWorker.register('/sw.js')
        .then(() => debug('✅ Service worker enregistré'))
        .catch((e) => debug('⚠️ Service worker: ' + e));
    }, 2000);
  });
} else {
  debug('⚠️ Service Worker non disponible');
}
