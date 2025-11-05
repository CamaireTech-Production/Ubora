# Unified Notification System

This directory contains the unified notification system for the Ubora application, including the backend cron job API and smart interval logic.

## 🚀 Overview

The unified notification system handles 4 core notification types:
- **`form_assignment`** - Form assignment/unassignment notifications
- **`form_reminder`** - Form reminder notifications (1h, 30min, 15min, 5min)
- **`metric_reminder`** - Metric reminder notifications for directors
- **`programmed_instruction`** - Programmed instruction execution notifications

## 📁 Files

### Core API Endpoints

- **`cron.js`** - Main cron job endpoint that processes due notifications
- **`health.js`** - Health check endpoint for monitoring system status
- **`smart-interval.js`** - Smart interval calculation utilities
- **`cron-config.js`** - Configuration for different platforms and settings

## 🔧 Setup

### 1. Environment Variables

Ensure these environment variables are set:

```bash
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_CLIENT_ID=your_client_id
```

### 2. Cron Job Setup

Choose one of the following platforms:

#### Option A: Vercel Cron (Recommended)
Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/cron",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

#### Option B: GitHub Actions
Create `.github/workflows/notifications.yml`:

```yaml
name: Notification Cron
on:
  schedule:
    - cron: '*/2 * * * *'
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notifications
        run: curl -X GET "${{ secrets.APP_URL }}/api/notifications/cron"
```

#### Option C: External Cron Service
Use any external cron service (cron-job.org, etc.) with:
- URL: `https://your-domain.com/api/notifications/cron`
- Method: GET
- Schedule: `*/2 * * * *` (every 2 minutes)

## 📊 API Endpoints

### GET /api/notifications/cron

Main cron job endpoint that processes due notifications.

**Query Parameters:**
- `agencyId` (optional) - Limit to specific agency
- `limit` (optional) - Max notifications to process (default: 50)

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 notifications",
  "processed": 5,
  "sent": 4,
  "failed": 1,
  "duration": 1250
}
```

### GET /api/notifications/health

Health check endpoint for monitoring system status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "responseTime": 150,
  "checks": {
    "database": { "status": "healthy", "responseTime": 50 },
    "fcm": { "status": "healthy", "responseTime": 30 },
    "queue": { "status": "healthy", "count": 10, "dueCount": 2 },
    "metrics": { "status": "healthy", "data": { "sentLastHour": 5, "failureRate": 0.1 } }
  }
}
```

## 🧠 Smart Interval Logic

The system uses smart intervals to optimize cron job frequency:

- **< 5 minutes**: Check every 30 seconds
- **< 30 minutes**: Check every 2 minutes
- **< 2 hours**: Check every 10 minutes
- **> 2 hours**: Check every hour

## 🔄 Notification Flow

1. **Frontend** creates notification → Firestore
2. **Cron job** checks Firestore for due notifications
3. **FCM service** sends push notification to user's device
4. **Service worker** handles notification display and clicks
5. **Frontend** handles navigation and page highlighting

## 📱 Notification Types & Redirects

### Form Assignment
- **Redirect**: `/forms`
- **Action**: Highlight assigned form (auto-scroll)
- **Data**: `{ formId, action: 'highlight' }`

### Form Reminder
- **Redirect**: `/directeur/dashboard` or `/employe/dashboard` (based on user role)
- **Action**: Direct to dashboard with form filling interface
- **Data**: `{ formId, action: 'fill_form' }`

### Metric Reminder
- **Redirect**: `/dashboard/{dashboardId}`
- **Action**: Highlight specific metric (auto-scroll)
- **Data**: `{ dashboardId, metricId, action: 'highlight_metric' }`

### Programmed Instruction
- **Redirect**: `/instructions/{instructionId}/response`
- **Action**: Show response interface
- **Data**: `{ instructionId, action: 'show_response' }`

## 🚨 Error Handling

The system handles various error scenarios:

- **Invalid FCM Token**: Mark as failed, don't retry
- **User Not Found**: Mark as failed, don't retry
- **Network Error**: Retry up to 3 times
- **Unknown Error**: Retry up to 2 times

## 📈 Monitoring

### Health Check
Monitor system health at `/api/notifications/health`

### Metrics
- Sent notifications per hour
- Failed notifications per hour
- Failure rate
- Queue size
- Processing time

### Alerts
Configure alerts for:
- High failure rate (>10%)
- Long processing time (>30s)
- Large queue size (>100 notifications)

## 🔧 Configuration

### Smart Intervals
```javascript
const SMART_INTERVALS = {
  HIGH_URGENCY: { threshold: 5 * 60 * 1000, interval: 30 * 1000 },
  MEDIUM_URGENCY: { threshold: 30 * 60 * 1000, interval: 2 * 60 * 1000 },
  LOW_URGENCY: { threshold: 2 * 60 * 60 * 1000, interval: 10 * 60 * 1000 },
  DEFAULT: { threshold: Infinity, interval: 60 * 60 * 1000 }
};
```

### Notification Priorities
```javascript
const NOTIFICATION_CONFIGS = {
  form_assignment: { priority: 'high', maxRetries: 3 },
  form_reminder: { priority: 'high', maxRetries: 3 },
  metric_reminder: { priority: 'medium', maxRetries: 2 },
  programmed_instruction: { priority: 'medium', maxRetries: 2 }
};
```

## 🧪 Testing

### Manual Testing
```bash
# Test cron job
curl -X GET "https://your-domain.com/api/notifications/cron"

# Test health check
curl -X GET "https://your-domain.com/api/notifications/health"
```

### Automated Testing
Use the health check endpoint in your monitoring system to ensure the notification system is working properly.

## 🚀 Deployment

1. Deploy the API endpoints to your hosting platform
2. Set up the cron job using one of the platform options
3. Monitor the health check endpoint
4. Test with a sample notification

## 📝 Notes

- The system is designed to be fault-tolerant and self-healing
- FCM tokens are automatically validated and invalid tokens are marked as failed
- The smart interval system reduces unnecessary API calls
- All notifications include proper redirect URLs and action data for seamless user experience
