// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDjk-Y3jeoPy3nW_9MniNs8heBv17briMU",
  authDomain: "studio-gpnfx.firebaseapp.com",
  projectId: "studio-gpnfx",
  storageBucket: "studio-gpnfx.firebasestorage.app",
  messagingSenderId: "848246677738",
  appId: "1:848246677738:web:7612dab5f030c52b227793"
});

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('🔔 [SW] Message reçu en arrière-plan:', payload);
  
  const notificationTitle = payload.notification?.title || 'Nouvelle notification Ubora';
  const notificationOptions = {
    body: payload.notification?.body || 'Vous avez reçu une nouvelle notification',
    icon: '/fav-icons/android-icon-192x192.png',
    badge: '/fav-icons/android-icon-96x96.png',
    tag: 'ubora-notification',
    data: payload.data || {},
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
    ],
    requireInteraction: true,
    silent: false
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification cliquée:', event);
  
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
  console.log('🔔 [SW] Notification fermée:', event);
});
