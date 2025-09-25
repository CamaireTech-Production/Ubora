if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('🔔 [SW] Service worker registered:', registration);
      })
      .catch((error) => {
        console.error('🔔 [SW] Service worker registration failed:', error);
      });
  });
}
