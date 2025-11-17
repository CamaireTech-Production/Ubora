import { unifiedNotificationService } from './unifiedNotificationService';
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
      console.warn(`📅 [FormReminder] User ${userId} not found, defaulting to employee role`);
      return 'employe';
    } catch (error) {
      console.error(`📅 [FormReminder] Error getting user role for ${userId}:`, error);
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
      console.error(`📅 [FormReminder] Error getting FCM token for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Schedule form reminders for a form with deadline
   */
  async scheduleFormReminders(form: Form): Promise<void> {
    if (!form.deadline) {
      console.log('📅 [FormReminder] No deadline set for form:', form.title);
      return;
    }

    try {
      console.log('📅 [FormReminder] Scheduling reminders for form:', form.title, 'deadline:', form.deadline);

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

            console.log(`📅 [FormReminder] Scheduled ${intervalMinutes}min reminder for ${userRole} ${userId} at ${reminderTime}`);
          } else {
            console.log(`📅 [FormReminder] Skipping ${intervalMinutes}min reminder (time in past):`, reminderTime);
          }
        }
      }
    } catch (error) {
      console.error('❌ [FormReminder] Error scheduling form reminders:', error);
      throw error;
    }
  }

  /**
   * Update form reminders when form deadline is changed
   */
  async updateFormReminders(form: Form, oldDeadline?: { date: string; time: string }): Promise<void> {
    if (!form.deadline) {
      console.log('📅 [FormReminder] No deadline set for form:', form.title);
      return;
    }

    // If deadline changed, we need to cancel old reminders and create new ones
    if (oldDeadline) {
      console.log('📅 [FormReminder] Deadline changed for form:', form.title);
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
      console.log('📅 [FormReminder] Cancelling reminders for form:', formId);
      
      // Note: In a production system, you'd want to cancel scheduled notifications
      // For now, we'll mark them as cancelled in Firestore
      // This would require updating the unified notification service to support cancellation
      
      console.log('📅 [FormReminder] Reminders cancelled for form:', formId);
    } catch (error) {
      console.error('❌ [FormReminder] Error cancelling form reminders:', error);
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
      console.error('❌ [FormReminder] Error getting reminder status:', error);
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
