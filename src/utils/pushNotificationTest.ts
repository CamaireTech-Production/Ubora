/**
 * Push Notification Test Utilities
 * This file contains utility functions to test push notification functionality
 */

import { fcmService } from '../services/fcmService';

export interface TestResult {
  test: string;
  success: boolean;
  message: string;
  timestamp: Date;
}

export class PushNotificationTester {
  private results: TestResult[] = [];

  /**
   * Test basic notification support
   */
  testBasicSupport(): TestResult {
    const test = 'Basic Support';
    try {
      const hasNotification = 'Notification' in window;
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasPushManager = 'PushManager' in window;
      
      const success = hasNotification && hasServiceWorker && hasPushManager;
      const message = success 
        ? 'All required APIs are available'
        : `Missing APIs: ${!hasNotification ? 'Notification ' : ''}${!hasServiceWorker ? 'ServiceWorker ' : ''}${!hasPushManager ? 'PushManager' : ''}`;
      
      const result = { test, success, message, timestamp: new Date() };
      this.results.push(result);
      return result;
    } catch (error) {
      const result = { test, success: false, message: `Error: ${error}`, timestamp: new Date() };
      this.results.push(result);
      return result;
    }
  }

  /**
   * Test notification permission
   */
  testPermission(): TestResult {
    const test = 'Permission';
    try {
      const permission = Notification.permission;
      const success = permission === 'granted';
      const message = `Permission status: ${permission}`;
      
      const result = { test, success, message, timestamp: new Date() };
      this.results.push(result);
      return result;
    } catch (error) {
      const result = { test, success: false, message: `Error: ${error}`, timestamp: new Date() };
      this.results.push(result);
      return result;
    }
  }

  /**
   * Test service worker registration
   */
  async testServiceWorker(): Promise<TestResult> {
    const test = 'Service Worker';
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const success = !!registration;
      const message = success 
        ? `Service worker registered: ${registration?.active?.scriptURL}`
        : 'No service worker registration found';
      
      const result = { test, success, message, timestamp: new Date() };
      this.results.push(result);
      return result;
    } catch (error) {
      const result = { test, success: false, message: `Error: ${error}`, timestamp: new Date() };
      this.results.push(result);
      return result;
    }
  }

  /**
   * Test FCM service availability
   */
  testFCMService(): TestResult {
    const test = 'FCM Service';
    try {
      const success = !!fcmService;
      const message = success 
        ? 'FCM service is available'
        : 'FCM service is not available';
      
      const result = { test, success, message, timestamp: new Date() };
      this.results.push(result);
      return result;
    } catch (error) {
      const result = { test, success: false, message: `Error: ${error}`, timestamp: new Date() };
      this.results.push(result);
      return result;
    }
  }

  /**
   * Test platform detection
   */
  testPlatformDetection(): TestResult {
    const test = 'Platform Detection';
    try {
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      const isDesktop = !isIOS && !isAndroid;
      
      const platform = isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop';
      const success = true; // Platform detection always succeeds
      const message = `Detected platform: ${platform} (iOS: ${isIOS}, Android: ${isAndroid}, Desktop: ${isDesktop})`;
      
      const result = { test, success, message, timestamp: new Date() };
      this.results.push(result);
      return result;
    } catch (error) {
      const result = { test, success: false, message: `Error: ${error}`, timestamp: new Date() };
      this.results.push(result);
      return result;
    }
  }

  /**
   * Test PWA installation status
   */
  testPWAStatus(): TestResult {
    const test = 'PWA Status';
    try {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInstalled = (window.navigator as any).standalone === true || isStandalone;
      
      const success = true; // PWA status check always succeeds
      const message = `PWA ${isInstalled ? 'installed' : 'not installed'} (Standalone: ${isStandalone})`;
      
      const result = { test, success, message, timestamp: new Date() };
      this.results.push(result);
      return result;
    } catch (error) {
      const result = { test, success: false, message: `Error: ${error}`, timestamp: new Date() };
      this.results.push(result);
      return result;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TestResult[]> {
    this.results = [];
    
    // Run synchronous tests
    this.testBasicSupport();
    this.testPermission();
    this.testFCMService();
    this.testPlatformDetection();
    this.testPWAStatus();
    
    // Run asynchronous tests
    await this.testServiceWorker();
    
    return this.results;
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return this.results;
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Get test summary
   */
  getSummary(): { total: number; passed: number; failed: number; successRate: number } {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;
    const successRate = total > 0 ? (passed / total) * 100 : 0;
    
    return { total, passed, failed, successRate };
  }
}

/**
 * Quick test function for console use
 */
export const quickTest = async (): Promise<void> => {
  console.log('🔔 [Push Test] Starting quick push notification test...');
  
  const tester = new PushNotificationTester();
  const results = await tester.runAllTests();
  const summary = tester.getSummary();
  
  console.log('🔔 [Push Test] Test Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.test}: ${result.message}`);
  });
  
  console.log(`🔔 [Push Test] Summary: ${summary.passed}/${summary.total} tests passed (${summary.successRate.toFixed(1)}%)`);
  
  if (summary.failed > 0) {
    console.log('🔔 [Push Test] Some tests failed. Check the implementation and configuration.');
  } else {
    console.log('🔔 [Push Test] All tests passed! Push notifications should work correctly.');
  }
};

// Make quickTest available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).quickPushTest = quickTest;
}
