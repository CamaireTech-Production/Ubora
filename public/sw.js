// Service Worker Minimal pour iOS Safari
// Version simple sans dépendances externes pour garantir la compatibilité

console.log('🔔 [SW] Service Worker démarré');

// Événement d'installation - activation immédiate
self.addEventListener('install', (event) => {
  console.log('🔔 [SW] Installation...');
  // Activation immédiate pour éviter les problèmes
  self.skipWaiting();
});

// Événement d'activation
self.addEventListener('activate', (event) => {
  console.log('🔔 [SW] Activation...');
  // Prendre le contrôle de tous les clients immédiatement
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('🔔 [SW] Service Worker activé');
    })
  );
});

// Gestion des messages depuis l'application
self.addEventListener('message', (event) => {
  console.log('🔔 [SW] Message reçu:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Gestion des notifications (si Firebase est chargé ailleurs)
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification cliquée');
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Ouvrir ou focus l'application
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        const url = event.notification.data?.url || '/';
        return self.clients.openWindow(url);
      }
    })
  );
});

console.log('🔔 [SW] Service Worker prêt');
