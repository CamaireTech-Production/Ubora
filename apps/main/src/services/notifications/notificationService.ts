import { unifiedNotificationService } from './unifiedNotificationService';
import { logger } from '@ubora/shared/utils/logger';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';

export interface NotificationData {
  id?: string;
  title: string;
  body: string;
  type: 'form_submission' | 'director_message' | 'system_alert' | 'reminder' | 'form_assignment' | 'form_created';
  recipientId?: string;
  recipientRole?: 'directeur' | 'employe';
  data?: Record<string, any>;
  read: boolean;
  createdAt?: any;
}

/**
 * Legacy Notification Service - Wrapper around Unified Notification Service
 * This service maintains backward compatibility while using the unified system
 */
class NotificationService {

  private normalizeRole(role?: string): 'directeur' | 'employe' {
    return role === 'directeur' ? 'directeur' : 'employe';
  }

  /**
   * Get user role from database
   */
  private async getUserRole(userId: string): Promise<'directeur' | 'employe'> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return this.normalizeRole(userData.role);
      }
      logger.warn(`User ${userId} not found, defaulting to employee role`, { userId }, 'NotificationService');
      return 'employe';
    } catch (error) {
      logger.error(`Error getting user role for ${userId}`, error, 'NotificationService');
      return 'employe'; // Default to employee on error
    }
  }

  /**
   * Get user data from Firestore (including email)
   */
  private async getUserData(userId: string): Promise<{ email?: string; role?: string; agencyId?: string } | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          email: userData.email || undefined,
          role: this.normalizeRole(userData.role),
          agencyId: userData.agencyId
        };
      }
      logger.warn(`User ${userId} not found`, { userId }, 'NotificationService');
      return null;
    } catch (error) {
      logger.error(`Error getting user data for ${userId}`, error, 'NotificationService');
      return null;
    }
  }

  /**
   * Get FCM token from user profile with validation and regeneration
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getUserFCMToken(userId: string): Promise<string | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        let fcmToken = userData.fcmToken || null;
        
        if (fcmToken) {
          logger.debug(`Retrieved FCM token for user ${userId}`, {
            userId,
            length: fcmToken.length,
            startsWith: fcmToken.substring(0, 10),
            endsWith: fcmToken.substring(fcmToken.length - 10)
          });
          
          // Validate token format
          if (fcmToken.length < 100) {
            logger.warn(`FCM token appears invalid for user ${userId}`, { userId, length: fcmToken.length }, 'NotificationService');
            fcmToken = null;
          }
        }

        // If no valid token, try to regenerate one
        if (!fcmToken) {
          logger.debug(`No valid FCM token for user ${userId}, attempting to regenerate`, { userId }, 'NotificationService');
          fcmToken = await this.regenerateFCMToken(userId);
        }

        return fcmToken;
      }
      logger.warn(`User ${userId} not found, no FCM token available`, { userId }, 'NotificationService');
      return null;
    } catch (error) {
      logger.error(`Error getting FCM token for ${userId}`, error, 'NotificationService');
      return null;
    }
  }

  /**
   * Regenerate FCM token for user
   */
  private async regenerateFCMToken(userId: string): Promise<string | null> {
    try {
      // Import the push notification hook to get a fresh token
      const { getToken } = await import('firebase/messaging');
      const { messaging } = await import('@ubora/shared/firebaseConfig');
      
      const messagingInstance = await messaging;
      if (!messagingInstance) {
        logger.warn(`Messaging not available for user ${userId}`, { userId }, 'NotificationService');
        return null;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
        logger.warn(`VAPID key not configured for user ${userId}`, { userId }, 'NotificationService');
        return null;
      }

      // Get fresh FCM token
      const newToken = await getToken(messagingInstance, {
        vapidKey: vapidKey
        // Removed serviceWorkerRegistration to let Firebase use firebase-messaging-sw.js automatically
      });

      if (newToken) {
        logger.debug(`Generated new FCM token for user ${userId}`, {
          userId,
          length: newToken.length,
          startsWith: newToken.substring(0, 10),
          endsWith: newToken.substring(newToken.length - 10)
        });

        // Save new token to user profile
        await this.saveFCMTokenToUser(userId, newToken);
        return newToken;
      } else {
        logger.warn(`Failed to generate FCM token for user ${userId}`, { userId }, 'NotificationService');
        return null;
      }
    } catch (error) {
      logger.error(`Error regenerating FCM token for user ${userId}`, error, 'NotificationService');
      return null;
    }
  }

  /**
   * Save FCM token to user profile
   */
  private async saveFCMTokenToUser(userId: string, fcmToken: string): Promise<void> {
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', userId), {
        fcmToken: fcmToken,
        fcmTokenUpdatedAt: new Date().toISOString()
      });
      logger.info(`Saved new FCM token for user ${userId}`, { userId }, 'NotificationService');
    } catch (error) {
      logger.error(`Error saving FCM token for user ${userId}`, error, 'NotificationService');
    }
  }

  /**
   * Map legacy notification types to unified types
   */
  private mapLegacyTypeToUnified(legacyType: string): 'form_assignment' | 'form_reminder' | 'metric_reminder' | 'programmed_instruction' {
    switch (legacyType) {
      case 'form_assignment':
      case 'form_created':
        return 'form_assignment';
      case 'reminder':
        return 'form_reminder';
      case 'form_submission':
      case 'director_message':
      case 'system_alert':
      default:
        // For legacy types that don't map to unified types, use form_assignment as fallback
        return 'form_assignment';
    }
  }

  /**
   * Send notification to specific user (legacy method - uses unified service)
   */
  async sendToUser(userId: string, notification: Omit<NotificationData, 'id' | 'read' | 'createdAt'>, agencyId?: string): Promise<void> {
    try {
      // Map legacy notification types to unified types
      const unifiedType = this.mapLegacyTypeToUnified(notification.type);
      
      await unifiedNotificationService.sendNotification({
        title: notification.title,
        body: notification.body,
        type: unifiedType,
        recipientId: userId,
        recipientRole: notification.recipientRole,
        agencyId: agencyId || '',
        data: notification.data
      });
    } catch (error) {
      logger.error('Error sending to user', error, 'NotificationService');
      throw error;
    }
  }

  /**
   * Send notification to all users with specific role (legacy method - uses unified service)
   */
  async sendToRole(role: 'directeur' | 'employe', notification: Omit<NotificationData, 'id' | 'read' | 'createdAt'>): Promise<void> {
    try {
      // For role-based notifications, we need to get all users with that role
      // This is a simplified approach - in practice, you might want to use the unified service's role-based methods
      logger.warn('sendToRole is deprecated. Use unified notification service directly for role-based notifications.', { role }, 'NotificationService');
      
      // For now, just log that this method is deprecated
      logger.debug('Role-based notification requested', { role, notification }, 'NotificationService');
    } catch (error) {
      logger.error('Error sending to role', error, 'NotificationService');
      throw error;
    }
  }

  /**
   * Get notifications for a specific user (legacy method - uses unified service)
   */
  async getUserNotifications(userId: string, limitCount: number = 50): Promise<NotificationData[]> {
    try {
      const unifiedNotifications = await unifiedNotificationService.getUserNotifications(userId, limitCount);
      
      // Convert unified notifications to legacy format
      return unifiedNotifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.type as any, // Map unified type to legacy type
        recipientId: notification.recipientId,
        recipientRole: notification.recipientRole,
        data: notification.data,
        read: notification.read,
        createdAt: notification.createdAt
      }));
    } catch (error) {
      logger.error('Error getting user notifications', error, 'NotificationService');
      return [];
    }
  }

  /**
   * Mark notification as read (legacy method - uses unified service)
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await unifiedNotificationService.markAsRead(notificationId);
    } catch (error) {
      logger.error('Error marking as read', error, 'NotificationService');
      throw error;
    }
  }

  /**
   * Helper methods for common notification types (legacy methods - use unified service directly)
   */
  async notifyFormSubmission(): Promise<void> {
    logger.warn('notifyFormSubmission is deprecated. Use unified notification service directly.', undefined, 'NotificationService');
    // This would be handled by the unified system in the backend cron job
  }

  async notifyDirectorMessage(): Promise<void> {
    logger.warn('notifyDirectorMessage is deprecated. Use unified notification service directly.', undefined, 'NotificationService');
    // This would be handled by the unified system in the backend cron job
  }

  async notifySystemAlert(): Promise<void> {
    logger.warn('notifySystemAlert is deprecated. Use unified notification service directly.', undefined, 'NotificationService');
    // This would be handled by the unified system in the backend cron job
  }

  /**
   * Notify users when a form is assigned to them (legacy method - use unified service directly)
   * Now supports both employees and directors
   */
  async notifyFormAssignment(formId: string, formTitle: string, userIds: string[], directorName: string, agencyId?: string): Promise<void> {
    logger.warn('notifyFormAssignment is deprecated. Use unified notification service directly.', { formId }, 'NotificationService');
    logger.debug('notifyFormAssignment called', {
      formId,
      formTitle,
      userIds,
      directorName,
      agencyId
    });
    
    // Use unified service for form assignment notifications (batch all users)
    await Promise.allSettled(
      userIds.map(async (userId) => {
        try {
          const userData = await this.getUserData(userId);
          const userRole = this.normalizeRole(userData?.role);
          const agency = agencyId || userData?.agencyId || '';
          const email = userData?.email;

          logger.debug('Sending form assignment notification', {
            formId,
            formTitle,
            userId,
            userRole,
            agencyId: agency,
            email: email || 'none'
          });

          await unifiedNotificationService.createFormAssignmentNotification(
            formId,
            formTitle,
            userId,
            userRole,
            agency,
            'assigned',
            directorName,
            email
          );

          logger.info('Form assignment notification sent successfully', { userId }, 'NotificationService');
        } catch (error) {
          const err: any = error;
          logger.error('Error sending form assignment notification', {
            userId,
            formId,
            error: err?.message || String(error),
            stack: err?.stack
          });
        }
      })
    );
  }

  /**
   * Notify users when a form is created and assigned to them (legacy method - use unified service directly)
   * Now supports both employees and directors
   */
  async notifyFormCreated(formId: string, formTitle: string, userIds: string[], directorName: string, agencyId?: string): Promise<void> {
    logger.warn('notifyFormCreated is deprecated. Use unified notification service directly.', { formId }, 'NotificationService');
    
    // Use unified service for form creation notifications (batch all users)
    await Promise.allSettled(
      userIds.map(async (userId) => {
        try {
          const userData = await this.getUserData(userId);
          const userRole = this.normalizeRole(userData?.role);
          const agency = agencyId || userData?.agencyId || '';
          const email = userData?.email;

          await unifiedNotificationService.createFormAssignmentNotification(
            formId,
            formTitle,
            userId,
            userRole,
            agency,
            'assigned',
            directorName,
            email
          );
        } catch (error) {
          const err: any = error;
          logger.error('Error sending form creation notification', err?.message || String(error), 'NotificationService');
        }
      })
    );
  }

  /**
   * Notify users when form assignment is updated (legacy method - use unified service directly)
   * Now supports both employees and directors
   */
  async notifyFormAssignmentUpdate(formId: string, formTitle: string, newUserIds: string[], removedUserIds: string[], directorName: string, agencyId?: string): Promise<void> {
    logger.warn('notifyFormAssignmentUpdate is deprecated. Use unified notification service directly.', { formId }, 'NotificationService');
    logger.debug('notifyFormAssignmentUpdate called', {
      formId,
      formTitle,
      newUserIds,
      removedUserIds,
      directorName,
      agencyId
    });
    
    // Notify newly assigned users (batch)
    await Promise.allSettled(
      newUserIds.map(async (userId) => {
        try {
          const userData = await this.getUserData(userId);
          const userRole = this.normalizeRole(userData?.role);
          const agency = agencyId || userData?.agencyId || '';
          const email = userData?.email;

          logger.debug('Sending assignment notification', {
            formId,
            formTitle,
            userId,
            userRole,
            agencyId: agency,
            email: email || 'none',
            action: 'assigned'
          });

          await unifiedNotificationService.createFormAssignmentNotification(
            formId,
            formTitle,
            userId,
            userRole,
            agency,
            'assigned',
            directorName,
            email
          );

          logger.info('Assignment notification sent successfully', { userId }, 'NotificationService');
        } catch (error) {
          const err: any = error;
          logger.error('Error sending form assignment notification', {
            userId,
            formId,
            error: err?.message || String(error),
            stack: err?.stack
          });
        }
      })
    );

    // Notify removed users (batch)
    await Promise.allSettled(
      removedUserIds.map(async (userId) => {
        try {
          const userData = await this.getUserData(userId);
          const userRole = this.normalizeRole(userData?.role);
          const agency = agencyId || userData?.agencyId || '';
          const email = userData?.email;

          logger.debug('Sending unassignment notification', {
            formId,
            formTitle,
            userId,
            userRole,
            agencyId: agency,
            email: email || 'none',
            action: 'unassigned'
          });

          await unifiedNotificationService.createFormAssignmentNotification(
            formId,
            formTitle,
            userId,
            userRole,
            agency,
            'unassigned',
            directorName,
            email
          );

          logger.info('Unassignment notification sent successfully', { userId }, 'NotificationService');
        } catch (error) {
          const err: any = error;
          logger.error('Error sending form unassignment notification', {
            userId,
            formId,
            error: err?.message || String(error),
            stack: err?.stack
          });
        }
      })
    );
  }
}

export const notificationService = new NotificationService();

