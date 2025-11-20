/**
 * Enhanced Error Handling Utilities
 * Provides user-friendly error messages, retry logic, and connection quality detection
 */

export interface RetryOptions {
  maxRetries?: number;
  timeout?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
}

export interface ConnectionQuality {
  isSlow: boolean;
  isPoor: boolean;
  estimatedSpeed: 'fast' | 'medium' | 'slow' | 'poor';
}

/**
 * Enhanced Error with additional metadata
 */
export interface EnhancedError extends Error {
  originalError?: Error;
  errorType?: string;
  url?: string;
}

export class EnhancedErrorHandler {
  private static readonly DEFAULT_TIMEOUT = 20000; // 20 seconds

  /**
   * Single-attempt fetch with timeout and enhanced error handling (no retries)
   */
  static async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<Response> {
    const { timeout = this.DEFAULT_TIMEOUT } = retryOptions;

    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create abort controller for timeout
      controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller?.abort();
      }, timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      throw this.createEnhancedError(error as Error, url);
    }
  }

  /**
   * Create user-friendly error messages
   */
  static createEnhancedError(originalError: Error, url: string): EnhancedError {
    const errorType = this.detectErrorType(originalError);
    const userMessage = this.getUserFriendlyMessage(errorType, url);
    
    const enhancedError = new Error(userMessage) as EnhancedError;
    enhancedError.originalError = originalError;
    enhancedError.errorType = errorType;
    enhancedError.url = url;
    
    return enhancedError;
  }

  /**
   * Detect the type of error for better user messaging
   */
  private static detectErrorType(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('aborted')) {
      return 'timeout';
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    
    if (message.includes('connection') || message.includes('refused')) {
      return 'connection';
    }
    
    if (message.includes('cors')) {
      return 'cors';
    }
    
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return 'server';
    }
    
    return 'unknown';
  }

  /**
   * Get user-friendly error messages in French
   */
  private static getUserFriendlyMessage(errorType: string, url: string): string {
    const isApiEndpoint = url.includes('/api/');
    const serviceName = isApiEndpoint ? 'ARCHA' : 'le serveur';
    
    switch (errorType) {
      case 'timeout':
        return `⏱️ ARCHA met plus de temps à répondre que prévu. Veuillez réessayer.`;
      
      case 'network':
        return `🌐 Problème de connexion réseau. Vérifiez votre connexion internet et réessayez.`;
      
      case 'connection':
        return `🔌 Impossible de joindre ${serviceName}. ${serviceName === 'ARCHA' ? 'ARCHA pourrait être temporairement indisponible.' : 'Le service pourrait être temporairement indisponible.'}`;
      
      case 'server':
        return `⚠️ ${serviceName} rencontre des difficultés techniques. Veuillez réessayer dans quelques minutes.`;
      
      case 'cors':
        return `🔒 Problème de configuration de sécurité. Contactez le support technique.`;
      
      default:
        return `❌ Erreur lors de la communication avec ${serviceName}. Veuillez réessayer.`;
    }
  }

  /**
   * Detect connection quality based on response times
   */
  static detectConnectionQuality(responseTime: number): ConnectionQuality {
    let isSlow = false;
    let isPoor = false;
    let estimatedSpeed: 'fast' | 'medium' | 'slow' | 'poor';

    if (responseTime < 1000) {
      estimatedSpeed = 'fast';
    } else if (responseTime < 3000) {
      estimatedSpeed = 'medium';
    } else if (responseTime < 8000) {
      estimatedSpeed = 'slow';
      isSlow = true;
    } else {
      estimatedSpeed = 'poor';
      isSlow = true;
      isPoor = true;
    }

    return { isSlow, isPoor, estimatedSpeed };
  }

  /**
   * Show connection quality warning
   */
  static showConnectionWarning(quality: ConnectionQuality): string | null {
    if (quality.isPoor) {
      return `🐌 Connexion très lente détectée (${quality.estimatedSpeed}). Les réponses peuvent prendre plus de temps.`;
    } else if (quality.isSlow) {
      return `⏳ Connexion lente détectée (${quality.estimatedSpeed}). Veuillez patienter.`;
    }
    return null;
  }


  /**
   * Check if error is retryable
   */
  static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return !(
      message.includes('400') || // Bad Request
      message.includes('401') || // Unauthorized
      message.includes('403') || // Forbidden
      message.includes('404') || // Not Found
      message.includes('cors')   // CORS errors
    );
  }
}

/**
 * Enhanced fetch wrapper for API calls
 */
export const enhancedFetch = {
  /**
   * AI API calls with enhanced error handling
   */
  async aiRequest(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
    try {
      const { timeout, ...init } = options;
      const response = await EnhancedErrorHandler.fetchWithRetry(url, init, {
        timeout: typeof timeout === 'number' ? timeout : 20000
      });

      return response;
    } catch (error) {
      // Error is already enhanced by fetchWithRetry
      throw error;
    }
  },

  /**
   * OCR API calls with enhanced error handling
   */
  async ocrRequest(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
    try {
      const { timeout, ...init } = options;
      const response = await EnhancedErrorHandler.fetchWithRetry(url, init, {
        // Increase default timeout to reduce false timeouts on large files
        timeout: typeof timeout === 'number' ? timeout : 60000
      });

      return response;
    } catch (error) {
      // Error is already enhanced by fetchWithRetry
      throw error;
    }
  }
};
