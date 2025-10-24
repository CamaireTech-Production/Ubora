import { unifiedNotificationService, UnifiedNotification } from './unifiedNotificationService';

class NotificationCronService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private currentUserId: string | null = null;
  private currentAgencyId: string | null = null;

  /**
   * Start the smart cron job
   */
  start(userId: string, agencyId: string): void {
    if (this.isRunning && this.currentUserId === userId) {
      console.log('🕐 [NotificationCron] Service already running for user:', userId);
      return;
    }

    // Stop previous service if running
    if (this.isRunning) {
      this.stop();
    }

    // console.log('🚀 [NotificationCron] Starting smart cron job for user:', userId);
    this.isRunning = true;
    this.currentUserId = userId;
    this.currentAgencyId = agencyId;

    // Start the cron job
    this.scheduleNextCheck();
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.currentUserId = null;
    this.currentAgencyId = null;
    // console.log('🛑 [NotificationCron] Smart cron job stopped');
  }

  /**
   * Schedule the next check based on dynamic intervals
   */
  private scheduleNextCheck(): void {
    if (!this.isRunning) return;

    const nextInterval = this.getNextCheckInterval();
    
    this.intervalId = setTimeout(async () => {
      if (this.isRunning) {
        await this.checkScheduledNotifications();
        this.scheduleNextCheck();
      }
    }, nextInterval);

    // console.log(`🕐 [NotificationCron] Next check in ${nextInterval}ms (${Math.round(nextInterval / 1000)}s)`);
  }

  /**
   * Check for scheduled notifications and send them
   */
  private async checkScheduledNotifications(): Promise<void> {
    try {
      // console.log('🔍 [NotificationCron] Checking for due notifications...');
      
      if (!this.currentAgencyId) {
        // console.log('🔍 [NotificationCron] No agency ID, skipping check');
        return;
      }
      
      const dueNotifications = await unifiedNotificationService.getDueNotifications(this.currentAgencyId);
      
      if (dueNotifications.length === 0) {
        // console.log('🔍 [NotificationCron] No due notifications found');
        return;
      }

      // console.log(`🔍 [NotificationCron] Found ${dueNotifications.length} due notifications`);

      // Send all due notifications
      for (const notification of dueNotifications) {
        try {
          await unifiedNotificationService.sendScheduledNotification(notification);
          console.log(`✅ [NotificationCron] Sent notification: ${notification.title}`);
        } catch (error) {
          console.error(`❌ [NotificationCron] Failed to send notification: ${notification.title}`, error);
        }
      }
    } catch (error) {
      console.error('❌ [NotificationCron] Error checking scheduled notifications:', error);
    }
  }

  /**
   * Calculate the next check interval based on urgency
   * Smart intervals: 5s, 30s, 5min, 30min
   */
  private async getNextCheckInterval(): Promise<number> {
    try {
      if (!this.currentAgencyId) {
        return 30 * 60 * 1000; // Default 30 minutes if no agency
      }

      // Get the next scheduled notification
      const dueNotifications = await unifiedNotificationService.getDueNotifications(this.currentAgencyId);
      
      if (dueNotifications.length === 0) {
        // No immediate notifications, check every 30 minutes
        return 30 * 60 * 1000; // 30 minutes
      }

      const now = new Date();
      const nextNotification = dueNotifications[0];
      
      if (!nextNotification.scheduledFor) {
        return 5 * 60 * 1000; // 5 minutes fallback
      }

      const timeUntilDue = nextNotification.scheduledFor.getTime() - now.getTime();
      
      // If notification is due now or overdue, check every 5 seconds
      if (timeUntilDue <= 0) {
        return 5 * 1000; // 5 seconds
      }
      
      // If notification is due within 30 seconds, check every 5 seconds
      if (timeUntilDue <= 30 * 1000) {
        return 5 * 1000; // 5 seconds
      }
      
      // If notification is due within 5 minutes, check every 30 seconds
      if (timeUntilDue <= 5 * 60 * 1000) {
        return 30 * 1000; // 30 seconds
      }
      
      // If notification is due within 1 hour, check every 5 minutes
      if (timeUntilDue <= 60 * 60 * 1000) {
        return 5 * 60 * 1000; // 5 minutes
      }
      
      // For long-term notifications, check every 30 minutes
      return 30 * 60 * 1000; // 30 minutes
    } catch (error) {
      console.error('❌ [NotificationCron] Error calculating next interval:', error);
      return 5 * 60 * 1000; // 5 minutes fallback
    }
  }

  /**
   * Get current status
   */
  getStatus(): { isRunning: boolean; userId: string | null; agencyId: string | null } {
    return {
      isRunning: this.isRunning,
      userId: this.currentUserId,
      agencyId: this.currentAgencyId,
    };
  }

  /**
   * Force check for due notifications (for testing)
   */
  async forceCheck(): Promise<void> {
    console.log('🔍 [NotificationCron] Force checking for due notifications...');
    await this.checkScheduledNotifications();
  }
}

export const notificationCronService = new NotificationCronService();
