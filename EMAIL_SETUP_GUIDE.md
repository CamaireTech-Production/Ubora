# Email Configuration Guide

## Overview
The email service is configured to send real emails using Hostinger SMTP. This guide explains how to set it up.

## Environment Variables Required

Add these environment variables to your `.env.local` file or server environment:

```bash
# Email Configuration for Hostinger
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASSWORD=your-email-password
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

## Hostinger Email Setup Instructions

### 1. Get Your Email Credentials
- Log into your Hostinger control panel
- Go to Email section
- Note your email address and password
- Use these as `EMAIL_USER` and `EMAIL_PASSWORD`

### 2. SMTP Settings
- **Host**: `smtp.hostinger.com`
- **Port**: `587` (for TLS) or `465` (for SSL)
- **Security**: TLS (recommended) or SSL
- **Authentication**: Required

### 3. Set Environment Variables
```bash
EMAIL_USER=your-actual-email@yourdomain.com
EMAIL_PASSWORD=your-actual-email-password
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

## How It Works

### Triple Delivery System
1. **Browser Notification**: Shows immediately (pop-up, sound, system tray)
2. **FCM Push**: Tries to send push notification to mobile devices
3. **Email**: Sends email to director's email address as fallback

### Email Recipients
- **Form Assignment**: Sent to the employee who was assigned/unassigned
- **Form Reminder**: Sent to the employee who needs to fill the form
- **Metric Reminder**: Sent to the director who set up the metric
- **Programmed Instruction**: Sent to the director who created the instruction

### Email Content
Each notification type has customized email templates:
- **Form Assignment**: "Nouveau formulaire assigné - [Form Title]"
- **Form Reminder**: "Rappel de formulaire - [Form Title]"
- **Metric Reminder**: "Rappel de métrique - [Metric Name]"
- **Programmed Instruction**: "Instruction programmée exécutée - [Instruction Title]"

## Testing

### Without Email Configuration
If `EMAIL_USER` and `EMAIL_PASSWORD` are not set, the system will:
- Log email content to console
- Return success response
- Continue with Browser and FCM notifications

### With Email Configuration
When properly configured, emails will be sent to:
- Director email addresses from user profiles
- Employee email addresses from user profiles
- Real Hostinger SMTP delivery

## Troubleshooting

### Common Issues
1. **"Invalid login"**: Check EMAIL_USER and EMAIL_PASSWORD
2. **"ECONNREFUSED"**: Check EMAIL_HOST and EMAIL_PORT settings
3. **"Authentication failed"**: Verify your email credentials with Hostinger

### Logs
Check server logs for email delivery status:
```
📧 [Email] Sending email to: director@example.com
📧 [Email] Subject: Nouveau formulaire assigné - Test Formulaire
📧 [Email] ✅ Email sent successfully: <message-id>
```

## Alternative Email Providers

If you prefer other email providers, modify `api/email/send.js`:

### SendGrid
```javascript
const transporter = nodemailer.createTransporter({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});
```

### Mailgun
```javascript
const transporter = nodemailer.createTransporter({
  service: 'Mailgun',
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASSWORD
  }
});
```

### AWS SES
```javascript
const transporter = nodemailer.createTransporter({
  service: 'SES',
  auth: {
    user: process.env.AWS_ACCESS_KEY_ID,
    pass: process.env.AWS_SECRET_ACCESS_KEY
  }
});
```
