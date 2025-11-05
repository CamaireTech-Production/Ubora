import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { getDeferredPrompt, getIsInstallable, clearDeferredPrompt } from '@ubora/shared/utils/pwaRegistration';

// Main app PWA Config - always blue theme, no admin mode
const getMainPWAConfig = () => {
  // Detect environment: dev (dev.ubora-app.com) or prod (my.ubora-app.com)
  const isDev = window.location.hostname.includes('dev.') || 
                window.location.hostname.includes('localhost') ||
                window.location.hostname.includes('127.0.0.1');
  
  return {
    appName: isDev ? 'Ubora Dev' : 'Ubora',
    shortName: isDev ? 'Ubora Dev' : 'Ubora',
    isAdmin: false,
    startUrl: '/',
    scope: '/'
  };
};

export const PWAInstallPrompt: React.FC = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pwaConfig, setPwaConfig] = useState(getMainPWAConfig());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Update PWA config when hostname changes
    const updateConfig = () => {
      const newConfig = getMainPWAConfig();
      setPwaConfig(newConfig);
    };

    // Check if app is already installed
    const checkIfInstalled = () => {
      // Check for standalone mode (Android/Desktop)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check for iOS Safari standalone mode
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }

      // Check if running in PWA mode
      if (window.location.search.includes('source=pwa') || 
          document.referrer.includes('android-app://')) {
        setIsInstalled(true);
        return;
      }
    };

    updateConfig();
    checkIfInstalled();

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
    };

    // Listen for display mode changes
    const handleDisplayModeChange = () => {
      checkIfInstalled();
    };

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = () => {
      if (!isInstalled) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);

    // Check if app should be installable
    const checkShouldShowPrompt = () => {
      // Don't show if already installed
      if (isInstalled) {
        return false;
      }
      
      // Check if we have a deferred prompt (most reliable)
      if (getIsInstallable()) {
        return true;
      }
      
      // Fallback: Check basic PWA criteria
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
      
      // Show if basic PWA criteria are met
      return hasServiceWorker && hasManifest && isHTTPS;
    };

    // Show prompt after a delay if conditions are met
    if (checkShouldShowPrompt()) {
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000); // Show after 3 seconds
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstallClick = async () => {
    setIsInstalling(true);

    try {
      const deferredPrompt = getDeferredPrompt();
      
      // First try the native prompt if available (Android/Desktop)
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          clearDeferredPrompt();
          setShowInstallPrompt(false);
        } else {
          clearDeferredPrompt();
          setShowInstallPrompt(false);
        }
        setIsInstalling(false);
        return;
      }

      // For iOS or when no deferred prompt is available
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        setIsInstalling(false);
        return;
      }

      // For other browsers, show manual instructions
      alert('Pour installer cette application:\n\n1. Cliquez sur le menu de votre navigateur (⋮)\n2. Sélectionnez "Installer l\'application" ou "Ajouter à l\'écran d\'accueil"\n3. Suivez les instructions à l\'écran');
      setIsInstalling(false);
      
    } catch (error) {
      console.error('❌ Error during installation:', error);
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Don't show if already installed
  if (isInstalled || isStandalone) {
    return null;
  }

  // Check if dismissed recently (within 7 days)
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed && !showInstallPrompt) {
    const dismissedTime = parseInt(dismissed, 10);
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed < 7) {
      return null;
    }
  }

  // Don't show if prompt is dismissed
  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  Installer {pwaConfig.shortName}
                </h3>
                <p className="text-blue-100 text-sm">
                  Accédez plus rapidement à votre application
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isIOS ? (
            <div className="space-y-3">
              <p className="text-blue-100 text-sm">
                Pour installer cette application sur votre iPhone/iPad :
              </p>
              <ol className="text-blue-100 text-sm space-y-1 list-decimal list-inside">
                <li>Appuyez sur le bouton Partager <span className="text-white">⎋</span></li>
                <li>Faites défiler et sélectionnez "Sur l'écran d'accueil"</li>
                <li>Appuyez sur "Ajouter"</li>
              </ol>
              <div className="mt-3 p-2 bg-white/10 rounded-lg">
                <p className="text-blue-200 text-xs">
                  💡 Astuce: L'icône de partage se trouve en bas de l'écran
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-4 text-blue-100 text-sm">
                <div className="flex items-center space-x-1">
                  <Smartphone className="h-4 w-4" />
                  <span>Mobile</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Monitor className="h-4 w-4" />
                  <span>Desktop</span>
                </div>
              </div>
              
              <p className="text-blue-100 text-sm">
                Installez l'application pour une expérience optimale
              </p>
              
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full bg-white text-blue-600 hover:bg-blue-50 font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isInstalling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                    <span>Installation...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Installer maintenant</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-blue-500/30">
            <p className="text-blue-200 text-xs">
              ✓ Fonctionne hors ligne • ✓ Notifications • ✓ Accès rapide
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
