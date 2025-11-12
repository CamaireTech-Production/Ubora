// Unified Service Worker for PWA + FCM
// This service worker handles both PWA functionality and Firebase Cloud Messaging
// Version updated on build - changes here force browser to detect new SW

console.log('🔔 [SW] ===== UNIFIED SERVICE WORKER STARTING =====');

// Variables globales pour Firebase et Workbox
let firebaseLoaded = false;
let workboxLoaded = false;

// Charger les scripts de manière synchrone (importScripts doit être au niveau supérieur)
// Mais avec gestion d'erreur pour iOS
try {
  // Essayer de charger Firebase
  importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');
  firebaseLoaded = true;
  console.log('🔔 [SW] ✅ Firebase scripts loaded successfully');
} catch (error) {
  console.error('🔔 [SW] ❌ Failed to load Firebase scripts:', error);
  firebaseLoaded = false;
  // Continuer sans Firebase - l'application peut fonctionner sans
  console.warn('🔔 [SW] Continuation sans Firebase');
}

try {
  // Essayer de charger Workbox
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');
  workboxLoaded = true;
  console.log('🔔 [SW] ✅ Workbox loaded successfully');
} catch (error) {
  console.error('🔔 [SW] ❌ Failed to load Workbox:', error);
  workboxLoaded = false;
  // Continuer sans Workbox - l'application peut fonctionner sans
  console.warn('🔔 [SW] Continuation sans Workbox');
}

// Initialiser Firebase si chargé
if (firebaseLoaded && typeof firebase !== 'undefined') {
  try {
    console.log('🔔 [SW] Firebase scripts loaded, initializing...');
    
    // Initialize Firebase in the service worker
    firebase.initializeApp({
      apiKey: "AIzaSyDjk-Y3jeoPy3nW_9MniNs8heBv17briMU",
      authDomain: "studio-gpnfx.firebaseapp.com",
      projectId: "studio-gpnfx",
      storageBucket: "studio-gpnfx.firebasestorage.app",
      messagingSenderId: "848246677738",
      appId: "1:848246677738:web:7612dab5f030c52b227793"
    });

    console.log('🔔 [SW] Firebase app initialized successfully');
    
    // Initialize Firebase Messaging
    const messaging = firebase.messaging();
    console.log('🔔 [SW] Firebase messaging instance created');
    
    // Configure VAPID key for FCM
    const vapidKey = 'BDtb0-pnjhy-iYqqcCmpU7892IDJZ1wozc3v-CvoWYqOnJySqv4HJVnqUbOPiCN9fiW15tUu3z5QnWqi0FUgkvY';
    console.log('🔔 [SW] VAPID key configured');

    // Handle FCM background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('🔔 [SW] ===== FCM BACKGROUND MESSAGE RECEIVED =====');
      console.log('🔔 [SW] Payload:', payload);
      
      const title = payload.notification?.title || payload.data?.title || 'Ubora';
      const body = payload.notification?.body || payload.data?.body || 'Vous avez reçu une nouvelle notification';
      const icon = payload.notification?.icon || '/fav-icons/android-icon-192x192.png';
      const badge = payload.notification?.badge || '/fav-icons/android-icon-96x96.png';
      
      console.log('🔔 [SW] Creating notification:', { title, body, icon, badge });
      
      // Create notification options - simplifié pour iOS
      const notificationOptions = {
        body: body,
        icon: icon,
        badge: badge,
        data: {
          ...payload.data,
          fcmMessageId: payload.messageId,
          timestamp: Date.now(),
          url: payload.data?.redirectUrl || payload.data?.clickAction || '/'
        },
        tag: `ubora-fcm-${Date.now()}`,
        requireInteraction: false, // iOS ne supporte pas requireInteraction
        silent: false,
        timestamp: Date.now(),
        dir: 'auto',
        lang: 'fr'
      };
      
      // Ajouter vibrate seulement si supporté
      try {
        if ('vibrate' in navigator) {
          notificationOptions.vibrate = [200, 100, 200];
        }
      } catch (e) {
        // Ignorer si vibrate n'est pas supporté
      }
      
      // Ajouter actions seulement si supporté
      try {
        if ('actions' in Notification.prototype) {
          notificationOptions.actions = [
            {
              action: 'open',
              title: 'Ouvrir',
              icon: '/fav-icons/android-icon-48x48.png'
            },
            {
              action: 'dismiss',
              title: 'Ignorer',
              icon: '/fav-icons/android-icon-48x48.png'
            }
          ];
        }
      } catch (e) {
        // Ignorer si actions ne sont pas supportées
      }
      
      console.log('🔔 [SW] Notification options:', notificationOptions);
      
      // Show the notification
      return self.registration.showNotification(title, notificationOptions)
        .then(() => {
          console.log('🔔 [SW] ✅ Notification displayed successfully!');
          console.log('🔔 [SW] ===== FCM MESSAGE PROCESSED =====');
        })
        .catch((error) => {
          console.error('🔔 [SW] ❌ Error displaying notification:', error);
        });
    });
    
    console.log('🔔 [SW] ✅ FCM background message handler registered');
  } catch (error) {
    console.error('🔔 [SW] ❌ Firebase initialization failed:', error);
    // Continuer sans Firebase - l'application peut fonctionner sans
    console.warn('🔔 [SW] Continuation sans Firebase FCM');
  }
} else {
  console.warn('🔔 [SW] ⚠️ Firebase not loaded - FCM features will be unavailable');
}

