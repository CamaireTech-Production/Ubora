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
 * Health Check Endpoint for Notification System
 * GET /api/notifications/health
 * 
 * This endpoint provides health status of the notification system including:
 * - Database connectivity
 * - FCM service status
 * - Notification queue status
 * - Error rates and performance metrics
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const healthChecks = {
    database: { status: 'unknown', responseTime: 0, error: null },
    fcm: { status: 'unknown', responseTime: 0, error: null },
    queue: { status: 'unknown', responseTime: 0, error: null, count: 0 },
    metrics: { status: 'unknown', responseTime: 0, error: null, data: {} }
  };

  try {
    // Check database connectivity
    await checkDatabaseHealth(healthChecks);
    
    // Check FCM service
    await checkFCMHealth(healthChecks);
    
    // Check notification queue
    await checkQueueHealth(healthChecks);
    
    // Get system metrics
    await getSystemMetrics(healthChecks);

    const totalTime = Date.now() - startTime;
    const overallStatus = determineOverallStatus(healthChecks);

    return res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalTime,
      checks: healthChecks,
      uptime: process.uptime(),
      version: '1.0.0'
    });

  } catch (error) {
    console.error('🔔 [HealthCheck] Error in health check:', error);
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      checks: healthChecks
    });
  }
}

/**
 * Check database connectivity and performance
 */
async function checkDatabaseHealth(healthChecks) {
  const startTime = Date.now();
  
  try {
    // Test database connection with a simple query
    const testQuery = db.collection('notifications').limit(1);
    await testQuery.get();
    
    healthChecks.database = {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      error: null
    };
  } catch (error) {
    healthChecks.database = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Check FCM service health
 */
async function checkFCMHealth(healthChecks) {
  const startTime = Date.now();
  
  try {
    // Test FCM service by checking if admin.messaging() is available
    const messaging = admin.messaging();
    if (!messaging) {
      throw new Error('FCM messaging service not available');
    }
    
    healthChecks.fcm = {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      error: null
    };
  } catch (error) {
    healthChecks.fcm = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Check notification queue health
 */
async function checkQueueHealth(healthChecks) {
  const startTime = Date.now();
  
  try {
    // Get count of scheduled notifications
    const scheduledQuery = db.collection('notifications')
      .where('status', '==', 'scheduled');
    
    const scheduledSnapshot = await scheduledQuery.get();
    const scheduledCount = scheduledSnapshot.size;
    
    // Get count of due notifications
    const dueQuery = db.collection('notifications')
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', new Date());
    
    const dueSnapshot = await dueQuery.get();
    const dueCount = dueSnapshot.size;
    
    healthChecks.queue = {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      error: null,
      count: scheduledCount,
      dueCount: dueCount
    };
  } catch (error) {
    healthChecks.queue = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message,
      count: 0,
      dueCount: 0
    };
  }
}

/**
 * Get system metrics
 */
async function getSystemMetrics(healthChecks) {
  const startTime = Date.now();
  
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get notification statistics
    const [sentStats, failedStats, scheduledStats] = await Promise.all([
      // Sent notifications in last hour
      db.collection('notifications')
        .where('status', '==', 'sent')
        .where('sentAt', '>=', oneHourAgo)
        .get(),
      
      // Failed notifications in last hour
      db.collection('notifications')
        .where('status', '==', 'failed')
        .where('sentAt', '>=', oneHourAgo)
        .get(),
      
      // Scheduled notifications
      db.collection('notifications')
        .where('status', '==', 'scheduled')
        .get()
    ]);
    
    const sentCount = sentStats.size;
    const failedCount = failedStats.size;
    const scheduledCount = scheduledStats.size;
    const totalProcessed = sentCount + failedCount;
    const failureRate = totalProcessed > 0 ? failedCount / totalProcessed : 0;
    
    healthChecks.metrics = {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      error: null,
      data: {
        sentLastHour: sentCount,
        failedLastHour: failedCount,
        scheduled: scheduledCount,
        failureRate: Math.round(failureRate * 100) / 100,
        totalProcessed: totalProcessed
      }
    };
  } catch (error) {
    healthChecks.metrics = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message,
      data: {}
    };
  }
}

/**
 * Determine overall system health status
 */
function determineOverallStatus(healthChecks) {
  const criticalChecks = ['database', 'fcm'];
  const hasCriticalFailure = criticalChecks.some(
    check => healthChecks[check].status === 'unhealthy'
  );
  
  if (hasCriticalFailure) {
    return 'unhealthy';
  }
  
  const allHealthy = Object.values(healthChecks).every(
    check => check.status === 'healthy'
  );
  
  return allHealthy ? 'healthy' : 'degraded';
}
