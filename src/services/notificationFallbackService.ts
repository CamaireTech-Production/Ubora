import { unifiedNotificationService, UnifiedNotification } from './unifiedNotificationService';

class NotificationFallbackService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private currentUserId: string | null = null;
  private currentAgencyId: string | null = null;

  /**
   * Start the fallback service
   */
  start(userId: string, agencyId: string): void {
    if (this.isRunning && this.currentUserId === userId) {
      console.log('🔄 [NotificationFallback] Service already running for user:', userId);
      return;
    }

    // Stop previous service if running
    if (this.isRunning) {
      this.stop();
    }

    // console.log('🚀 [NotificationFallback] Starting fallback service for user:', userId);
    this.isRunning = true;
    this.currentUserId = userId;
    this.currentAgencyId = agencyId;

    // Run immediately
    this.checkMissedNotifications();

    // Then run every 10 minutes
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.checkMissedNotifications();
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Stop the fallback service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.currentUserId = null;
    this.currentAgencyId = null;
    // console.log('🛑 [NotificationFallback] Fallback service stopped');
  }

  /**
   * Check for missed notifications and send them
   */
  private async checkMissedNotifications(): Promise<void> {
    try {
      // console.log('🔍 [NotificationFallback] Checking for missed notifications...');
      
      if (!this.currentAgencyId) {
        // console.log('🔍 [NotificationFallback] No agency ID, skipping check');
        return;
      }
      
      const missedNotifications = await unifiedNotificationService.getMissedNotifications(this.currentAgencyId);
      
      if (missedNotifications.length === 0) {
        // console.log('🔍 [NotificationFallback] No missed notifications found');
        return;
      }

      // console.log(`🔍 [NotificationFallback] Found ${missedNotifications.length} missed notifications`);

      // Send all missed notifications
      for (const notification of missedNotifications) {
        try {
          await unifiedNotificationService.sendMissedNotification(notification);
          console.log(`✅ [NotificationFallback] Sent missed notification: ${notification.title}`);
        } catch (error) {
          console.error(`❌ [NotificationFallback] Failed to send missed notification: ${notification.title}`, error);
        }
      }
    } catch (error) {
      console.error('❌ [NotificationFallback] Error checking missed notifications:', error);
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
   * Force check for missed notifications (for testing)
   */
  async forceCheck(): Promise<void> {
    console.log('🔍 [NotificationFallback] Force checking for missed notifications...');
    await this.checkMissedNotifications();
  }
}

export const notificationFallbackService = new NotificationFallbackService();