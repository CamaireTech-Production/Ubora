import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Shield, X, Smartphone, Monitor, Download } from 'lucide-react';
import { getPWAConfig, updateManifestLink } from '../utils/pwaConfig';
import { getDeferredPrompt, getIsInstallable, clearDeferredPrompt } from '../utils/pwaRegistration';

export const AdminPWAInstallPrompt: React.FC = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pwaConfig, setPwaConfig] = useState(getPWAConfig());
  const [isInstalling, setIsInstalling] = useState(false);
  const [adminDeferredPrompt, setAdminDeferredPrompt] = useState<any>(null);

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
      console.log('✅ Admin app installed successfully');
      setIsInstalled(true);
      setShowInstallPrompt(false);
    };

    // Listen for display mode changes
    const handleDisplayModeChange = () => {
      checkIfInstalled();
    };

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🔔 [Admin PWA] beforeinstallprompt event fired - storing admin deferred prompt');
      e.preventDefault(); // Prevent the default browser install prompt
      setAdminDeferredPrompt(e); // Store the prompt locally for admin use
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
        console.log('🔍 [Admin PWA] Not showing prompt - app already installed');
        return false;
      }
      
      // Check if we have a local admin deferred prompt (most reliable)
      if (adminDeferredPrompt) {
        console.log('🔍 [Admin PWA] Showing prompt - local admin deferred prompt available');
        return true;
      }
      
      // Check if we have a global deferred prompt
      if (getIsInstallable()) {
        console.log('🔍 [Admin PWA] Showing prompt - global deferred prompt available');
        return true;
      }
      
      // Fallback: Check basic PWA criteria
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
      
      console.log('🔍 [Admin PWA] PWA criteria check:', {
        hasServiceWorker,
        hasManifest,
        isHTTPS,
        isInstallable: getIsInstallable(),
        hasAdminDeferredPrompt: !!adminDeferredPrompt
      });
      
      // Show if basic PWA criteria are met
      return hasServiceWorker && hasManifest && isHTTPS;
    };

    // Show prompt after a delay if conditions are met
    if (checkShouldShowPrompt()) {
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 2000); // Show after 2 seconds for admin (faster than regular app)
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('popstate', handleRouteChange);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, [pwaConfig.isAdmin]);

  const handleInstallClick = async () => {
    console.log('🚀 Admin install button clicked');
    setIsInstalling(true);

    try {
      // First try the local admin deferred prompt
      if (adminDeferredPrompt) {
        console.log('✅ Using local admin deferred prompt');
        await adminDeferredPrompt.prompt();
        const { outcome } = await adminDeferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the admin install prompt');
          setAdminDeferredPrompt(null);
          setShowInstallPrompt(false);
        } else {
          console.log('❌ User dismissed the admin install prompt');
          setAdminDeferredPrompt(null);
          setShowInstallPrompt(false);
        }
        setIsInstalling(false);
        return;
      }

      // Fallback to global deferred prompt
      const globalDeferredPrompt = getDeferredPrompt();
      if (globalDeferredPrompt) {
        console.log('✅ Using global deferred prompt for admin');
        await globalDeferredPrompt.prompt();
        const { outcome } = await globalDeferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the admin install prompt');
          clearDeferredPrompt();
          setShowInstallPrompt(false);
        } else {
          console.log('❌ User dismissed the admin install prompt');
          clearDeferredPrompt();
          setShowInstallPrompt(false);
        }
        setIsInstalling(false);
        return;
      }

      // If no deferred prompt, try to trigger the browser's install prompt
      console.log('📱 No deferred prompt available, trying alternative methods');
      
      // Check if it's iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // For iOS, we can't programmatically install, so we show instructions
        console.log('🍎 iOS detected - showing manual install instructions for admin');
        setIsInstalling(false);
        return;
      }

      // For other browsers, try to trigger the install prompt by checking if the app is installable
      // Sometimes the browser needs a user gesture to show the install prompt
      console.log('🔄 Attempting to trigger browser install prompt');
      
      // Check if the app meets PWA criteria and try to show install prompt
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        // Try to trigger the beforeinstallprompt event by creating a small delay
        // This sometimes helps the browser recognize the app as installable
        setTimeout(() => {
          // Check again for deferred prompt after a short delay
          const newDeferredPrompt = getDeferredPrompt();
          if (newDeferredPrompt) {
            console.log('✅ Deferred prompt became available after delay');
            newDeferredPrompt.prompt();
            const { outcome } = newDeferredPrompt.userChoice;
            if (outcome === 'accepted') {
              clearDeferredPrompt();
              setShowInstallPrompt(false);
            }
            setIsInstalling(false);
          } else {
            // Still no prompt available, show manual instructions
            console.log('🔄 Still no prompt available, showing manual instructions');
            alert('Pour installer le panel d\'administration Ubora:\n\n1. Cliquez sur le menu de votre navigateur (⋮)\n2. Sélectionnez "Installer l\'application" ou "Ajouter à l\'écran d\'accueil"\n3. Suivez les instructions à l\'écran\n\nL\'application s\'ouvrira directement sur le panel d\'administration.');
            setIsInstalling(false);
          }
        }, 100);
      } else {
        // Browser doesn't support PWA installation
        alert('Votre navigateur ne supporte pas l\'installation d\'applications. Veuillez utiliser Chrome, Edge, ou Firefox.');
        setIsInstalling(false);
      }
      
    } catch (error) {
      console.error('❌ Error during admin installation:', error);
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    console.log('🚫 Admin PWA install prompt dismissed');
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
      <Card className="bg-gradient-to-r from-red-600 to-red-700 text-white border-0 shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  Installer {pwaConfig.shortName}
                </h3>
                <p className="text-red-100 text-sm">
                  Accédez au panel d'administration
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
              <p className="text-red-100 text-sm">
                Pour installer le panel d'administration sur votre iPhone/iPad :
              </p>
              <ol className="text-red-100 text-sm space-y-1 list-decimal list-inside">
                <li>Appuyez sur le bouton Partager <span className="text-white">⎋</span></li>
                <li>Faites défiler et sélectionnez "Sur l'écran d'accueil"</li>
                <li>Appuyez sur "Ajouter"</li>
              </ol>
              <div className="mt-3 p-2 bg-white/10 rounded-lg">
                <p className="text-red-200 text-xs">
                  💡 Le panel d'administration s'ouvrira directement
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-4 text-red-100 text-sm">
                <div className="flex items-center space-x-1">
                  <Smartphone className="h-4 w-4" />
                  <span>Mobile</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Monitor className="h-4 w-4" />
                  <span>Desktop</span>
                </div>
              </div>
              
              <p className="text-red-100 text-sm">
                Installez le panel d'administration pour un accès rapide et sécurisé
              </p>
              
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full bg-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 text-red-600 hover:bg-red-50"
              >
                {isInstalling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                    <span>Installation...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    <span>Installer l'Admin</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-red-500/30">
            <p className="text-red-200 text-xs">
              ✓ Accès sécurisé • ✓ Gestion des utilisateurs • ✓ Monitoring système
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
