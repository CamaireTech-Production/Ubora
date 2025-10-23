const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: "studio-gpnfx",
    private_key_id: "49cf718bd7049b5fcc3e2e6fbc583ebcec3b373d",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDNUG4k1NBeeCb8\nZ5+S5SAJujgqP85D12CkQqbeP44r9oP3ZyfVZgAuz0YFF0so//kgsn6vaJEqk+vy\nJux5Lb+0QNfsQrTMYkKbQP+pc8KX9VRTz1PUa47h5MgemSMdp/eTaqhdsO6dKbIe\n5Nu0UjlYHXBJ9uPOYzOVZ+Sv0hMuPYyucLHrTiqwG91aCGXxKwSW9Ojipghr4KKG\nqSlUIzt5d20nLPOWz7d9pNac4gLVw0VlZk02ep+xclRnkjDc+qWKbcgr90/Zx4Cx\n+aSIx6d4IOVBaa8cWrAUoE2IUJ/yFk0joMoxN+Iz7gzDwuKbx4eAMyR4SSIRU42J\nXW4dTMIFAgMBAAECggEAVd+FIgyM1mZkz/87ZAJHYyorIaisSf3EYw+poZ1thn/F\n9G2F4KCYBPwWqjxy6EQf3AgsKouO5AMYlaCoGYsD+o2AgkXoPu/+Mdd+104entYy\nnhdCVb9i9KJu/TVJ1baSO2tJ3l4Jf1yYLonERuh5KZyugZEs+P7O7XeV0+AGu7is\nlZGj5AZhEFpwOBUNU5m9SGDqliq5X1iFhoBmFZ+V6QKUHyq/gWqUDx6baBLjGUdd\nWRjJHAVzY1Xjf0jHWs8RvkzMCskolzV5K0IP79REHTDjefeN4CuURy1KcxFHl3jR\nP7OZj2fgEz0gqAAganIDFI1D6onN4IB7Bk4NtB/gJQKBgQDyC55AYsYYvM7SMc/n\nPJ28lY4Vd5NSyQLf3BgkcpBFRcl8fqEQNaP+F53qa7bLCJJTWkglpur6B2LixlfW\nCkxUIzl4gGOeUQqp3/KzKHTPAAi3t6vAxLajZlugl7uLOBjY+UWkGu/K2+ekaQM9\nCkM8hA/ME2f0dPyF2nDo/XNeiwKBgQDZJrDrnrgevQjq0c0sTGPOdAMLgAStRHvu\nqeBGwEq1MdXFYeLqPhBDHnG9pdxftPXvD1QdfEeP/V+wV3kIx+sHGJl/39Qabg38\nJJDa0EDglKnT32R7A4IM3EcbdTjLA3yVSYNvpxyVi4LC+QFfexkxre/Oe3ItMATs\nVJfjFeqDrwKBgDNiZgkzLuzngFy9OG7VvoLfmRdTmFIV3Gdb2UA7lgcuxpSIaXcA\nfD0gFGVE0ryNqErLus9LfUzxLnwIMXN+IjAmfjfnwb5FZCcmJOcF6q5bSn5+HpdA\n66kKvN7991GZ6iR93tv03/1H7AhKRua5fAan3pardAFAqK9d7WR5Efn7AoGAIGUu\nRahjDWrkFqv/8Njglt8lySRrDjJGTt+W7tcnDgsGOjEVOh7SLEExdLp2uuxzOBvQ\nT6nHv0psaRFTpCS3AlMAK1yH9v1uJqyJ06r30sk64LnV8qgeUa7XCNifBWJaxqa1\n7gU/NWwfsNiXBNiHdKrfOK2f5e/g/CTOl/kgCE8CgYBo9fOsnIwlHikxgqpwq+j/\ngiFQUXcDeds6ke2FVu4Bw+jmw5WiDOYz9nUIRVfQQBYCZq/wuGg336xtvRd6bagl\nhEwBb1Bxs0PXOb9OJXfeN0t+i4QHTN+2Yt4fddvksO7kJeNbWCFmho+ebaKBsfey\nkW7wgMnKrF694aVMXaToiw==\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@studio-gpnfx.iam.gserviceaccount.com",
    client_id: "113149690446202662127",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40studio-gpnfx.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'studio-gpnfx'
  });
}

