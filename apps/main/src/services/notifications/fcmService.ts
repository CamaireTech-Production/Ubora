import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { logger } from '@ubora/shared/utils/logger';
import { buildApiUrl } from '@ubora/shared/config/api';

export interface FCMNotification {
  id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  clickAction?: string;
  redirectUrl?: string;
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
      logger.debug('===== STARTING FCM SEND PROCESS =====', undefined, 'FCMService');
      logger.debug('Notification details', {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.data?.type
      });
      logger.debug('Token details', { 
        fcmToken: fcmToken.substring(0, 20) + '...', 
        userId,
        tokenLength: fcmToken.length,
        tokenStart: fcmToken.substring(0, 10),
        tokenEnd: fcmToken.substring(fcmToken.length - 10)
      });
      logger.debug('FCM API endpoint', { endpoint: buildApiUrl('/api/fcm/send') }, 'FCMService');

      // Call backend API to send FCM
      logger.debug('Making FCM API call to backend', null, 'FCMService');
      const requestBody = {
        notification,
        fcmToken,
        userId
      };
      logger.debug('Request body', { requestBody }, 'FCMService');
      
      const response = await fetch(buildApiUrl('/api/fcm/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      logger.debug('API response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API Error Response', { errorText }, 'FCMService');
        
        // Handle specific FCM errors
        if (response.status === 400 || response.status === 500) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error && (errorData.error.includes('FCM token appears to be invalid') || 
                                   errorData.error.includes('FCM token is not registered') ||
                                   errorData.code === 'token-not-registered')) {
              logger.warn('FCM token is invalid/expired, attempting to regenerate', { token: fcmToken.substring(0, 20) + '...' }, 'FCMService');
              
              // Clear the expired token first
              if (userId) {
                await this.clearExpiredFCMToken(userId);
              }
              
              // Try to regenerate the token
              const newToken = await this.regenerateFCMToken(userId);
              if (newToken) {
                logger.info('Regenerated FCM token, retrying notification', undefined, 'FCMService');
                // Retry with new token
                return await this.sendToToken(notification, newToken, userId);
              } else {
                logger.warn('Failed to regenerate FCM token, notification will be skipped', undefined, 'FCMService');
                return {
                  id: `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  notificationId: notification.id || 'unknown',
                  userId: userId || 'unknown',
                  fcmToken,
                  platform: 'unknown',
                  status: 'failed',
                  error: 'Invalid FCM token - regeneration failed',
                  timestamp: new Date(),
                  response: { success: false, error: 'Invalid FCM token - regeneration failed' }
                };
              }
            }
          } catch (parseError) {
            // Continue with original error handling
          }
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      logger.debug('API response body', { result }, 'FCMService');
      
      // Log the delivery
      const deliveryLog: FCMDeliveryLog = {
        id: `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        notificationId: notification.id || 'unknown',
        userId: userId || 'unknown',
        fcmToken,
        platform: 'unknown', // Will be updated from user data
        status: result.success ? 'sent' : 'failed',
        error: result.error || null,
        timestamp: new Date(),
        response: result || {}
      };

      logger.debug('Delivery log created', { deliveryLog }, 'FCMService');
      logger.info('FCM send status', { success: result.success, status: result.success ? 'SUCCESS' : 'FAILED' }, 'FCMService');
      if (result.error) {
        logger.error('FCM error details', { error: result.error }, 'FCMService');
      }

      await this.logDelivery(deliveryLog);
      logger.debug('===== FCM SEND PROCESS COMPLETED =====', undefined, 'FCMService');
      return deliveryLog;

    } catch (error) {
      logger.error('Error sending to token', error, 'FCMService');
      
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
        logger.warn('No FCM token found for user', { userId }, 'FCMService');
        return null;
      }

      return await this.sendToToken(notification, fcmToken, userId);

    } catch (error) {
      logger.error('Error sending to user', error, 'FCMService');
      return null;
    }
  }

