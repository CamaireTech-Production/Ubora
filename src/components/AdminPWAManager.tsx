import React from 'react';
import { useLocation } from 'react-router-dom';
import { AdminPWAInstallPrompt } from './AdminPWAInstallPrompt';

/**
 * Component that manages PWA behavior specifically for admin routes
 * Only shows on routes that start with /admin
 */
export const AdminPWAManager: React.FC = () => {
  const location = useLocation();
  
  // Only show on admin routes
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  if (!isAdminRoute) {
    return null; // Don't show admin PWA prompt on non-admin routes
  }
  
  // Show the admin PWA install modal/prompt
  return <AdminPWAInstallPrompt />;
};
