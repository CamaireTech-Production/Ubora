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

export class EnhancedErrorHandler {
  private static readonly DEFAULT_TIMEOUT = 20000; // 20 seconds
  private static readonly DEFAULT_MAX_RETRIES = 2;
  private static readonly DEFAULT_RETRY_DELAY = 1000; // 1 second

  /**
   * Enhanced fetch with retry logic, timeout, and better error handling
   */
  static async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<Response> {
    const {
      maxRetries = this.DEFAULT_MAX_RETRIES,
      timeout = this.DEFAULT_TIMEOUT,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      exponentialBackoff = true
    } = retryOptions;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let controller: AbortController | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      
      try {
        console.log(`🔄 Attempt ${attempt + 1}/${maxRetries + 1} for ${url}`);
        
        // Create abort controller for timeout
        controller = new AbortController();
        timeoutId = setTimeout(() => {
          console.log(`⏰ Request timeout after ${timeout}ms on attempt ${attempt + 1}`);
          controller?.abort();
        }, timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        // Clear timeout immediately after response
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Check if response is ok
        if (!response.ok) {
          // Don't retry on client errors (4xx) except 408 (timeout)
          if (response.status >= 400 && response.status < 500 && response.status !== 408) {
            console.log(`❌ Client error ${response.status}, not retrying`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          // Retry on server errors (5xx) and 408 (timeout)
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`✅ Request successful on attempt ${attempt + 1}`);
        return response;

      } catch (error) {
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        lastError = error as Error;
        console.warn(`❌ Attempt ${attempt + 1} failed:`, error);

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Don't retry on AbortError (timeout) - it's likely a network issue
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`⏰ Request aborted on attempt ${attempt + 1}, will retry`);
        }

        // Calculate delay for next retry
        const delay = exponentialBackoff 
          ? retryDelay * Math.pow(2, attempt)
          : retryDelay;

        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await this.delay(delay);
      }
    }

    // All retries failed, throw enhanced error
    throw this.createEnhancedError(lastError!, url, maxRetries + 1);
  }

  /**
   * Create user-friendly error messages
   */
  static createEnhancedError(originalError: Error, url: string, attempts: number): Error {
    const errorType = this.detectErrorType(originalError);
    const userMessage = this.getUserFriendlyMessage(errorType, url, attempts);
    
    const enhancedError = new Error(userMessage);
    (enhancedError as any).originalError = originalError;
    (enhancedError as any).errorType = errorType;
    (enhancedError as any).url = url;
    (enhancedError as any).attempts = attempts;
    
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
  private static getUserFriendlyMessage(errorType: string, url: string, attempts: number): string {
    const isApiEndpoint = url.includes('/api/');
    const serviceName = isApiEndpoint ? 'le service IA' : 'le serveur';
    
    switch (errorType) {
      case 'timeout':
        return `⏱️ Connexion lente détectée. ${serviceName} met plus de temps à répondre que prévu. Veuillez patienter ou réessayer.`;
      
      case 'network':
        return `🌐 Problème de connexion réseau. Vérifiez votre connexion internet et réessayez.`;
      
      case 'connection':
        return `🔌 Impossible de joindre ${serviceName}. Le service pourrait être temporairement indisponible.`;
      
      case 'server':
        return `⚠️ ${serviceName} rencontre des difficultés techniques. Veuillez réessayer dans quelques minutes.`;
      
      case 'cors':
        return `🔒 Problème de configuration de sécurité. Contactez le support technique.`;
      
      default:
        return `❌ Erreur inattendue lors de la communication avec ${serviceName}. Veuillez réessayer.`;
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
   * Utility function to delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
  async aiRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const startTime = Date.now();
    
    try {
      const response = await EnhancedErrorHandler.fetchWithRetry(url, options, {
        maxRetries: 2,
        timeout: 20000,
        retryDelay: 1000,
        exponentialBackoff: true
      });

      const responseTime = Date.now() - startTime;
      const quality = EnhancedErrorHandler.detectConnectionQuality(responseTime);
      const warning = EnhancedErrorHandler.showConnectionWarning(quality);
      
      if (warning) {
        console.warn(warning);
      }

      return response;
    } catch (error) {
      console.error('AI request failed:', error);
      throw error;
    }
  },

  /**
   * OCR API calls with enhanced error handling
   */
  async ocrRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const startTime = Date.now();
    
    try {
      const response = await EnhancedErrorHandler.fetchWithRetry(url, options, {
        maxRetries: 2,
        timeout: 30000, // OCR requests can take longer
        retryDelay: 2000,
        exponentialBackoff: true
      });

      const responseTime = Date.now() - startTime;
      const quality = EnhancedErrorHandler.detectConnectionQuality(responseTime);
      const warning = EnhancedErrorHandler.showConnectionWarning(quality);
      
      if (warning) {
        console.warn(warning);
      }

      return response;
    } catch (error) {
      console.error('OCR request failed:', error);
      throw error;
    }
  }
};