  /**
   * Send notification to all users with a specific role
   */
  async sendToRole(notification: FCMNotification, role: string): Promise<FCMDeliveryLog[]> {
    try {
      logger.debug('Sending notification to role', { role }, 'FCMService');

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

      logger.info('Sent notification to role', { role, count: deliveryLogs.length }, 'FCMService');
      return deliveryLogs;

    } catch (error) {
      logger.error('Error sending notification to role', error, 'FCMService');
      return [];
    }
  }

  /**
   * Send notification to all users (broadcast)
   */
  async sendBroadcast(notification: FCMNotification): Promise<FCMDeliveryLog[]> {
    try {
      logger.debug('Sending broadcast notification', null, 'FCMService');

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

      logger.info('Broadcast notification sent', { count: deliveryLogs.length }, 'FCMService');
      return deliveryLogs;

    } catch (error) {
      logger.error('Error sending broadcast notification', error, 'FCMService');
      return [];
    }
  }

  /**
   * Regenerate FCM token for user
   */
  private async regenerateFCMToken(userId?: string): Promise<string | null> {
    try {
      if (!userId) {
        logger.warn('No userId provided for token regeneration', null, 'FCMService');
        return null;
      }

      // Import the push notification hook to get a fresh token
      const { getToken } = await import('firebase/messaging');
      const { messaging } = await import('@ubora/shared/firebaseConfig');
      
      const messagingInstance = await messaging;
      if (!messagingInstance) {
        logger.warn('Messaging not available for user', { userId }, 'FCMService');
        return null;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
        logger.warn('VAPID key not configured for user', { userId }, 'FCMService');
        return null;
      }

      // Get fresh FCM token
      const newToken = await getToken(messagingInstance, {
        vapidKey: vapidKey
        // Removed serviceWorkerRegistration to let Firebase use firebase-messaging-sw.js automatically
      });

      if (newToken) {
        logger.debug('Generated new FCM token for user', {
          userId,
          tokenLength: newToken.length,
          tokenStart: newToken.substring(0, 10),
          endsWith: newToken.substring(newToken.length - 10)
        });

        // Save new token to user profile
        await this.saveFCMTokenToUser(userId, newToken);
        return newToken;
      } else {
        logger.warn('Failed to generate FCM token for user', { userId }, 'FCMService');
        return null;
      }
    } catch (error) {
      logger.error('Error regenerating FCM token for user', error, 'FCMService');
      return null;
    }
  }

