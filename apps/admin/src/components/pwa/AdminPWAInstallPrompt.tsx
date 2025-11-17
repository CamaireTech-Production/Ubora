import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Shield, X, Smartphone, Monitor } from 'lucide-react';

// Admin PWA Config - always admin mode with red theme
const getAdminPWAConfig = () => {
  // Detect environment: dev (admindev.ubora-app.com) or prod (admin.ubora-app.com)
  const isDev = window.location.hostname.includes('admindev') || 
                window.location.hostname.includes('localhost') ||
                window.location.hostname.includes('127.0.0.1');
  
  return {
    appName: isDev ? 'Ubora Admin Dev' : 'Ubora Admin',
    shortName: isDev ? 'Ubora Admin Dev' : 'Ubora Admin',
    isAdmin: true,
    startUrl: '/login',
    scope: '/'
  };
};

export const AdminPWAInstallPrompt: React.FC = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pwaConfig, setPwaConfig] = useState(getAdminPWAConfig());
  const [isInstalling, setIsInstalling] = useState(false);
  const [adminDeferredPrompt, setAdminDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }

      if (window.location.search.includes('source=pwa') || 
          document.referrer.includes('android-app://')) {
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();

    // Listen for the appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
    };

    // Listen for display mode changes
    const handleDisplayModeChange = () => {
      checkIfInstalled();
    };

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setAdminDeferredPrompt(e);
      if (!isInstalled) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);

    // Check if app should be installable
    const checkShouldShowPrompt = () => {
      if (isInstalled) {
        return;
      }

      // Check if dismissed recently (within 7 days)
      const dismissed = localStorage.getItem('admin-pwa-install-dismissed');
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          return;
        }
      }

      // Show prompt if installable
      if (adminDeferredPrompt || ('serviceWorker' in navigator && 'PushManager' in window)) {
        setShowInstallPrompt(true);
      }
    };

    // Initial check after a delay
    const timer = setTimeout(checkShouldShowPrompt, 3000);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, [isInstalled, adminDeferredPrompt]);

  const handleInstall = async () => {
    setIsInstalling(true);
    
    try {
      if (adminDeferredPrompt) {
        await adminDeferredPrompt.prompt();
        const { outcome } = await adminDeferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('User accepted the admin install prompt');
        } else {
          console.log('User dismissed the admin install prompt');
        }
        
        setAdminDeferredPrompt(null);
        setShowInstallPrompt(false);
      }
    } catch (error) {
      console.error('Error during admin installation:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('admin-pwa-install-dismissed', Date.now().toString());
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isInstalled || isStandalone) {
    return null;
  }

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Card className="bg-gradient-to-r from-red-600 to-red-700 text-white border-0 shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  Installer {pwaConfig.shortName}
                </h3>
                <p className="text-red-100 text-sm">
                  Accédez au panel d'administration
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isIOS ? (
            <div className="space-y-3">
              <p className="text-red-100 text-sm">
                Appuyez sur <strong>Partager</strong> puis <strong>Sur l'écran d'accueil</strong>
              </p>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              disabled={isInstalling || !adminDeferredPrompt}
              className="w-full bg-white text-red-800 hover:bg-red-50 font-semibold px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isInstalling ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Installation...
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4" />
                  Installer l'application
                </>
              )}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};

