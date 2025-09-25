# PWA Implementation Guide for CamerTok/Kolabo

This guide documents the complete Progressive Web App (PWA) implementation used in the CamerTok/Kolabo project. This setup enables your React Native/Expo app to work as a PWA with install prompts, offline capabilities, and push notifications.

## 📋 Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Configuration Files](#configuration-files)
4. [Custom Hook Implementation](#custom-hook-implementation)
5. [Service Workers](#service-workers)
6. [PWA Features](#pwa-features)
7. [Implementation Steps](#implementation-steps)
8. [Usage Examples](#usage-examples)
9. [Testing & Deployment](#testing--deployment)
10. [Troubleshooting](#troubleshooting)

## 🎯 Overview

This PWA implementation provides:
- **Install Prompt**: Custom hook to detect and handle PWA installation
- **Offline Support**: Service worker with caching strategies
- **Push Notifications**: Firebase messaging integration
- **Standalone Mode**: App runs like a native app when installed
- **Cross-Platform**: Works on web, mobile browsers, and as installed app

## 📁 File Structure

```
project-root/
├── usePWAinstallPrompt.js          # Custom hook for PWA install functionality
├── expo-service-worker.js          # Main service worker with caching
├── workbox-config.js               # Workbox configuration for build
├── vercel.json                     # Vercel deployment configuration
├── app.json                        # Expo configuration with PWA settings
├── public/
│   ├── manifest.json               # PWA manifest file
│   ├── firebase-messaging-sw.js    # Firebase messaging service worker
│   ├── icon-192.png               # PWA icon (192x192)
│   └── icon-512.png               # PWA icon (512x512)
└── package.json                    # Dependencies and scripts
```

## ⚙️ Configuration Files

### 1. app.json (Expo Configuration)

```json
{
  "expo": {
    "web": {
      "serviceWorker": {
        "register": true,
        "path": "firebase-messaging-sw.js"
      },
      "pwa": {
        "name": "Kolabo",
        "themeColor": "#000000",
        "backgroundColor": "#000000",
        "display": "standalone",
        "orientation": "portrait",
        "startUrl": ".",
        "icons": [
          {
            "src": "./assets/images/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
          },
          {
            "src": "./assets/images/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
          }
        ]
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#000000",
          "mode": "production"
        }
      ]
    ]
  }
}
```

### 2. public/manifest.json

```json
{
  "name": "Kolabo",
  "themeColor": "#222222",
  "backgroundColor": "#222222",
  "display": "standalone",
  "orientation": "portrait",
  "startUrl": ".",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 3. workbox-config.js

```javascript
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{png,ico}'
  ],
  swDest: 'dist/sw.js',
  ignoreURLParametersMatching: [
    /^utm_/,
    /^fbclid$/
  ]
};
```

### 4. vercel.json

```json
{
  "version": 2,
  "regions": ["sfo1"],
  "routes": [
    {
      "src": "/(.*)",
      "headers": {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      "dest": "/index.js"
    }
  ]
}
```

## 🎣 Custom Hook Implementation

### usePWAinstallPrompt.js

This custom hook provides PWA installation functionality:

```javascript
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export default function usePWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installationCompleted, setInstallationCompleted] = useState(
    window.localStorage?.getItem("wasInstalled") === "true"
  );

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const saveInstallState = () => {
      console.log("PWA was installed 🎉");
      window.localStorage?.setItem("wasInstalled", "true");
      setInstallationCompleted(true);
    };

    if (window?.addEventListener) {
      window?.addEventListener("beforeinstallprompt", handler);
      window?.addEventListener("appinstalled", saveInstallState);
      
      return () => {
        window?.removeEventListener("beforeinstallprompt", handler);
        window?.removeEventListener("appinstalled", saveInstallState);
      };
    }
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === "accepted";
  };

  const wasInstalled = () => {
    let standalone = false;
    if (window?.matchMedia) {
      standalone =
        window?.matchMedia("(display-mode: standalone)").matches ||
        window?.navigator.standalone === true;
    }

    const wasInstall = window.localStorage?.getItem("wasInstalled") === "true";
    return standalone || wasInstall;
  };

  const isStandalone = () => {
    let standalone = false;
    if (window?.matchMedia) {
      standalone =
        window?.matchMedia("(display-mode: standalone)").matches ||
        window?.navigator.standalone === true;
    }
    return standalone;
  };

  return { 
    isInstallable, 
    promptInstall, 
    wasInstalled, 
    isStandalone, 
    installationCompleted 
  };
}
```

## 🔧 Service Workers

### 1. expo-service-worker.js (Main Service Worker)

```javascript
/* eslint-env serviceworker */

import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import { precacheAndRoute } from "workbox-precaching";

// Precache all assets generated by the build process
precacheAndRoute(self.__WB_MANIFEST);

// Cache requests for same-origin images
registerRoute(
  ({ request }) => request.destination === "image",
  new StaleWhileRevalidate()
);

// Listen for push events
self?.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "New Notification";
  const options = {
    body: data.body,
    icon: "/icon.png",
    data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self?.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(urlToOpen));
});
```

### 2. firebase-messaging-sw.js (Firebase Messaging)

```javascript
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

const firebaseConfig = {
  // Your Firebase config
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background notifications
messaging.onBackgroundMessage(async (payload) => {
  console.log("Received background message:", payload);
  
  const allClients = await clients.matchAll({ 
    type: "window", 
    includeUncontrolled: true 
  });

  if (allClients.length > 0) {
    allClients.forEach(client => {
      client.postMessage({
        type: "PUSH_MESSAGE",
        payload
      });
    });
  }
});

// Handle notification clicks
self?.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.customData.data?.path || "/";
  event.waitUntil(clients.openWindow(targetUrl));
});
```

## 🚀 PWA Features

### 1. Install Prompt
- Detects when app can be installed
- Shows custom install button
- Tracks installation status

### 2. Offline Support
- Caches static assets
- Implements stale-while-revalidate strategy
- Works offline after first visit

### 3. Push Notifications
- Firebase messaging integration
- Background message handling
- Notification click handling

### 4. Standalone Mode
- Runs without browser UI
- Full-screen experience
- Native app-like behavior

## 📝 Implementation Steps

### Step 1: Install Dependencies

```bash
npm install workbox-webpack-plugin workbox-routing workbox-strategies workbox-precaching
```

### Step 2: Create PWA Assets

Create the following icon files in `public/`:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)
- `favicon.png` (32x32 pixels)

### Step 3: Configure Expo

Update `app.json` with PWA configuration as shown above.

### Step 4: Create Service Workers

Create the service worker files as documented above.

### Step 5: Implement Install Hook

Add the `usePWAinstallPrompt.js` hook to your project.

### Step 6: Use in Components

```javascript
import usePWAInstallPrompt from './usePWAinstallPrompt';

