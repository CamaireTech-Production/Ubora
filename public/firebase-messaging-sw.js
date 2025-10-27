// Minimal firebase-messaging-sw.js that redirects to our unified service worker
// This file exists only to satisfy Firebase's expectations

console.log('🔔 [FCM-SW] Redirecting to unified service worker...');

// Import our unified service worker
importScripts('/sw.js');

console.log('🔔 [FCM-SW] Unified service worker imported successfully');
