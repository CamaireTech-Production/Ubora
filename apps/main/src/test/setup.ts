import '@testing-library/jest-dom'

// Mock Firebase
vi.mock('../firebaseConfig', () => ({
  db: {},
  auth: {},
  storage: {},
  analytics: {}
}))

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
