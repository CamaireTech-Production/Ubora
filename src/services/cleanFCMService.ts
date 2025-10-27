// Clean FCM Service - Following Firebase Official Patterns
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { messaging } from '../firebaseConfig';

export class CleanFCMService {
  private static instance: CleanFCMService;
  private messagingInstance: any = null;
  private vapidKey: string;

  constructor() {
    this.vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BDtb0-pnjhy-iYqqcCmpU7892IDJZ1wozc3v-CvoWYqOnJySqv4HJVnqUbOPiCN9fiW15tUu3z5QnWqi0FUgkvY';
  }

  static getInstance(): CleanFCMService {
    if (!CleanFCMService.instance) {
      CleanFCMService.instance = new CleanFCMService();
    }
    return CleanFCMService.instance;
  }

  /**
   * Initialize FCM service
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔔 [CleanFCM] Initializing FCM service...');
      
      // Check if FCM is supported
      const supported = await isSupported();
      if (!supported) {
        console.error('🔔 [CleanFCM] FCM not supported in this browser');
        return false;
      }

      // Get messaging instance
      this.messagingInstance = await messaging;
      if (!this.messagingInstance) {
        console.error('🔔 [CleanFCM] Failed to get messaging instance');
        return false;
      }

      console.log('🔔 [CleanFCM] ✅ FCM service initialized successfully');
      return true;
    } catch (error) {
      console.error('🔔 [CleanFCM] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    try {
      console.log('🔔 [CleanFCM] Requesting notification permission...');
      
      if (!('Notification' in window)) {
        throw new Error('Notifications not supported');
      }

      const permission = await Notification.requestPermission();
      console.log('🔔 [CleanFCM] Permission result:', permission);
      
      return permission;
    } catch (error) {
      console.error('🔔 [CleanFCM] ❌ Permission request failed:', error);
      return 'denied';
    }
  }

  /**
   * Get FCM token
   */
  async getFCMToken(): Promise<string | null> {
    try {
      if (!this.messagingInstance) {
        console.error('🔔 [CleanFCM] Messaging not initialized');
        return null;
      }

      console.log('🔔 [CleanFCM] Getting FCM token...');
      
      // Ensure service worker is registered and active
      if ('serviceWorker' in navigator) {
        try {
          console.log('🔔 [CleanFCM] Checking service worker registration...');
          
          // Check if service worker is already registered
          let registration = await navigator.serviceWorker.getRegistration('/');
          
          if (!registration) {
            console.log('🔔 [CleanFCM] No service worker found, registering...');
            registration = await navigator.serviceWorker.register('/sw.js');
            console.log('🔔 [CleanFCM] Service worker registered:', registration);
          } else {
            console.log('🔔 [CleanFCM] Service worker already registered:', registration);
          }
          
          // Wait for service worker to be active
          if (registration.waiting) {
            console.log('🔔 [CleanFCM] Service worker is waiting, activating...');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          
          if (registration.installing) {
            console.log('🔔 [CleanFCM] Service worker is installing, waiting...');
            await new Promise((resolve) => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.addEventListener('statechange', () => {
                  if (installingWorker.state === 'activated') {
                    resolve(undefined);
                  }
                });
              } else {
                resolve(undefined);
              }
            });
          }
          
          // Ensure we have an active service worker
          if (!registration.active) {
            console.log('🔔 [CleanFCM] No active service worker, waiting...');
            await new Promise((resolve) => {
              const checkActive = () => {
                if (registration.active) {
                  resolve(undefined);
                } else {
                  setTimeout(checkActive, 100);
                }
              };
              checkActive();
            });
          }
          
          console.log('🔔 [CleanFCM] ✅ Service worker is active:', registration.active);
          
        } catch (error) {
          console.error('🔔 [CleanFCM] Service worker registration failed:', error);
          return null;
        }
      } else {
        console.error('🔔 [CleanFCM] Service Worker not supported');
        return null;
      }
      
      const token = await getToken(this.messagingInstance, {
        vapidKey: this.vapidKey
      });

      if (token) {
        console.log('🔔 [CleanFCM] ✅ FCM token obtained:', token.substring(0, 20) + '...');
        return token;
      } else {
        console.log('🔔 [CleanFCM] ❌ No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('🔔 [CleanFCM] ❌ Token generation failed:', error);
      return null;
    }
  }

  /**
   * Set up foreground message handler
   */
  setupForegroundHandler(onMessageReceived?: (payload: any) => void): void {
    if (!this.messagingInstance) {
      console.error('🔔 [CleanFCM] Messaging not initialized');
      return;
    }

    console.log('🔔 [CleanFCM] Setting up foreground message handler...');

    onMessage(this.messagingInstance, (payload) => {
      console.log('🔔 [CleanFCM] Foreground message received:', payload);
      
      // Show notification when app is in foreground
      if (Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || 'Ubora';
        const body = payload.notification?.body || payload.data?.body || 'Nouvelle notification';
        
        const notification = new Notification(title, {
          body: body,
          icon: '/fav-icons/android-icon-192x192.png',
          badge: '/fav-icons/android-icon-96x96.png',
          data: payload.data,
          tag: `foreground-${Date.now()}`,
          requireInteraction: true,
          silent: false
        });
        
        notification.onclick = () => {
          window.focus();
          notification.close();
          
          if (payload.data?.redirectUrl) {
            window.location.href = payload.data.redirectUrl;
          }
        };
        
        console.log('🔔 [CleanFCM] ✅ Foreground notification displayed');
      }
      
      // Call custom handler if provided
      if (onMessageReceived) {
        onMessageReceived(payload);
      }
    });

    console.log('🔔 [CleanFCM] ✅ Foreground handler registered');
  }

  /**
   * Send test notification via backend
   */
  async sendTestNotification(userId: string, fcmToken: string): Promise<boolean> {
    try {
      console.log('🔔 [CleanFCM] Sending test notification...');
      
      // Use the correct backend API endpoint
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/fcm/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification: {
            id: `test_${Date.now()}`,
            title: 'Test FCM Notification',
            body: 'Ceci est un test de notification FCM',
            data: {
              type: 'test',
              timestamp: Date.now().toString(),
              redirectUrl: '/'
            }
          },
          fcmToken: fcmToken,
          userId: userId
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔔 [CleanFCM] ✅ Test notification sent:', result);
        return true;
      } else {
        const error = await response.text();
        console.error('🔔 [CleanFCM] ❌ Test notification failed:', error);
        return false;
      }
    } catch (error) {
      console.error('🔔 [CleanFCM] ❌ Test notification error:', error);
      return false;
    }
  }

  /**
   * Check if environment supports FCM
   */
  checkEnvironmentCompatibility(): {
    isCompatible: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check HTTPS
    const isHTTPS = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isHTTPS && !isLocalhost) {
      issues.push('HTTP protocol detected');
      recommendations.push('Deploy to HTTPS for FCM to work');
    } else if (!isHTTPS && isLocalhost) {
      issues.push('HTTP localhost - FCM may not work reliably');
      recommendations.push('Use ngrok or deploy to HTTPS for reliable FCM');
    }

    // Check secure context
    if (!window.isSecureContext) {
      issues.push('Not in secure context');
      recommendations.push('Ensure HTTPS is properly configured');
    }

    // Check notification support
    if (!('Notification' in window)) {
      issues.push('Notifications not supported');
      recommendations.push('Use a modern browser that supports notifications');
    }

    // Check service worker support
    if (!('serviceWorker' in navigator)) {
      issues.push('Service Worker not supported');
      recommendations.push('Use a modern browser that supports service workers');
    }

    const isCompatible = issues.length === 0;

    return {
      isCompatible,
      issues,
      recommendations
    };
  }
}

// Export singleton instance
export const cleanFCMService = CleanFCMService.getInstance();
