// Production cron worker for PM2
// This script runs independently from the main backend server
// and handles all scheduled notifications (form reminders, metric reminders, programmed instructions)

import cronNotificationsHandler from '../api/cron/notifications.js';

console.log('🔄 [CronWorker] Starting production cron worker...');
console.log('🔄 [CronWorker] Environment:', process.env.NODE_ENV || 'development');

// Configuration
const CRON_INTERVAL = 2 * 60 * 1000; // 2 minutes
const STARTUP_DELAY = 10000; // 10 seconds delay after startup

// Track cron job execution
let isRunning = false;
let executionCount = 0;

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
  }
}

// Start the cron worker
console.log(`⏰ [CronWorker] Scheduling cron jobs every ${CRON_INTERVAL / 1000} seconds`);

// Run initial cron job after startup delay
setTimeout(async () => {
  console.log('🚀 [CronWorker] Running initial cron job after startup delay...');
  await runCronJob();
}, STARTUP_DELAY);

// Schedule recurring cron jobs
const cronInterval = setInterval(async () => {
  await runCronJob();
}, CRON_INTERVAL);

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 [CronWorker] Received SIGINT, shutting down gracefully...');
  clearInterval(cronInterval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 [CronWorker] Received SIGTERM, shutting down gracefully...');
  clearInterval(cronInterval);
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ [CronWorker] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [CronWorker] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('✅ [CronWorker] Production cron worker started successfully');
console.log(`📊 [CronWorker] Will run cron jobs every ${CRON_INTERVAL / 1000} seconds`);
console.log(`⏰ [CronWorker] Initial cron job scheduled in ${STARTUP_DELAY / 1000} seconds`);
