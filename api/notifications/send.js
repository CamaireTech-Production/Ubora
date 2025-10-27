// Unified Notification Backend Endpoint
// Supports FCM push notifications and browser notifications

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const messaging = admin.messaging();

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    console.log('🔔 [UnifiedNotification] Received notification request:', req.body);

    const { 
      notification, 
      fcmToken, 
      userId, 
      method = 'auto' // 'fcm', 'browser', or 'auto'
    } = req.body;

    // Validate required fields
    if (!notification || !notification.title || !notification.body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required notification fields'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId'
      });
    }

    console.log('🔔 [UnifiedNotification] Processing notification:', {
      title: notification.title,
      body: notification.body,
      method: method,
      hasFcmToken: !!fcmToken
    });

    let success = false;
    let methodUsed = 'none';
    let error = null;

    // Try FCM first if token is provided and method allows it
    if (fcmToken && (method === 'fcm' || method === 'auto')) {
      try {
        console.log('🔔 [UnifiedNotification] Attempting FCM notification...');
        
        const message = {
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: {
            ...notification.data,
            type: notification.data?.type || 'notification',
            userId: userId,
            timestamp: Date.now().toString(),
            redirectUrl: notification.data?.redirectUrl || '/'
          },
          token: fcmToken,
          android: {
            notification: {
              icon: 'ic_notification',
              color: '#3b82f6',
              sound: 'default',
              channelId: 'ubora_notifications'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          },
          webpush: {
            notification: {
              icon: '/fav-icons/android-icon-192x192.png',
              badge: '/fav-icons/android-icon-96x96.png',
              requireInteraction: true,
              silent: false
            }
          }
        };

        const response = await messaging.send(message);
        console.log('🔔 [UnifiedNotification] ✅ FCM notification sent:', response);
        
        success = true;
        methodUsed = 'fcm';
        
      } catch (fcmError) {
        console.error('🔔 [UnifiedNotification] ❌ FCM notification failed:', fcmError);
        error = fcmError.message;
      }
    }

    // If FCM failed or method is browser, indicate browser notification should be used
    if (!success && (method === 'browser' || method === 'auto')) {
      console.log('🔔 [UnifiedNotification] FCM failed or method is browser, indicating browser notification');
      success = true;
      methodUsed = 'browser';
    }

    // Log the notification attempt
    const logData = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notificationId: notification.id || `notif_${Date.now()}`,
      userId: userId,
      fcmToken: fcmToken ? fcmToken.substring(0, 20) + '...' : null,
      platform: 'web',
      method: methodUsed,
      success: success,
      error: error,
      timestamp: new Date().toISOString(),
      title: notification.title,
      body: notification.body,
      type: notification.data?.type || 'notification'
    };

    console.log('🔔 [UnifiedNotification] Delivery log:', logData);

    // Return response
    if (success) {
      res.status(200).json({
        success: true,
        message: `Notification sent via ${methodUsed}`,
        method: methodUsed,
        notificationId: logData.notificationId,
        deliveryLog: logData
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send notification',
        details: error,
        method: methodUsed
      });
    }

  } catch (error) {
    console.error('🔔 [UnifiedNotification] ❌ Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};
