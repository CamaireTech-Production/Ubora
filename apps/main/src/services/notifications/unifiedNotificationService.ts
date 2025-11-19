import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { logger } from '@ubora/shared/utils/logger';
import { browserNotificationService } from './browserNotificationService';
import { emailNotificationService } from './emailNotificationService';

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
  // Email address for email notification delivery
  emailAddress?: string;
}

interface NotificationDeliveryResult {
  browser: { success: boolean; error?: string };
  email: { success: boolean; error?: string };
  overallSuccess: boolean;
}

class UnifiedNotificationService {
  private readonly collectionName = 'notifications';
  private normalizeRole(role?: string): 'directeur' | 'employe' {
    return role === 'directeur' ? 'directeur' : 'employe';
  }

  /**
   * Send notification immediately (main entry point for all notifications)
   * Implements dual delivery strategy: Browser → Email (both methods attempted)
   */
  async sendNotification(notification: Omit<UnifiedNotification, 'id' | 'read' | 'createdAt' | 'status' | 'sentAt'>): Promise<string> {
    try {
      logger.info('Starting dual delivery', { title: notification.title }, 'UnifiedNotification');

      // Initialize delivery tracking
      const deliveryResult: NotificationDeliveryResult = {
        browser: { success: false },
        email: { success: false },
        overallSuccess: false
      };

      // Build idempotency key to avoid duplicate creations/deliveries on retries
      const idempotencyKey = JSON.stringify({
        t: notification.type,
        r: notification.recipientId,
        a: notification.agencyId,
        role: this.normalizeRole(notification.recipientRole),
        formId: notification.data?.formId,
        action: notification.data?.action,
        title: notification.title,
        body: notification.body,
      });

      // Idempotency check: reuse existing doc if same key exists recently
      try {
        const existingQ = query(
          collection(db, this.collectionName),
          where('idempotencyKey', '==', idempotencyKey),
          limit(1)
        );
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
          const existing = existingSnap.docs[0];
          logger.debug('Idempotent hit, skipping duplicate creation', { existingId: existing.id }, 'UnifiedNotification');
          return existing.id;
        }
      } catch (idErr) {
        logger.warn('Idempotency check failed, proceeding', idErr, 'UnifiedNotification');
      }

      // Store notification in Firestore first
      const notificationData = {
        title: notification.title,
        body: notification.body,
        type: notification.type,
        recipientId: notification.recipientId,
        recipientRole: this.normalizeRole(notification.recipientRole),
        agencyId: notification.agencyId,
        data: notification.data,
        redirectUrl: notification.redirectUrl,
        read: false,
        status: 'sent' as const,
        createdAt: serverTimestamp(),
        sentAt: serverTimestamp(),
        idempotencyKey,
      };

      const docRef = await addDoc(collection(db, this.collectionName), notificationData);
      logger.info('Notification stored in Firestore', {
        id: docRef.id,
        recipientId: notification.recipientId,
        recipientRole: notification.recipientRole,
        agencyId: notification.agencyId,
        type: notification.type,
        title: notification.title
      }, 'UnifiedNotification');

      // Method 1: Browser Notification (Primary - Immediate)
      try {
        logger.debug('Method 1: Attempting browser notification', undefined, 'UnifiedNotification');
        await this.sendBrowserNotification({
          ...notification,
          read: false,
          status: 'sent',
          createdAt: new Date(),
          sentAt: new Date(),
        });
        deliveryResult.browser.success = true;
        logger.info('Method 1: Browser notification sent successfully', undefined, 'UnifiedNotification');
      } catch (browserError) {
        deliveryResult.browser.error = browserError instanceof Error ? browserError.message : String(browserError);
        logger.error('Method 1: Browser notification failed', browserError, 'UnifiedNotification');
      }

      // Method 2: Email Notification (Secondary - Universal Delivery)
      if (notification.emailAddress) {
        try {
          logger.debug('Method 2: Attempting email notification', undefined, 'UnifiedNotification');
          await this.sendEmailNotification({
            ...notification,
            read: false,
            status: 'sent',
            createdAt: new Date(),
            sentAt: new Date(),
          });
          deliveryResult.email.success = true;
          logger.info('Method 2: Email notification sent successfully', undefined, 'UnifiedNotification');
        } catch (emailError) {
          deliveryResult.email.error = emailError instanceof Error ? emailError.message : String(emailError);
          logger.error('Method 2: Email notification failed', emailError, 'UnifiedNotification');
        }
      } else {
        logger.debug('Method 2: Skipping email (no email address provided)', undefined, 'UnifiedNotification');
      }

      // Determine overall success
      deliveryResult.overallSuccess = deliveryResult.browser.success || deliveryResult.email.success;

      // Log final delivery summary
      logger.info('Delivery Summary', {
        notificationId: docRef.id,
        title: notification.title,
        methods: {
          browser: deliveryResult.browser.success,
          email: deliveryResult.email.success
        },
        overallSuccess: deliveryResult.overallSuccess
      }, 'UnifiedNotification');

      if (!deliveryResult.overallSuccess) {
        logger.warn('All delivery methods failed', { notificationId: docRef.id }, 'UnifiedNotification');
      }

      return docRef.id;
    } catch (error) {
      logger.error('Critical error in sendNotification', error, 'UnifiedNotification');
      
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
        logger.error('Error storing failed notification', storeError, 'UnifiedNotification');
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
      logger.info('Scheduling notification', { title: notification.title, scheduledFor }, 'UnifiedNotification');

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
      
      logger.info('Notification scheduled successfully', { notificationId: docRef.id }, 'UnifiedNotification');
      return docRef.id;
    } catch (error) {
      logger.error('Error scheduling notification', error, 'UnifiedNotification');
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
      logger.error('Error getting due notifications', error, 'UnifiedNotification');
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
      logger.error('Error getting missed notifications', error, 'UnifiedNotification');
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
      logger.info('Sending scheduled notification', { title: notification.title, notificationId: notification.id }, 'UnifiedNotification');

      // Update status to sent
      await updateDoc(doc(db, this.collectionName, notification.id), {
        status: 'sent',
        sentAt: serverTimestamp(),
      });

      // Display notification
      await this.displayNotification(notification);
      
      logger.info('Scheduled notification sent successfully', { notificationId: notification.id }, 'UnifiedNotification');
    } catch (error) {
      logger.error('Error sending scheduled notification', error, 'UnifiedNotification');
      
      // Mark as failed
      try {
        await updateDoc(doc(db, this.collectionName, notification.id), {
          status: 'failed',
        });
      } catch (updateError) {
        logger.error('Error marking notification as failed', updateError, 'UnifiedNotification');
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
      logger.info('Sending missed notification', { title: notification.title, notificationId: notification.id }, 'UnifiedNotification');

      // Update status to delayed
      await updateDoc(doc(db, this.collectionName, notification.id), {
        status: 'delayed',
        sentAt: serverTimestamp(),
      });

      // Display notification
      await this.displayNotification(notification);
      
      logger.info('Missed notification sent successfully', { notificationId: notification.id }, 'UnifiedNotification');
    } catch (error) {
      logger.error('Error sending missed notification', error, 'UnifiedNotification');
      
      // Mark as failed
      try {
        await updateDoc(doc(db, this.collectionName, notification.id), {
          status: 'failed',
        });
      } catch (updateError) {
        logger.error('Error marking missed notification as failed', updateError, 'UnifiedNotification');
      }
      
      throw error;
    }
  }


