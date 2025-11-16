import { unifiedNotificationService } from './unifiedNotificationService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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
      console.warn(`🔔 [NotificationService] User ${userId} not found, defaulting to employee role`);
      return 'employe';
    } catch (error) {
      console.error(`🔔 [NotificationService] Error getting user role for ${userId}:`, error);
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
      console.warn(`🔔 [NotificationService] User ${userId} not found`);
      return null;
    } catch (error) {
      console.error(`🔔 [NotificationService] Error getting user data for ${userId}:`, error);
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
          console.log(`🔔 [NotificationService] Retrieved FCM token for user ${userId}:`, {
            length: fcmToken.length,
            startsWith: fcmToken.substring(0, 10),
            endsWith: fcmToken.substring(fcmToken.length - 10)
          });
          
          // Validate token format
          if (fcmToken.length < 100) {
            console.warn(`🔔 [NotificationService] FCM token appears invalid for user ${userId}, length: ${fcmToken.length}`);
            fcmToken = null;
          }
        }
        
        // If no valid token, try to regenerate one
        if (!fcmToken) {
          console.log(`🔔 [NotificationService] No valid FCM token for user ${userId}, attempting to regenerate...`);
          fcmToken = await this.regenerateFCMToken(userId);
        }
        
        return fcmToken;
      }
      console.warn(`🔔 [NotificationService] User ${userId} not found, no FCM token available`);
      return null;
    } catch (error) {
      console.error(`🔔 [NotificationService] Error getting FCM token for ${userId}:`, error);
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
      const { messaging } = await import('../firebaseConfig');
      
      const messagingInstance = await messaging;
      if (!messagingInstance) {
        console.warn(`🔔 [NotificationService] Messaging not available for user ${userId}`);
        return null;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
        console.warn(`🔔 [NotificationService] VAPID key not configured for user ${userId}`);
        return null;
      }

      // Get fresh FCM token
      const newToken = await getToken(messagingInstance, {
        vapidKey: vapidKey
        // Removed serviceWorkerRegistration to let Firebase use firebase-messaging-sw.js automatically
      });

      if (newToken) {
        console.log(`🔔 [NotificationService] Generated new FCM token for user ${userId}:`, {
          length: newToken.length,
          startsWith: newToken.substring(0, 10),
          endsWith: newToken.substring(newToken.length - 10)
        });

        // Save new token to user profile
        await this.saveFCMTokenToUser(userId, newToken);
        return newToken;
      } else {
        console.warn(`🔔 [NotificationService] Failed to generate FCM token for user ${userId}`);
        return null;
      }
    } catch (error) {
      console.error(`🔔 [NotificationService] Error regenerating FCM token for user ${userId}:`, error);
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
      console.log(`🔔 [NotificationService] Saved new FCM token for user ${userId}`);
    } catch (error) {
      console.error(`🔔 [NotificationService] Error saving FCM token for user ${userId}:`, error);
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
      console.error('🔔 [NotificationService] Error sending to user:', error);
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
      console.warn('🔔 [NotificationService] sendToRole is deprecated. Use unified notification service directly for role-based notifications.');
      
      // For now, just log that this method is deprecated
      console.log('🔔 [NotificationService] Role-based notification requested:', { role, notification });
    } catch (error) {
      console.error('🔔 [NotificationService] Error sending to role:', error);
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
      console.error('🔔 [NotificationService] Error getting user notifications:', error);
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
      console.error('🔔 [NotificationService] Error marking as read:', error);
      throw error;
    }
  }

  /**
   * Helper methods for common notification types (legacy methods - use unified service directly)
   */
  async notifyFormSubmission(): Promise<void> {
    console.warn('🔔 [NotificationService] notifyFormSubmission is deprecated. Use unified notification service directly.');
    // This would be handled by the unified system in the backend cron job
  }

  async notifyDirectorMessage(): Promise<void> {
    console.warn('🔔 [NotificationService] notifyDirectorMessage is deprecated. Use unified notification service directly.');
    // This would be handled by the unified system in the backend cron job
  }

  async notifySystemAlert(): Promise<void> {
    console.warn('🔔 [NotificationService] notifySystemAlert is deprecated. Use unified notification service directly.');
    // This would be handled by the unified system in the backend cron job
  }

  /**
   * Notify users when a form is assigned to them (legacy method - use unified service directly)
   * Now supports both employees and directors
   */
  async notifyFormAssignment(formId: string, formTitle: string, userIds: string[], directorName: string, agencyId?: string): Promise<void> {
    console.warn('🔔 [NotificationService] notifyFormAssignment is deprecated. Use unified notification service directly.');
    console.log('🔔 [NotificationService] notifyFormAssignment called:', {
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

          console.log('🔔 [NotificationService] Sending form assignment notification:', {
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

          console.log('🔔 [NotificationService] Form assignment notification sent successfully for userId:', userId);
        } catch (error) {
          const err: any = error;
          console.error('🔔 [NotificationService] Error sending form assignment notification:', {
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
    console.warn('🔔 [NotificationService] notifyFormCreated is deprecated. Use unified notification service directly.');
    
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
          console.error('🔔 [NotificationService] Error sending form creation notification:', err?.message || String(error));
        }
      })
    );
  }

  /**
   * Notify users when form assignment is updated (legacy method - use unified service directly)
   * Now supports both employees and directors
   */
  async notifyFormAssignmentUpdate(formId: string, formTitle: string, newUserIds: string[], removedUserIds: string[], directorName: string, agencyId?: string): Promise<void> {
    console.warn('🔔 [NotificationService] notifyFormAssignmentUpdate is deprecated. Use unified notification service directly.');
    console.log('🔔 [NotificationService] notifyFormAssignmentUpdate called:', {
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

          console.log('🔔 [NotificationService] Sending assignment notification:', {
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

          console.log('🔔 [NotificationService] Assignment notification sent successfully for userId:', userId);
        } catch (error) {
          const err: any = error;
          console.error('🔔 [NotificationService] Error sending form assignment notification:', {
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

          console.log('🔔 [NotificationService] Sending unassignment notification:', {
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

          console.log('🔔 [NotificationService] Unassignment notification sent successfully for userId:', userId);
        } catch (error) {
          const err: any = error;
          console.error('🔔 [NotificationService] Error sending form unassignment notification:', {
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

