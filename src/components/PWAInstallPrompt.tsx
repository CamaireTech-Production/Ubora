import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Download, X, Smartphone, Monitor, Shield } from 'lucide-react';
import { getPWAConfig } from '../utils/pwaConfig';
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

    // Check if app is installable
    const checkInstallability = () => {
      if (getIsInstallable()) {
        setShowInstallPrompt(true);
      }
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      console.log('✅ App installed successfully');
      setIsInstalled(true);
      setShowInstallPrompt(false);
    };

    // Listen for display mode changes
    const handleDisplayModeChange = () => {
      checkIfInstalled();
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);
    
    // Check installability periodically
    checkInstallability();
    const installabilityInterval = setInterval(checkInstallability, 1000);

    // Listen for route changes to update config
    const handleRouteChange = () => {
      updateConfig();
    };
    window.addEventListener('popstate', handleRouteChange);

    // Check if user has previously dismissed the prompt
    const storageKey = pwaConfig.isAdmin ? 'pwa-admin-install-dismissed' : 'pwa-install-dismissed';
    const dismissed = localStorage.getItem(storageKey);
    
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show prompt again after 1 day
      if (daysSinceDismissed > 1) {
        localStorage.removeItem(storageKey);
      } else {
        setShowInstallPrompt(false);
      }
    }

    // Show prompt after a delay if not installed and not dismissed
    if (!isInstalled && !dismissed) {
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000); // Show after 3 seconds
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('popstate', handleRouteChange);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
      clearInterval(installabilityInterval);
    };
  }, [pwaConfig.isAdmin]);

  const handleInstallClick = async () => {
    console.log('🚀 Install button clicked');
    setIsInstalling(true);

    try {
      const deferredPrompt = getDeferredPrompt();
      
      // First try the native prompt if available (Android/Desktop)
      if (deferredPrompt) {
        console.log('✅ Using native deferred prompt');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
          clearDeferredPrompt();
          setShowInstallPrompt(false);
        } else {
          console.log('❌ User dismissed the install prompt');
          clearDeferredPrompt();
          setShowInstallPrompt(false);
        }
        setIsInstalling(false);
        return;
      }

      // For iOS or when no deferred prompt is available
      console.log('📱 No native prompt available');
      
      // Check if it's iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // For iOS, we can't programmatically install, so we show instructions
        console.log('🍎 iOS detected - showing manual install instructions');
        setIsInstalling(false);
        return;
      }

      // For other browsers, show manual instructions
      console.log('🔄 Showing manual install instructions');
      alert('Pour installer cette application:\n\n1. Cliquez sur le menu de votre navigateur (⋮)\n2. Sélectionnez "Installer l\'application" ou "Ajouter à l\'écran d\'accueil"\n3. Suivez les instructions à l\'écran');
      setIsInstalling(false);
      
    } catch (error) {
      console.error('❌ Error during installation:', error);
      setIsInstalling(false);
    }
  };


  const handleDismiss = () => {
    setShowInstallPrompt(false);
    const storageKey = pwaConfig.isAdmin ? 'pwa-admin-install-dismissed' : 'pwa-install-dismissed';
    localStorage.setItem(storageKey, Date.now().toString());
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