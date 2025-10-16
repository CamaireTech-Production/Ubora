import React, { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { showEnhancedNotification, isIOS, checkIOSSupport } from '../utils/notificationOptions';
// Removed useAuth import for pure frontend notifications

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp?: Date;
}

export const PushNotificationTester: React.FC = () => {
  // Removed unused user import for pure frontend notifications
  const pushNotifications = usePushNotifications();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const addTestResult = (test: string, status: 'success' | 'error', message: string) => {
    setTestResults(prev => [...prev, {
      test,
      status,
      message,
      timestamp: new Date()
    }]);
  };

  const runComprehensiveTest = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    // Test 1: Enhanced support check with iOS detection
    const basicSupported = pushNotifications.isSupported;
    const iosSupported = isIOS() ? checkIOSSupport() : true;
    const isSupported = basicSupported && iosSupported;
    
    addTestResult(
      'Basic Support',
      isSupported ? 'success' : 'error',
      isSupported 
        ? `Push notifications are supported${isIOS() ? ' (iOS 16.4+)' : ''}` 
        : `Not supported: ${isIOS() ? 'iOS version too old (16.4+ required)' : pushNotifications.error}`
    );

    // Test 2: Check platform detection
    addTestResult(
      'Platform Detection',
      'success',
      `Detected platform: ${pushNotifications.platform} (iOS: ${pushNotifications.isIOS}, Android: ${pushNotifications.isAndroid}, Desktop: ${pushNotifications.isDesktop})`
    );

    // Test 3: Enhanced permission check with iOS handling
    const permissionStatus = pushNotifications.permission.granted ? 'granted' : 
                            pushNotifications.permission.denied ? 'denied' : 'default';
    const hasPermission = pushNotifications.permission.granted;
    
    addTestResult(
      'Permission Status',
      hasPermission ? 'success' : 'error',
      `Permission: ${permissionStatus}${isIOS() ? ' (iOS requires user gesture)' : ''}`
    );

    // Test 4: Check FCM token
    if (pushNotifications.token) {
      addTestResult(
        'FCM Token',
        'success',
        `Token generated: ${pushNotifications.token.substring(0, 20)}...`
      );
    } else {
      addTestResult(
        'FCM Token',
        'error',
        'No FCM token available'
      );
    }

    // Test 5: Check service worker registration
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        addTestResult(
          'Service Worker',
          'success',
          `Service worker registered: ${registration.active?.scriptURL}`
        );
      } else {
        addTestResult(
          'Service Worker',
          'error',
          'No service worker registration found'
        );
      }
    } catch (error) {
      addTestResult(
        'Service Worker',
        'error',
        `Service worker check failed: ${error}`
      );
    }

    // Test 6: Enhanced foreground notification with pop-up behavior
    try {
      const success = await showEnhancedNotification(
        'Test Foreground Notification',
        'This is a test notification with pop-up behavior and highest priority',
        {
          tag: 'test-foreground-notification',
          data: { 
            url: '/dashboard',
            test: true,
            urgent: true
          }
        }
      );
      
      addTestResult(
        'Foreground Notification',
        success ? 'success' : 'error',
        success 
          ? 'Enhanced foreground notification displayed with pop-up behavior and highest priority'
          : 'Failed to show enhanced foreground notification'
      );
    } catch (error) {
      addTestResult(
        'Foreground Notification',
        'error',
        `Failed to show enhanced notification: ${error}`
      );
    }

    // Test 7: Test Direct Service Worker Notification
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (registration) {
          await registration.showNotification('Test Direct Notification', {
            body: 'This is a direct frontend notification test',
            icon: '/fav-icons/android-icon-192x192.png',
            badge: '/fav-icons/android-icon-96x96.png',
            requireInteraction: true,
            tag: `direct-test-${Date.now()}`,
            data: { 
              url: '/',
              test: true,
              timestamp: Date.now()
            },
          });
          
          addTestResult(
            'Direct Notification',
            'success',
            'Direct service worker notification sent successfully'
          );
        } else {
          addTestResult(
            'Direct Notification',
            'error',
            'Service worker registration not found'
          );
        }
      } else {
        addTestResult(
          'Direct Notification',
          'error',
          'Service worker not supported'
        );
      }
    } catch (error) {
      addTestResult(
        'Direct Notification',
        'error',
        `Direct notification failed: ${error}`
      );
    }

    // Test 8: Check PWA installation status
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = (window.navigator as any).standalone === true || isStandalone;
    
    addTestResult(
      'PWA Installation',
      isInstalled ? 'success' : 'error',
      `PWA ${isInstalled ? 'installed' : 'not installed'} (Standalone: ${isStandalone})`
    );

    setIsRunningTests(false);
  };

  const requestPermission = async () => {
    try {
      const granted = await pushNotifications.requestPermission();
      if (granted) {
        await pushNotifications.getFCMToken();
        addTestResult(
          'Permission Request',
          'success',
          'Permission granted and token generated'
        );
      } else {
        addTestResult(
          'Permission Request',
          'error',
          'Permission denied by user'
        );
      }
    } catch (error) {
      addTestResult(
        'Permission Request',
        'error',
        `Permission request failed: ${error}`
      );
    }
  };

  const sendTestNotification = async () => {
    try {
      const success = await showEnhancedNotification(
        'Test Push Notification',
        'This is a test notification with pop-up behavior and highest priority',
        {
          tag: `test-notification-${Date.now()}`,
          data: { 
            url: '/dashboard',
            test: true,
            urgent: true,
            clickAction: '/dashboard'
          }
        }
      );
      
      addTestResult(
        'Test Notification',
        success ? 'success' : 'error',
        success 
          ? 'Enhanced test notification sent with pop-up behavior and highest priority'
          : 'Failed to send enhanced test notification'
      );
    } catch (error) {
      addTestResult(
        'Test Notification',
        'error',
        `Enhanced test notification failed: ${error}`
      );
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Push Notification Tester</h2>
      
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800">Platform</h3>
          <p className="text-blue-600">{pushNotifications.platform}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-800">Support</h3>
          <p className="text-green-600">{pushNotifications.isSupported ? 'Yes' : 'No'}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-800">Permission</h3>
          <p className="text-purple-600">
            {pushNotifications.permission.granted ? 'Granted' : 
             pushNotifications.permission.denied ? 'Denied' : 'Default'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={runComprehensiveTest}
          disabled={isRunningTests}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunningTests ? 'Running Tests...' : 'Run Comprehensive Test'}
        </button>
        
        {!pushNotifications.permission.granted && (
          <button
            onClick={requestPermission}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Request Permission
          </button>
        )}
        
        {pushNotifications.permission.granted && pushNotifications.token && (
          <button
            onClick={sendTestNotification}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Send Test Notification
          </button>
        )}
        
        <button
          onClick={clearResults}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
        >
          Clear Results
        </button>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">Test Results</h3>
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                result.status === 'success' 
                  ? 'bg-green-50 border-green-500' 
                  : result.status === 'error'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-800">{result.test}</h4>
                  <p className={`text-sm ${
                    result.status === 'success' 
                      ? 'text-green-700' 
                      : result.status === 'error'
                      ? 'text-red-700'
                      : 'text-yellow-700'
                  }`}>
                    {result.message}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  result.status === 'success' 
                    ? 'bg-green-100 text-green-800' 
                    : result.status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {result.status}
                </span>
              </div>
              {result.timestamp && (
                <p className="text-xs text-gray-500 mt-2">
                  {result.timestamp.toLocaleTimeString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Debug Information */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Debug Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong>User Agent:</strong>
            <p className="text-gray-600 break-all">{navigator.userAgent}</p>
          </div>
          <div>
            <strong>FCM Token:</strong>
            <p className="text-gray-600 break-all">
              {pushNotifications.token ? `${pushNotifications.token.substring(0, 50)}...` : 'Not available'}
            </p>
          </div>
          <div>
            <strong>Is Standalone:</strong>
            <p className="text-gray-600">
              {window.matchMedia('(display-mode: standalone)').matches ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <strong>Service Worker:</strong>
            <p className="text-gray-600">
              {'serviceWorker' in navigator ? 'Supported' : 'Not supported'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
