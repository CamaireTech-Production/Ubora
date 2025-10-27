// Unified Service Worker for PWA + FCM
// This service worker handles both PWA functionality and Firebase Cloud Messaging

console.log('🔔 [SW] ===== UNIFIED SERVICE WORKER STARTING =====');

// Import Firebase scripts for FCM
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

// Import Workbox for PWA functionality
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

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
    
    // Create notification options with native properties
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
      requireInteraction: true, // Keep notification visible
      silent: false, // Enable sound
      vibrate: [200, 100, 200], // Vibration pattern
      timestamp: Date.now(),
      renotify: true,
      dir: 'auto',
      lang: 'fr',
      sticky: true, // Keep notification until user interacts
      actions: [
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
      ]
    };
    
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
        const url = event.notification.data?.url || '/';
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
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🔔 [SW] Service worker activating...');
  event.waitUntil(self.clients.claim());
});

// Workbox configuration for PWA functionality
if (workbox) {
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
} else {
  console.log('🔔 [SW] Workbox not available, skipping PWA features');
}

console.log('🔔 [SW] ===== UNIFIED SERVICE WORKER READY =====');