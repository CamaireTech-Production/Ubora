import React, { useState, useEffect } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';

export const PWAUpdateNotification: React.FC = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      let isMounted = true;

      // Check for waiting service worker on mount
      const checkForWaitingSW = async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (!registration) return;

          if (registration.waiting && isMounted) {
            setShowUpdatePrompt(true);
          }

          // Listen for new updates being found
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && registration.waiting && isMounted) {
                setShowUpdatePrompt(true);
              }
            });
          });
        } catch (error) {
          console.error('Error checking for waiting service worker:', error);
        }
      };

      checkForWaitingSW();

      // Cleanup flag
      return () => {
        isMounted = false;
      };
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
          
          // Reload the page once the new controller takes over
          const onControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            window.location.reload();
          };
          navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        } else {
          // No waiting service worker found, reset loading state
          setIsUpdating(false);
        }
      } else {
        // Service worker not supported, reset loading state
        setIsUpdating(false);
      }
    } catch (error) {
      console.error('Error updating app:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
  };

  if (!showUpdatePrompt) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform transition-transform duration-300 ease-in-out">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-blue-100" />
            <span className="text-sm font-medium">Update available</span>
          </div>
          <span className="text-blue-100 text-sm">•</span>
          <span className="text-blue-100 text-sm">Download update to get the latest improvements</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="bg-white text-blue-800 hover:bg-blue-50 border border-blue-200 font-semibold px-3 py-1.5 text-xs shadow-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Download className="h-3 w-3 mr-1.5" />
                Update
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="text-blue-100 hover:text-white transition-colors p-1 rounded"
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};