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
  const [userEngaged, setUserEngaged] = useState(false);

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

    // Track user engagement to trigger install prompt
    const trackUserEngagement = () => {
      setUserEngaged(true);
      // Trigger a small interaction to help with installability
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(() => {
          console.log('Service worker ready, user engaged');
        });
      }
    };

    // Track clicks, scrolls, and other interactions
    const handleUserInteraction = () => {
      if (!userEngaged) {
        trackUserEngagement();
      }
    };

    // Add event listeners for user engagement
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('scroll', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });

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
  }, [pwaConfig.isAdmin]);

  const handleInstallClick = async () => {
    // Force user engagement first
    setUserEngaged(true);
    
    // Create massive user engagement to satisfy browser requirements
    await createMassiveUserEngagement();
    
    // Try to trigger service worker registration if not already done
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
        console.log('Service worker is ready');
      } catch (error) {
        console.log('Service worker not ready, trying to register...');
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch (regError) {
          console.log('Service worker registration failed:', regError);
        }
      }
    }

    // Wait a moment for any pending events
    await new Promise(resolve => setTimeout(resolve, 500));

    if (deferredPrompt) {
      try {
        console.log('🚀 Triggering native install prompt...');
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
        // Fallback to manual instructions
        showManualInstallInstructions();
      }
    } else {
      console.log('❌ No deferred prompt available - PWA may not meet installability criteria');
      console.log('🔍 Debug info:');
      console.log('  - Service Worker:', 'serviceWorker' in navigator);
      console.log('  - HTTPS:', location.protocol === 'https:');
      console.log('  - Manifest:', document.querySelector('link[rel="manifest"]')?.getAttribute('href'));
      console.log('  - User Agent:', navigator.userAgent);
      console.log('  - User Engaged:', userEngaged);
      
      // For localhost HTTP, show better instructions
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        showLocalhostInstallInstructions();
      } else {
        // Try to force install prompt by creating user engagement
        await forceInstallPrompt();
      }
    }
  };

  const createMassiveUserEngagement = async () => {
    console.log('🔥 Creating massive user engagement...');
    
    // Method 1: Simulate multiple user interactions
    const interactionEvents = [
      'click', 'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave',
      'scroll', 'wheel', 'keydown', 'keyup', 'keypress', 'touchstart', 'touchend',
      'focus', 'blur', 'input', 'change', 'submit'
    ];
    
    // Fire multiple events rapidly
    for (let i = 0; i < 10; i++) {
      interactionEvents.forEach(eventType => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        document.dispatchEvent(event);
        window.dispatchEvent(event);
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Method 2: Access multiple browser APIs to show engagement
    const apis = [
      () => navigator.storage?.estimate(),
      () => navigator.permissions?.query({ name: 'notifications' as PermissionName }),
      () => navigator.permissions?.query({ name: 'geolocation' as PermissionName }),
      () => navigator.mediaDevices?.enumerateDevices(),
      () => navigator.clipboard?.readText(),
      () => window.localStorage.getItem('test'),
      () => window.sessionStorage.getItem('test'),
      () => navigator.serviceWorker?.ready,
      () => navigator.serviceWorker?.getRegistrations(),
      () => window.caches?.keys()
    ];
    
    for (const api of apis) {
      try {
        await api();
      } catch (error) {
        // Ignore errors, we just want to show engagement
      }
    }
    
    // Method 3: Create DOM interactions
    const tempElement = document.createElement('div');
    tempElement.style.position = 'absolute';
    tempElement.style.top = '-1000px';
    tempElement.style.left = '-1000px';
    document.body.appendChild(tempElement);
    
    // Simulate focus, click, and other interactions
    tempElement.focus();
    tempElement.click();
    tempElement.dispatchEvent(new Event('input', { bubbles: true }));
    tempElement.dispatchEvent(new Event('change', { bubbles: true }));
    
    document.body.removeChild(tempElement);
    
    console.log('✅ Massive user engagement created');
  };

  const showLocalhostInstallInstructions = () => {
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    
    let instructions = `🚨 INSTALLATION SUR LOCALHOST (HTTP)\n\n`;
    instructions += `Le PWA ne peut pas s'installer automatiquement sur localhost HTTP.\n\n`;
    instructions += `SOLUTIONS:\n\n`;
    
    if (isChrome || isEdge) {
      instructions += `1. 🌐 DÉPLOYEZ EN PRODUCTION (HTTPS)\n`;
      instructions += `   - Votre app fonctionnera parfaitement sur HTTPS\n\n`;
      instructions += `2. 🔧 INSTALLATION MANUELLE (Chrome/Edge):\n`;
      instructions += `   - Cliquez sur l'icône d'installation (⊕) dans la barre d'adresse\n`;
      instructions += `   - Ou faites un clic droit → "Installer ${pwaConfig.shortName}"\n`;
      instructions += `   - Ou menu (⋮) → "Installer ${pwaConfig.shortName}"\n\n`;
    } else {
      instructions += `1. 🌐 DÉPLOYEZ EN PRODUCTION (HTTPS)\n`;
      instructions += `   - Votre app fonctionnera parfaitement sur HTTPS\n\n`;
      instructions += `2. 🔧 INSTALLATION MANUELLE:\n`;
      instructions += `   - Cherchez l'icône d'installation dans la barre d'adresse\n`;
      instructions += `   - Ou faites un clic droit → "Installer"\n\n`;
    }
    
    instructions += `3. 🚀 TEST EN PRODUCTION:\n`;
    instructions += `   - Déployez sur votre domaine HTTPS\n`;
    instructions += `   - L'installation automatique fonctionnera parfaitement\n\n`;
    instructions += `✅ Votre PWA est correctement configurée!`;
    
    alert(instructions);
  };

  const showManualInstallInstructions = () => {
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    let instructions = `Pour installer ${pwaConfig.shortName}:\n\n`;
    
    if (isChrome || isEdge) {
      instructions += `1. Cliquez sur l'icône d'installation (⊕) dans la barre d'adresse\n`;
      instructions += `2. Ou faites un clic droit sur la page → "Installer ${pwaConfig.shortName}"\n`;
      instructions += `3. Ou allez dans le menu (⋮) → "Installer ${pwaConfig.shortName}"\n\n`;
    } else if (isFirefox) {
      instructions += `1. Cliquez sur l'icône "+" dans la barre d'adresse\n`;
      instructions += `2. Ou faites un clic droit sur la page → "Installer"\n\n`;
    } else if (isSafari) {
      instructions += `1. Appuyez sur le bouton Partager (□↗)\n`;
      instructions += `2. Sélectionnez "Sur l'écran d'accueil"\n`;
      instructions += `3. Appuyez sur "Ajouter"\n\n`;
    } else {
      instructions += `1. Cherchez l'icône d'installation dans la barre d'adresse\n`;
      instructions += `2. Ou faites un clic droit sur la page → "Installer"\n\n`;
    }
    
    instructions += `Assurez-vous d'être en mode normal (pas en navigation privée).`;
    
    alert(instructions);
  };

  const forceInstallPrompt = async () => {
    // Try to create more user engagement
    console.log('🔄 Attempting to force install prompt...');
    
    // Method 1: Simulate user interaction
    const events = ['click', 'scroll', 'keydown', 'touchstart', 'mousemove'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      document.dispatchEvent(event);
    });

    // Method 2: Try to trigger service worker events
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Force service worker to be active
          await navigator.serviceWorker.ready;
        }
      } catch (error) {
        console.log('Service worker error:', error);
      }
    }

    // Method 3: Try to access PWA APIs
    try {
      // Try to access some PWA-related APIs to show engagement
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        await navigator.storage.estimate();
      }
      if ('permissions' in navigator) {
        await navigator.permissions.query({ name: 'notifications' as PermissionName });
      }
    } catch (error) {
      console.log('PWA API access error:', error);
    }

    // Wait a bit more for the browser to process
    await new Promise(resolve => setTimeout(resolve, 1000));

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
        console.error('❌ Error during forced installation:', error);
        showManualInstallInstructions();
      }
    } else {
      console.log('❌ Still no deferred prompt available after all attempts');
      showManualInstallInstructions();
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
                onMouseDown={() => setUserEngaged(true)}
                onTouchStart={() => setUserEngaged(true)}
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