function App() {
  const { isInstallable, promptInstall, wasInstalled, isStandalone } = usePWAInstallPrompt();

  return (
    <div>
      {isInstallable && (
        <button onClick={promptInstall}>
          Install App
        </button>
      )}
      {isStandalone() && <p>Running as PWA!</p>}
    </div>
  );
}
```

## 💡 Usage Examples

### Basic Install Button

```javascript
import React from 'react';
import usePWAInstallPrompt from './usePWAinstallPrompt';

function InstallButton() {
  const { isInstallable, promptInstall } = usePWAInstallPrompt();

  if (!isInstallable) return null;

  return (
    <button 
      onClick={promptInstall}
      className="install-button"
    >
      📱 Install App
    </button>
  );
}
```

### PWA Status Indicator

```javascript
import React from 'react';
import usePWAInstallPrompt from './usePWAinstallPrompt';

function PWAStatus() {
  const { wasInstalled, isStandalone } = usePWAInstallPrompt();

  return (
    <div className="pwa-status">
      {isStandalone() && (
        <span className="status-badge">📱 PWA Mode</span>
      )}
      {wasInstalled() && (
        <span className="status-badge">✅ Installed</span>
      )}
    </div>
  );
}
```

### Conditional Rendering Based on PWA Status

```javascript
import React from 'react';
import usePWAInstallPrompt from './usePWAinstallPrompt';

function App() {
  const { isStandalone } = usePWAInstallPrompt();

  return (
    <div>
      {isStandalone() ? (
        <PWAInterface />
      ) : (
        <WebInterface />
      )}
    </div>
  );
}
```

## 🧪 Testing & Deployment

### Local Testing

1. **Start development server:**
   ```bash
   npm run web
   ```

2. **Test PWA features:**
   - Open Chrome DevTools
   - Go to Application tab
   - Check Manifest and Service Workers
   - Test offline functionality

3. **Test install prompt:**
   - Use Chrome's "Add to Home Screen" feature
   - Or trigger the custom install button

### Production Deployment

1. **Build for production:**
   ```bash
   expo build:web
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Verify PWA features:**
   - Test on mobile devices
   - Check Lighthouse PWA audit
   - Verify offline functionality

### Lighthouse Audit

Run Lighthouse audit to ensure PWA compliance:
- Open Chrome DevTools
- Go to Lighthouse tab
- Select "Progressive Web App"
- Run audit

## 🔧 Troubleshooting

### Common Issues

1. **Install prompt not showing:**
   - Ensure HTTPS is enabled
   - Check manifest.json is valid
   - Verify service worker is registered

2. **Service worker not updating:**
   - Clear browser cache
   - Check service worker registration
   - Verify workbox configuration

3. **Push notifications not working:**
   - Check Firebase configuration
   - Verify notification permissions
   - Test on HTTPS domain

4. **Icons not displaying:**
   - Check icon file paths
   - Verify icon sizes and formats
   - Ensure icons are in public directory

### Debug Commands

```bash
# Check service worker status
navigator.serviceWorker.getRegistrations()

# Check PWA installability
window.addEventListener('beforeinstallprompt', (e) => console.log(e))

# Check standalone mode
window.matchMedia('(display-mode: standalone)').matches
```

## 📚 Additional Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Expo PWA Guide](https://docs.expo.dev/guides/progressive-web-apps/)
- [Firebase Messaging](https://firebase.google.com/docs/cloud-messaging)

## 🎯 Best Practices

1. **Performance:**
   - Optimize images and assets
   - Implement proper caching strategies
   - Minimize service worker size

2. **User Experience:**
   - Show install prompt at appropriate times
   - Provide offline feedback
   - Handle network state changes

3. **Security:**
   - Use HTTPS in production
   - Validate push notification payloads
   - Implement proper CSP headers

4. **Accessibility:**
   - Ensure PWA works with screen readers
   - Provide keyboard navigation
   - Test with assistive technologies

---

This guide provides a complete reference for implementing PWA functionality in your React Native/Expo projects. The implementation is production-ready and includes all necessary features for a modern Progressive Web App.
