/**
 * PWA Service Worker Registration with Dynamic Manifest Support
 * Based on the Vouls PWA Implementation Guide
 */

import { getPWAConfig, updateManifestLink } from './pwaConfig';
import { logger } from '@ubora/shared/utils/logger';

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
      logger.warn('Service Worker non supporté sur cette version d\'iOS Safari', null, 'pwaRegistration');
    }
    return null;
  }
  
  try {
    // Add version query to force browser to fetch new SW
    // Use build time from vite config or current timestamp
    const buildTime = (globalThis as any).__BUILD_TIME__ || new Date().toISOString();
    const swVersion = buildTime.replace(/[:\-T]/g, '').split('.')[0]; // Format: 20241219103000
    
    if (isIOSSafari) {
      logger.debug('Tentative d\'enregistrement du service worker (iOS)', null, 'pwaRegistration');
    }
    
    const registration = await navigator.serviceWorker.register(`/sw.js?v=${swVersion}`, {
      scope: '/',
      updateViaCache: 'none' // Always check for updates, never use cache
    });
    
    if (isIOSSafari) {
      logger.debug('Service worker enregistré avec succès (iOS)', null, 'pwaRegistration');
    }
    
    // Force update check immediately after registration
    if (registration) {
      try {
        await registration.update();
        logger.debug('Service worker update check completed', null, 'pwaRegistration');
      } catch (updateError) {
        logger.warn('Service worker update check failed', updateError, 'pwaRegistration');
        // Sur iOS, ne pas bloquer si l'update échoue
        if (isIOSSafari) {
          logger.warn('L\'update du service worker a échoué, mais l\'application continue (iOS)', updateError, 'pwaRegistration');
        }
      }
    }
    
    // Update manifest based on current route
    const config = getPWAConfig();
    updateManifestLink(config);
    
    return registration;
  } catch (error) {
    logger.error('Service worker registration failed', error, 'pwaRegistration');
    
    // Sur iOS, ne pas bloquer l'application si l'enregistrement échoue
    if (isIOSSafari) {
      logger.warn('L\'enregistrement du service worker a échoué, mais l\'application continue de fonctionner (iOS)', error, 'pwaRegistration');
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
