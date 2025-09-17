# Push Notifications Setup Guide

## 🔔 Firebase Cloud Messaging (FCM) Configuration

### 1. Generate VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `studio-gpnfx`
3. Go to **Project Settings** → **Cloud Messaging** tab
4. Scroll down to **Web configuration**
5. Click **Generate key pair** under **Web push certificates**
6. Copy the generated key

### 2. Add VAPID Key to Environment

Add the VAPID key to your `.env.local` file:

```bash
# .env.local
VITE_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_HERE
```

### 3. Update Firebase Service Worker

The service worker is already configured at `public/firebase-messaging-sw.js` with your Firebase config.

### 4. Test Push Notifications

#### For Development:
1. Install the PWA on your device/browser
2. Go to `/notifications` page
3. Enable push notifications
4. Use the test panel to send notifications

#### For Production:
1. Deploy your app with HTTPS
2. Users install the PWA
3. They enable notifications in settings
4. Send notifications via the API

## 📱 Platform Support

### ✅ Android (Chrome/Edge)
- Full support when PWA is installed
- Notifications appear in system tray
- Click to open app

### ✅ Desktop (Windows/Mac/Linux)
- Full support when PWA is installed
- Native OS notifications
- Click to focus app

### ⚠️ iOS (Safari)
- Limited support
- Requires iOS 16.4+
- Must be added to home screen
- Some limitations with background notifications

## 🧪 Testing Notifications

### 1. Manual Testing
- Use the test panel in `/notifications`
- Send notifications between users
- Test different notification types

### 2. API Testing
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "role": "employe",
    "title": "Test Notification",
    "body": "This is a test message",
    "data": {"test": true}
  }'
```

### 3. Browser Testing
- Open DevTools → Application → Service Workers
- Check if `firebase-messaging-sw.js` is registered
- Test notification permissions

## 🔧 Troubleshooting

### Common Issues:

1. **"Messaging not supported"**
   - Ensure HTTPS in production
   - Check browser compatibility
   - Verify service worker registration

2. **"Permission denied"**
   - User must manually allow notifications
   - Check browser notification settings
   - Clear site data and retry

3. **"No FCM token"**
   - Check VAPID key configuration
   - Verify Firebase project settings
   - Ensure service worker is active

4. **Notifications not received**
   - Check if app is in background
   - Verify FCM token is valid
   - Check Firebase console for delivery status

## 📋 Notification Types

The app supports these notification types:

- **form_submission**: New form submitted
- **director_message**: Message from director
- **system_alert**: System notifications
- **reminder**: Reminder notifications

## 🚀 Production Deployment

1. Ensure HTTPS is enabled
2. Update VAPID key in production environment
3. Test on real devices
4. Monitor Firebase console for delivery metrics
5. Set up notification analytics

## 📊 Monitoring

- Firebase Console → Cloud Messaging
- Check delivery rates and errors
- Monitor token validity
- Track user engagement