  /**
   * Save FCM token to user profile
   */
  private async saveFCMTokenToUser(userId: string, fcmToken: string): Promise<void> {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@ubora/shared/firebaseConfig');
      
      await updateDoc(doc(db, 'users', userId), {
        fcmToken: fcmToken,
        fcmTokenUpdatedAt: new Date().toISOString()
      });
      logger.debug('Saved new FCM token for user', { userId }, 'FCMService');
    } catch (error) {
      logger.error('Error saving FCM token for user', error, 'FCMService');
    }
  }

  /**
   * Clear expired FCM token from user profile
   */
  private async clearExpiredFCMToken(userId: string): Promise<void> {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@ubora/shared/firebaseConfig');
      
      await updateDoc(doc(db, 'users', userId), {
        fcmToken: null,
        fcmTokenClearedAt: new Date().toISOString()
      });
      logger.debug('Cleared expired FCM token for user', { userId }, 'FCMService');
    } catch (error) {
      logger.error('Error clearing FCM token for user', error, 'FCMService');
    }
  }

  /**
   * Log FCM delivery attempt
   */
  private async logDelivery(deliveryLog: FCMDeliveryLog): Promise<void> {
    try {
      // Temporarily disabled delivery logging to avoid Firestore permissions error
      // await addDoc(collection(db, 'fcmDeliveryLogs'), deliveryLog);
      logger.debug('FCM delivery log (not saved to Firestore)', { deliveryLog }, 'FCMService');
    } catch (error) {
      logger.error('Error logging FCM delivery', error, 'FCMService');
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
      logger.error('Error getting FCM delivery logs', error, 'FCMService');
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
      logger.error('Error getting recent FCM delivery logs', error, 'FCMService');
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
    const notification: FCMNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      data: data || {},
      priority: 'high',
      ttl: 86400, // 24 hours
      ...options
    };

    // Set clickAction from redirectUrl if not explicitly provided
    if (notification.redirectUrl && !notification.clickAction) {
      notification.clickAction = notification.redirectUrl;
    }

    return notification;
  }

  /**
   * Send unified notification for form assignment
   */
  async sendFormAssignmentNotification(
    formId: string,
    formTitle: string,
    recipientId: string,
    action: 'assigned' | 'unassigned',
    assignedByName: string
  ): Promise<FCMDeliveryLog | null> {
    const isAssigned = action === 'assigned';
    const title = isAssigned ? 'Nouveau formulaire assigné' : 'Formulaire désassigné';
    const body = isAssigned 
      ? `${assignedByName} vous a assigné le formulaire "${formTitle}"`
      : `Vous n'êtes plus assigné au formulaire "${formTitle}"`;

    const notification = this.createNotification(
      title,
      body,
      {
        formId,
        formTitle,
        assignedByName,
        action,
        type: 'form_assignment',
        redirectUrl: '/forms',
        clickAction: '/forms',
        highlightForm: true
      }
    );

    return await this.sendToUser(notification, recipientId);
  }

  /**
   * Send unified notification for form reminder
   */
  async sendFormReminderNotification(
    formId: string,
    formTitle: string,
    recipientId: string,
    recipientRole: 'directeur' | 'employe',
    reminderType: '1h' | '30min' | '15min' | '5min'
  ): Promise<FCMDeliveryLog | null> {
    const title = 'Rappel de formulaire';
    const body = `N'oubliez pas de remplir: "${formTitle}" (${reminderType} restant)`;

    const notification = this.createNotification(
      title,
      body,
      {
        formId,
        formTitle,
        reminderType,
        type: 'form_reminder',
        redirectUrl: recipientRole === 'directeur' ? '/directeur/dashboard' : '/employe/dashboard',
        clickAction: recipientRole === 'directeur' ? '/directeur/dashboard' : '/employe/dashboard',
        action: 'fill_form'
      }
    );

    return await this.sendToUser(notification, recipientId);
  }

  /**
   * Send unified notification for metric reminder
   */
  async sendMetricReminderNotification(
    dashboardId: string,
    metricId: string,
    metricName: string,
    metricValue: number,
    recipientId: string
  ): Promise<FCMDeliveryLog | null> {
    const title = 'Rappel de métrique';
    const body = `Métrique "${metricName}": ${metricValue}`;

    const notification = this.createNotification(
      title,
      body,
      {
        dashboardId,
        metricId,
        metricName,
        metricValue,
        type: 'metric_reminder',
        redirectUrl: `/dashboard/${dashboardId}`,
        clickAction: `/dashboard/${dashboardId}`,
        action: 'highlight_metric'
      }
    );

    return await this.sendToUser(notification, recipientId);
  }

  /**
   * Send unified notification for programmed instruction
   */
  async sendProgrammedInstructionNotification(
    instructionId: string,
    instructionTitle: string,
    recipientId: string
  ): Promise<FCMDeliveryLog | null> {
    const title = 'Instruction programmée exécutée';
    const body = `L'instruction "${instructionTitle}" a été exécutée et la réponse est disponible`;

    const notification = this.createNotification(
      title,
      body,
      {
        instructionId,
        instructionTitle,
        type: 'programmed_instruction',
        redirectUrl: `/instructions/${instructionId}/response`,
        clickAction: `/instructions/${instructionId}/response`,
        action: 'show_response'
      }
    );

    return await this.sendToUser(notification, recipientId);
  }

  /**
   * Send unified notification (generic method for all 4 types)
   */
  async sendUnifiedNotification(
    type: 'form_assignment' | 'form_reminder' | 'metric_reminder' | 'programmed_instruction',
    recipientId: string,
    data: Record<string, any>
  ): Promise<FCMDeliveryLog | null> {
    const notification = this.createNotification(
      data.title,
      data.body,
      {
        ...data,
        type,
        redirectUrl: data.redirectUrl,
        clickAction: data.redirectUrl
      }
    );

    return await this.sendToUser(notification, recipientId);
  }
}

export const fcmService = FCMService.getInstance();


