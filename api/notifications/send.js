const { adminDb } = require('../lib/firebaseAdmin');
const admin = require('firebase-admin');

/**
 * Send push notification to specific users
 * POST /api/notifications/send
 * Body: {
 *   userIds: string[], // Array of user IDs
 *   title: string,
 *   body: string,
 *   data?: object, // Additional data
 *   role?: 'directeur' | 'employe' // Send to all users with specific role
 * }
 */
exports.handler = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userIds, title, body, data = {}, role } = req.body;

    if (!title || !body) {
      return res.status(400).json({ 
        error: 'Title and body are required' 
      });
    }

    let targetUserIds = userIds || [];

    // If role is specified, get all users with that role
    if (role && !userIds) {
      const usersSnapshot = await adminDb
        .collection('users')
        .where('role', '==', role)
        .where('notificationEnabled', '==', true)
        .get();

      targetUserIds = usersSnapshot.docs.map(doc => doc.id);
    }

    if (targetUserIds.length === 0) {
      return res.status(400).json({ 
        error: 'No target users specified' 
      });
    }

    // Get FCM tokens for target users
    const userDocs = await Promise.all(
      targetUserIds.map(userId => 
        adminDb.collection('users').doc(userId).get()
      )
    );

    const validTokens = userDocs
      .filter(doc => doc.exists && doc.data().fcmToken)
      .map(doc => doc.data().fcmToken);

    if (validTokens.length === 0) {
      return res.status(400).json({ 
        error: 'No valid FCM tokens found for target users' 
      });
    }

    // Prepare notification payload
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens: validTokens,
    };

    // Send notification
    const response = await admin.messaging().sendMulticast(message);

    // Log results
    console.log('🔔 [Notifications] Sent:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
      title,
      body,
      targetUsers: targetUserIds.length,
      validTokens: validTokens.length,
    });

    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: validTokens[idx],
            error: resp.error?.code,
          });
        }
      });

      // Remove invalid tokens from Firestore
      for (const failedToken of failedTokens) {
        if (failedToken.error === 'messaging/invalid-registration-token' ||
            failedToken.error === 'messaging/registration-token-not-registered') {
          // Find and remove the invalid token
          const userQuery = await adminDb
            .collection('users')
            .where('fcmToken', '==', failedToken.token)
            .get();

          for (const userDoc of userQuery.docs) {
            await userDoc.ref.update({
              fcmToken: null,
              notificationEnabled: false,
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Notifications sent successfully',
      results: {
        successCount: response.successCount,
        failureCount: response.failureCount,
        targetUsers: targetUserIds.length,
        validTokens: validTokens.length,
      },
    });

  } catch (error) {
    console.error('🔔 [Notifications] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to send notifications',
      details: error.message 
    });
  }
};
