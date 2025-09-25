/**
 * PWA Configuration Utility
 * Handles environment detection and PWA mode switching
 */

export interface PWAConfig {
  appName: string;
  shortName: string;
  description: string;
  isDev: boolean;
  isAdmin: boolean;
  startUrl: string;
  scope: string;
}

/**
 * Detect if we're in development environment
 */
export const isDevelopment = (): boolean => {
  // First check environment variables (highest priority)
  if (import.meta.env.VITE_APP_ENV === 'prod') {
    return false; // Explicitly set to prod
  }
  
  if (import.meta.env.VITE_APP_ENV === 'dev') {
    return true; // Explicitly set to dev
  }
  
  // Check NODE_ENV (Vite provides this as import.meta.env.MODE)
  if (import.meta.env.MODE === 'production') {
    return false;
  }
  
  if (import.meta.env.MODE === 'development') {
    return true;
  }
  
  // Fallback: Check hostname (lowest priority)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('dev.') || hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return true;
    }
  }
  
  // Default to dev if nothing else is set
  return true;
};


/**
 * Detect the entry point for the PWA
 * URL-based stealth approach - no modal for regular users
 */
export const getEntryPoint = (): 'regular' | 'admin' | 'auto' => {
  if (typeof window === 'undefined') return 'auto';
  
  // Check URL parameters for explicit entry point
  const urlParams = new URLSearchParams(window.location.search);
  const entryPoint = urlParams.get('entry');
  
  if (entryPoint === 'admin') return 'admin';
  if (entryPoint === 'regular') return 'regular';
  
  // Check if we're on admin route - this is the main detection method
  if (window.location.pathname.startsWith('/admin')) return 'admin';
  
  // Default to regular mode (no modal shown)
  return 'regular';
};

/**
 * Check if this is the first time the app is being accessed
 */
export const isFirstTimeAccess = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const hasVisited = localStorage.getItem('pwa-has-visited');
  if (!hasVisited) {
    localStorage.setItem('pwa-has-visited', 'true');
    return true;
  }
  return false;
};

/**
 * Detect if we're in admin mode based on current route
 */
export const isAdminMode = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/admin');
  }
  return false;
};

/**
 * Get PWA configuration based on environment and mode
 */
export const getPWAConfig = (): PWAConfig => {
  const isDev = isDevelopment();
  const entryPoint = getEntryPoint();
  const isAdmin = isAdminMode();
  
  let appName: string;
  let shortName: string;
  let description: string;
  let startUrl: string;
  let scope: string;
  
  // URL-based stealth hybrid approach: Single PWA with automatic mode detection
  if (entryPoint === 'admin' || isAdmin) {
    appName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
    shortName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
    description = 'Panel d\'administration Ubora pour la gestion des utilisateurs et du système';
    
    // Use root scope for hybrid approach
    startUrl = '/admin/login';
    scope = '/';
  } else {
    appName = isDev ? 'Ubora Dev' : 'Ubora';
    shortName = isDev ? 'Ubora Dev' : 'Ubora';
    description = 'Application de gestion des formulaires pour entreprises multi-agences';
    startUrl = '/';
    scope = '/';
  }

  return {
    appName,
    shortName,
    description,
    isDev,
    isAdmin: entryPoint === 'admin' || (entryPoint === 'auto' && isAdmin),
    startUrl,
    scope
  };
};

/**
 * Update HTML meta tags dynamically
 */
export const updateMetaTags = (config: PWAConfig): void => {
  if (typeof document === 'undefined') return;

  // Update application name
  const appNameMeta = document.querySelector('meta[name="application-name"]');
  if (appNameMeta) {
    appNameMeta.setAttribute('content', config.shortName);
  }

  // Update Apple mobile web app title
  const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitleMeta) {
    appleTitleMeta.setAttribute('content', config.shortName);
  }

  // Update page title
  document.title = `${config.appName} - Gestion des Formulaires avec ARCHA`;

  // Update description
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', config.description);
  }
};

/**
 * Get the appropriate manifest URL based on current mode
 */
export const getManifestUrl = (): string => {
  const config = getPWAConfig();
  return config.isAdmin ? '/manifest-admin.json' : '/manifest.json';
};

/**
 * Update the manifest link in the document head
 */
export const updateManifestLink = (config: PWAConfig): void => {
  if (typeof document === 'undefined') return;

  const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
  if (manifestLink) {
    let newManifestUrl: string;
    
    if (config.isAdmin) {
      newManifestUrl = config.isDev ? '/manifest-admin-dev.json' : '/manifest-admin.json';
    } else {
      newManifestUrl = config.isDev ? '/manifest-dev.json' : '/manifest.json';
    }
    
    if (manifestLink.href !== newManifestUrl) {
      manifestLink.href = newManifestUrl;
      console.log(`📱 [PWA] Updated manifest to: ${newManifestUrl} (${config.appName})`);
    }
  }
};

/**
 * Dynamically update manifest content based on environment and mode
 */
export const updateManifestContent = (config: PWAConfig): void => {
  if (typeof document === 'undefined') return;

  // Create or update a dynamic manifest
  let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
  
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }

  // Create dynamic manifest content
  const manifestContent = {
    name: config.appName,
    short_name: config.shortName,
    description: config.description,
    theme_color: config.isAdmin ? '#dc2626' : '#3b82f6',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait-primary',
    scope: config.scope,
    start_url: config.startUrl,
    id: config.scope,
    categories: config.isAdmin ? ['productivity', 'business', 'admin'] : ['productivity', 'business'],
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
      },
      {
        src: '/fav-icons/android-icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-48x48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/fav-icons/android-icon-36x36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };

  // Create a blob URL for the dynamic manifest
  const manifestBlob = new Blob([JSON.stringify(manifestContent, null, 2)], {
    type: 'application/json'
  });
  const manifestUrl = URL.createObjectURL(manifestBlob);
  
  manifestLink.href = manifestUrl;
  console.log(`📱 [PWA] Updated dynamic manifest with name: ${config.appName}`);
};

/**
 * Initialize PWA configuration on app load
 */
export const initializePWAConfig = (): PWAConfig => {
  const config = getPWAConfig();
  updateMetaTags(config);
  updateManifestLink(config); // Use static manifest files to preserve installability
  return config;
};