/**
 * FCM Send API Endpoint
 * POST /api/fcm/send
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { notification, fcmToken, userId } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    // Validate FCM token format
    if (fcmToken.length < 100) {
      console.error('❌ [FCM API] FCM token appears to be truncated. Length:', fcmToken.length);
      return res.status(400).json({ error: 'FCM token appears to be invalid or truncated' });
    }

    if (!notification || !notification.title || !notification.body) {
      return res.status(400).json({ error: 'Notification title and body are required' });
    }

    console.log('🔔 [FCM API] Sending notification to token:', fcmToken.substring(0, 20) + '...');
    console.log('🔔 [FCM API] Full token length:', fcmToken.length);
    console.log('🔔 [FCM API] Token starts with:', fcmToken.substring(0, 10));
    console.log('🔔 [FCM API] Token ends with:', fcmToken.substring(fcmToken.length - 10));

    // Create the FCM message
    // Convert all data values to strings (FCM requirement)
    const stringifiedData = {};
    if (notification.data) {
      Object.keys(notification.data).forEach(key => {
        stringifiedData[key] = String(notification.data[key]);
      });
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        // Add image for better mobile display
        imageUrl: notification.data?.imageUrl || '/fav-icons/android-icon-512x512.png'
      },
      data: {
        ...stringifiedData,
        type: String(notification.data?.type || 'general'),
        recipientId: String(userId || 'unknown'),
        timestamp: Date.now().toString(),
        // Add click action for mobile
        click_action: notification.redirectUrl || '/',
        // Add notification channel for Android 8+
        channel_id: 'ubora_notifications',
        // Add priority for mobile
        priority: 'high'
      },
      android: {
        priority: 'high',
        ttl: 86400000, // 24 hours
        notification: {
          title: notification.title,
          body: notification.body,
          sound: 'default',
          icon: '/fav-icons/android-icon-96x96.png',
          color: '#FF6B35',
          channel_id: 'ubora_notifications',
          click_action: notification.redirectUrl || '/',
          tag: `ubora_${notification.data?.type || 'general'}_${Date.now()}`,
          // Add image for Android
          image: notification.data?.imageUrl || '/fav-icons/android-icon-512x512.png',
          // Add actions for Android
          actions: [
            { action: 'open', title: 'Ouvrir' },
            { action: 'dismiss', title: 'Ignorer' }
          ]
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: 'default',
            badge: 1,
            category: 'UBORA_NOTIFICATION',
            'mutable-content': 1,
            'content-available': 1
          }
        },
        fcm_options: {
          image: notification.data?.imageUrl || '/fav-icons/android-icon-512x512.png'
        }
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: '/fav-icons/android-icon-192x192.png',
          badge: '/fav-icons/android-icon-96x96.png',
          image: notification.data?.imageUrl || '/fav-icons/android-icon-512x512.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            { action: 'open', title: 'Ouvrir', icon: '/fav-icons/android-icon-48x48.png' },
            { action: 'dismiss', title: 'Ignorer', icon: '/fav-icons/android-icon-48x48.png' }
          ]
        },
        fcmOptions: {
          link: notification.redirectUrl || '/'
        }
      }
    };

    // Send the FCM message
    const response = await admin.messaging().send(message);
    
    console.log('🔔 [FCM API] Notification sent successfully:', response);

    return res.status(200).json({
      success: true,
      messageId: response,
      message: 'FCM notification sent successfully'
    });

  } catch (error) {
    console.error('❌ [FCM API] Error sending notification:', error);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/registration-token-not-registered') {
      console.warn('❌ [FCM API] FCM token is not registered or expired');
      return res.status(400).json({
        success: false,
        error: 'FCM token is not registered or expired',
        code: 'token-not-registered',
        details: 'The FCM token is invalid, expired, or not registered. Please regenerate the token.'
      });
    }
    
    if (error.code === 'messaging/invalid-registration-token') {
      console.warn('❌ [FCM API] FCM token is invalid');
      return res.status(400).json({
        success: false,
        error: 'FCM token is invalid',
        code: 'invalid-token',
        details: 'The FCM token format is invalid.'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to send FCM notification',
      details: error.message,
      code: error.code || 'unknown'
    });
  }
};