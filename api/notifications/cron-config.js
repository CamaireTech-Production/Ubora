/**
 * Unified Notification Cron Job Configuration
 * 
 * This file contains configuration for the unified notification cron job system.
 * It includes smart interval logic and platform-specific cron setups.
 */

// Smart interval configuration
export const SMART_INTERVALS = {
  // High urgency: notifications due in next 5 minutes
  HIGH_URGENCY: {
    threshold: 5 * 60 * 1000, // 5 minutes
    interval: 30 * 1000, // 30 seconds
    description: 'Check every 30 seconds for urgent notifications'
  },
  
  // Medium urgency: notifications due in next 30 minutes
  MEDIUM_URGENCY: {
    threshold: 30 * 60 * 1000, // 30 minutes
    interval: 2 * 60 * 1000, // 2 minutes
    description: 'Check every 2 minutes for medium urgency notifications'
  },
  
  // Low urgency: notifications due in next 2 hours
  LOW_URGENCY: {
    threshold: 2 * 60 * 60 * 1000, // 2 hours
    interval: 10 * 60 * 1000, // 10 minutes
    description: 'Check every 10 minutes for low urgency notifications'
  },
  
  // Default: notifications due later
  DEFAULT: {
    threshold: Infinity,
    interval: 60 * 60 * 1000, // 1 hour
    description: 'Check every hour for future notifications'
  }
};

// Platform-specific cron configurations
export const PLATFORM_CONFIGS = {
  vercel: {
    name: 'Vercel Cron',
    description: 'Built-in cron functionality for Vercel deployments',
    config: {
      "crons": [
        {
          "path": "/api/notifications/cron",
          "schedule": "*/2 * * * *" // Every 2 minutes
        }
      ]
    },
    setup: 'Add to vercel.json in project root',
    advantages: ['Built-in', 'No external dependencies', 'Automatic scaling'],
    disadvantages: ['Vercel-specific', 'Limited to Vercel platform']
  },
  
  github: {
    name: 'GitHub Actions',
    description: 'GitHub Actions workflow for cron jobs',
    config: `
name: Notification Cron
on:
  schedule:
    - cron: '*/2 * * * *'  # Every 2 minutes
  workflow_dispatch:  # Allow manual trigger
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notifications
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/notifications/cron" \\
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
    `,
    setup: 'Create .github/workflows/notifications.yml',
    advantages: ['Free for public repos', 'Flexible', 'Version controlled'],
    disadvantages: ['Requires GitHub repository', 'Limited to GitHub Actions']
  },
  
  external: {
    name: 'External Cron Service',
    description: 'Use with any external cron service (cron-job.org, etc.)',
    config: {
      url: 'https://your-domain.com/api/notifications/cron',
      method: 'GET',
      schedule: '*/2 * * * *', // Every 2 minutes
      headers: {
        'Authorization': 'Bearer YOUR_CRON_SECRET'
      }
    },
    setup: 'Configure in your preferred cron service',
    advantages: ['Platform independent', 'Flexible scheduling', 'Reliable'],
    disadvantages: ['External dependency', 'May require payment']
  }
};

// Notification type configurations
export const NOTIFICATION_CONFIGS = {
  form_assignment: {
    priority: 'high',
    maxRetries: 3,
    retryDelay: 30000, // 30 seconds
    description: 'Form assignment notifications'
  },
  
  form_reminder: {
    priority: 'high',
    maxRetries: 3,
    retryDelay: 30000, // 30 seconds
    description: 'Form reminder notifications'
  },
  
  metric_reminder: {
    priority: 'medium',
    maxRetries: 2,
    retryDelay: 60000, // 1 minute
    description: 'Metric reminder notifications'
  },
  
  programmed_instruction: {
    priority: 'medium',
    maxRetries: 2,
    retryDelay: 60000, // 1 minute
    description: 'Programmed instruction notifications'
  }
};

// Error handling configurations
export const ERROR_CONFIGS = {
  FCM_TOKEN_INVALID: {
    action: 'mark_failed',
    retry: false,
    description: 'FCM token is invalid or expired'
  },
  
  FCM_TOKEN_NOT_REGISTERED: {
    action: 'mark_failed',
    retry: false,
    description: 'FCM token is not registered'
  },
  
  USER_NOT_FOUND: {
    action: 'mark_failed',
    retry: false,
    description: 'User not found in database'
  },
  
  NETWORK_ERROR: {
    action: 'retry',
    maxRetries: 3,
    retryDelay: 30000,
    description: 'Network error during FCM send'
  },
  
  UNKNOWN_ERROR: {
    action: 'retry',
    maxRetries: 2,
    retryDelay: 60000,
    description: 'Unknown error occurred'
  }
};

// Monitoring and logging configurations
export const MONITORING_CONFIG = {
  logLevel: 'info', // 'debug', 'info', 'warn', 'error'
  enableMetrics: true,
  enableAlerts: true,
  alertThresholds: {
    failureRate: 0.1, // 10% failure rate
    processingTime: 30000, // 30 seconds
    queueSize: 100 // 100 notifications
  }
};

// Health check endpoint configuration
export const HEALTH_CHECK_CONFIG = {
  endpoint: '/api/notifications/health',
  checks: [
    'database_connection',
    'fcm_service',
    'notification_queue',
    'error_rate'
  ],
  timeout: 5000, // 5 seconds
  interval: 60000 // 1 minute
};

export default {
  SMART_INTERVALS,
  PLATFORM_CONFIGS,
  NOTIFICATION_CONFIGS,
  ERROR_CONFIGS,
  MONITORING_CONFIG,
  HEALTH_CHECK_CONFIG
};
