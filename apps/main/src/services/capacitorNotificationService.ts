/**
 * Enhanced Notification Service using Capacitor
 * Provides unified notification API for both PWA and native apps
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';

export interface NotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  id?: number;
  schedule?: {
    at: Date;
  };
}

export class CapacitorNotificationService {
  private static instance: CapacitorNotificationService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): CapacitorNotificationService {
    if (!CapacitorNotificationService.instance) {
      CapacitorNotificationService.instance = new CapacitorNotificationService();
    }
    return CapacitorNotificationService.instance;
  }

  /**
   * Initialize the notification service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔔 [CapacitorNotification] Initializing...');
    console.log('🔔 [CapacitorNotification] Platform:', Capacitor.getPlatform());
    console.log('🔔 [CapacitorNotification] Is Native:', Capacitor.isNativePlatform());

    try {
      if (Capacitor.isNativePlatform()) {
        await this.initializeNativeNotifications();
      } else {
        await this.initializeWebNotifications();
      }
      this.isInitialized = true;
      console.log('🔔 [CapacitorNotification] Initialized successfully');
    } catch (error) {
      console.error('🔔 [CapacitorNotification] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize native notifications (Android/iOS)
   */
  private async initializeNativeNotifications(): Promise<void> {
    console.log('🔔 [CapacitorNotification] Initializing native notifications...');

    // Request permissions
    const permStatus = await LocalNotifications.requestPermissions();
    console.log('🔔 [CapacitorNotification] Local permissions:', permStatus);

    const pushPermStatus = await PushNotifications.requestPermissions();
    console.log('🔔 [CapacitorNotification] Push permissions:', pushPermStatus);

    // Register for push notifications
    await PushNotifications.register();

    // Listen for registration
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('🔔 [CapacitorNotification] Push registration success, token: ' + token.value);
      // Store token for server use
      this.storePushToken(token.value);
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('🔔 [CapacitorNotification] Push registration error:', error);
    });

    // Listen for incoming notifications
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('🔔 [CapacitorNotification] Push notification received:', notification);
    });

    // Listen for notification actions
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('🔔 [CapacitorNotification] Push notification action performed:', notification);
      this.handleNotificationAction(notification);
    });
  }

  /**
   * Initialize web notifications (PWA)
   */
  private async initializeWebNotifications(): Promise<void> {
    console.log('🔔 [CapacitorNotification] Initializing web notifications...');

    // Request web notification permissions
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('🔔 [CapacitorNotification] Web notification permission:', permission);
    }
  }

  /**
   * Show a local notification
   */
  public async showNotification(options: NotificationOptions): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('🔔 [CapacitorNotification] Showing notification:', options);

      if (Capacitor.isNativePlatform()) {
        return await this.showNativeNotification(options);
      } else {
        return await this.showWebNotification(options);
      }
    } catch (error) {
      console.error('🔔 [CapacitorNotification] Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Show native notification
   */
  private async showNativeNotification(options: NotificationOptions): Promise<boolean> {
    try {
      const notificationId = options.id || Date.now();
      
      await LocalNotifications.schedule({
        notifications: [{
          title: options.title,
          body: options.body,
          id: notificationId,
          schedule: options.schedule || { at: new Date(Date.now() + 1000) },
          sound: 'default',
          attachments: undefined,
          actionTypeId: '',
          extra: {
            data: options.data || {}
          }
        }]
      });

      console.log('🔔 [CapacitorNotification] Native notification scheduled:', notificationId);
      return true;
    } catch (error) {
      console.error('🔔 [CapacitorNotification] Native notification failed:', error);
      return false;
    }
  }

  /**
   * Show web notification
   */
  private async showWebNotification(options: NotificationOptions): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.error('🔔 [CapacitorNotification] Web notifications not supported');
        return false;
      }

      if (Notification.permission !== 'granted') {
        console.error('🔔 [CapacitorNotification] Web notification permission not granted');
        return false;
      }

      // Use service worker for better PWA compatibility
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (registration) {
          await registration.showNotification(options.title, {
            body: options.body,
            icon: '/fav-icons/android-icon-192x192.png',
            badge: '/fav-icons/android-icon-96x96.png',
            tag: `ubora-${Date.now()}`,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200, 100, 200],
            data: options.data || {}
          });
          
          console.log('🔔 [CapacitorNotification] Web notification sent via service worker');
          return true;
        }
      }

      // Fallback to direct notification
      const notification = new Notification(options.title, {
        body: options.body,
        icon: '/fav-icons/android-icon-192x192.png',
        badge: '/fav-icons/android-icon-96x96.png',
        tag: `ubora-${Date.now()}`,
        requireInteraction: true,
        silent: false
      });

      console.log('🔔 [CapacitorNotification] Web notification created directly');
      return true;
    } catch (error) {
      console.error('🔔 [CapacitorNotification] Web notification failed:', error);
      return false;
    }
  }

  /**
   * Store push token for server use
   */
  private async storePushToken(token: string): Promise<void> {
    try {
      // Store in localStorage for now
      localStorage.setItem('fcm_token', token);
      console.log('🔔 [CapacitorNotification] Push token stored:', token);
      
      // TODO: Send to your server
      // await this.sendTokenToServer(token);
    } catch (error) {
      console.error('🔔 [CapacitorNotification] Failed to store push token:', error);
    }
  }

  /**
   * Handle notification actions
   */
  private handleNotificationAction(notification: ActionPerformed): void {
    console.log('🔔 [CapacitorNotification] Handling notification action:', notification);
    
    // Handle different actions
    if (notification.actionId === 'tap') {
      // Handle tap action
      console.log('🔔 [CapacitorNotification] Notification tapped');
    }
  }

  /**
   * Get push token
   */
  public async getPushToken(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      // For native apps, we'll get the token from the registration listener
      return localStorage.getItem('fcm_token');
    } else {
      // For web, return null (use existing FCM implementation)
      return null;
    }
  }

  /**
   * Check if notifications are supported
   */
  public isSupported(): boolean {
    if (Capacitor.isNativePlatform()) {
      return true; // Native apps always support notifications
    } else {
      return 'Notification' in window;
    }
  }

  /**
   * Check notification permissions
   */
  public async getPermissionStatus(): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      return status.display;
    } else {
      return Notification.permission;
    }
  }
}

// Export singleton instance
export const capacitorNotificationService = CapacitorNotificationService.getInstance();
