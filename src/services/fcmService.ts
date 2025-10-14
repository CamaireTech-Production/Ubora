import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface FCMNotification {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  clickAction?: string;
  priority?: 'high' | 'normal';
  ttl?: number; // Time to live in seconds
}

export interface FCMTarget {
  userId?: string;
  userRole?: string;
  fcmToken?: string;
  platform?: 'ios' | 'android' | 'desktop';
}

export interface FCMDeliveryLog {
  id: string;
  notificationId: string;
  userId: string;
  fcmToken: string;
  platform: string;
  status: 'sent' | 'delivered' | 'failed';
  error?: string;
  timestamp: Date;
  response?: any;
}

class FCMService {
  private static instance: FCMService;

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  /**
   * Send notification to specific user by FCM token
   */
  async sendToToken(notification: FCMNotification, fcmToken: string, userId?: string): Promise<FCMDeliveryLog> {
    try {
      console.log('🔔 [FCM] Sending notification to token:', { fcmToken: fcmToken.substring(0, 20) + '...', userId });

      // Call backend API to send FCM
      const response = await fetch('/api/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification,
          fcmToken,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log the delivery
      const deliveryLog: FCMDeliveryLog = {
        id: `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        notificationId: notification.id || 'unknown',
        userId: userId || 'unknown',
        fcmToken,
        platform: 'unknown', // Will be updated from user data
        status: result.success ? 'sent' : 'failed',
        error: result.error,
        timestamp: new Date(),
        response: result
      };

      await this.logDelivery(deliveryLog);
      return deliveryLog;

    } catch (error) {
      console.error('🔔 [FCM] Error sending to token:', error);
      
      const deliveryLog: FCMDeliveryLog = {
        id: `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        notificationId: notification.id || 'unknown',
        userId: userId || 'unknown',
        fcmToken,
        platform: 'unknown',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };

      await this.logDelivery(deliveryLog);
      return deliveryLog;
    }
  }

  /**
   * Send notification to user by user ID
   */
  async sendToUser(notification: FCMNotification, userId: string): Promise<FCMDeliveryLog | null> {
    try {
      // Get user's FCM token
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;

      if (!fcmToken) {
        console.warn('🔔 [FCM] No FCM token found for user:', userId);
        return null;
      }

      return await this.sendToToken(notification, fcmToken, userId);

    } catch (error) {
      console.error('🔔 [FCM] Error sending to user:', error);
      return null;
    }
  }

  /**
   * Send notification to all users with a specific role
   */
  async sendToRole(notification: FCMNotification, role: string): Promise<FCMDeliveryLog[]> {
    try {
      console.log('🔔 [FCM] Sending notification to role:', role);

      // Get all users with the specified role
      const usersQuery = query(
        collection(db, 'users'),
        where('role', '==', role),
        where('fcmToken', '!=', null),
        where('notificationEnabled', '==', true)
      );

      const usersSnapshot = await getDocs(usersQuery);
      const deliveryLogs: FCMDeliveryLog[] = [];

      // Send to each user
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;
        
        if (fcmToken) {
          const deliveryLog = await this.sendToToken(notification, fcmToken, userDoc.id);
          deliveryLogs.push(deliveryLog);
        }
      }

      console.log('🔔 [FCM] Sent to', deliveryLogs.length, 'users with role:', role);
      return deliveryLogs;

    } catch (error) {
      console.error('🔔 [FCM] Error sending to role:', error);
      return [];
    }
  }

