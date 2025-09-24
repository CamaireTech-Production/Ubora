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

  useEffect(() => {
    // Update PWA config when route changes
    const updateConfig = () => {
      const newConfig = getPWAConfig();
      setPwaConfig(newConfig);
    };

    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check for iOS Safari
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
    };

    updateConfig();
    checkIfInstalled();

    // Listen for the beforeinstallprompt event
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

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for route changes to update config
    const handleRouteChange = () => {
      updateConfig();
    };
    window.addEventListener('popstate', handleRouteChange);

    // Check if user has previously dismissed the prompt (admin-specific storage)
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


    // Show prompt by default after a delay (this was the working behavior)
    if (!isInstalled) {
       setTimeout(() => {
         setShowInstallPrompt(true);
       }, 3000); // Show after 3 seconds
     }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const handleInstallClick = async () => {
    console.log('🚀 Install button clicked');
    
    // First try the native prompt if available
    if (deferredPrompt) {
      try {
        console.log('✅ Using native deferred prompt');
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
          setDeferredPrompt(null);
          setShowInstallPrompt(false);
          return;
        } else {
          console.log('❌ User dismissed the install prompt');
          setDeferredPrompt(null);
          setShowInstallPrompt(false);
          return;
        }
      } catch (error) {
        console.error('❌ Error with native prompt:', error);
      }
    }
    
    // If no native prompt, create user engagement to trigger it
    console.log('🔄 No native prompt - creating user engagement...');
    await createUserEngagement();
  };



  const tryBrowserInstallButton = async () => {
    console.log('🔍 Looking for browser install button...');
    
    // Wait a moment for browser to potentially show install button
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to find and click the browser's install button
    const installSelectors = [
      '[aria-label*="Install"]',
      '[aria-label*="install"]',
      '[title*="Install"]',
      '[title*="install"]',
      'button[data-testid*="install"]',
      '.install-button',
      '#install-button',
      '[data-testid="install-button"]',
      '[aria-label="Install this app"]',
      '[aria-label="Install app"]',
      'button[aria-label*="Add to Home screen"]',
      'button[aria-label*="Install app"]'
    ];
    
    for (const selector of installSelectors) {
      const button = document.querySelector(selector) as HTMLButtonElement;
      if (button) {
        console.log('✅ Found browser install button:', selector);
        button.click();
        return;
      }
    }
    
    console.log('❌ No browser install button found');
  };

  const createUserEngagement = async () => {
    console.log('👆 Creating user engagement to trigger installability...');
    
    // Method 1: Access PWA APIs to show engagement (no event dispatching)
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
        console.log('✅ Service worker ready');
      }
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        await navigator.storage.estimate();
        console.log('✅ Storage API accessed');
      }
      if ('permissions' in navigator) {
        await navigator.permissions.query({ name: 'notifications' as PermissionName });
        console.log('✅ Permissions API accessed');
      }
    } catch (error) {
      console.log('PWA API access error:', error);
    }

    // Method 2: Create real DOM interactions (not synthetic events)
    const tempElement = document.createElement('div');
    tempElement.style.position = 'absolute';
    tempElement.style.top = '-1000px';
    tempElement.style.left = '-1000px';
    tempElement.tabIndex = 0;
    document.body.appendChild(tempElement);
    
    // Real focus and click (not synthetic events)
    tempElement.focus();
    tempElement.click();
    
    // Clean up
    document.body.removeChild(tempElement);
    console.log('✅ Real DOM interactions created');

    // Method 3: Try to access manifest and icons
    try {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        const manifestUrl = manifestLink.getAttribute('href');
        if (manifestUrl) {
          const response = await fetch(manifestUrl);
          const manifest = await response.json();
          console.log('✅ Manifest accessed:', manifest.name);
        }
      }
    } catch (error) {
      console.log('Manifest access failed:', error);
    }
    
    // Wait a moment for browser to process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Check if deferredPrompt is now available
    if (deferredPrompt) {
      console.log('✅ Deferred prompt now available after user engagement!');
    try {
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
    } catch (error) {
        console.error('❌ Error during installation:', error);
      }
    } else {
      console.log('❌ Still no deferred prompt available after user engagement');
      
      // Try to find and click the browser's install button directly
      await tryBrowserInstallButton();
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    const storageKey = pwaConfig.isAdmin ? 'pwa-admin-install-dismissed' : 'pwa-install-dismissed';
    localStorage.setItem(storageKey, Date.now().toString());
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isInstalled || isStandalone) {
    return null;
  }

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
                <li>Appuyez sur le bouton Partager</li>
                <li>Faites défiler et sélectionnez "Sur l'écran d'accueil"</li>
                <li>Appuyez sur "Ajouter"</li>
              </ol>
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
                       className={`w-full bg-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                         pwaConfig.isAdmin 
                           ? 'text-red-600 hover:bg-red-50' 
                           : 'text-blue-600 hover:bg-blue-50'
                       }`}
                     >
                {pwaConfig.isAdmin ? (
                  <Shield className="h-4 w-4" />
                ) : (
                 <Download className="h-4 w-4" />
                )}
                 <span>Installer maintenant</span>
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
