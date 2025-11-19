import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger } from '../logger';
import * as pwaConfig from '../pwaConfig';

// Mock pwaConfig
vi.mock('../pwaConfig', () => ({
  isDevelopment: vi.fn(() => true)
}));

describe('Logger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debug', () => {
    test('should log debug message in development', () => {
      vi.mocked(pwaConfig.isDevelopment).mockReturnValue(true);
      const testLogger = new Logger();
      
      testLogger.debug('Test debug message', { key: 'value' }, 'TestContext');
      
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleDebugSpy.mock.calls[0];
      expect(callArgs[0]).toContain('🔍');
      expect(callArgs[0]).toContain('Test debug message');
      expect(callArgs[0]).toContain('[TestContext]');
    });

    test('should not log debug message in production', () => {
      vi.mocked(pwaConfig.isDevelopment).mockReturnValue(false);
      const testLogger = new Logger();
      
      testLogger.debug('Test debug message');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    test('should log info message', () => {
      logger.info('Test info message', { data: 'test' }, 'TestContext');
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleInfoSpy.mock.calls[0];
      expect(callArgs[0]).toContain('ℹ️');
      expect(callArgs[0]).toContain('Test info message');
    });
  });

  describe('warn', () => {
    test('should log warning message', () => {
      logger.warn('Test warning', { warning: 'data' });
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleWarnSpy.mock.calls[0];
      expect(callArgs[0]).toContain('⚠️');
      expect(callArgs[0]).toContain('Test warning');
    });
  });

  describe('error', () => {
    test('should log error message with Error object', () => {
      const testError = new Error('Test error');
      logger.error('Error occurred', testError, 'ErrorContext');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const callArgs = consoleErrorSpy.mock.calls[0];
      expect(callArgs[0]).toContain('❌');
      expect(callArgs[0]).toContain('Error occurred');
    });

    test('should log error message with unknown error', () => {
      logger.error('Error occurred', 'String error', 'ErrorContext');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    test('should call error handler if configured', () => {
      const errorHandler = vi.fn();
      const testLogger = new Logger();
      testLogger.setErrorHandler(errorHandler);
      
      const testError = new Error('Test error');
      testLogger.error('Error occurred', testError, 'ErrorContext');
      
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(testError, expect.objectContaining({
        message: 'Error occurred',
        context: 'ErrorContext'
      }));
    });

    test('should handle error handler failure gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler failed');
      });
      const testLogger = new Logger();
      testLogger.setErrorHandler(errorHandler);
      
      const testError = new Error('Test error');
      testLogger.error('Error occurred', testError);
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // Error log + handler failure
    });
  });

  describe('log', () => {
    test('should log with custom level', () => {
      logger.log('info', 'Custom log message');
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('formatLog', () => {
    test('should format log entry correctly', () => {
      const testLogger = new Logger();
      testLogger.info('Test message', undefined, 'TestContext');
      
      const callArgs = consoleInfoSpy.mock.calls[0][0];
      expect(callArgs).toContain('[TestContext]');
      expect(callArgs).toContain('Test message');
      expect(callArgs).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
    });
  });
});

