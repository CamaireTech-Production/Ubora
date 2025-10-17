import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ubora.dev',
  appName: 'Ubora Dev',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://dev.ubora-app.com',
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
