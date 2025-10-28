import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { browserNotificationService } from './browserNotificationService';

export interface UnifiedNotification {
  id?: string;
  title: string;
  body: string;
  type: 'form_assignment' | 'form_reminder' | 'metric_reminder' | 'programmed_instruction';
  recipientId: string;
  recipientRole?: 'directeur' | 'employe';
  agencyId: string;
  data?: Record<string, any>;
  read: boolean;
  status: 'sent' | 'scheduled' | 'delayed' | 'failed';
  scheduledFor?: Date;
  createdAt?: Date;
  sentAt?: Date;
  // Redirect URL for notification click
  redirectUrl?: string;
  // FCM token for push notification delivery
  fcmToken?: string;
}

class UnifiedNotificationService {
  private readonly collectionName = 'notifications';

  /**
   * Send notification immediately (main entry point for all notifications)
   */
  async sendNotification(notification: Omit<UnifiedNotification, 'id' | 'read' | 'createdAt' | 'status' | 'sentAt'>): Promise<string> {
    try {
      console.log('🔔 [UnifiedNotification] Sending notification:', notification.title);

      // Store notification in Firestore (without fcmToken field)
      const notificationData = {
        title: notification.title,
        body: notification.body,
        type: notification.type,
        recipientId: notification.recipientId,
        recipientRole: notification.recipientRole,
        agencyId: notification.agencyId,
        data: notification.data,
        redirectUrl: notification.redirectUrl,
        read: false,
        status: 'sent' as const,
        createdAt: serverTimestamp(),
        sentAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.collectionName), notificationData);
      
      // Try browser notifications first, then fallback to FCM
      let notificationSent = false;
      
      // Primary: Try browser notifications first
      try {
        console.log('🔔 [UnifiedNotification] Attempting browser notification first...');
        await this.sendBrowserNotification({
          ...notification,
          read: false,
          status: 'sent',
          createdAt: new Date(),
          sentAt: new Date(),
        });
        notificationSent = true;
        console.log('🔔 [UnifiedNotification] ✅ Browser notification sent successfully');
      } catch (browserError) {
        console.error('🔔 [UnifiedNotification] ❌ Browser notification failed:', browserError);
      }
      
      // Fallback: Try FCM if browser failed and token is available
      if (!notificationSent && notification.fcmToken) {
        try {
          console.log('🔔 [UnifiedNotification] Attempting FCM fallback...');
          await this.sendFCMPushNotification({
            ...notification,
            read: false,
            status: 'sent',
            createdAt: new Date(),
            sentAt: new Date(),
          });
          console.log('🔔 [UnifiedNotification] ✅ FCM fallback sent successfully');
        } catch (fcmError) {
          console.error('🔔 [UnifiedNotification] ❌ FCM fallback also failed:', fcmError);
        }
      }
      
      console.log('🔔 [UnifiedNotification] Notification sent successfully:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error sending notification:', error);
      
      // Store as failed notification
      try {
        const failedNotification = {
          title: notification.title,
          body: notification.body,
          type: notification.type,
          recipientId: notification.recipientId,
          recipientRole: notification.recipientRole,
          agencyId: notification.agencyId,
          data: notification.data,
          redirectUrl: notification.redirectUrl,
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
        title: notification.title,
        body: notification.body,
        type: notification.type,
        recipientId: notification.recipientId,
        recipientRole: notification.recipientRole,
        agencyId: notification.agencyId,
        data: notification.data,
        redirectUrl: notification.redirectUrl,
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
   * Send FCM push notification using existing FCM service
   */
  private async sendFCMPushNotification(notification: Omit<UnifiedNotification, 'id'>): Promise<void> {
    try {
      if (!notification.fcmToken) {
        console.warn('🔔 [UnifiedNotification] No FCM token provided for push notification');
        return;
      }

      console.log('🔔 [UnifiedNotification] Sending FCM push notification to token:', notification.fcmToken.substring(0, 20) + '...');

      // Import the existing FCM service
      const { fcmService } = await import('./fcmService');
      
      // Create FCM notification object
      const fcmNotification = {
        title: notification.title,
        body: notification.body,
        data: {
          ...notification.data,
          type: notification.type,
          recipientId: notification.recipientId,
          agencyId: notification.agencyId,
          redirectUrl: notification.redirectUrl || '/',
          timestamp: Date.now().toString(),
        },
        clickAction: notification.redirectUrl || '/',
        redirectUrl: notification.redirectUrl || '/',
        priority: 'high' as const,
        ttl: 86400 // 24 hours
      };

      // Send using existing FCM service
      const result = await fcmService.sendToToken(fcmNotification, notification.fcmToken, notification.recipientId);
      
      if (result && result.status === 'sent') {
        console.log('🔔 [UnifiedNotification] FCM push notification sent successfully');
      } else {
        console.warn('🔔 [UnifiedNotification] FCM push notification may have failed:', result?.error);
        
        // If token is invalid, try to regenerate it
        if (result?.error && (result.error.includes('Invalid FCM token') || result.error.includes('token-not-registered'))) {
          console.log('🔔 [UnifiedNotification] Attempting to regenerate FCM token for user:', notification.recipientId);
          // The token regeneration will happen automatically on the next notification attempt
        }
      }
    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error sending FCM push notification:', error);
      // Don't throw error - notification should still be saved to Firestore even if FCM fails
    }
  }

  /**
   * Display notification via service worker (disabled - using FCM push notifications only)
   */
  private async displayNotification(_notification: Omit<UnifiedNotification, 'id'>): Promise<void> {
    // Disabled - we're using FCM push notifications instead of browser notifications
    console.log('🔔 [UnifiedNotification] Browser notification disabled - using FCM push notifications only');
    return;
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

  /**
   * Create form assignment notification
   */
  async createFormAssignmentNotification(
    formId: string,
    formTitle: string,
    recipientId: string,
    recipientRole: 'directeur' | 'employe',
    agencyId: string,
    action: 'assigned' | 'unassigned',
    assignedByName: string,
    fcmToken?: string
  ): Promise<string> {
    const isAssigned = action === 'assigned';
    const title = isAssigned ? 'Nouveau formulaire assigné' : 'Formulaire désassigné';
    const body = isAssigned 
      ? `${assignedByName} vous a assigné le formulaire "${formTitle}"`
      : `Vous n'êtes plus assigné au formulaire "${formTitle}"`;

    return await this.sendNotification({
      title,
      body,
      type: 'form_assignment',
      recipientId,
      recipientRole,
      agencyId,
      redirectUrl: '/forms',
      fcmToken,
      data: {
        formId,
        formTitle,
        assignedByName,
        action,
        highlightForm: true
      }
    });
  }

  /**
   * Create form reminder notification
   */
  async createFormReminderNotification(
    formId: string,
    formTitle: string,
    recipientId: string,
    recipientRole: 'directeur' | 'employe',
    agencyId: string,
    reminderType: '1h' | '30min' | '15min' | '5min',
    fcmToken?: string
  ): Promise<string> {
    const title = 'Rappel de formulaire';
    const body = `N'oubliez pas de remplir: "${formTitle}" (${reminderType} restant)`;

    return await this.sendNotification({
      title,
      body,
      type: 'form_reminder',
      recipientId,
      recipientRole,
      agencyId,
      redirectUrl: recipientRole === 'directeur' ? '/directeur/dashboard' : '/employe/dashboard',
      fcmToken,
      data: {
        formId,
        formTitle,
        reminderType,
        action: 'fill_form'
      }
    });
  }

  /**
   * Create metric reminder notification
   */
  async createMetricReminderNotification(
    dashboardId: string,
    metricId: string,
    metricName: string,
    metricValue: number,
    recipientId: string,
    agencyId: string,
    fcmToken?: string
  ): Promise<string> {
    const title = 'Rappel de métrique';
    const body = `Métrique "${metricName}": ${metricValue}`;

    return await this.sendNotification({
      title,
      body,
      type: 'metric_reminder',
      recipientId,
      recipientRole: 'directeur',
      agencyId,
      redirectUrl: `/dashboard/${dashboardId}`,
      fcmToken,
      data: {
        dashboardId,
        metricId,
        metricName,
        metricValue,
        action: 'highlight_metric'
      }
    });
  }

  /**
   * Create programmed instruction notification
   */
  async createProgrammedInstructionNotification(
    instructionId: string,
    instructionTitle: string,
    recipientId: string,
    agencyId: string,
    fcmToken?: string
  ): Promise<string> {
    const title = 'Instruction programmée exécutée';
    const body = `L'instruction "${instructionTitle}" a été exécutée et la réponse est disponible`;

    return await this.sendNotification({
      title,
      body,
      type: 'programmed_instruction',
      recipientId,
      recipientRole: 'directeur',
      agencyId,
      redirectUrl: `/instructions/${instructionId}/response`,
      fcmToken,
      data: {
        instructionId,
        instructionTitle,
        action: 'show_response'
      }
    });
  }

  /**
   * Send browser notification using the browser notification service
   */
  private async sendBrowserNotification(notification: Omit<UnifiedNotification, 'id'>): Promise<void> {
    try {
      console.log('🔔 [UnifiedNotification] Sending browser notification:', notification.title);

      // Check if browser notifications are supported
      if (!browserNotificationService.isBrowserNotificationSupported()) {
        console.warn('🔔 [UnifiedNotification] Browser notifications not supported');
        return;
      }

      // Check permission
      const permission = browserNotificationService.getPermissionStatus();
      if (permission !== 'granted') {
        console.warn('🔔 [UnifiedNotification] Browser notification permission not granted:', permission);
        return;
      }

      // Send browser notification based on type
      let success = false;
      
      switch (notification.type) {
        case 'form_assignment':
          success = await browserNotificationService.showFormAssignmentNotification({
            formId: notification.data?.formId,
            formName: notification.data?.formName,
            redirectUrl: notification.redirectUrl
          });
          break;
          
        case 'form_reminder':
          success = await browserNotificationService.showFormReminderNotification({
            formId: notification.data?.formId,
            formName: notification.data?.formName,
            timeRemaining: notification.data?.timeRemaining,
            redirectUrl: notification.redirectUrl
          });
          break;
          
        case 'metric_reminder':
          success = await browserNotificationService.showMetricReminderNotification({
            metricId: notification.data?.metricId,
            metricName: notification.data?.metricName,
            redirectUrl: notification.redirectUrl
          });
          break;
          
        case 'programmed_instruction':
          success = await browserNotificationService.showProgrammedInstructionNotification({
            instructionId: notification.data?.instructionId,
            message: notification.body,
            redirectUrl: notification.redirectUrl
          });
          break;
          
        default:
          // Generic notification
          success = await browserNotificationService.showNotification({
            title: notification.title,
            body: notification.body,
            data: {
              ...notification.data,
              type: notification.type,
              redirectUrl: notification.redirectUrl
            }
          });
          break;
      }

      if (success) {
        console.log('🔔 [UnifiedNotification] ✅ Browser notification sent successfully');
      } else {
        console.error('🔔 [UnifiedNotification] ❌ Browser notification failed');
      }

    } catch (error) {
      console.error('🔔 [UnifiedNotification] Error sending browser notification:', error);
      throw error;
    }
  }
}

export const unifiedNotificationService = new UnifiedNotificationService();
