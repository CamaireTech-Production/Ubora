import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface NotificationData {
  id?: string;
  title: string;
  body: string;
  type: 'form_submission' | 'director_message' | 'system_alert' | 'reminder';
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
  async sendToUser(userId: string, notification: Omit<NotificationData, 'id' | 'read' | 'createdAt'>): Promise<void> {
    try {
      await addDoc(collection(db, this.collectionName), {
        ...notification,
        recipientId: userId,
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
  async sendToRole(role: 'directeur' | 'employe', notification: Omit<NotificationData, 'id' | 'read' | 'createdAt'>): Promise<void> {
    try {
      await addDoc(collection(db, this.collectionName), {
        ...notification,
        recipientRole: role,
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
   * Send push notification via API
   */
  private async sendPushNotification(
    userIds: string[] | null,
    title: string,
    body: string,
    data?: Record<string, any>,
    role?: 'directeur' | 'employe'
  ): Promise<void> {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds,
          title,
          body,
          data,
          role,
        }),
      });

      if (!response.ok) {
        throw new Error(`Push notification failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🔔 [NotificationService] Push notification sent:', result);
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
}

export const notificationService = new NotificationService();

