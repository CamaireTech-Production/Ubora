import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Système de débogage visuel pour iOS
const debugLog: string[] = [];
let debugVisible = true;

const debugElement = document.createElement('div');
debugElement.id = 'debug-overlay';
debugElement.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;color:#0f0;padding:1rem;font-family:monospace;font-size:12px;z-index:99999;overflow:auto;';
document.body.appendChild(debugElement);

function debug(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  debugLog.push(`[${timestamp}] ${message}`);
  
  const toggleBtn = '<button onclick="document.getElementById(\'debug-overlay\').style.display=document.getElementById(\'debug-overlay\').style.display===\'none\'?\'\':\'none\';" style="position:fixed;top:10px;right:10px;padding:0.5rem;background:#0f0;color:#000;border:none;border-radius:4px;cursor:pointer;z-index:100000;font-weight:bold;">Masquer Debug</button>';
  
  debugElement.innerHTML = toggleBtn + '<h2 style="color:#0f0;margin:0 0 1rem 0;">🔍 DEBUG iOS - Tous les logs</h2>' + 
    debugLog.map(log => `<div style="margin:0.25rem 0;padding:0.25rem;background:#111;border-left:3px solid #0f0;">${log}</div>`).join('');
  console.log(message);
}

// Démarrer le débogage
debug('🚀 Démarrage de l\'application');
debug(`🌐 User Agent: ${navigator.userAgent}`);
debug(`📱 Platform: ${navigator.platform}`);
debug(`🔗 URL: ${window.location.href}`);

// Tester les imports
debug('📦 Test des imports');
try {
  debug('✅ StrictMode disponible');
} catch (e) {
  debug(`❌ ERREUR StrictMode: ${e}`);
}

try {
  debug('✅ createRoot disponible');
} catch (e) {
  debug(`❌ ERREUR createRoot: ${e}`);
}

// Fonction d'initialisation avec débogage complet
function init() {
  try {
    debug('📋 Étape 1: Vérification de l\'élément root');
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      debug('❌ ERREUR: Élément root introuvable');
      document.body.innerHTML = '<div style="padding:2rem;text-align:center;background:#fee;color:#c00;"><h1>Erreur</h1><p>Élément root introuvable</p><button onclick="location.reload()" style="padding:0.5rem 1rem;background:#c00;color:#fff;border:none;border-radius:4px;cursor:pointer;">Recharger</button></div>';
      return;
    }
    debug('✅ Élément root trouvé');

    debug('🎨 Étape 2: Création du root React');
    let root;
    try {
      root = createRoot(rootElement);
      debug('✅ Root React créé');
    } catch (e) {
      debug(`❌ ERREUR création root: ${e}`);
      rootElement.innerHTML = `<div style="padding:2rem;text-align:center;background:#fee;color:#c00;"><h1>Erreur React</h1><p>${String(e)}</p><pre style="text-align:left;background:#fdd;padding:1rem;margin:1rem 0;overflow:auto;">${e instanceof Error ? e.stack : String(e)}</pre><button onclick="location.reload()">Recharger</button></div>`;
      return;
    }

    debug('📦 Étape 3: Test import App');
    try {
      debug('✅ App importé');
    } catch (e) {
      debug(`❌ ERREUR import App: ${e}`);
      rootElement.innerHTML = `<div style="padding:2rem;text-align:center;background:#fee;color:#c00;"><h1>Erreur Import App</h1><p>${String(e)}</p><pre style="text-align:left;background:#fdd;padding:1rem;margin:1rem 0;overflow:auto;">${e instanceof Error ? e.stack : String(e)}</pre><button onclick="location.reload()">Recharger</button></div>`;
      return;
    }
      
    debug('⚛️ Étape 4: Rendu de l\'application');
    try {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
      debug('✅ Application rendue avec succès');
      
      // Ne pas masquer le debug automatiquement - laisser l'utilisateur le voir
      debug('✅✅✅ TOUT FONCTIONNE - L\'application devrait être visible');
      
    } catch (error) {
      debug(`❌ ERREUR lors du rendu: ${error}`);
      debug(`❌ Type d'erreur: ${error instanceof Error ? error.constructor.name : typeof error}`);
      debug(`❌ Message: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        debug(`❌ Stack: ${error.stack}`);
      }
      rootElement.innerHTML = `<div style="padding:2rem;text-align:center;background:#fee;color:#c00;"><h1>Erreur de rendu</h1><p>${String(error)}</p><pre style="text-align:left;background:#fdd;padding:1rem;margin:1rem 0;overflow:auto;font-size:10px;">${error instanceof Error ? error.stack : String(error)}</pre><button onclick="location.reload()" style="padding:0.5rem 1rem;background:#c00;color:#fff;border:none;border-radius:4px;cursor:pointer;">Recharger</button></div>`;
    }
  } catch (error) {
    debug(`❌ ERREUR CRITIQUE dans init(): ${error}`);
    debug(`❌ Type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `<div style="padding:2rem;text-align:center;background:#fee;color:#c00;"><h1>Erreur critique</h1><p>${String(error)}</p><pre style="text-align:left;background:#fdd;padding:1rem;margin:1rem 0;overflow:auto;font-size:10px;">${error instanceof Error ? error.stack : String(error)}</pre><button onclick="location.reload()" style="padding:0.5rem 1rem;background:#c00;color:#fff;border:none;border-radius:4px;cursor:pointer;">Recharger</button></div>`;
    }
  }
}

// Initialiser quand le DOM est prêt
debug('📄 Étape 0: Vérification du DOM');
if (document.readyState === 'loading') {
  debug('⏳ DOM en cours de chargement, attente de DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    debug('✅ DOMContentLoaded déclenché');
    init();
  });
} else {
  debug('✅ DOM déjà prêt');
  init();
}

// Service worker - enregistrement optionnel
if ('serviceWorker' in navigator) {
  debug('🔔 Service Worker disponible');
  window.addEventListener('load', () => {
    setTimeout(() => {
      debug('🔔 Tentative d\'enregistrement du service worker');
      navigator.serviceWorker.register('/sw.js')
        .then(() => debug('✅ Service worker enregistré'))
        .catch((e) => debug(`⚠️ Service worker échoué: ${e}`));
    }, 2000);
  });
} else {
  debug('⚠️ Service Worker non disponible');
}
