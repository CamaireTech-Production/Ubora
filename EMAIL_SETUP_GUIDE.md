# Email Configuration Guide

## Overview
The email service is configured to send real emails using Hostinger SMTP. This guide explains how to set it up.

## Environment Variables Required

Add these environment variables to your `.env.local` file (at the project root) or server environment:

```bash
# Common email configuration
EMAIL_USER=your-email@yourdomain.com        # SMTP auth username
EMAIL_PASSWORD=your-email-password          # SMTP auth password (Gmail: App Password)
EMAIL_HOST=smtp.titan.email                 # SMTP host (see providers below)
EMAIL_PORT=587                              # 587 for TLS, 465 for SSL
EMAIL_SECURE=false                          # true only if using port 465

# Optional: Customize sender details (defaults to EMAIL_USER and "Ubora App")
EMAIL_FROM=notifications@yourdomain.com
EMAIL_FROM_NAME=Ubora App
```

## Hostinger Email Setup Instructions

### 1. Get Your Email Credentials
- Log into your Hostinger control panel
- Go to Email section
- Note your email address and password
- Use these as `EMAIL_USER` and `EMAIL_PASSWORD`

### 2. SMTP Settings
- **Host**: `smtp.hostinger.com` (or `smtp.titan.email` for Titan)
- **Port**: `587` (for TLS) or `465` (for SSL)
- **Security**: TLS (recommended) or SSL
- **Authentication**: Required

### 3. Set Environment Variables
```bash
EMAIL_USER=your-actual-email@yourdomain.com
EMAIL_PASSWORD=your-actual-email-password
EMAIL_HOST=smtp.titan.email
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM=notifications@yourdomain.com
EMAIL_FROM_NAME=Ubora App
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

## Provider Examples

### Titan (Hostinger Power Titan)
```bash
EMAIL_USER=sender@yourdomain.com
EMAIL_PASSWORD=your-strong-password
EMAIL_HOST=smtp.titan.email
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM=notifications@yourdomain.com
EMAIL_FROM_NAME=Ubora App
```

### Gmail (REQUIRES App Password - regular password will NOT work)
```bash
EMAIL_USER=uboraarcha@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx   # 16-character App Password (no spaces in .env)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM=uboraarcha@gmail.com
EMAIL_FROM_NAME=Ubora App
```

**⚠️ IMPORTANT: Gmail App Password Setup (Required)**

Gmail does NOT accept regular passwords for SMTP. You MUST use an App Password:

1. **Enable 2-Step Verification** (required):
   - Go to: https://myaccount.google.com/security
   - Enable "2-Step Verification" if not already enabled

2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Other (Custom name)" as device, enter "Ubora SMTP"
   - Click "Generate"
   - Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

3. **Update .env.local**:
   - Use the 16-character App Password (you can remove spaces)
   - Example: `EMAIL_PASSWORD=abcdefghijklmnop` or `EMAIL_PASSWORD=abcd efgh ijkl mnop`

4. **Test the configuration**:
   ```bash
   node scripts/test-email.js
   ```

**Common Errors:**
- `535-5.7.8 BadCredentials`: You're using your regular password instead of App Password
- `Invalid login`: Double-check the App Password was copied correctly

**Notes:**
- If using port 465, set `EMAIL_SECURE=true` and `EMAIL_PORT=465`
- App Passwords are secure - they only work for SMTP and can be revoked anytime
