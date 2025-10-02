import React from 'react';
import { useLocation } from 'react-router-dom';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { AdminPWAInstallPrompt } from './AdminPWAInstallPrompt';
import { getEntryPoint } from '../utils/pwaConfig';

/**
 * Stealth Hybrid PWA Manager - URL-based approach
 * No modal shown to regular users - they never know admin exists
 * Admin users access via /admin routes automatically
 */
export const HybridPWAManager: React.FC = () => {
  const location = useLocation();
  
  // Determine if we're in admin mode based on URL
  const isAdminRoute = location.pathname.startsWith('/admin');
  const entryPoint = getEntryPoint();
  
  // Show admin PWA prompt if:
  // 1. We're on an admin route, OR
  // 2. Entry point is explicitly set to admin
  if (isAdminRoute || entryPoint === 'admin') {
    return <AdminPWAInstallPrompt />;
  }
  
  // Show regular PWA prompt for all other cases
  return <PWAInstallPrompt />;
};
