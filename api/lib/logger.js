/**
 * Structured Logger for Backend
 * 
 * Provides logging with different levels (debug, info, warn, error)
 * - Debug logs are disabled in production
 * - Format JSON in production, readable in development
 * - Separate log files (error.log, combined.log) - optional with Winston
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

class Logger {
  constructor() {
    this.isDev = isDevelopment;
  }

  /**
   * Format log entry for console output
   */
  formatLog(level, message, data, context) {
    const timestamp = new Date().toISOString();
    const prefix = context ? `[${context}]` : '';
    const emoji = this.getEmoji(level);
    
    if (this.isDev) {
      // Development: readable format
      return `${emoji} ${timestamp} ${prefix} ${message}`;
    } else {
      // Production: JSON format
      return JSON.stringify({
        level,
        message,
        data,
        context,
        timestamp
      });
    }
  }

  /**
   * Get emoji for log level
   */
  getEmoji(level) {
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
   * Debug log (only in development)
   */
  debug(message, data = null, context = null) {
    if (!this.isDev) return;
    
    const formatted = this.formatLog('debug', message, data, context);
    console.debug(formatted, data ? data : '');
  }

  /**
   * Info log
   */
  info(message, data = null, context = null) {
    const formatted = this.formatLog('info', message, data, context);
    console.info(formatted, data ? data : '');
  }

  /**
   * Warning log
   */
  warn(message, data = null, context = null) {
    const formatted = this.formatLog('warn', message, data, context);
    console.warn(formatted, data ? data : '');
  }

  /**
   * Error log
   */
  error(message, error = null, context = null) {
    const errorData = error instanceof Error 
      ? { 
          message: error.message, 
          stack: error.stack, 
          name: error.name 
        }
      : error;

    const formatted = this.formatLog('error', message, errorData, context);
    console.error(formatted, errorData ? errorData : '');
  }

  /**
   * Log with custom level
   */
  log(level, message, data = null, context = null) {
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
      default:
        this.info(message, data, context);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };

