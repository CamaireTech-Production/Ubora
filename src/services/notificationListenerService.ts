import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
// import { useAuth } from '../contexts/AuthContext'; // Unused for now

/**
 * Service to listen for new notifications and show them using browser notifications
 * This works entirely on the frontend without any backend API calls
 */
class NotificationListenerService {
  private unsubscribe: (() => void) | null = null;
  private lastNotificationTime: Date | null = null;

  /**
   * Start listening for notifications for a specific user
   */
  startListening(userId: string) {
    if (this.unsubscribe) {
      this.unsubscribe();
    }


    // Request notification permission first
    this.requestNotificationPermission();

    // Query for notifications for this user, ordered by creation time
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    this.unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = change.doc.data();
          const notificationTime = notification.createdAt?.toDate() || new Date();
          
          // Only show notification if it's new (not from initial load)
          if (!this.lastNotificationTime || notificationTime > this.lastNotificationTime) {
            this.showNotification(notification);
            this.lastNotificationTime = notificationTime;
          }
        }
      });
    }, (error) => {
      // Reduce noise: handle permission-denied gracefully
      const message = (error && (error.code || error.message)) || '';
      if (typeof message === 'string' && message.includes('permission')) {
        console.warn('🔔 [NotificationListener] Permission denied for notifications listener');
        return;
      }
      console.error('🔔 [NotificationListener] Error listening to notifications:', error);
    });
  }

  /**
   * Stop listening for notifications
   */
  stopListening() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Request notification permission from the user
   */
  private async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('🔔 [NotificationListener] Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Show a browser notification
   */
  private showNotification(notification: any) {
    // Check if notifications are supported and permission is granted
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'denied') {
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          this.createNotification(notification);
        }
      });
      return;
    }

    // Permission is granted, show notification
    this.createNotification(notification);
  }

  /**
   * Create and show the actual notification
   */
  private createNotification(notification: any) {
    const notificationOptions: NotificationOptions = {
      body: notification.body,
      icon: '/fav-icons/android-icon-192x192.png',
      badge: '/fav-icons/android-icon-96x96.png',
      tag: `ubora-notification-${Date.now()}`, // Unique tag to ensure each notification shows
      data: notification.data || {},
      requireInteraction: false, // Allow auto-dismiss for better UX
      silent: false, // Ensure sound plays
      // vibrate: [200, 100, 200], // Vibration pattern for mobile devices (not supported in all browsers)
      // timestamp: Date.now(), // Not supported in all browsers
      // renotify: true // Allow re-notification even with same tag (not supported in all browsers)
    };

    try {
      const browserNotification = new Notification(notification.title, notificationOptions);

      // Handle notification click
      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
        
        // Navigate to appropriate page based on notification type
        if (notification.data?.formId) {
          if (notification.data.action === 'form_assigned' || notification.data.action === 'form_created') {
            window.location.href = '/forms';
          } else if (notification.data.action === 'form_submission') {
            window.location.href = '/dashboard';
          } else if (notification.data.action === 'form_reminder') {
            window.location.href = '/forms';
          }
        } else if (notification.type === 'director_message') {
          window.location.href = '/notifications';
        } else if (notification.type === 'system_alert') {
          window.location.href = '/dashboard';
        } else if (notification.type === 'reminder') {
          window.location.href = '/forms';
        }
      };

      // Handle notification close
      browserNotification.onclose = () => {
      };

      // Handle notification error
      browserNotification.onerror = (error) => {
        console.error('🔔 [NotificationListener] Notification error:', error);
      };

      // Auto-close notification after 8 seconds (longer for desktop)
      setTimeout(() => {
        browserNotification.close();
      }, 8000);

    } catch (error) {
      console.error('🔔 [NotificationListener] Error creating notification:', error);
    }
  }

  /**
   * Test function to show a notification (for debugging)
   */
  testNotification() {
    this.showNotification({
      title: 'Test Notification',
      body: 'This is a test notification to verify the system is working',
      type: 'system_alert',
      data: { test: true }
    });
  }
}

export const notificationListenerService = new NotificationListenerService();

// Make test function available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testNotification = () => {
    notificationListenerService.testNotification();
  };
}
