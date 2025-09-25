import React from 'react';
import { PWAInstallPrompt } from './PWAInstallPrompt';

/**
 * Component that manages PWA behavior based on current route
 * Handles dynamic PWA configuration and install prompts
 */
export const PWAManager: React.FC = () => {
  // Only show the PWA install modal/prompt
  return <PWAInstallPrompt />;
};
