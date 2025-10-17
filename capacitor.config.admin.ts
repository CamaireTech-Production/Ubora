import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ubora.admin',
  appName: 'Ubora Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://ubora-app.com/admin',
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'fav-icons/android-icon-48x48.png',
      iconColor: '#3b82f6',
      sound: 'default',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
