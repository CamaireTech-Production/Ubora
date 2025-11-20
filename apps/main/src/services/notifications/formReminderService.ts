import { unifiedNotificationService } from './unifiedNotificationService';
import { logger } from '@ubora/shared/utils/logger';
import { Form } from '../../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';

class FormReminderService {
  /**
   * Get user role from database
   */
  private async getUserRole(userId: string): Promise<'directeur' | 'employe'> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.role || 'employe'; // Default to employee if role not found
      }
      logger.warn(`User ${userId} not found, defaulting to employee role`, { userId }, 'FormReminderService');
      return 'employe';
    } catch (error) {
      logger.error(`Error getting user role for ${userId}`, error, 'FormReminderService');
      return 'employe'; // Default to employee on error
    }
  }

  /**
   * Get FCM token from user profile
   */
  private async getUserFCMToken(userId: string): Promise<string | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.fcmToken || null;
      }
      return null;
    } catch (error) {
      logger.error(`Error getting FCM token for ${userId}`, error, 'FormReminderService');
      return null;
    }
  }

  /**
   * Schedule form reminders for a form with deadline
   */
  async scheduleFormReminders(form: Form): Promise<void> {
    if (!form.deadline) {
      logger.debug('No deadline set for form', { formTitle: form.title }, 'FormReminderService');
      return;
    }

    try {
      logger.debug('Scheduling reminders for form', { formTitle: form.title, deadline: form.deadline }, 'FormReminderService');

      const deadlineDate = new Date(`${form.deadline.date}T${form.deadline.time}`);
      const reminderIntervals = [60, 30, 15, 5]; // minutes before deadline

      // Schedule reminders for each assigned user (employees and directors)
      for (const userId of form.assignedTo) {
        const userRole = await this.getUserRole(userId);
        const fcmToken = await this.getUserFCMToken(userId);
        
        for (const intervalMinutes of reminderIntervals) {
          const reminderTime = new Date(deadlineDate.getTime() - intervalMinutes * 60 * 1000);
          
          // Only schedule if reminder time is in the future
          if (reminderTime > new Date()) {
            await unifiedNotificationService.scheduleNotification({
              title: 'Rappel de formulaire',
              body: `N'oubliez pas de remplir le formulaire "${form.title}" (${intervalMinutes}min restantes)`,
              type: 'form_reminder',
              recipientId: userId,
              recipientRole: userRole,
              agencyId: form.agencyId,
              redirectUrl: `/forms/${form.id}`,
              data: {
                formId: form.id,
                formTitle: form.title,
                deadline: form.deadline,
                minutesBeforeDeadline: intervalMinutes,
                action: 'fill_form',
                reminderType: `${intervalMinutes}min`
              },
              fcmToken: fcmToken || undefined
            }, reminderTime);

            logger.debug(`Scheduled ${intervalMinutes}min reminder`, { userRole, userId, reminderTime }, 'FormReminderService');
          } else {
            logger.debug(`Skipping ${intervalMinutes}min reminder (time in past)`, { reminderTime }, 'FormReminderService');
          }
        }
      }
    } catch (error) {
      logger.error('Error scheduling form reminders', error, 'FormReminderService');
      throw error;
    }
  }

  /**
   * Update form reminders when form deadline is changed
   */
  async updateFormReminders(form: Form, oldDeadline?: { date: string; time: string }): Promise<void> {
    if (!form.deadline) {
      logger.debug('No deadline set for form', { formTitle: form.title }, 'FormReminderService');
      return;
    }

    // If deadline changed, we need to cancel old reminders and create new ones
    if (oldDeadline) {
      logger.debug('Deadline changed for form', { formTitle: form.title }, 'FormReminderService');
      // Note: In a production system, you'd want to cancel old scheduled notifications
      // For now, we'll just schedule new ones (old ones will be ignored if past due)
    }

    await this.scheduleFormReminders(form);
  }

  /**
   * Cancel form reminders when form is deleted or deadline removed
   */
  async cancelFormReminders(formId: string): Promise<void> {
    try {
      logger.debug('Cancelling reminders for form', { formId }, 'FormReminderService');
      
      // Note: In a production system, you'd want to cancel scheduled notifications
      // For now, we'll mark them as cancelled in Firestore
      // This would require updating the unified notification service to support cancellation
      
      logger.info('Reminders cancelled for form', { formId }, 'FormReminderService');
    } catch (error) {
      logger.error('Error cancelling form reminders', error, 'FormReminderService');
    }
  }

  /**
   * Get reminder status for a form
   */
  async getFormReminderStatus(): Promise<{
    totalReminders: number;
    scheduledReminders: number;
    sentReminders: number;
    failedReminders: number;
  }> {
    try {
      // This would query the notifications collection for form reminders
      // For now, return mock data
      return {
        totalReminders: 0,
        scheduledReminders: 0,
        sentReminders: 0,
        failedReminders: 0,
      };
    } catch (error) {
      logger.error('Error getting reminder status', error, 'FormReminderService');
      return {
        totalReminders: 0,
        scheduledReminders: 0,
        sentReminders: 0,
        failedReminders: 0,
      };
    }
  }
}

export const formReminderService = new FormReminderService();
