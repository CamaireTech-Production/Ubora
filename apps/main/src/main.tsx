import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Détection iOS pour le débogage
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isIOSSafari = isIOS && !(window as any).MSStream;

if (isIOSSafari) {
  console.log('🍎 [iOS] Détection iOS Safari - Mode de compatibilité activé');
}

// Fonction pour initialiser l'application de manière sécurisée
function initializeApp() {
  try {
    // Vérifier que l'élément root existe
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      console.error('❌ [App] Élément root introuvable');
      document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f3f4f6; font-family: system-ui;">
          <div style="text-align: center; padding: 2rem;">
            <h1 style="color: #ef4444; margin-bottom: 1rem;">Erreur de chargement</h1>
            <p style="color: #6b7280;">L'élément root est introuvable. Veuillez recharger la page.</p>
            <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
              Recharger
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Initialiser Firebase de manière asynchrone pour ne pas bloquer le rendu
    Promise.resolve().then(async () => {
      try {
        await import('@ubora/shared/firebaseConfig');
        console.log('🔥 [Firebase] Configuration chargée avec succès');
      } catch (firebaseError) {
        console.error('🔥 [Firebase] Erreur lors du chargement de Firebase:', firebaseError);
        // Ne pas bloquer l'application si Firebase échoue
        if (isIOSSafari) {
          console.warn('🍎 [iOS] Firebase a échoué, mais l\'application continue de fonctionner');
        }
      }
    });

    // Enregistrer le service worker de manière asynchrone (non-bloquant)
    // Attendre que la page soit complètement chargée
    window.addEventListener('load', () => {
      setTimeout(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
              console.log('🔔 [SW] Service worker enregistré:', registration.scope);
            })
            .catch((error) => {
              console.warn('🔔 [SW] Échec de l\'enregistrement:', error);
              if (isIOSSafari) {
                console.warn('🍎 [iOS] Service worker non disponible - normal sur certaines versions iOS');
              }
            });
        } else {
          if (isIOSSafari) {
            console.warn('🍎 [iOS] Service Worker non supporté sur cette version');
          }
        }
      }, 1000); // Délai pour ne pas bloquer le chargement
    });

    // Rendre l'application React
    const root = createRoot(rootElement);
    
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    
    console.log('✅ [App] Application React initialisée avec succès');
    
  } catch (error) {
    console.error('❌ [App] Erreur critique lors de l\'initialisation:', error);
    
    // Afficher un message d'erreur à l'utilisateur
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f3f4f6; font-family: system-ui;">
          <div style="text-align: center; padding: 2rem; max-width: 500px;">
            <h1 style="color: #ef4444; margin-bottom: 1rem;">Erreur de chargement</h1>
            <p style="color: #6b7280; margin-bottom: 1rem;">
              Une erreur s'est produite lors du chargement de l'application.
            </p>
            ${isIOSSafari ? '<p style="color: #f59e0b; margin-bottom: 1rem; font-size: 0.875rem;">Détecté: iOS Safari - Vérifiez la console pour plus de détails.</p>' : ''}
            <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
              Recharger la page
            </button>
            ${process.env.NODE_ENV === 'development' ? `
              <details style="margin-top: 2rem; text-align: left;">
                <summary style="cursor: pointer; color: #6b7280; margin-bottom: 0.5rem;">Détails techniques</summary>
                <pre style="background: #1f2937; color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow: auto; font-size: 0.75rem;">${error instanceof Error ? error.stack : String(error)}</pre>
              </details>
            ` : ''}
          </div>
        </div>
      `;
    }
  }
}

// Attendre que le DOM soit prêt avant d'initialiser
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM déjà prêt
  initializeApp();
}
