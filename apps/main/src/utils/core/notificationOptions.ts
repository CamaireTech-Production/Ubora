/**
 * Enhanced Notification Options Utility
 * Provides platform-specific notification options with pop-up behavior and highest priority
 */

export interface EnhancedNotificationOptions {
  body: string;
  icon: string;
  badge: string;
  requireInteraction: boolean;
  silent: boolean;
  tag: string;
  renotify: boolean;
  data: Record<string, any>;
}

/**
 * Detect if device is iOS
 */
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * Detect if device is Android
 */
export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

/**
 * Check iOS version for web push support (16.4+ required)
 */
export const checkIOSSupport = (): boolean => {
  if (!isIOS()) return true;
  
  const iosVersion = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (!iosVersion) return false;
  
  const majorVersion = parseInt(iosVersion[1]);
  const minorVersion = parseInt(iosVersion[2]);
  
  // iOS 16.4+ required for web push notifications
  return majorVersion > 16 || (majorVersion === 16 && minorVersion >= 4);
};

/**
 * Enhanced permission request for iOS
 */
export const requestEnhancedPermission = async (): Promise<boolean> => {
  if (isIOS()) {
    // iOS requires user gesture for permission
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('iOS permission request failed:', error);
      return false;
    }
  }
  
  // For other platforms, check current permission
  return Notification.permission === 'granted';
};

/**
 * Get enhanced notification options with pop-up behavior and highest priority
 */
export const getEnhancedNotificationOptions = (
  _title: string,
  body: string,
  options: Partial<EnhancedNotificationOptions> = {}
): NotificationOptions => {
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  
  const baseOptions: NotificationOptions = {
    body,
    icon: options.icon || '/fav-icons/android-icon-192x192.png',
    badge: options.badge || '/fav-icons/android-icon-96x96.png',
    requireInteraction: true,        // Keep notification visible longer
    silent: false,                   // Enable default sound (important for pop-up)
    tag: options.tag || `notification-${Date.now()}`,
    data: {
      url: '/dashboard',
      timestamp: Date.now(),
      platform: isIOSDevice ? 'ios' : isAndroidDevice ? 'android' : 'desktop',
      ...options.data
    }
  };

  // Ensure icon paths are absolute and valid
  if (baseOptions.icon && !baseOptions.icon.startsWith('http')) {
    baseOptions.icon = baseOptions.icon.startsWith('/') ? baseOptions.icon : `/${baseOptions.icon}`;
  }
  if (baseOptions.badge && !baseOptions.badge.startsWith('http')) {
    baseOptions.badge = baseOptions.badge.startsWith('/') ? baseOptions.badge : `/${baseOptions.badge}`;
  }

  // Add platform-specific enhancements
  if (isIOSDevice) {
    // iOS-specific options
    Object.assign(baseOptions, {
      renotify: true,
      data: {
        ...baseOptions.data,
        ios: true
      }
    });
  } else if (isAndroidDevice) {
    // Android-specific options for pop-up behavior
    Object.assign(baseOptions, {
      renotify: true,
      vibrate: [200, 100, 200, 100, 200], // Vibration helps trigger pop-up
      data: {
        ...baseOptions.data,
        android: true
      }
    });
  }

  return baseOptions;
};

/**
 * Show enhanced notification with pop-up behavior and highest priority
 */
export const showEnhancedNotification = async (
  title: string,
  body: string,
  options: Partial<EnhancedNotificationOptions> = {}
): Promise<boolean> => {
  try {
    // Check permission first
    const hasPermission = await requestEnhancedPermission();
    if (!hasPermission) {
      console.error('Notification permission not granted');
      return false;
    }

    // Check iOS support
    if (isIOS() && !checkIOSSupport()) {
      console.error('iOS version does not support web push notifications (16.4+ required)');
      return false;
    }

    // Use service worker for better compatibility
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        const notificationOptions = getEnhancedNotificationOptions(title, body, options);
        
        await registration.showNotification(title, notificationOptions);
        console.log('Enhanced notification sent successfully:', { title, options: notificationOptions });
        return true;
      } else {
        console.error('Service worker registration not found');
        return false;
      }
    } else {
      console.error('Service worker not supported');
      return false;
    }
  } catch (error) {
    console.error('Failed to show enhanced notification:', error);
    return false;
  }
};
