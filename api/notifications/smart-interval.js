/**
 * Smart Interval Calculator for Notification Cron Jobs
 * 
 * This utility calculates the optimal next check interval based on upcoming notifications.
 * It should be used by external cron services to determine when to call the cron endpoint.
 */

/**
 * Calculate smart interval based on upcoming notifications
 * @param {Array} notifications - Array of scheduled notifications
 * @returns {number} - Next check interval in milliseconds
 */
function calculateSmartInterval(notifications) {
  if (!notifications || notifications.length === 0) {
    // No notifications - check every hour
    return 3600000; // 1 hour
  }

  const now = new Date();
  const upcomingNotifications = notifications
    .filter(n => n.scheduledFor && new Date(n.scheduledFor) > now)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));

  if (upcomingNotifications.length === 0) {
    // No upcoming notifications - check every hour
    return 3600000; // 1 hour
  }

  const nextNotification = upcomingNotifications[0];
  const timeUntilNext = new Date(nextNotification.scheduledFor) - now;

  // Smart interval logic based on urgency
  if (timeUntilNext <= 300000) { // < 5 minutes
    return 30000; // 30 seconds
  } else if (timeUntilNext <= 1800000) { // < 30 minutes
    return 120000; // 2 minutes
  } else if (timeUntilNext <= 7200000) { // < 2 hours
    return 600000; // 10 minutes
  } else {
    return 3600000; // 1 hour
  }
}

/**
 * Get next check time based on smart interval
 * @param {Array} notifications - Array of scheduled notifications
 * @returns {Date} - Next check time
 */
function getNextCheckTime(notifications) {
  const interval = calculateSmartInterval(notifications);
  return new Date(Date.now() + interval);
}

/**
 * Check if cron should run now based on smart interval
 * @param {Array} notifications - Array of scheduled notifications
 * @param {Date} lastCheck - Last check time
 * @returns {boolean} - Whether cron should run now
 */
function shouldRunCron(notifications, lastCheck) {
  const nextCheckTime = getNextCheckTime(notifications);
  return new Date() >= nextCheckTime;
}

/**
 * Get cron schedule recommendations for different platforms
 * @param {Array} notifications - Array of scheduled notifications
 * @returns {Object} - Cron schedule recommendations
 */
function getCronScheduleRecommendations(notifications) {
  const interval = calculateSmartInterval(notifications);
  
  // Convert milliseconds to cron format
  const minutes = Math.floor(interval / 60000);
  const hours = Math.floor(interval / 3600000);
  
  let cronExpression;
  if (interval <= 60000) { // <= 1 minute
    cronExpression = '* * * * *'; // Every minute
  } else if (interval <= 300000) { // <= 5 minutes
    cronExpression = `*/${minutes} * * * *`; // Every N minutes
  } else if (interval <= 3600000) { // <= 1 hour
    cronExpression = `*/${minutes} * * * *`; // Every N minutes
  } else {
    cronExpression = `0 */${hours} * * *`; // Every N hours
  }

  return {
    interval: interval,
    cronExpression: cronExpression,
    description: getIntervalDescription(interval),
    recommendations: {
      vercel: `Run every ${minutes} minutes`,
      github: `Run every ${minutes} minutes`,
      external: `Use cron expression: ${cronExpression}`
    }
  };
}

/**
 * Get human-readable interval description
 * @param {number} interval - Interval in milliseconds
 * @returns {string} - Human-readable description
 */
function getIntervalDescription(interval) {
  if (interval <= 60000) {
    return 'Every minute';
  } else if (interval <= 300000) {
    const minutes = Math.floor(interval / 60000);
    return `Every ${minutes} minutes`;
  } else if (interval <= 3600000) {
    const minutes = Math.floor(interval / 60000);
    return `Every ${minutes} minutes`;
  } else {
    const hours = Math.floor(interval / 3600000);
    return `Every ${hours} hours`;
  }
}

/**
 * Example usage for external cron services
 */
const cronExamples = {
  // Vercel Cron
  vercel: {
    description: 'Add to vercel.json',
    config: {
      "crons": [
        {
          "path": "/api/notifications/cron",
          "schedule": "*/2 * * * *"
        }
      ]
    }
  },
  
  // GitHub Actions
  github: {
    description: 'Add to .github/workflows/notifications.yml',
    config: `
name: Notification Cron
on:
  schedule:
    - cron: '*/2 * * * *'  # Every 2 minutes
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notifications
        run: curl -X GET "$\{\{ secrets.APP_URL \}\}/api/notifications/cron"
    `
  },
  
  // External Cron Service
  external: {
    description: 'Use with any cron service',
    command: 'curl -X GET "https://your-domain.com/api/notifications/cron"',
    schedule: '*/2 * * * *'
  }
};

// CommonJS exports
module.exports = {
  calculateSmartInterval,
  getNextCheckTime,
  shouldRunCron,
  getCronScheduleRecommendations,
  cronExamples
};
