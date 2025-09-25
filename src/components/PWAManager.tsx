import React from 'react';
import { useLocation } from 'react-router-dom';
import { PWAInstallPrompt } from './PWAInstallPrompt';

/**
 * Component that manages PWA behavior for regular (non-admin) routes
 * Only shows on routes that don't start with /admin
 */
export const PWAManager: React.FC = () => {
  const location = useLocation();
  
  // Only show on non-admin routes
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  if (isAdminRoute) {
    return null; // Don't show regular PWA prompt on admin routes
  }
  
  // Show the regular PWA install modal/prompt
  return <PWAInstallPrompt />;
};
