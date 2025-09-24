import React from 'react';
import { usePWARouteDetection } from '../hooks/usePWARouteDetection';
import { PWAInstallPrompt } from './PWAInstallPrompt';

/**
 * Component that manages PWA behavior based on current route
 * Handles dynamic PWA configuration and install prompts
 */
export const PWAManager: React.FC = () => {
  const pwaConfig = usePWARouteDetection();

  // Only show install prompt for admin routes if we're in admin mode
  // This ensures the admin install prompt only appears on admin pages
  if (pwaConfig.isAdmin) {
    return <PWAInstallPrompt />;
  }

  // Show regular install prompt for non-admin routes
  return <PWAInstallPrompt />;
};
