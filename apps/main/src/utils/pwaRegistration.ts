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
  if ('serviceWorker' in navigator) {
    try {
      // Add version query to force browser to fetch new SW
      // Use build time from vite config or current timestamp
      const buildTime = (globalThis as any).__BUILD_TIME__ || new Date().toISOString();
      const swVersion = buildTime.replace(/[:\-T]/g, '').split('.')[0]; // Format: 20241219103000
      
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${swVersion}`, {
        scope: '/',
        updateViaCache: 'none' // Always check for updates, never use cache
      });
      
      // Force update check immediately after registration
      if (registration) {
        try {
          await registration.update();
          console.log('🔔 [PWA] Service worker update check completed');
        } catch (updateError) {
          console.warn('🔔 [PWA] Service worker update check failed:', updateError);
        }
      }
      
      // Update manifest based on current route
      const config = getPWAConfig();
      updateManifestLink(config);
      
      return registration;
    } catch (error) {
      console.error('🔔 [PWA] Service worker registration failed:', error);
      throw error;
    }
  }
};

export const getDeferredPrompt = () => deferredPrompt;
export const getIsInstallable = () => isInstallable;
export const clearDeferredPrompt = () => {
  deferredPrompt = null;
  isInstallable = false;
};
