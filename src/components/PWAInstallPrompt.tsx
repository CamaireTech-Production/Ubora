import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Download, X, Smartphone, Monitor, Shield } from 'lucide-react';
import { getPWAConfig } from '../utils/pwaConfig';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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

    // Listen for the beforeinstallprompt event (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🔔 beforeinstallprompt event fired - PWA is installable!');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      console.log('✅ App installed successfully');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    // Listen for display mode changes
    const handleDisplayModeChange = () => {
      checkIfInstalled();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);

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
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('popstate', handleRouteChange);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, [pwaConfig.isAdmin]);

  const handleInstallClick = async () => {
    console.log('🚀 Install button clicked');
    setIsInstalling(true);

    try {
      // First try the native prompt if available (Android/Desktop)
      if (deferredPrompt) {
        console.log('✅ Using native deferred prompt');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
          setDeferredPrompt(null);
          setShowInstallPrompt(false);
          setIsInstalling(false);
          return;
        } else {
          console.log('❌ User dismissed the install prompt');
          setDeferredPrompt(null);
          setShowInstallPrompt(false);
          setIsInstalling(false);
          return;
        }
      }

      // For iOS or when no deferred prompt is available
      console.log('📱 No native prompt available - showing iOS instructions or fallback');
      
      // Check if it's iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // For iOS, we can't programmatically install, so we show instructions
        console.log('🍎 iOS detected - showing manual install instructions');
        setIsInstalling(false);
        return;
      }

      // For other browsers, try to trigger installability
      console.log('🔄 Attempting to trigger installability...');
      await triggerInstallability();
      
    } catch (error) {
      console.error('❌ Error during installation:', error);
      setIsInstalling(false);
    }
  };

  const triggerInstallability = async () => {
    try {
      // Access PWA-related APIs to show user engagement
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
        console.log('✅ Service worker ready');
      }

      // Access storage API
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        await navigator.storage.estimate();
        console.log('✅ Storage API accessed');
      }

      // Access permissions API
      if ('permissions' in navigator) {
        try {
          await navigator.permissions.query({ name: 'notifications' as PermissionName });
          console.log('✅ Permissions API accessed');
        } catch (e) {
          console.log('Permissions API not available');
        }
      }

      // Try to access manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        const manifestUrl = manifestLink.getAttribute('href');
        if (manifestUrl) {
          try {
            const response = await fetch(manifestUrl);
            if (response.ok) {
              const manifest = await response.json();
              console.log('✅ Manifest accessed:', manifest.name);
            } else {
              console.log('⚠️ Manifest not accessible:', response.status);
            }
          } catch (error) {
            console.log('⚠️ Manifest fetch error:', error);
          }
        }
      }

      // Wait a moment for browser to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if deferredPrompt is now available
      if (deferredPrompt) {
        console.log('✅ Deferred prompt now available after user engagement!');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
          setDeferredPrompt(null);
          setShowInstallPrompt(false);
        } else {
          console.log('❌ User dismissed the install prompt');
          setDeferredPrompt(null);
          setShowInstallPrompt(false);
        }
      } else {
        console.log('❌ Still no deferred prompt available');
        
        // Check if we're on localhost
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.includes('192.168.');
        
        if (isLocalhost) {
          alert('Pour tester l\'installation PWA sur localhost, vous devez:\n\n1. Construire l\'application: npm run build\n2. Servir avec HTTPS: npm run preview\n\nOu utilisez le menu de votre navigateur (⋮) et sélectionnez "Installer l\'application".');
        } else {
          alert('Pour installer cette application, utilisez le menu de votre navigateur et sélectionnez "Installer l\'application" ou "Ajouter à l\'écran d\'accueil".');
        }
      }

    } catch (error) {
      console.error('Error triggering installability:', error);
    } finally {
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