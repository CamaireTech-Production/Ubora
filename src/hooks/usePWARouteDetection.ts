import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getPWAConfig, updateMetaTags } from '../utils/pwaConfig';

/**
 * Hook to detect route changes and update PWA configuration accordingly
 */
export const usePWARouteDetection = () => {
  const location = useLocation();
  const [pwaConfig, setPwaConfig] = useState(getPWAConfig());

  useEffect(() => {
    // Update PWA configuration when route changes
    const newConfig = getPWAConfig();
    setPwaConfig(newConfig);
    updateMetaTags(newConfig);

    // Update manifest link if needed
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (manifestLink) {
      const newManifestUrl = newConfig.isAdmin ? '/manifest-admin.json' : '/manifest.json';
      if (manifestLink.href !== newManifestUrl) {
        manifestLink.href = newManifestUrl;
      }
    }
  }, [location.pathname]);

  return pwaConfig;
};

/**
 * Alternative hook that doesn't rely on React Router
 * Uses window.location instead of useLocation hook
 */
export const usePWARouteDetectionFallback = () => {
  const [pwaConfig, setPwaConfig] = useState(getPWAConfig());

  useEffect(() => {
    // Update PWA configuration when route changes
    const newConfig = getPWAConfig();
    setPwaConfig(newConfig);
    updateMetaTags(newConfig);

    // Update manifest link if needed
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (manifestLink) {
      const newManifestUrl = newConfig.isAdmin ? '/manifest-admin.json' : '/manifest.json';
      if (manifestLink.href !== newManifestUrl) {
        manifestLink.href = newManifestUrl;
      }
    }

    // Listen for route changes using popstate
    const handleRouteChange = () => {
      const updatedConfig = getPWAConfig();
      setPwaConfig(updatedConfig);
      updateMetaTags(updatedConfig);
    };

    window.addEventListener('popstate', handleRouteChange);
    
    // Also listen for pushstate/replacestate (for programmatic navigation)
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      setTimeout(handleRouteChange, 0);
    };
    
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(handleRouteChange, 0);
    };

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return pwaConfig;
};
