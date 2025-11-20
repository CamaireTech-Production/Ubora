import { useState, useEffect } from 'react';
import { logger } from '@ubora/shared/utils/logger';

interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  isInstallable: boolean;
}

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    isOnline: true,
    isUpdateAvailable: false,
    isInstallable: false,
  });

  useEffect(() => {
    // Check if app is installed
    const checkInstallStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      
      setPwaState(prev => ({
        ...prev,
        isInstalled: isStandalone || isIOSStandalone,
      }));
    };

    // Check online status
    const updateOnlineStatus = () => {
      setPwaState(prev => ({
        ...prev,
        isOnline: navigator.onLine,
      }));
    };

    // Check for updates with enhanced detection
    const checkForUpdates = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            // Check if there's already a waiting service worker
            if (registration.waiting) {
              setPwaState(prev => ({
                ...prev,
                isUpdateAvailable: true,
              }));
            }
            
            // Listen for new updates
            registration.addEventListener('updatefound', () => {
              logger.info('PWA: Update found, new service worker installing', null, 'usePWA');
              setPwaState(prev => ({
                ...prev,
                isUpdateAvailable: true,
              }));
            });
            
            // Periodic update check every 5 minutes
            setInterval(async () => {
              try {
                await registration.update();
                logger.debug('PWA: Periodic update check completed', null, 'usePWA');
              } catch (error) {
                logger.error('PWA: Periodic update check failed', error, 'usePWA');
              }
            }, 5 * 60 * 1000); // 5 minutes
          }
        } catch (error) {
          logger.error('Error checking for updates', error, 'usePWA');
        }
      }
    };

    // Check if installable
    const checkInstallability = () => {
      const isInstallable = 'serviceWorker' in navigator && 'PushManager' in window;
      setPwaState(prev => ({
        ...prev,
        isInstallable,
      }));
    };

    // Initial checks
    checkInstallStatus();
    updateOnlineStatus();
    checkForUpdates();
    checkInstallability();

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check for updates when window gains focus
    window.addEventListener('focus', checkForUpdates);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaState(prev => ({
        ...prev,
        isInstallable: true,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setPwaState(prev => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
      }));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('focus', checkForUpdates);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return pwaState;
};
