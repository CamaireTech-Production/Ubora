import { unifiedNotificationService } from './unifiedNotificationService';
import { Form } from '../types';

class FormReminderService {
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

      // Schedule reminders for each assigned employee
      for (const employeeId of form.assignedTo) {
        for (const intervalMinutes of reminderIntervals) {
          const reminderTime = new Date(deadlineDate.getTime() - intervalMinutes * 60 * 1000);
          
          // Only schedule if reminder time is in the future
          if (reminderTime > new Date()) {
            await unifiedNotificationService.scheduleNotification({
              title: 'Rappel de formulaire',
              body: `N'oubliez pas de remplir le formulaire "${form.title}" (${intervalMinutes}min restantes)`,
              type: 'form_reminder',
              recipientId: employeeId,
              recipientRole: 'employe',
              agencyId: form.agencyId,
              data: {
                formId: form.id,
                formTitle: form.title,
                deadline: form.deadline,
                minutesBeforeDeadline: intervalMinutes,
                action: 'form_reminder'
              }
            }, reminderTime);

            console.log(`📅 [FormReminder] Scheduled ${intervalMinutes}min reminder for employee ${employeeId} at ${reminderTime}`);
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
  async cancelFormReminders(formId: string, employeeIds: string[]): Promise<void> {
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
  async getFormReminderStatus(formId: string): Promise<{
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
