import React from 'react';
import { PushNotificationTester } from '../components/PushNotificationTester';

export const NotificationTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Push Notification Testing
          </h1>
          <p className="text-gray-600">
            Test and verify push notification functionality across different platforms
          </p>
        </div>
        
        <PushNotificationTester />
        
        <div className="mt-8 p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Testing Instructions</h2>
          <div className="space-y-4 text-gray-600">
            <div>
              <h3 className="font-medium text-gray-800">For Desktop Testing:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Click "Run Comprehensive Test" to check all components</li>
                <li>If permission is not granted, click "Request Permission"</li>
                <li>Click "Send Test Notification" to test FCM integration</li>
                <li>Check browser console for detailed logs</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-800">For Mobile Testing:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Ensure the app is installed as a PWA (Progressive Web App)</li>
                <li>Use Chrome, Firefox, or Safari on mobile devices</li>
                <li>For iOS: Requires iOS 16.4+ and Safari or installed PWA</li>
                <li>For Android: Works with Chrome, Firefox, or Edge</li>
                <li>Test background notifications by closing the app and sending a notification</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-800">Troubleshooting:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Check device notification settings for the app</li>
                <li>Ensure the app has notification permissions</li>
                <li>Verify VAPID key is configured in environment variables</li>
                <li>Check browser console for error messages</li>
                <li>Test on different browsers and devices</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

