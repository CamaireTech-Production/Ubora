import '@testing-library/jest-dom'

// Mock Firebase
vi.mock('../firebaseConfig', () => ({
  db: {},
  auth: {},
  storage: {},
  analytics: {}
}))

// Mock Notification API for browser notification tests
if (typeof global.Notification === 'undefined') {
  global.Notification = class MockNotification {
    static permission: NotificationPermission = 'default';
    static requestPermission = vi.fn().mockResolvedValue('granted');
    
    constructor(public title: string, public options?: NotificationOptions) {}
    
    static get permission() {
      return 'default' as NotificationPermission;
    }
  } as unknown as typeof Notification;
  
  // Add static methods
  (global.Notification as unknown as { permission: NotificationPermission }).permission = 'default';
  (global.Notification as unknown as { requestPermission: () => Promise<NotificationPermission> }).requestPermission = vi.fn().mockResolvedValue('granted');
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}
