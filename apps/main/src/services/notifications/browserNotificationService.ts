// Browser Notification Service - Reliable cross-platform notifications
// This service provides immediate, working notifications using the browser's native Notification API

import { logger } from '@ubora/shared/utils/logger';

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
  actions?: NotificationAction[];
  dir?: 'auto' | 'ltr' | 'rtl';
  lang?: string;
  renotify?: boolean;
  sticky?: boolean;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export class BrowserNotificationService {
  private static instance: BrowserNotificationService;
  private isSupported: boolean = false;
  private permission: NotificationPermission = 'default';

  constructor() {
    this.checkSupport();
    // Safely access Notification.permission (may not exist in test environment)
    this.permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  }

  static getInstance(): BrowserNotificationService {
    if (!BrowserNotificationService.instance) {
      BrowserNotificationService.instance = new BrowserNotificationService();
    }
    return BrowserNotificationService.instance;
  }

  /**
   * Check if browser notifications are supported
   */
  private checkSupport(): void {
    this.isSupported = 'Notification' in window;
    logger.debug('Support check', {
      supported: this.isSupported,
      permission: this.permission
    }, 'BrowserNotification');
  }

  /**
   * Check if browser notifications are supported
   */
  isBrowserNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      logger.warn('Notifications not supported', undefined, 'BrowserNotification');
      return false;
    }

    try {
      logger.debug('Requesting permission', undefined, 'BrowserNotification');
      
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      logger.debug('Permission result', { permission }, 'BrowserNotification');
      
      if (permission === 'granted') {
        logger.info('Permission granted', undefined, 'BrowserNotification');
        return true;
      } else {
        logger.warn('Permission denied', { permission }, 'BrowserNotification');
        return false;
      }
    } catch (error) {
      logger.error('Permission request failed', error, 'BrowserNotification');
      return false;
    }
  }

  /**
   * Show a browser notification with native features
   */
  async showNotification(options: BrowserNotificationOptions): Promise<boolean> {
    if (!this.isSupported) {
      logger.warn('Notifications not supported', undefined, 'BrowserNotification');
      return false;
    }

    if (this.permission !== 'granted') {
      logger.warn('Permission not granted', { permission: this.permission }, 'BrowserNotification');
      return false;
    }

    try {
      logger.debug('Showing notification', { title: options.title }, 'BrowserNotification');
      logger.debug('Browser info', {
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        documentVisibility: document.visibilityState,
        windowFocused: document.hasFocus()
      }, 'BrowserNotification');

      // Enhanced notification options for better cross-platform support
      const notificationOptions: NotificationOptions = {
        body: options.body,
        icon: options.icon || '/fav-icons/android-icon-192x192.png',
        badge: options.badge || '/fav-icons/android-icon-96x96.png',
        tag: options.tag || `browser-notification-${Date.now()}`,
        data: options.data || {},
        requireInteraction: options.requireInteraction !== false, // Default to true
        silent: options.silent || false, // Default to false (enable sound)
        dir: options.dir || 'auto',
        lang: options.lang || 'fr'
      };

      // Add non-standard properties if supported
      if (options.vibrate && 'vibrate' in Notification.prototype) {
        (notificationOptions as any).vibrate = options.vibrate;
      }
      if (options.timestamp) {
        (notificationOptions as any).timestamp = options.timestamp;
      }
      if (options.renotify !== undefined) {
        (notificationOptions as any).renotify = options.renotify;
      }
      if (options.sticky !== undefined) {
        (notificationOptions as any).sticky = options.sticky;
      }
      if (options.actions) {
        (notificationOptions as any).actions = options.actions;
      }

      logger.debug('Notification options', notificationOptions, 'BrowserNotification');

      // Create the notification
      const notification = new Notification(options.title, notificationOptions);
      
      // Verify notification was created
      if (!notification) {
        throw new Error('Failed to create notification object');
      }

      logger.debug('Notification object created', {
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        data: notification.data
      }, 'BrowserNotification');

      // Handle notification click
      notification.onclick = (event) => {
        logger.debug('Notification clicked', undefined, 'BrowserNotification');
        event.preventDefault();
        
        // Focus the window
        window.focus();
        
        // Close the notification
        notification.close();
        
        // Navigate if URL provided
        if (options.data?.redirectUrl) {
          logger.debug('Navigating to', { redirectUrl: options.data.redirectUrl }, 'BrowserNotification');
          window.location.href = options.data.redirectUrl;
        }
      };

      // Handle notification close
      notification.onclose = () => {
        logger.debug('Notification closed', undefined, 'BrowserNotification');
      };

      // Handle notification error
      notification.onerror = (error) => {
        logger.error('Notification error', error, 'BrowserNotification');
      };

      // Handle notification show (when it becomes visible)
      notification.onshow = () => {
        logger.debug('Notification is now visible', undefined, 'BrowserNotification');
      };

      // Auto-close after 10 seconds if not interacted with
      setTimeout(() => {
        if (notification) {
          logger.debug('Auto-closing notification after 10 seconds', undefined, 'BrowserNotification');
          notification.close();
        }
      }, 10000);

      logger.info('Notification displayed successfully', { title: options.title }, 'BrowserNotification');
      return true;

    } catch (error) {
      logger.error('Failed to show notification', error, 'BrowserNotification');
      logger.error('Error details', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      }, 'BrowserNotification');
      return false;
    }
  }

  /**
   * Test browser notification (direct)
   */
  async testNotification(): Promise<boolean> {
    logger.debug('Testing browser notification', undefined, 'BrowserNotification');

    const testOptions: BrowserNotificationOptions = {
      title: 'Test Browser Notification',
      body: 'Ceci est un test de notification navigateur avec son et pop-up',
      icon: '/fav-icons/android-icon-192x192.png',
      badge: '/fav-icons/android-icon-96x96.png',
      tag: 'browser-test',
      data: {
        type: 'test',
        timestamp: Date.now(),
        redirectUrl: '/'
      },
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 200],
      sticky: true
    };

    return await this.showNotification(testOptions);
  }

  /**
   * Send test notification directly (frontend only)
   */
  async sendTestNotificationDirect(): Promise<boolean> {
    const testOptions: BrowserNotificationOptions = {
      title: 'Test Browser Notification',
      body: 'Ceci est un test de notification navigateur direct',
      data: {
        type: 'test',
        timestamp: Date.now().toString(),
        redirectUrl: '/'
      },
      requireInteraction: true,
      silent: false
    };

    return await this.showNotification(testOptions);
  }

  /**
   * Show form assignment notification
   */
  async showFormAssignmentNotification(formData: any): Promise<boolean> {
    const options: BrowserNotificationOptions = {
      title: 'Nouvelle Assignation de Formulaire',
      body: `Vous avez été assigné au formulaire: ${formData.formName || 'Formulaire'}`,
      icon: '/fav-icons/android-icon-192x192.png',
      badge: '/fav-icons/android-icon-96x96.png',
      tag: `form-assignment-${formData.formId || Date.now()}`,
      data: {
        type: 'form_assignment',
        formId: formData.formId,
        redirectUrl: formData.redirectUrl || '/forms'
      },
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      sticky: true
    };

    return await this.showNotification(options);
  }

  /**
   * Show form reminder notification
   */
  async showFormReminderNotification(reminderData: any): Promise<boolean> {
    const options: BrowserNotificationOptions = {
      title: 'Rappel de Formulaire',
      body: `Le formulaire "${reminderData.formName}" est dû dans ${reminderData.timeRemaining}`,
      icon: '/fav-icons/android-icon-192x192.png',
      badge: '/fav-icons/android-icon-96x96.png',
      tag: `form-reminder-${reminderData.formId || Date.now()}`,
      data: {
        type: 'form_reminder',
        formId: reminderData.formId,
        redirectUrl: reminderData.redirectUrl || '/forms'
      },
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      sticky: true
    };

    return await this.showNotification(options);
  }

  /**
   * Show metric reminder notification
   */
  async showMetricReminderNotification(metricData: any): Promise<boolean> {
    const options: BrowserNotificationOptions = {
      title: 'Rappel de Métrique',
      body: `Il est temps de mettre à jour la métrique: ${metricData.metricName}`,
      icon: '/fav-icons/android-icon-192x192.png',
      badge: '/fav-icons/android-icon-96x96.png',
      tag: `metric-reminder-${metricData.metricId || Date.now()}`,
      data: {
        type: 'metric_reminder',
        metricId: metricData.metricId,
        redirectUrl: metricData.redirectUrl || '/metrics'
      },
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      sticky: true
    };

    return await this.showNotification(options);
  }

  /**
   * Show programmed instruction notification
   */
  async showProgrammedInstructionNotification(instructionData: any): Promise<boolean> {
    const options: BrowserNotificationOptions = {
      title: 'Instruction Programmée',
      body: instructionData.message || 'Vous avez reçu une nouvelle instruction',
      icon: '/fav-icons/android-icon-192x192.png',
      badge: '/fav-icons/android-icon-96x96.png',
      tag: `instruction-${instructionData.instructionId || Date.now()}`,
      data: {
        type: 'programmed_instruction',
        instructionId: instructionData.instructionId,
        redirectUrl: instructionData.redirectUrl || '/instructions'
      },
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      sticky: true
    };

    return await this.showNotification(options);
  }

  /**
   * Check environment compatibility
   */
  checkEnvironmentCompatibility(): {
    isCompatible: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check notification support
    if (!this.isSupported) {
      issues.push('Browser notifications not supported');
      recommendations.push('Use a modern browser that supports notifications');
    }

    // Check permission
    if (this.permission === 'denied') {
      issues.push('Notification permission denied');
      recommendations.push('Enable notifications in browser settings');
    } else if (this.permission === 'default') {
      issues.push('Notification permission not requested');
      recommendations.push('Request notification permission');
    }

    // Check secure context (not critical for browser notifications)
    if (!window.isSecureContext) {
      issues.push('Not in secure context');
      recommendations.push('Use HTTPS for better reliability');
    }

    const isCompatible = issues.length === 0;

    return {
      isCompatible,
      issues,
      recommendations
    };
  }
}

// Export singleton instance
export const browserNotificationService = BrowserNotificationService.getInstance();
