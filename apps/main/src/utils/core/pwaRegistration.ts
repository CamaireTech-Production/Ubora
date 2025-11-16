/**
 * PWA Service Worker Registration with Dynamic Manifest Support
 * Based on the Vouls PWA Implementation Guide
 */

import { getPWAConfig, updateManifestLink } from './pwaConfig';

let deferredPrompt: any = null;
let isInstallable = false;

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  isInstallable = true;
});

// Listen for the appinstalled event
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  isInstallable = false;
});

export const registerServiceWorker = async () => {
  // Détection iOS pour gestion spéciale
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIOSSafari = isIOS && !(window as any).MSStream;
  
  if (!('serviceWorker' in navigator)) {
    if (isIOSSafari) {
      console.warn('🍎 [iOS] Service Worker non supporté sur cette version d\'iOS Safari');
    }
    return null;
  }
  
  try {
    // Add version query to force browser to fetch new SW
    // Use build time from vite config or current timestamp
    const buildTime = (globalThis as any).__BUILD_TIME__ || new Date().toISOString();
    const swVersion = buildTime.replace(/[:\-T]/g, '').split('.')[0]; // Format: 20241219103000
    
    if (isIOSSafari) {
      console.log('🍎 [iOS] Tentative d\'enregistrement du service worker...');
    }
    
    const registration = await navigator.serviceWorker.register(`/sw.js?v=${swVersion}`, {
      scope: '/',
      updateViaCache: 'none' // Always check for updates, never use cache
    });
    
    if (isIOSSafari) {
      console.log('🍎 [iOS] Service worker enregistré avec succès');
    }
    
    // Force update check immediately after registration
    if (registration) {
      try {
        await registration.update();
        console.log('🔔 [PWA] Service worker update check completed');
      } catch (updateError) {
        console.warn('🔔 [PWA] Service worker update check failed:', updateError);
        // Sur iOS, ne pas bloquer si l'update échoue
        if (isIOSSafari) {
          console.warn('🍎 [iOS] L\'update du service worker a échoué, mais l\'application continue');
        }
      }
    }
    
    // Update manifest based on current route
    const config = getPWAConfig();
    updateManifestLink(config);
    
    return registration;
  } catch (error) {
    console.error('🔔 [PWA] Service worker registration failed:', error);
    
    // Sur iOS, ne pas bloquer l'application si l'enregistrement échoue
    if (isIOSSafari) {
      console.warn('🍎 [iOS] L\'enregistrement du service worker a échoué, mais l\'application continue de fonctionner');
      console.warn('🍎 [iOS] Erreur:', error);
      // Retourner null au lieu de throw pour ne pas bloquer
      return null;
    }
    
    // Pour les autres navigateurs, on peut throw si nécessaire
    // Mais pour éviter de bloquer l'app, on retourne null
    return null;
  }
};

export const getDeferredPrompt = () => deferredPrompt;
export const getIsInstallable = () => isInstallable;
export const clearDeferredPrompt = () => {
  deferredPrompt = null;
  isInstallable = false;
};
