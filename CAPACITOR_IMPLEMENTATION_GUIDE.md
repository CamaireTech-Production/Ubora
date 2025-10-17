# Capacitor Hybrid Implementation Guide

## 🎯 Overview

This project now supports a **hybrid approach** using Capacitor, allowing the same codebase to work as both a PWA and native apps with enhanced notification capabilities.

## 📱 Deployment Options

### 1. PWA (Progressive Web App)
- **Installation**: Via browser "Add to Home Screen"
- **Platform**: Web (enhanced with Capacitor APIs)
- **Notifications**: Improved web notifications via Capacitor
- **Access**: Direct web access

### 2. Native Apps
- **Installation**: Via Google Play Store / Apple App Store
- **Platform**: Android / iOS
- **Notifications**: Full native notification control with pop-up behavior
- **Access**: Native app experience

## 🔧 Environment Configurations

### Development Environment
```bash
# Build for development
npm run build:dev

# Copy custom icons and sync with Capacitor (dev config)
npm run cap:copy-icons
npm run cap:sync:dev

# Open Android Studio
npm run cap:open:android
```

### Production Environment
```bash
# Build for production
npm run build:prod

# Copy custom icons and sync with Capacitor (prod config)
npm run cap:copy-icons
npm run cap:sync:prod

# Open Android Studio
npm run cap:open:android
```

### Admin Environment
```bash
# Build for admin
npm run build:admin

# Copy custom icons and sync with Capacitor (admin config)
npm run cap:copy-icons
npm run cap:sync:admin

# Open Android Studio
npm run cap:open:android
```

## 🚀 Key Features Implemented

### 1. Custom Icons Integration
- **File**: `scripts/copy-icons.js`
- **Features**:
  - Automatically copies your custom Ubora icons to Android project
  - Replaces default Capacitor icons with your branded icons
  - Supports all Android icon densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
  - Includes app launcher, round, and notification icons

### 2. Enhanced Notification Service
- **File**: `src/services/capacitorNotificationService.ts`
- **Features**:
  - Unified API for both PWA and native
  - Automatic platform detection
  - Native notification channels (Android)
  - Push notification support
  - Fallback to web notifications

### 3. Platform Detection
```typescript
import { Capacitor } from '@capacitor/core';

// Detect platform
const platform = Capacitor.getPlatform(); // 'web', 'android', 'ios'
const isNative = Capacitor.isNativePlatform(); // true/false
```

### 4. Notification Usage
```typescript
import { capacitorNotificationService } from '../services/capacitorNotificationService';

// Show notification (works on both PWA and native)
await capacitorNotificationService.showNotification({
  title: 'Ubora Notification',
  body: 'You have a new message',
  data: { url: '/dashboard' }
});
```

## 📊 App Configurations

### Main App (Ubora)
- **Bundle ID**: `com.ubora.app`
- **App Name**: `Ubora`
- **URL**: `https://ubora-app.com`

### Development App (Ubora Dev)
- **Bundle ID**: `com.ubora.dev`
- **App Name**: `Ubora Dev`
- **URL**: `https://dev.ubora-app.com`

### Admin App (Ubora Admin)
- **Bundle ID**: `com.ubora.admin`
- **App Name**: `Ubora Admin`
- **URL**: `https://ubora-app.com/admin`

## 🎯 Testing

### PWA Testing
1. Open your website in browser
2. Install as PWA via "Add to Home Screen"
3. Test notifications using the test page
4. Check console for Capacitor platform detection

### Native App Testing
1. Build the app: `npm run build:dev`
2. Sync with Capacitor: `npm run cap:sync:dev`
3. Open in Android Studio: `npm run cap:open:android`
4. Run on device/emulator
5. Test native notifications

## 🔍 Notification Behavior

### PWA Mode
- Uses enhanced web notifications via Capacitor
- Better than standard web notifications
- Still limited by browser capabilities
- May not show pop-ups depending on browser settings

### Native Mode
- Full native notification control
- True pop-up behavior (heads-up notifications)
- Native notification channels
- Works like WhatsApp notifications

## 📱 User Experience

### For PWA Users
- Same installation process (browser)
- Enhanced notification capabilities
- Better performance
- No app store required

### For Native App Users
- Download from app stores
- Full native features
- True pop-up notifications
- Better integration with device

## 🚀 Next Steps

### Phase 1: Testing (Current)
- Test PWA with Capacitor enhancements
- Verify notification improvements
- Test on different devices/browsers

### Phase 2: Native App Development
- Configure Android notification channels
- Set up iOS push notifications
- Test native app builds

### Phase 3: App Store Deployment
- Prepare app store listings
- Configure app store metadata
- Submit for review

## 🔧 Troubleshooting

### Common Issues

1. **Notifications not working in PWA**
   - Check browser notification permissions
   - Verify service worker is active
   - Check console for Capacitor logs

2. **Native app build fails**
   - Ensure Android Studio is installed
   - Check Capacitor sync completed successfully
   - Verify all dependencies installed

3. **Platform detection issues**
   - Check Capacitor initialization in main.tsx
   - Verify Capacitor imports are correct
   - Check console for platform detection logs

### Debug Commands
```bash
# Check Capacitor status
npx cap doctor

# Sync and check for issues
npx cap sync

# Open native projects for debugging
npx cap open android
npx cap open ios
```

## 📚 Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Local Notifications Plugin](https://capacitorjs.com/docs/apis/local-notifications)
- [Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Android Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)
