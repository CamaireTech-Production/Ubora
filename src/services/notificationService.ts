import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
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

class NotificationService {
  private readonly collectionName = 'notifications';

  /**
   * Send notification to specific user
   */
  async sendToUser(userId: string, notification: Omit<NotificationData, 'id' | 'read' | 'createdAt'>, agencyId?: string): Promise<void> {
    try {
      await addDoc(collection(db, this.collectionName), {
        ...notification,
        recipientId: userId,
        agencyId: agencyId,
        read: false,
        createdAt: serverTimestamp(),
      });

      // Also send push notification via API
      await this.sendPushNotification([userId], notification.title, notification.body, notification.data);
    } catch (error) {
      console.error('🔔 [NotificationService] Error sending to user:', error);
      throw error;
    }
  }

  /**
   * Send notification to all users with specific role
   */
  async sendToRole(role: 'directeur' | 'employe', notification: Omit<NotificationData, 'id' | 'read' | 'createdAt'>, agencyId?: string): Promise<void> {
    try {
      await addDoc(collection(db, this.collectionName), {
        ...notification,
        recipientRole: role,
        agencyId: agencyId,
        read: false,
        createdAt: serverTimestamp(),
      });

      // Also send push notification via API
      await this.sendPushNotification(null, notification.title, notification.body, notification.data, role);
    } catch (error) {
      console.error('🔔 [NotificationService] Error sending to role:', error);
      throw error;
    }
  }

  /**
   * Send push notification using FCM directly
   * Note: FCM from frontend can only send to current user, so we rely on Firestore real-time updates
   */
  private async sendPushNotification(
    userIds: string[] | null,
    title: string,
    body: string,
    data?: Record<string, any>,
    role?: 'directeur' | 'employe'
  ): Promise<void> {
    try {
      // Since FCM from frontend can only send to current user,
      // we rely on Firestore real-time updates to trigger notifications
      // The service worker will handle background notifications
      
      
      // The notification will be delivered through:
      // 1. Firestore real-time listeners (for in-app notifications)
      // 2. Service worker (for background notifications)
      // 3. FCM will automatically handle push notifications when the app is in background
      
    } catch (error) {
      console.error('🔔 [NotificationService] Push notification error:', error);
      // Don't throw here - we still want to save the notification to Firestore
    }
  }

  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(userId: string, limitCount: number = 50): Promise<NotificationData[]> {
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
      })) as NotificationData[];
    } catch (error) {
      console.error('🔔 [NotificationService] Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Get notifications for a specific role
   */
  async getRoleNotifications(role: 'directeur' | 'employe', limitCount: number = 50): Promise<NotificationData[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('recipientRole', '==', role),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as NotificationData[];
    } catch (error) {
      console.error('🔔 [NotificationService] Error getting role notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const notificationRef = doc(db, this.collectionName, notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('🔔 [NotificationService] Error marking as read:', error);
      throw error;
    }
  }

  /**
   * Helper methods for common notification types
   */
  async notifyFormSubmission(formId: string, formTitle: string, submitterName: string, directorId: string): Promise<void> {
    await this.sendToUser(directorId, {
      title: 'Nouvelle soumission',
      body: `${submitterName} a soumis le formulaire "${formTitle}"`,
      type: 'form_submission',
      data: { formId, submitterName, formTitle },
    });
  }

  async notifyDirectorMessage(message: string, employeeId: string): Promise<void> {
    await this.sendToUser(employeeId, {
      title: 'Message du directeur',
      body: message,
      type: 'director_message',
      data: { message },
    });
  }

  async notifySystemAlert(title: string, message: string, role?: 'directeur' | 'employe'): Promise<void> {
    if (role) {
      await this.sendToRole(role, {
        title,
        body: message,
        type: 'system_alert',
        data: { message },
      });
    } else {
      // Send to all users
      await this.sendToRole('directeur', {
        title,
        body: message,
        type: 'system_alert',
        data: { message },
      });
      await this.sendToRole('employe', {
        title,
        body: message,
        type: 'system_alert',
        data: { message },
      });
    }
  }

  /**
   * Notify employees when a form is assigned to them
   */
  async notifyFormAssignment(formId: string, formTitle: string, employeeIds: string[], directorName: string, agencyId?: string): Promise<void> {
    const notifications = employeeIds.map(employeeId => 
      this.sendToUser(employeeId, {
        title: 'Nouveau formulaire assigné',
        body: `${directorName} vous a assigné le formulaire "${formTitle}"`,
        type: 'form_assignment',
        data: { 
          formId, 
          formTitle, 
          directorName,
          action: 'form_assigned'
        },
      }, agencyId)
    );

    await Promise.all(notifications);
  }

  /**
   * Notify employees when a form is created and assigned to them
   */
  async notifyFormCreated(formId: string, formTitle: string, employeeIds: string[], directorName: string, agencyId?: string): Promise<void> {
    const notifications = employeeIds.map(employeeId => 
      this.sendToUser(employeeId, {
        title: 'Nouveau formulaire créé',
        body: `${directorName} a créé et vous a assigné le formulaire "${formTitle}"`,
        type: 'form_created',
        data: { 
          formId, 
          formTitle, 
          directorName,
          action: 'form_created'
        },
      }, agencyId)
    );

    await Promise.all(notifications);
  }

  /**
   * Notify employees when form assignment is updated
   */
  async notifyFormAssignmentUpdate(formId: string, formTitle: string, newEmployeeIds: string[], removedEmployeeIds: string[], directorName: string, agencyId?: string): Promise<void> {
    const notifications = [];

    // Notify newly assigned employees
    if (newEmployeeIds.length > 0) {
      const newAssignmentNotifications = newEmployeeIds.map(employeeId => 
        this.sendToUser(employeeId, {
          title: 'Formulaire assigné',
          body: `${directorName} vous a assigné le formulaire "${formTitle}"`,
          type: 'form_assignment',
          data: { 
            formId, 
            formTitle, 
            directorName,
            action: 'form_assigned'
          },
        }, agencyId)
      );
      notifications.push(...newAssignmentNotifications);
    }

    // Notify removed employees
    if (removedEmployeeIds.length > 0) {
      const removedAssignmentNotifications = removedEmployeeIds.map(employeeId => 
        this.sendToUser(employeeId, {
          title: 'Formulaire désassigné',
          body: `Vous n'êtes plus assigné au formulaire "${formTitle}"`,
          type: 'form_assignment',
          data: { 
            formId, 
            formTitle, 
            directorName,
            action: 'form_unassigned'
          },
        }, agencyId)
      );
      notifications.push(...removedAssignmentNotifications);
    }

    if (notifications.length > 0) {
      await Promise.all(notifications);
    }
  }
}

export const notificationService = new NotificationService();

