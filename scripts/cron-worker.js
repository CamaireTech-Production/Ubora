// Production cron worker for PM2
// This script runs independently from the main backend server
// and handles all scheduled notifications (form reminders, metric reminders, programmed instructions)

import cronNotificationsHandler from '../api/cron/notifications.js';
import { getNextNotificationTime } from '../api/cron/notifications.js';

console.log('🔄 [CronWorker] Starting production cron worker...');
console.log('🔄 [CronWorker] Environment:', process.env.NODE_ENV || 'development');

// Configuration
const DEFAULT_INTERVAL = 2 * 60 * 1000; // 2 minutes default
const STARTUP_DELAY = 10000; // 10 seconds delay after startup
const MIN_INTERVAL = 30 * 1000; // Minimum 30 seconds between runs
const MAX_INTERVAL = 60 * 60 * 1000; // Maximum 1 hour between runs

// Track cron job execution
let isRunning = false;
let executionCount = 0;
let currentTimeoutId = null;

// Run cron job function
async function runCronJob() {
  if (isRunning) {
    console.log('⚠️ [CronWorker] Previous cron job still running, skipping this execution');
    return;
  }

  isRunning = true;
  executionCount++;
  
  try {
    console.log(`🔄 [CronWorker] Running cron job #${executionCount}...`);
    
    // Create a mock request/response for the cron handler
    const mockReq = {
      method: 'POST',
      body: {},
      headers: {
        'user-agent': 'CronWorker/1.0',
        'x-cron-execution': executionCount.toString()
      }
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`📊 [CronWorker] Cron job #${executionCount} result:`, {
            success: data.success,
            processed: data.processed || 0,
            sent: data.sent || 0,
            errors: data.errors || 0,
            timestamp: data.timestamp
          });
          return mockRes;
        }
      }),
      setHeader: () => mockRes,
      end: () => mockRes
    };
    
    // Call the cron handler
    await cronNotificationsHandler(mockReq, mockRes);
    
    console.log(`✅ [CronWorker] Cron job #${executionCount} completed successfully`);
    
  } catch (error) {
    console.error(`❌ [CronWorker] Error in cron job #${executionCount}:`, error);
  } finally {
    isRunning = false;
    // Schedule next run after completion using smart intervals
    await scheduleNextRun();
  }
}

/**
 * Calculate smart interval based on next notification time
 */
function calculateSmartInterval(nextNotificationTime) {
  if (!nextNotificationTime) {
    return MAX_INTERVAL; // No notifications - check every hour
  }

  const now = new Date();
  const timeUntilNext = nextNotificationTime.getTime() - now.getTime();

  // Smart interval logic based on urgency
  if (timeUntilNext <= 5 * 60 * 1000) {
    // < 5 minutes - check every 30 seconds
    return Math.max(MIN_INTERVAL, 30 * 1000);
  } else if (timeUntilNext <= 30 * 60 * 1000) {
    // < 30 minutes - check every 2 minutes
    return 2 * 60 * 1000;
  } else if (timeUntilNext <= 2 * 60 * 60 * 1000) {
    // < 2 hours - check every 10 minutes
    return 10 * 60 * 1000;
  } else {
    // > 2 hours - check every hour
    return MAX_INTERVAL;
  }
}

/**
 * Schedule next cron run using smart intervals
 */
async function scheduleNextRun() {
  try {
    // Get next notification time
    const nextNotificationTime = await getNextNotificationTime();
    
    // Calculate smart interval
    const interval = calculateSmartInterval(nextNotificationTime);
    
    console.log(`⏰ [CronWorker] Next notification: ${nextNotificationTime ? nextNotificationTime.toISOString() : 'None'}`);
    console.log(`⏰ [CronWorker] Smart interval: ${interval / 1000} seconds (${interval / 60000} minutes)`);
    
    // Clear any existing timeout
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId);
    }
    
    // Schedule next run
    currentTimeoutId = setTimeout(async () => {
      await runCronJob();
      // runCronJob will schedule the next run automatically in its finally block
    }, interval);
    
  } catch (error) {
    console.error('❌ [CronWorker] Error scheduling next run:', error);
    // Fallback to default interval on error
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId);
    }
    currentTimeoutId = setTimeout(async () => {
      await runCronJob();
      // runCronJob will schedule the next run automatically
    }, DEFAULT_INTERVAL);
  }
}

// Start the cron worker
console.log(`⏰ [CronWorker] Starting smart interval cron worker...`);

// Run initial cron job after startup delay
setTimeout(async () => {
  console.log('🚀 [CronWorker] Running initial cron job after startup delay...');
  await runCronJob();
  // runCronJob will schedule the next run automatically
}, STARTUP_DELAY);

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 [CronWorker] Received SIGINT, shutting down gracefully...');
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 [CronWorker] Received SIGTERM, shutting down gracefully...');
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ [CronWorker] Uncaught Exception:', error);
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [CronWorker] Unhandled Rejection at:', promise, 'reason:', reason);
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }
  process.exit(1);
});

console.log('✅ [CronWorker] Production cron worker started successfully');
console.log(`📊 [CronWorker] Using smart intervals based on upcoming notifications`);
console.log(`⏰ [CronWorker] Initial cron job scheduled in ${STARTUP_DELAY / 1000} seconds`);
