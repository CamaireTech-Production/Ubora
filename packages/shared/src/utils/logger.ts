/**
 * Structured Logger for Frontend
 * 
 * Provides logging with different levels (debug, info, warn, error)
 * - Debug logs are disabled in production
 * - Errors can be sent to external service (Sentry optional)
 * - Structured format for better debugging
 */

import { isDevelopment } from './pwaConfig';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  context?: string;
}

class Logger {
  private isDev: boolean;
  private errorHandler?: (error: Error, context?: Record<string, unknown>) => void;

  constructor() {
    this.isDev = isDevelopment();
  }

  /**
   * Set custom error handler (e.g., for Sentry)
   */
  setErrorHandler(handler: (error: Error, context?: Record<string, unknown>) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Format log entry for console output
   */
  private formatLog(entry: LogEntry): string {
    const { level, message, context, timestamp } = entry;
    const prefix = context ? `[${context}]` : '';
    const emoji = this.getEmoji(level);
    return `${emoji} ${timestamp} ${prefix} ${message}`;
  }

  /**
   * Get emoji for log level
   */
  private getEmoji(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return '🔍';
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: unknown,
    context?: string
  ): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  /**
   * Output log to console
   */
  private outputLog(entry: LogEntry): void {
    const formatted = this.formatLog(entry);
    const { level, data } = entry;

    switch (level) {
      case 'debug':
        if (this.isDev) {
          console.debug(formatted, data || '');
        }
        break;
      case 'info':
        console.info(formatted, data || '');
        break;
      case 'warn':
        console.warn(formatted, data || '');
        break;
      case 'error':
        console.error(formatted, data || '');
        break;
    }
  }

  /**
   * Debug log (only in development)
   */
  debug(message: string, data?: unknown, context?: string): void {
    if (!this.isDev) return;
    
    const entry = this.createLogEntry('debug', message, data, context);
    this.outputLog(entry);
  }

  /**
   * Info log
   */
  info(message: string, data?: unknown, context?: string): void {
    const entry = this.createLogEntry('info', message, data, context);
    this.outputLog(entry);
  }

  /**
   * Warning log
   */
  warn(message: string, data?: unknown, context?: string): void {
    const entry = this.createLogEntry('warn', message, data, context);
    this.outputLog(entry);
  }

  /**
   * Error log
   * Also sends to error handler if configured (e.g., Sentry)
   */
  error(message: string, error?: Error | unknown, context?: string): void {
    const errorData = error instanceof Error 
      ? { 
          message: error.message, 
          stack: error.stack, 
          name: error.name 
        }
      : error;

    const entry = this.createLogEntry('error', message, errorData, context);
    this.outputLog(entry);

    // Send to error handler if configured
    if (this.errorHandler && error instanceof Error) {
      try {
        this.errorHandler(error, {
          message,
          context,
          timestamp: entry.timestamp,
        });
      } catch (handlerError) {
        // Fallback if error handler fails
        console.error('Logger error handler failed:', handlerError);
      }
    }
  }

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, data?: unknown, context?: string): void {
    switch (level) {
      case 'debug':
        this.debug(message, data, context);
        break;
      case 'info':
        this.info(message, data, context);
        break;
      case 'warn':
        this.warn(message, data, context);
        break;
      case 'error':
        this.error(message, data, context);
        break;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };

