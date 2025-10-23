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

const db = admin.firestore();

/**
 * Unified Notification Cron Job
 * GET /api/notifications/cron
 * 
 * This endpoint checks for due notifications and sends FCM push notifications.
 * It should be called by a cron service (like Vercel Cron, GitHub Actions, or external cron).
 * 
 * Query Parameters:
 * - agencyId: Optional agency ID to limit notifications to specific agency
 * - limit: Maximum number of notifications to process (default: 50)
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agencyId, limit = 50 } = req.query;
    const startTime = Date.now();
    
    console.log('🔔 [NotificationCron] Starting cron job...', { agencyId, limit });

    // Get due notifications
    const dueNotifications = await getDueNotifications(agencyId, parseInt(limit));
    
    if (dueNotifications.length === 0) {
      console.log('🔔 [NotificationCron] No due notifications found');
      return res.status(200).json({
        success: true,
        message: 'No due notifications found',
        processed: 0,
        duration: Date.now() - startTime
      });
    }

    console.log(`🔔 [NotificationCron] Found ${dueNotifications.length} due notifications`);

    // Process notifications
    const results = await processNotifications(dueNotifications);
    
    const duration = Date.now() - startTime;
    console.log(`🔔 [NotificationCron] Completed in ${duration}ms`, {
      total: dueNotifications.length,
      sent: results.sent,
      failed: results.failed
    });

    return res.status(200).json({
      success: true,
      message: `Processed ${dueNotifications.length} notifications`,
      processed: dueNotifications.length,
      sent: results.sent,
      failed: results.failed,
      duration
    });

  } catch (error) {
    console.error('🔔 [NotificationCron] Error in cron job:', error);
    return res.status(500).json({
      success: false,
      error: 'Cron job failed',
      details: error.message
    });
  }
}

/**
 * Get due notifications from Firestore
 */
async function getDueNotifications(agencyId, limit) {
  try {
    let query = db.collection('notifications')
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', new Date())
      .orderBy('scheduledFor', 'asc')
      .limit(limit);

    // Filter by agency if provided
    if (agencyId) {
      query = query.where('agencyId', '==', agencyId);
    }

    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      scheduledFor: doc.data().scheduledFor?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      sentAt: doc.data().sentAt?.toDate(),
    }));
  } catch (error) {
    console.error('🔔 [NotificationCron] Error getting due notifications:', error);
    throw error;
  }
}

/**
 * Process notifications and send FCM push notifications
 */
async function processNotifications(notifications) {
  const results = { sent: 0, failed: 0 };
  
  for (const notification of notifications) {
    try {
      await processSingleNotification(notification);
      results.sent++;
    } catch (error) {
      console.error(`🔔 [NotificationCron] Failed to process notification ${notification.id}:`, error);
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Process a single notification
 */
async function processSingleNotification(notification) {
  try {
    console.log(`🔔 [NotificationCron] Processing notification: ${notification.title}`);

    // Get user's FCM token
    const userDoc = await db.collection('users').doc(notification.recipientId).get();
    if (!userDoc.exists) {
      throw new Error(`User ${notification.recipientId} not found`);
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.warn(`🔔 [NotificationCron] No FCM token for user ${notification.recipientId}`);
      // Mark as failed but don't throw
      await markNotificationAsFailed(notification.id, 'No FCM token');
      return;
    }

    // Send FCM push notification
    await sendFCMPushNotification(notification, fcmToken);

    // Mark notification as sent
    await markNotificationAsSent(notification.id);

    console.log(`🔔 [NotificationCron] Successfully sent notification: ${notification.title}`);

  } catch (error) {
    console.error(`🔔 [NotificationCron] Error processing notification ${notification.id}:`, error);
    
    // Mark as failed
    await markNotificationAsFailed(notification.id, error.message);
    throw error;
  }
}

/**
 * Send FCM push notification
 */
async function sendFCMPushNotification(notification, fcmToken) {
  try {
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.data?.imageUrl
      },
      data: {
        ...notification.data,
        type: notification.type,
        redirectUrl: notification.redirectUrl || '/',
        clickAction: notification.redirectUrl || '/',
        timestamp: Date.now().toString(),
        notificationId: notification.id
      },
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_notification',
          color: '#4F46E5',
          sound: 'default',
          channelId: 'ubora_notifications',
          clickAction: notification.redirectUrl || 'FLUTTER_NOTIFICATION_CLICK'
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
          image: notification.data?.imageUrl,
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
          link: notification.redirectUrl || '/'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`🔔 [NotificationCron] FCM message sent: ${response}`);
    
  } catch (error) {
    console.error('🔔 [NotificationCron] FCM send error:', error);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      console.warn(`🔔 [NotificationCron] Invalid FCM token for user ${notification.recipientId}`);
      // Don't throw - just log and continue
      return;
    }
    
    throw error;
  }
}

/**
 * Mark notification as sent
 */
async function markNotificationAsSent(notificationId) {
  try {
    await db.collection('notifications').doc(notificationId).update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('🔔 [NotificationCron] Error marking notification as sent:', error);
    throw error;
  }
}

/**
 * Mark notification as failed
 */
async function markNotificationAsFailed(notificationId, errorMessage) {
  try {
    await db.collection('notifications').doc(notificationId).update({
      status: 'failed',
      error: errorMessage,
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('🔔 [NotificationCron] Error marking notification as failed:', error);
  }
}