  /**
   * Display notification via service worker (used for scheduled notifications)
   */
  private async displayNotification(notification: Omit<UnifiedNotification, 'id'>): Promise<void> {
    // Use browser notification service for scheduled notifications
    try {
      await this.sendBrowserNotification(notification);
    } catch (error) {
      logger.error('Error displaying notification', error, 'UnifiedNotification');
    }
  }

  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(userId: string, limitCount: number = 50): Promise<UnifiedNotification[]> {
    try {
      logger.debug('Getting notifications for userId', { userId }, 'UnifiedNotification');
      const q = query(
        collection(db, this.collectionName),
        where('recipientId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      logger.debug('Query result', {
        userId: userId,
        notificationCount: snapshot.docs.length,
        notifications: snapshot.docs.map(doc => ({
          id: doc.id,
          recipientId: doc.data().recipientId,
          recipientRole: doc.data().recipientRole,
          type: doc.data().type,
          title: doc.data().title,
          status: doc.data().status
        }))
      }, 'UnifiedNotification');
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      })) as UnifiedNotification[];
    } catch (error) {
      logger.error('Error getting user notifications', error, 'UnifiedNotification');
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
      logger.error('Error marking notification as read', error, 'UnifiedNotification');
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
      logger.error('Error getting unread count', error, 'UnifiedNotification');
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
    emailAddress?: string
  ): Promise<string> {
    logger.debug('createFormAssignmentNotification called', {
      formId,
      formTitle,
      recipientId,
      recipientRole,
      agencyId,
      action,
      assignedByName,
      emailAddress: emailAddress || 'none'
    }, 'UnifiedNotification');
    
    const isAssigned = action === 'assigned';
    const title = isAssigned ? 'Nouveau formulaire assigné' : 'Formulaire désassigné';
    const body = isAssigned 
      ? `${assignedByName} vous a assigné le formulaire "${formTitle}"`
      : `Vous n'êtes plus assigné au formulaire "${formTitle}"`;

    logger.debug('Creating notification with', {
      title,
      body,
      type: 'form_assignment',
      recipientId,
      recipientRole,
      agencyId,
      emailAddress: emailAddress || 'none'
    }, 'UnifiedNotification');

    return await this.sendNotification({
      title,
      body,
      type: 'form_assignment',
      recipientId,
      recipientRole: this.normalizeRole(recipientRole),
      agencyId,
      redirectUrl: '/forms',
      emailAddress,
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
    emailAddress?: string
  ): Promise<string> {
    const title = 'Rappel de formulaire';
    const body = `N'oubliez pas de remplir: "${formTitle}" (${reminderType} restant)`;

    return await this.sendNotification({
      title,
      body,
      type: 'form_reminder',
      recipientId,
      recipientRole: this.normalizeRole(recipientRole),
      agencyId,
      redirectUrl: recipientRole === 'directeur' ? '/directeur/dashboard' : '/employe/dashboard',
      emailAddress,
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
    emailAddress?: string
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
      emailAddress,
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
    emailAddress?: string
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
      emailAddress,
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
      logger.debug('Sending browser notification', { title: notification.title }, 'UnifiedNotification');

      // Check if browser notifications are supported
      if (!browserNotificationService.isBrowserNotificationSupported()) {
        logger.warn('Browser notifications not supported', undefined, 'UnifiedNotification');
        return;
      }

      // Check permission
      const permission = browserNotificationService.getPermissionStatus();
      if (permission !== 'granted') {
        logger.warn('Browser notification permission not granted', { permission }, 'UnifiedNotification');
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
        logger.info('Browser notification sent successfully', { title: notification.title }, 'UnifiedNotification');
      } else {
        logger.error('Browser notification failed', undefined, 'UnifiedNotification');
      }

    } catch (error) {
      logger.error('Error sending browser notification', error, 'UnifiedNotification');
      throw error;
    }
  }

  /**
   * Send email notification using the email notification service
   */
  private async sendEmailNotification(notification: Omit<UnifiedNotification, 'id'>): Promise<void> {
    if (!notification.emailAddress) {
      throw new Error('No email address provided');
    }

    try {
      logger.debug('Sending email notification', { 
        title: notification.title, 
        emailAddress: notification.emailAddress 
      }, 'UnifiedNotification');

      // Create email content based on notification type
      const emailContent = this.createEmailContent(notification);
      
      const success = await emailNotificationService.sendEmail({
        to: notification.emailAddress,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      if (!success) {
        throw new Error('Failed to send email notification');
      }

      logger.info('Email notification sent successfully', { 
        title: notification.title,
        emailAddress: notification.emailAddress 
      }, 'UnifiedNotification');
    } catch (error) {
      logger.error('Error sending email notification', error, 'UnifiedNotification');
      throw error;
    }
  }

  /**
   * Create email content based on notification type
   */
  private createEmailContent(notification: Omit<UnifiedNotification, 'id'>): { subject: string; html: string; text: string } {
    const subject = `Ubora - ${notification.title}`;
    
    // Create HTML content with styling
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Ubora</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <h2 style="color: #1e293b; margin-top: 0;">${notification.title}</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">${notification.body}</p>
          
          ${notification.redirectUrl ? `
            <div style="margin: 30px 0;">
              <a href="${notification.redirectUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
                Ouvrir dans Ubora
              </a>
            </div>
          ` : ''}
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            📧 Notification ${notification.type.replace('_', ' ')} • Envoyé depuis Ubora App
          </p>
        </div>
      </div>
    `;
    
    // Create plain text version
    const text = `${notification.title}\n\n${notification.body}\n\n${notification.redirectUrl ? `Ouvrir: ${notification.redirectUrl}\n\n` : ''}Envoyé depuis Ubora App - ${notification.type.replace('_', ' ')}`;
    
    return { subject, html, text };
  }
}

export const unifiedNotificationService = new UnifiedNotificationService();



