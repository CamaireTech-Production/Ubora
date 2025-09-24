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
  // Check for dev subdomain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('dev.') || hostname.includes('localhost')) {
      return true;
    }
  }
  
  // Check environment variables
  return process.env.NODE_ENV === 'development' || 
         process.env.VITE_APP_ENV === 'dev' ||
         import.meta.env.VITE_APP_ENV === 'dev';
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
  const isAdmin = isAdminMode();
  
  let appName: string;
  let shortName: string;
  let description: string;
  let startUrl: string;
  let scope: string;
  
  if (isAdmin) {
    appName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
    shortName = isDev ? 'Ubora Admin Dev' : 'Ubora Admin';
    description = 'Panel d\'administration Ubora pour la gestion des utilisateurs et du système';
    startUrl = '/admin/login';
    scope = '/admin';
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
    isAdmin,
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
 * Initialize PWA configuration on app load
 */
export const initializePWAConfig = (): PWAConfig => {
  const config = getPWAConfig();
  updateMetaTags(config);
  return config;
};
