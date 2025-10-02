import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Download, X, Smartphone, Monitor, Shield } from 'lucide-react';
import { getPWAConfig, updateManifestLink } from '../utils/pwaConfig';
import { getDeferredPrompt, getIsInstallable, clearDeferredPrompt } from '../utils/pwaRegistration';

export const PWAInstallPrompt: React.FC = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pwaConfig, setPwaConfig] = useState(getPWAConfig());
  const [isInstalling, setIsInstalling] = useState(false);


  useEffect(() => {
    // Update PWA config when route changes
    const updateConfig = () => {
      const newConfig = getPWAConfig();
      setPwaConfig(newConfig);
      updateManifestLink(newConfig); // Update manifest when config changes
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

    // Listen for route changes to update config
    const handleRouteChange = () => {
      updateConfig();
    };
    window.addEventListener('popstate', handleRouteChange);

    // Check if app should be installable (more robust check)
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
      window.removeEventListener('popstate', handleRouteChange);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, [pwaConfig.isAdmin]);

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
      
      // Check if it's iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // For iOS, we can't programmatically install, so we show instructions
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
    // Modal will show again on page reload
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Don't show if already installed
  if (isInstalled || isStandalone) {
    return null;
  }


  // Don't show if prompt is dismissed
  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Card className={`bg-gradient-to-r text-white border-0 shadow-lg ${
        pwaConfig.isAdmin 
          ? 'from-red-600 to-red-700' 
          : 'from-blue-600 to-blue-700'
      }`}>
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                {pwaConfig.isAdmin ? (
                  <Shield className="h-5 w-5" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  Installer {pwaConfig.shortName}
                </h3>
                <p className="text-blue-100 text-sm">
                  {pwaConfig.isAdmin 
                    ? 'Accédez au panel d\'administration'
                    : 'Accédez plus rapidement à votre application'
                  }
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
                {pwaConfig.isAdmin 
                  ? 'Installez le panel d\'administration pour un accès rapide'
                  : 'Installez l\'application pour une expérience optimale'
                }
              </p>
              
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className={`w-full bg-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 ${
                  pwaConfig.isAdmin 
                    ? 'text-red-600 hover:bg-red-50' 
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                {isInstalling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                    <span>Installation...</span>
                  </>
                ) : (
                  <>
                    {pwaConfig.isAdmin ? (
                      <Shield className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
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