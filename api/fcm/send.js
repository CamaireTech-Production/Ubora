const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: "studio-gpnfx",
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'studio-gpnfx'
  });
}

/**
 * Send FCM notification
 * POST /api/fcm/send
 * Body: {
 *   notification: { title, body, data?, imageUrl?, clickAction? },
 *   fcmToken: string,
 *   userId?: string
 * }
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { notification, fcmToken, userId } = req.body;

    // Validate required fields
    if (!notification || !fcmToken) {
      return res.status(400).json({ 
        error: 'Missing required fields: notification and fcmToken are required' 
      });
    }

    if (!notification.title || !notification.body) {
      return res.status(400).json({ 
        error: 'Notification must have title and body' 
      });
    }

    console.log('🔔 [FCM API] Sending notification:', {
      title: notification.title,
      fcmToken: fcmToken.substring(0, 20) + '...',
      userId
    });

    // Prepare the message
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl
      },
      data: {
        ...notification.data,
        clickAction: notification.clickAction || '/',
        timestamp: Date.now().toString()
      },
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_notification',
          color: '#4F46E5',
          sound: 'default',
          channelId: 'ubora_notifications',
          clickAction: notification.clickAction || 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            badge: 1,
            sound: 'default',
            category: 'UBORA_NOTIFICATION'
          }
        }
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: '/fav-icons/android-icon-192x192.png',
          badge: '/fav-icons/android-icon-96x96.png',
          image: notification.imageUrl,
          requireInteraction: false,
          silent: false,
          vibrate: [200, 100, 200],
          actions: [
            {
              action: 'open',
              title: 'Ouvrir',
              icon: '/fav-icons/android-icon-48x48.png'
            },
            {
              action: 'dismiss',
              title: 'Ignorer',
              icon: '/fav-icons/android-icon-48x48.png'
            }
          ]
        },
        fcmOptions: {
          link: notification.clickAction || '/'
        }
      }
    };

    // Send the message
    const response = await admin.messaging().send(message);
    
    console.log('🔔 [FCM API] Successfully sent message:', response);

    return res.status(200).json({
      success: true,
      messageId: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔔 [FCM API] Error sending message:', error);

    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-registration-token') {
      return res.status(400).json({
        success: false,
        error: 'Invalid FCM token - user may need to re-register',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.code === 'messaging/registration-token-not-registered') {
      return res.status(400).json({
        success: false,
        error: 'FCM token not registered - user may have uninstalled the app',
        code: 'TOKEN_NOT_REGISTERED'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to send notification',
      details: error.message
    });
  }
}
