import React from 'react';
import { PWAInstallPrompt } from './PWAInstallPrompt';

/**
 * PWA Manager for Main App
 * Only shows regular PWA install prompt (blue theme)
 * Admin app handles its own PWA install prompt separately
 */
export const HybridPWAManager: React.FC = () => {
  // Main app only shows regular PWA prompt
  return <PWAInstallPrompt />;
};
