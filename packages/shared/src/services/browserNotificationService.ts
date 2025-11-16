// Browser Notification Service - Reliable cross-platform notifications
// This service provides immediate, working notifications using the browser's native Notification API

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
    // Vérifier que Notification existe avant d'accéder à permission
    if (typeof Notification !== 'undefined' && 'permission' in Notification) {
      this.permission = Notification.permission;
    } else {
      this.permission = 'denied'; // Par défaut si Notification n'existe pas
    }
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
    console.log('🔔 [BrowserNotification] Support check:', {
      supported: this.isSupported,
      permission: this.permission
    });
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
      console.error('🔔 [BrowserNotification] Notifications not supported');
      return false;
    }

    try {
      if (typeof Notification === 'undefined') {
        console.error('🔔 [BrowserNotification] Notification API not available');
        return false;
      }
      
      console.log('🔔 [BrowserNotification] Requesting permission...');
      
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      console.log('🔔 [BrowserNotification] Permission result:', permission);
      
      if (permission === 'granted') {
        console.log('🔔 [BrowserNotification] ✅ Permission granted!');
        return true;
      } else {
        console.log('🔔 [BrowserNotification] ❌ Permission denied');
        return false;
      }
    } catch (error) {
      console.error('🔔 [BrowserNotification] ❌ Permission request failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Show a browser notification with native features
   */
  async showNotification(options: BrowserNotificationOptions): Promise<boolean> {
    if (!this.isSupported) {
      console.error('🔔 [BrowserNotification] Notifications not supported');
      return false;
    }

    if (this.permission !== 'granted') {
      console.error('🔔 [BrowserNotification] Permission not granted');
      return false;
    }

    try {
      console.log('🔔 [BrowserNotification] Showing notification:', options.title);
      console.log('🔔 [BrowserNotification] Browser info:', {
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext,
        documentVisibility: document.visibilityState,
        windowFocused: document.hasFocus()
      });

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
      if (options.vibrate && typeof Notification !== 'undefined' && 'vibrate' in Notification.prototype) {
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

      console.log('🔔 [BrowserNotification] Notification options:', notificationOptions);

      // Vérifier que Notification est disponible avant de créer
      if (typeof Notification === 'undefined') {
        throw new Error('Notification API is not available');
      }

      // Create the notification
      const notification = new Notification(options.title, notificationOptions);
      
      // Verify notification was created
      if (!notification) {
        throw new Error('Failed to create notification object');
      }

      console.log('🔔 [BrowserNotification] Notification object created:', {
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        data: notification.data
      });

      // Handle notification click
      notification.onclick = (event) => {
        console.log('🔔 [BrowserNotification] Notification clicked');
        event.preventDefault();
        
        // Focus the window
        window.focus();
        
        // Close the notification
        notification.close();
        
        // Navigate if URL provided
        if (options.data?.redirectUrl) {
          console.log('🔔 [BrowserNotification] Navigating to:', options.data.redirectUrl);
          window.location.href = options.data.redirectUrl;
        }
      };

      // Handle notification close
      notification.onclose = () => {
        console.log('🔔 [BrowserNotification] Notification closed');
      };

      // Handle notification error
      notification.onerror = (error) => {
        console.error('🔔 [BrowserNotification] Notification error:', error);
      };

      // Handle notification show (when it becomes visible)
      notification.onshow = () => {
        console.log('🔔 [BrowserNotification] ✅ Notification is now visible');
      };

      // Auto-close after 10 seconds if not interacted with
      setTimeout(() => {
        if (notification) {
          console.log('🔔 [BrowserNotification] Auto-closing notification after 10 seconds');
          notification.close();
        }
      }, 10000);

      console.log('🔔 [BrowserNotification] ✅ Notification displayed successfully');
      return true;

    } catch (error) {
      console.error('🔔 [BrowserNotification] ❌ Failed to show notification:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error) {
        console.error('🔔 [BrowserNotification] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  /**
   * Test browser notification (direct)
   */
  async testNotification(): Promise<boolean> {
    console.log('🔔 [BrowserNotification] Testing browser notification...');

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
