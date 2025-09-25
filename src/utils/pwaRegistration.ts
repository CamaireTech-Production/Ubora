/**
 * PWA Service Worker Registration with Dynamic Manifest Support
 * Based on the Vouls PWA Implementation Guide
 */

import { getPWAConfig, updateManifestLink } from './pwaConfig';

let deferredPrompt: any = null;
let isInstallable = false;

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('🔔 [PWA] beforeinstallprompt event fired');
  e.preventDefault();
  deferredPrompt = e;
  isInstallable = true;
});

// Listen for the appinstalled event
window.addEventListener('appinstalled', () => {
  console.log('✅ [PWA] App installed successfully');
  deferredPrompt = null;
  isInstallable = false;
});

export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('🔔 [PWA] Service worker registered:', registration);
      
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