  /**
   * Send notification to all users (broadcast)
   */
  async sendBroadcast(notification: FCMNotification): Promise<FCMDeliveryLog[]> {
    try {
      console.log('🔔 [FCM] Sending broadcast notification');

      // Get all users with FCM tokens
      const usersQuery = query(
        collection(db, 'users'),
        where('fcmToken', '!=', null),
        where('notificationEnabled', '==', true)
      );

      const usersSnapshot = await getDocs(usersQuery);
      const deliveryLogs: FCMDeliveryLog[] = [];

      // Send to each user
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;
        
        if (fcmToken) {
          const deliveryLog = await this.sendToToken(notification, fcmToken, userDoc.id);
          deliveryLogs.push(deliveryLog);
        }
      }

      console.log('🔔 [FCM] Broadcast sent to', deliveryLogs.length, 'users');
      return deliveryLogs;

    } catch (error) {
      console.error('🔔 [FCM] Error sending broadcast:', error);
      return [];
    }
  }

  /**
   * Log FCM delivery attempt
   */
  private async logDelivery(deliveryLog: FCMDeliveryLog): Promise<void> {
    try {
      await addDoc(collection(db, 'fcmDeliveryLogs'), deliveryLog);
    } catch (error) {
      console.error('🔔 [FCM] Error logging delivery:', error);
    }
  }

  /**
   * Get delivery logs for a notification
   */
  async getDeliveryLogs(notificationId: string): Promise<FCMDeliveryLog[]> {
    try {
      const logsQuery = query(
        collection(db, 'fcmDeliveryLogs'),
        where('notificationId', '==', notificationId),
        orderBy('timestamp', 'desc')
      );

      const logsSnapshot = await getDocs(logsQuery);
      return logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FCMDeliveryLog));

    } catch (error) {
      console.error('🔔 [FCM] Error getting delivery logs:', error);
      return [];
    }
  }

  /**
   * Get recent delivery logs
   */
  async getRecentDeliveryLogs(limitCount: number = 50): Promise<FCMDeliveryLog[]> {
    try {
      const logsQuery = query(
        collection(db, 'fcmDeliveryLogs'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const logsSnapshot = await getDocs(logsQuery);
      return logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FCMDeliveryLog));

    } catch (error) {
      console.error('🔔 [FCM] Error getting recent delivery logs:', error);
      return [];
    }
  }

  /**
   * Create a notification with proper structure
   */
  createNotification(
    title: string, 
    body: string, 
    data?: Record<string, any>,
    options?: Partial<FCMNotification>
  ): FCMNotification {
    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      data: data || {},
      priority: 'high',
      ttl: 86400, // 24 hours
      ...options
    };
  }

  /**
   * Send form-related notification
   */
  async sendFormNotification(
    type: 'assigned' | 'created' | 'submission' | 'reminder',
    formId: string,
    formTitle: string,
    targetUserId?: string,
    targetRole?: string
  ): Promise<FCMDeliveryLog[]> {
    const notifications: Record<string, { title: string; body: string; data: any }> = {
      assigned: {
        title: 'Nouveau formulaire assigné',
        body: `Vous avez un nouveau formulaire: ${formTitle}`,
        data: { formId, action: 'form_assigned', type: 'form' }
      },
      created: {
        title: 'Formulaire créé',
        body: `Le formulaire "${formTitle}" a été créé`,
        data: { formId, action: 'form_created', type: 'form' }
      },
      submission: {
        title: 'Nouvelle soumission',
        body: `Nouvelle soumission pour: ${formTitle}`,
        data: { formId, action: 'form_submission', type: 'form' }
      },
      reminder: {
        title: 'Rappel de formulaire',
        body: `N'oubliez pas de remplir: ${formTitle}`,
        data: { formId, action: 'form_reminder', type: 'reminder' }
      }
    };

    const notificationData = notifications[type];
    if (!notificationData) {
      throw new Error(`Unknown form notification type: ${type}`);
    }

    const notification = this.createNotification(
      notificationData.title,
      notificationData.body,
      notificationData.data
    );

    if (targetUserId) {
      const result = await this.sendToUser(notification, targetUserId);
      return result ? [result] : [];
    } else if (targetRole) {
      return await this.sendToRole(notification, targetRole);
    } else {
      throw new Error('Either targetUserId or targetRole must be specified');
    }
  }
}

export const fcmService = FCMService.getInstance();


