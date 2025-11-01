# PWA Implementation Guide - Complete Setup

This guide shows you exactly how to implement a Progressive Web App (PWA) with install prompts, just like in the Ubora application. Follow these steps to add PWA functionality to your React/Vite project.

## 📋 Table of Contents

1. [Dependencies Setup](#dependencies-setup)
2. [Vite Configuration](#vite-configuration)
3. [Web App Manifest](#web-app-manifest)
4. [HTML Meta Tags](#html-meta-tags)
5. [Service Worker Setup](#service-worker-setup)
6. [PWA Components](#pwa-components)
7. [PWA Hook](#pwa-hook)
8. [Integration in App](#integration-in-app)
9. [Icon Assets](#icon-assets)
10. [Testing](#testing)

---

## 1. Dependencies Setup

First, install the required packages:

```bash
npm install vite-plugin-pwa workbox-window
```

Add these to your `package.json` devDependencies:

```json
{
  "devDependencies": {
    "vite-plugin-pwa": "^1.0.3",
    "workbox-window": "^7.3.0"
  }
}
```

---

## 2. Vite Configuration

Update your `vite.config.ts` file:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Your App Name',
        short_name: 'YourApp',
        description: 'Your app description',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  // ... rest of your config
});
```

---

## 3. Web App Manifest

Create a `public/manifest.json` file:

```json
{
  "name": "Your App Name",
  "short_name": "YourApp",
  "description": "Your app description",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait-primary",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/android-icon-36x36.png",
      "sizes": "36x36",
      "type": "image/png",
      "density": "0.75"
    },
    {
      "src": "/android-icon-48x48.png",
      "sizes": "48x48",
      "type": "image/png",
      "density": "1.0"
    },
    {
      "src": "/android-icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "density": "1.5"
    },
    {
      "src": "/android-icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "density": "2.0"
    },
    {
      "src": "/android-icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "density": "3.0"
    },
    {
      "src": "/android-icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "density": "4.0"
    }
  ]
}
```

---

## 4. HTML Meta Tags

Update your `index.html` file with PWA meta tags:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon-32x32.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    
    <!-- PWA Meta Tags -->
    <meta name="application-name" content="YourApp" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="YourApp" />
    <meta name="description" content="Your app description" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="msapplication-TileColor" content="#3b82f6" />
    <meta name="msapplication-tap-highlight" content="no" />
    <meta name="theme-color" content="#3b82f6" />
    
    <!-- Apple Touch Icons -->
    <link rel="apple-touch-icon" href="/apple-icon.png" />
    <link rel="apple-touch-icon" sizes="152x152" href="/apple-icon-152x152.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon-180x180.png" />
    
    <!-- Standard Icons -->
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="shortcut icon" href="/favicon.ico" />
    
    <title>Your App Name</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 5. Service Worker Setup

Create a `public/firebase-messaging-sw.js` file (or rename to `sw.js` if not using Firebase):

```javascript
// Import Firebase scripts for service worker (if using Firebase)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker (if using Firebase)
firebase.initializeApp({
  // Your Firebase config
});

// Initialize Firebase Messaging (if using Firebase)
const messaging = firebase.messaging();

// Handle background messages (if using Firebase)
messaging.onBackgroundMessage((payload) => {
  console.log('Message received in background:', payload);
  
  const notificationTitle = payload.notification?.title || 'New notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/android-icon-192x192.png',
    badge: '/android-icon-96x96.png',
    tag: 'app-notification',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/android-icon-48x48.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/android-icon-48x48.png'
      }
    ],
    requireInteraction: true,
    silent: false
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // If app is not open, open it
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});
```

Update your `main.tsx` to register the service worker:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js') // or '/sw.js'
    .then((registration) => {
      console.log('Service worker registered:', registration);
    })
    .catch((error) => {
      console.error('Service worker registration failed:', error);
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

## 6. PWA Components

### PWA Install Prompt Component

Create `src/components/PWAInstallPrompt.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';

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

  useEffect(() => {
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

    checkIfInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if user has previously dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Show prompt again after 1 day
      if (daysSinceDismissed > 1) {
        localStorage.removeItem('pwa-install-dismissed');
      } else {
        setShowInstallPrompt(false);
      }
    }

    // If no deferred prompt but app is installable, show prompt after a delay
    if (!deferredPrompt && !isInstalled) {
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000); // Show after 3 seconds
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg rounded-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Install App</h3>
                <p className="text-blue-100 text-sm">
                  Get faster access to your application
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
                To install this app on your iPhone/iPad:
              </p>
              <ol className="text-blue-100 text-sm space-y-1 list-decimal list-inside">
                <li>Tap the Share button</li>
                <li>Scroll and select "Add to Home Screen"</li>
                <li>Tap "Add"</li>
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
                Install the app for an optimal experience
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full bg-white text-blue-600 hover:bg-blue-50 font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Install Now</span>
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-blue-500/30">
            <p className="text-blue-200 text-xs">
              ✓ Works offline • ✓ Notifications • ✓ Quick access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### PWA Status Indicator Component

Create `src/components/PWAStatusIndicator.tsx`:

```typescript
import React from 'react';
import { usePWA } from '../hooks/usePWA';
import { Wifi, WifiOff, Download, CheckCircle, Smartphone } from 'lucide-react';

export const PWAStatusIndicator: React.FC = () => {
  const { isInstalled, isOnline, isUpdateAvailable } = usePWA();

  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Offline</span>
        </div>
      </div>
    );
  }

  if (isUpdateAvailable) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-orange-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Download className="h-4 w-4" />
          <span className="text-sm font-medium">Update available</span>
        </div>
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="fixed top-4 right-4 z-40">
        <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Smartphone className="h-4 w-4" />
          <span className="text-sm font-medium">App installed</span>
        </div>
      </div>
    );
  }

  return null;
};
```

### PWA Update Notification Component

Create `src/components/PWAUpdateNotification.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { RefreshCw, X, CheckCircle } from 'lucide-react';

export const PWAUpdateNotification: React.FC = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdatePrompt(true);
      });
    }
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          // Tell the waiting service worker to skip waiting and become active
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload the page to use the new service worker
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error updating app:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
  };

  if (!showUpdatePrompt) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white border-0 shadow-lg rounded-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Update Available</h3>
                <p className="text-green-100 text-sm">
                  A new version of the app is available
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

          <div className="space-y-3">
            <p className="text-green-100 text-sm">
              Update to benefit from the latest improvements and bug fixes.
            </p>
            
            <div className="flex space-x-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 bg-white text-green-600 hover:bg-green-50 font-medium disabled:opacity-50 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Update</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-green-100 hover:text-white hover:bg-green-500/20 rounded-lg"
              >
                Later
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-green-500/30">
            <p className="text-green-200 text-xs">
              ✓ Performance improvements • ✓ New features • ✓ Bug fixes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 7. PWA Hook

Create `src/hooks/usePWA.ts`:

```typescript
import { useState, useEffect } from 'react';

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

    // Check for updates
    const checkForUpdates = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            registration.addEventListener('updatefound', () => {
              setPwaState(prev => ({
                ...prev,
                isUpdateAvailable: true,
              }));
            });
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
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
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return pwaState;
};
```

---

## 8. Integration in App

Add the PWA components to your main `App.tsx`:

```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAStatusIndicator } from './components/PWAStatusIndicator';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';

function App() {
  return (
    <Router>
      <Routes>
        {/* Your routes here */}
      </Routes>
      
      {/* PWA Components */}
      <PWAInstallPrompt />
      <PWAStatusIndicator />
      <PWAUpdateNotification />
    </Router>
  );
}

export default App;
```

---

## 9. Icon Assets

Create the following icon files in your `public` folder:

### Required Icon Sizes:
- `favicon.ico` (16x16, 32x32, 48x48)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `android-icon-36x36.png`
- `android-icon-48x48.png`
- `android-icon-72x72.png`
- `android-icon-96x96.png`
- `android-icon-144x144.png`
- `android-icon-192x192.png`
- `apple-icon.png` (180x180)
- `apple-icon-152x152.png`
- `apple-icon-180x180.png`
- `pwa-192x192.png`
- `pwa-512x512.png`

### Icon Generation Tools:
- [PWA Builder](https://www.pwabuilder.com/imageGenerator)
- [Favicon Generator](https://realfavicongenerator.net/)
- [App Icon Generator](https://appicon.co/)

---

## 10. Testing

### Local Testing:
1. Run your development server: `npm run dev`
2. Open Chrome DevTools → Application → Manifest
3. Check if manifest is loaded correctly
4. Go to Application → Service Workers to verify registration

### PWA Testing Checklist:
- [ ] Manifest loads without errors
- [ ] Service worker registers successfully
- [ ] Install prompt appears on supported browsers
- [ ] App works offline (basic functionality)
- [ ] Icons display correctly on home screen
- [ ] App opens in standalone mode when installed
- [ ] Update notifications work
- [ ] iOS Safari shows "Add to Home Screen" instructions

### Browser Support:
- ✅ Chrome/Edge (Android & Desktop)
- ✅ Firefox (Android & Desktop)
- ✅ Safari (iOS 11.3+)
- ✅ Samsung Internet
- ⚠️ Safari (macOS) - Limited support

---

## 🎉 You're Done!

Your PWA is now fully implemented with:
- ✅ Install prompts for all platforms
- ✅ Offline functionality
- ✅ Update notifications
- ✅ Status indicators
- ✅ Proper manifest and meta tags
- ✅ Service worker with caching strategies

The install modal will automatically appear to users on supported browsers, and they can install your app just like a native application!

## 📱 Additional Features You Can Add:

1. **Push Notifications** - Use Firebase Cloud Messaging
2. **Background Sync** - Sync data when connection is restored
3. **Share API** - Allow users to share content from your app
4. **Badge API** - Show notification badges on app icon
5. **Shortcuts** - Add app shortcuts for quick actions

Happy coding! 🚀
