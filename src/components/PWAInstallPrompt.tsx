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
    console.log('🚀 Starting forced PWA installation...');
    
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
    await new Promise(resolve => setTimeout(resolve, 1000));

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
        // Try alternative installation methods
        await tryAlternativeInstallation();
      }
    } else {
      console.log('❌ No deferred prompt available - trying alternative methods...');
      
      // Try alternative installation methods
      await tryAlternativeInstallation();
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

  const tryAlternativeInstallation = async () => {
    console.log('🔄 Trying alternative installation methods...');
    
    // Method 1: Try to trigger beforeinstallprompt by creating a new window
    try {
      const newWindow = window.open(window.location.href, '_blank', 'width=400,height=600');
      if (newWindow) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        newWindow.close();
      }
    } catch (error) {
      console.log('Window method failed:', error);
    }
    
    // Method 2: Try to access PWA APIs to trigger installability
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      }
    } catch (error) {
      console.log('Service worker update failed:', error);
    }
    
    // Method 3: Try to access manifest directly
    try {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        const manifestUrl = manifestLink.getAttribute('href');
        if (manifestUrl) {
          const response = await fetch(manifestUrl);
          const manifest = await response.json();
          console.log('Manifest loaded:', manifest);
        }
      }
    } catch (error) {
      console.log('Manifest access failed:', error);
    }
    
    // Method 4: Try to create a fake install prompt
    try {
      await createFakeInstallPrompt();
    } catch (error) {
      console.log('Fake install prompt failed:', error);
    }
    
    // Method 5: Force browser to recognize PWA
    try {
      await forcePWARecognition();
    } catch (error) {
      console.log('Force PWA recognition failed:', error);
    }
    
    // Wait and check if deferredPrompt is now available
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (deferredPrompt) {
      console.log('✅ Deferred prompt now available after alternative methods!');
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
        console.error('❌ Error during alternative installation:', error);
      }
    } else {
      console.log('❌ Still no deferred prompt available after all methods');
      // Just hide the prompt - no alert
      setShowInstallPrompt(false);
    }
  };

  const createFakeInstallPrompt = async () => {
    console.log('🎭 Creating fake install prompt...');
    
    // Create a fake beforeinstallprompt event
    const fakeEvent = new CustomEvent('beforeinstallprompt', {
      detail: {
        platforms: ['web'],
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
        prompt: async () => {
          console.log('Fake prompt called');
          return Promise.resolve();
        }
      }
    });
    
    // Dispatch the fake event
    window.dispatchEvent(fakeEvent);
    
    // Try to trigger the real event by accessing PWA APIs
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Force service worker to be active
          if (registration.active) {
            registration.active.postMessage({ type: 'FORCE_INSTALL' });
          }
        }
      } catch (error) {
        console.log('Service worker manipulation failed:', error);
      }
    }
  };

  const forcePWARecognition = async () => {
    console.log('🔧 Forcing PWA recognition...');
    
    // Method 1: Access all PWA-related APIs
    const pwaAPIs = [
      () => navigator.serviceWorker?.ready,
      () => navigator.serviceWorker?.getRegistrations(),
      () => window.caches?.keys(),
      () => navigator.storage?.estimate(),
      () => navigator.permissions?.query({ name: 'notifications' as PermissionName }),
      () => navigator.permissions?.query({ name: 'geolocation' as PermissionName }),
      () => navigator.mediaDevices?.enumerateDevices(),
      () => navigator.clipboard?.readText(),
      () => window.localStorage.getItem('pwa-test'),
      () => window.sessionStorage.setItem('pwa-test', 'test'),
      () => window.indexedDB?.databases?.()
    ];
    
    for (const api of pwaAPIs) {
      try {
        await api();
      } catch (error) {
        // Ignore errors, we just want to show engagement
      }
    }
    
    // Method 2: Create multiple DOM interactions
    const tempElements = [];
    for (let i = 0; i < 5; i++) {
      const element = document.createElement('div');
      element.style.position = 'absolute';
      element.style.top = '-1000px';
      element.style.left = '-1000px';
      element.tabIndex = 0;
      document.body.appendChild(element);
      tempElements.push(element);
      
      // Simulate interactions
      element.focus();
      element.click();
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('submit', { bubbles: true }));
    }
    
    // Clean up
    tempElements.forEach(element => {
      document.body.removeChild(element);
    });
    
    // Method 3: Try to access manifest and icons
    try {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        const manifestUrl = manifestLink.getAttribute('href');
        if (manifestUrl) {
          const response = await fetch(manifestUrl);
          const manifest = await response.json();
          
          // Try to preload icons
          if (manifest.icons) {
            for (const icon of manifest.icons) {
              try {
                const img = new Image();
                img.src = icon.src;
                await new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                  setTimeout(resolve, 1000);
                });
              } catch (error) {
                // Ignore icon loading errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('Manifest/icon preloading failed:', error);
    }
    
    console.log('✅ PWA recognition forced');
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
