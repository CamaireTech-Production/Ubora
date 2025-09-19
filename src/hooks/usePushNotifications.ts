import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';

interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  token: string | null;
  isSubscribed: boolean;
  error: string | null;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: { granted: false, denied: false, default: true },
    token: null,
    isSubscribed: false,
    error: null,
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(async () => {
    try {
      const messagingInstance = await messaging;
      if (!messagingInstance) {
        setState(prev => ({ ...prev, isSupported: false }));
        return false;
      }

      setState(prev => ({ ...prev, isSupported: true }));
      return true;
    } catch (error) {
      console.error('🔔 [Push] Support check failed:', error);
      setState(prev => ({ ...prev, isSupported: false, error: 'Push notifications not supported' }));
      return false;
    }
  }, []);

  // Check notification permission
  const checkPermission = useCallback(() => {
    if (!('Notification' in window)) {
      setState(prev => ({ ...prev, permission: { granted: false, denied: true, default: false } }));
      return;
    }

    const permission = Notification.permission;
    setState(prev => ({
      ...prev,
      permission: {
        granted: permission === 'granted',
        denied: permission === 'denied',
        default: permission === 'default',
      }
    }));
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    try {
      if (!('Notification' in window)) {
        throw new Error('Notifications not supported');
      }

      const permission = await Notification.requestPermission();
      checkPermission();

      if (permission === 'granted') {
        await getFCMToken();
      } else {
        setState(prev => ({ ...prev, error: 'Permission denied' }));
      }

      return permission === 'granted';
    } catch (error) {
      console.error('🔔 [Push] Permission request failed:', error);
      setState(prev => ({ ...prev, error: 'Failed to request permission' }));
      return false;
    }
  }, []);

  // Save token to Firestore
  const saveTokenToFirestore = useCallback(async (token: string) => {
    if (!user || !user.id) {
      console.error('🔔 [Push] User or user.id is undefined:', { user });
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.id);
      await setDoc(userDocRef, {
        fcmToken: token,
        lastTokenUpdate: new Date(),
        notificationEnabled: true,
      }, { merge: true });
      
      console.log('🔔 [Push] Token saved to Firestore for user:', user.id);
    } catch (error) {
      console.error('🔔 [Push] Failed to save token:', error);
    }
  }, [user]);

  // Get FCM token
  const getFCMToken = useCallback(async () => {
    try {
      console.log('🔔 [Push] Getting FCM token...', { user: user?.id });
      
      const messagingInstance = await messaging;
      if (!messagingInstance) {
        throw new Error('Messaging not available');
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      
      if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
        throw new Error('VAPID key not configured. Please add VITE_FIREBASE_VAPID_KEY to your .env.local file');
      }

      const token = await getToken(messagingInstance, {
        vapidKey: vapidKey
      });

      if (token) {
        setState(prev => ({ ...prev, token, isSubscribed: true }));
        
        // Save token to Firestore for the current user
        if (user) {
          await saveTokenToFirestore(token);
        }
        
        console.log('🔔 [Push] FCM Token generated successfully:', token.substring(0, 50) + '...');
        return token;
      } else {
        setState(prev => ({ ...prev, error: 'No registration token available' }));
        return null;
      }
    } catch (error) {
      console.error('🔔 [Push] Token generation failed:', error);
      setState(prev => ({ ...prev, error: 'Failed to get token' }));
      return null;
    }
  }, [user, saveTokenToFirestore]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      const supported = await checkSupport();
      if (!supported) return false;
    }

    if (state.permission.denied) {
      setState(prev => ({ ...prev, error: 'Permission denied' }));
      return false;
    }

    if (state.permission.default) {
      const granted = await requestPermission();
      return granted;
    }

    if (state.permission.granted && !state.token) {
      await getFCMToken();
    }

    return state.isSubscribed;
  }, [state, checkSupport, requestPermission, getFCMToken]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      if (user && user.id) {
        const userDocRef = doc(db, 'users', user.id);
        await setDoc(userDocRef, {
          fcmToken: null,
          notificationEnabled: false,
        }, { merge: true });
      }

      setState(prev => ({ 
        ...prev, 
        token: null, 
        isSubscribed: false 
      }));

      console.log('🔔 [Push] Unsubscribed successfully');
    } catch (error) {
      console.error('🔔 [Push] Unsubscribe failed:', error);
    }
  }, [user]);

  // Listen for foreground messages
  useEffect(() => {
    const setupForegroundListener = async () => {
      try {
        const messagingInstance = await messaging;
        if (!messagingInstance) return;

        const unsubscribe = onMessage(messagingInstance, (payload) => {
          console.log('🔔 [Push] Message reçu en premier plan:', payload);
          
          // Show notification manually when app is in foreground
          if (Notification.permission === 'granted') {
            new Notification(payload.notification?.title || 'Ubora', {
              body: payload.notification?.body,
              icon: '/fav-icons/android-icon-192x192.png',
              tag: 'ubora-foreground',
            });
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('🔔 [Push] Foreground listener setup failed:', error);
      }
    };

    if (state.isSupported && state.permission.granted) {
      setupForegroundListener();
    }
  }, [state.isSupported, state.permission.granted]);

  // Check user's notification state from Firestore
  const checkUserNotificationState = useCallback(async () => {
    if (!user || !user.id) return;

    try {
      const userDocRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const hasToken = !!userData.fcmToken;
        const isEnabled = userData.notificationEnabled === true;
        
        if (hasToken && isEnabled) {
          setState(prev => ({ 
            ...prev, 
            token: userData.fcmToken,
            isSubscribed: true 
          }));
        }
      }
    } catch (error) {
      console.error('🔔 [Push] Error checking user notification state:', error);
    }
  }, [user]);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      await checkSupport();
      checkPermission();
      await checkUserNotificationState();
    };

    initialize();
  }, [checkSupport, checkPermission, checkUserNotificationState]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
    getFCMToken,
  };
};

