/**
 * Dynamic Manifest Generator
 * Generates the appropriate manifest based on the current route and environment
 */

(function() {
  'use strict';

  // Get current path and hostname
  const pathname = window.location.pathname;
  const hostname = window.location.hostname;
  
  // Detect environment
  const isDev = hostname.includes('dev.') || hostname.includes('localhost') || hostname.includes('127.0.0.1');
  
  // Detect admin mode
  const isAdmin = pathname.startsWith('/admin');
  
  // Generate manifest based on environment and mode
  let manifest;
  
  if (isAdmin) {
    manifest = {
      name: isDev ? 'Ubora Admin Dev' : 'Ubora Admin',
      short_name: isDev ? 'Ubora Admin Dev' : 'Ubora Admin',
      description: 'Panel d\'administration Ubora pour la gestion des utilisateurs et du système',
      theme_color: '#dc2626',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/admin',
      start_url: '/admin/login',
      id: '/admin',
      categories: ['productivity', 'business', 'admin'],
      lang: 'fr',
      dir: 'ltr',
      icons: [
        {
          src: '/fav-icons/android-icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/fav-icons/android-icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: '/fav-icons/android-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/fav-icons/android-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    };
  } else {
    manifest = {
      name: isDev ? 'Ubora Dev' : 'Ubora',
      short_name: isDev ? 'Ubora Dev' : 'Ubora',
      description: 'Application de gestion des formulaires pour entreprises multi-agences',
      theme_color: '#3b82f6',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/',
      start_url: '/',
      id: '/',
      categories: ['productivity', 'business'],
      lang: 'fr',
      dir: 'ltr',
      icons: [
        {
          src: '/fav-icons/android-icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/fav-icons/android-icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: '/fav-icons/android-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/fav-icons/android-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    };
  }

  // Update the manifest link
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    // Create a data URL with the manifest
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    manifestLink.href = manifestUrl;
    
    console.log('📱 [PWA] Dynamic manifest generated:', manifest.name);
  }

  // Also update meta tags
  document.title = `${manifest.name} - Gestion des Formulaires avec ARCHA`;
  
  const appNameMeta = document.querySelector('meta[name="application-name"]');
  if (appNameMeta) {
    appNameMeta.setAttribute('content', manifest.short_name);
  }
  
  const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitleMeta) {
    appleTitleMeta.setAttribute('content', manifest.short_name);
  }
  
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', manifest.description);
  }
  
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', manifest.theme_color);
  }

})();
