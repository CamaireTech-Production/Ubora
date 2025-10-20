import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface UnifiedNotification {
  id?: string;
  title: string;
  body: string;
  type: 'form_assignment' | 'form_reminder' | 'metric_reminder' | 'program_instruction';
  recipientId: string;
  recipientRole?: 'directeur' | 'employe';
  agencyId: string;
  data?: Record<string, any>;
  read: boolean;
  status: 'sent' | 'scheduled' | 'delayed' | 'failed';
  scheduledFor?: Date;
  createdAt?: Date;
  sentAt?: Date;
}

class UnifiedNotificationService {
  private readonly collectionName = 'notifications';

  /**
   * Send notification immediately (main entry point for all notifications)
   */
  async sendNotification(notification: Omit<UnifiedNotification, 'id' | 'read' | 'createdAt' | 'status' | 'sentAt'>): Promise<string> {
    try {
      console.log('🔔 [UnifiedNotification] Sending notification:', notification.title);

      // Store notification in Firestore
      const notificationData = {
        ...notification,
        read: false,
        status: 'sent' as const,
        createdAt: serverTimestamp(),
        sentAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.collectionName), notificationData);
      
      // Display notification via service worker
      await this.displayNotification({
        ...notification,
        read: false,
        status: 'sent',
        createdAt: new Date(),
        sentAt: new Date(),
      });
      
      console.log('🔔 [UnifiedNotification] Notification sent successfully:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error sending notification:', error);
      
      // Store as failed notification
      try {
        const failedNotification = {
          ...notification,
          read: false,
          status: 'failed' as const,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, this.collectionName), failedNotification);
      } catch (storeError) {
        console.error('🔔 [UnifiedNotification] Error storing failed notification:', storeError);
      }
      
      throw error;
    }
  }

  /**
   * Schedule notification for future delivery
   */
  async scheduleNotification(
    notification: Omit<UnifiedNotification, 'id' | 'read' | 'createdAt' | 'status' | 'sentAt'>,
    scheduledFor: Date
  ): Promise<string> {
    try {
      console.log('🔔 [UnifiedNotification] Scheduling notification:', notification.title, 'for:', scheduledFor);

      const notificationData = {
        ...notification,
        read: false,
        status: 'scheduled' as const,
        scheduledFor: scheduledFor,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.collectionName), notificationData);
      
      console.log('🔔 [UnifiedNotification] Notification scheduled successfully:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error scheduling notification:', error);
      throw error;
    }
  }

  /**
   * Get scheduled notifications that are due for a specific agency
   */
  async getDueNotifications(agencyId: string): Promise<UnifiedNotification[]> {
    try {
      const now = new Date();
      const q = query(
        collection(db, this.collectionName),
        where('status', '==', 'scheduled'),
        where('agencyId', '==', agencyId),
        where('scheduledFor', '<=', now),
        orderBy('scheduledFor', 'asc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      })) as UnifiedNotification[];
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error getting due notifications:', error);
      return [];
    }
  }

  /**
   * Get missed notifications (scheduled but past due time) for a specific agency
   */
  async getMissedNotifications(agencyId: string): Promise<UnifiedNotification[]> {
    try {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
      
      const q = query(
        collection(db, this.collectionName),
        where('status', '==', 'scheduled'),
        where('agencyId', '==', agencyId),
        where('scheduledFor', '<=', twoMinutesAgo),
        orderBy('scheduledFor', 'asc'),
        limit(20)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      })) as UnifiedNotification[];
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error getting missed notifications:', error);
      return [];
    }
  }

  /**
   * Send a scheduled notification
   */
  async sendScheduledNotification(notification: UnifiedNotification): Promise<void> {
    if (!notification.id) {
      throw new Error('Notification ID is required for sending scheduled notifications');
    }

    try {
      console.log('🔔 [UnifiedNotification] Sending scheduled notification:', notification.title);

      // Update status to sent
      await updateDoc(doc(db, this.collectionName, notification.id), {
        status: 'sent',
        sentAt: serverTimestamp(),
      });

      // Display notification
      await this.displayNotification(notification);
      
      console.log('🔔 [UnifiedNotification] Scheduled notification sent successfully');
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error sending scheduled notification:', error);
      
      // Mark as failed
      try {
        await updateDoc(doc(db, this.collectionName, notification.id), {
          status: 'failed',
        });
      } catch (updateError) {
        console.error('🔔 [UnifiedNotification] Error marking notification as failed:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Send a missed notification (with delayed status)
   */
  async sendMissedNotification(notification: UnifiedNotification): Promise<void> {
    if (!notification.id) {
      throw new Error('Notification ID is required for sending missed notifications');
    }

    try {
      console.log('🔔 [UnifiedNotification] Sending missed notification:', notification.title);

      // Update status to delayed
      await updateDoc(doc(db, this.collectionName, notification.id), {
        status: 'delayed',
        sentAt: serverTimestamp(),
      });

      // Display notification
      await this.displayNotification(notification);
      
      console.log('🔔 [UnifiedNotification] Missed notification sent successfully');
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error sending missed notification:', error);
      
      // Mark as failed
      try {
        await updateDoc(doc(db, this.collectionName, notification.id), {
          status: 'failed',
        });
      } catch (updateError) {
        console.error('🔔 [UnifiedNotification] Error marking missed notification as failed:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Get appropriate icon for notification type
   */
  private getNotificationIcon(_type: string): string {
    // Use a smaller icon size (96x96) for better display in Android notification bar
    // The notification bar typically uses smaller icons than the main app icon
    return '/fav-icons/android-icon-96x96.png';
  }

  /**
   * Get appropriate badge icon for notification type
   */
  private getNotificationBadge(_type: string): string {
    // Use consistent badge but could be customized per type if needed
    return '/fav-icons/android-icon-96x96.png';
  }

  /**
   * Display notification via service worker
   */
  private async displayNotification(notification: Omit<UnifiedNotification, 'id'>): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) {
        console.warn('🔔 [UnifiedNotification] Service worker not supported');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const notificationOptions: NotificationOptions = {
        body: notification.body,
        icon: this.getNotificationIcon(notification.type),
        badge: this.getNotificationBadge(notification.type),
        tag: `ubora-${notification.type}-${Date.now()}`,
        data: {
          ...notification.data,
          type: notification.type,
          recipientId: notification.recipientId,
          agencyId: notification.agencyId,
        },
        requireInteraction: true,
        silent: false,
        dir: 'auto',
        lang: 'fr'
      };

      await registration.showNotification(notification.title, notificationOptions);
      console.log('🔔 [UnifiedNotification] Displayed notification:', notification.title);
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error displaying notification:', error);
    }
  }

  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(userId: string, limitCount: number = 50): Promise<UnifiedNotification[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('recipientId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      })) as UnifiedNotification[];
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.collectionName, notificationId), {
        read: true,
      });
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('recipientId', '==', userId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error getting unread count:', error);
      return 0;
    }
  }
}

export const unifiedNotificationService = new UnifiedNotificationService();
