import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { RefreshCw, X, CheckCircle } from 'lucide-react';

export const PWAUpdateNotification: React.FC = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [autoUpdateTimer, setAutoUpdateTimer] = useState<number | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);

  useEffect(() => {
    // Check if update was dismissed recently (within 1 hour)
    const dismissed = localStorage.getItem('pwa-update-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - dismissedTime < oneHour) {
        setDismissedUntil(dismissedTime + oneHour);
        return;
      } else {
        localStorage.removeItem('pwa-update-dismissed');
      }
    }

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdatePrompt(true);
      });

      // Check for waiting service worker
      const checkForWaitingSW = async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration && registration.waiting) {
            setShowUpdatePrompt(true);
          }
        } catch (error) {
          console.error('Error checking for waiting service worker:', error);
        }
      };

      checkForWaitingSW();
    }
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          // Tell the waiting service worker to skip waiting and become active
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload the page to use the new service worker
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error updating app:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    // Remember dismissal for 1 hour
    localStorage.setItem('pwa-update-dismissed', Date.now().toString());
    setDismissedUntil(Date.now() + (60 * 60 * 1000));
    
    // Clear auto-update timer if running
    if (autoUpdateTimer) {
      clearTimeout(autoUpdateTimer);
      setAutoUpdateTimer(null);
    }
  };

  // Auto-update after 5 seconds
  useEffect(() => {
    if (showUpdatePrompt && !autoUpdateTimer) {
      const timer = window.setTimeout(() => {
        handleUpdate();
      }, 5000);
      setAutoUpdateTimer(timer);
    }
    
    return () => {
      if (autoUpdateTimer) {
        clearTimeout(autoUpdateTimer);
      }
    };
  }, [showUpdatePrompt]);

  // Don't show if dismissed recently
  if (!showUpdatePrompt || (dismissedUntil && Date.now() < dismissedUntil)) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white border-0 shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Mise à jour disponible</h3>
                <p className="text-green-100 text-sm">
                  Une nouvelle version de l'application est disponible
                  {autoUpdateTimer && (
                    <span className="block mt-1 text-xs">
                      Mise à jour automatique dans 5 secondes...
                    </span>
                  )}
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

          <div className="space-y-3">
            <p className="text-green-100 text-sm">
              Mettez à jour pour bénéficier des dernières améliorations et corrections.
            </p>
            
            <div className="flex space-x-2">
              <Button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 bg-white text-green-600 hover:bg-green-50 font-medium disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Mettre à jour
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleDismiss}
                variant="secondary"
                className="px-4 text-green-100 hover:text-white hover:bg-green-500/20"
              >
                Plus tard (1h)
              </Button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-green-500/30">
            <p className="text-green-200 text-xs">
              ✓ Améliorations de performance • ✓ Nouvelles fonctionnalités • ✓ Corrections de bugs
            </p>
          </div>
        </div>
      </Card>
    </div>
      );
};