// Initialiser Workbox si chargé
if (workboxLoaded && typeof workbox !== 'undefined') {
  try {
    console.log('🔔 [SW] Workbox loaded, configuring PWA features...');
    
    // Precache static assets
    workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
    
    // Cache API responses
    workbox.routing.registerRoute(
      ({ url }) => url.pathname.startsWith('/api/'),
      new workbox.strategies.NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 3,
      })
    );
    
    // Cache static assets
    workbox.routing.registerRoute(
      ({ request }) => request.destination === 'image',
      new workbox.strategies.CacheFirst({
        cacheName: 'images-cache',
      })
    );
    
    console.log('🔔 [SW] ✅ Workbox PWA features configured');
  } catch (error) {
    console.error('🔔 [SW] ❌ Error configuring Workbox:', error);
    console.warn('🔔 [SW] Continuation sans cache avancé');
  }
} else {
  console.warn('🔔 [SW] ⚠️ Workbox not loaded - PWA caching features will be limited');
  
  // Fallback: Basic fetch handler pour le caching
  self.addEventListener('fetch', (event) => {
    // Ne rien faire - laisser le navigateur gérer
    // Cette fonction existe juste pour éviter les erreurs
  });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    console.log('🔔 [SW] Notification dismissed');
    return;
  }

  // Open the app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('🔔 [SW] Focusing existing window');
          return client.focus();
        }
      }
      
      // If app is not open, open it
      if (clients.openWindow) {
        const redirectPath = event.notification.data?.redirectPath;
        const dataUrl = event.notification.data?.url; // legacy absolute
        const url = redirectPath ? (self.location.origin + redirectPath) : (dataUrl || '/');
        console.log('🔔 [SW] Opening new window:', url);
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('🔔 [SW] Notification closed:', event);
});

// Handle messages from main thread (for testing and updates)
self.addEventListener('message', (event) => {
  console.log('🔔 [SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'TEST_SW') {
    event.ports[0].postMessage({
      message: 'Service Worker is active and responding',
      timestamp: Date.now(),
      state: self.registration.active?.state || 'unknown'
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔔 [SW] Skip waiting message received, activating...');
    self.skipWaiting();
  }
});

// Handle service worker updates
self.addEventListener('install', (event) => {
  console.log('🔔 [SW] Service worker installing...');
  // Force activation immediately pour éviter les problèmes
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🔔 [SW] Service worker activating...');
  event.waitUntil(self.clients.claim());
});

console.log('🔔 [SW] ===== UNIFIED SERVICE WORKER READY =====');
