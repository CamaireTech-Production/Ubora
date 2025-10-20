// src/services/firebaseErrorHandler.ts
import { FirebaseError } from 'firebase/app';

export interface FirebaseErrorInfo {
  code: string;
  message: string;
  userFriendlyMessage: string;
  canRetry: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class FirebaseErrorHandler {
  private static errorCount = 0;
  private static maxErrors = 5;
  private static circuitBreakerActive = false;
  private static lastErrorTime = 0;
  private static retryDelay = 5000; // 5 seconds

  /**
   * Handle Firebase errors with graceful degradation
   */
  static handleError(error: any): FirebaseErrorInfo {
    this.errorCount++;
    this.lastErrorTime = Date.now();

    // Activate circuit breaker if too many errors
    if (this.errorCount >= this.maxErrors) {
      this.circuitBreakerActive = true;
      console.warn('🔥 [FirebaseErrorHandler] Circuit breaker activated due to too many errors');
    }

    // Check if it's a Firebase internal assertion error
    if (this.isInternalAssertionError(error)) {
      return this.handleInternalAssertionError(error);
    }

    // Check if it's a network error
    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error);
    }

    // Check if it's a permission error
    if (this.isPermissionError(error)) {
      return this.handlePermissionError(error);
    }

    // Default Firebase error handling
    return this.handleGenericFirebaseError(error);
  }

  /**
   * Check if circuit breaker is active
   */
  static isCircuitBreakerActive(): boolean {
    if (this.circuitBreakerActive) {
      const timeSinceLastError = Date.now() - this.lastErrorTime;
      if (timeSinceLastError > this.retryDelay) {
        this.circuitBreakerActive = false;
        this.errorCount = 0;
        console.info('🔥 [FirebaseErrorHandler] Circuit breaker reset');
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Reset error counter (call when Firebase operations succeed)
   */
  static resetErrorCount(): void {
    this.errorCount = 0;
    this.circuitBreakerActive = false;
  }

  /**
   * Check if error is Firebase internal assertion error
   */
  private static isInternalAssertionError(error: any): boolean {
    return error?.message?.includes('INTERNAL ASSERTION FAILED') ||
           error?.message?.includes('Unexpected state') ||
           error?.code === 'internal';
  }

  /**
   * Check if error is network related
   */
  private static isNetworkError(error: any): boolean {
    return error?.code === 'unavailable' ||
           error?.code === 'deadline-exceeded' ||
           error?.message?.includes('network') ||
           error?.message?.includes('connection');
  }

  /**
   * Check if error is permission related
   */
  private static isPermissionError(error: any): boolean {
    return error?.code === 'permission-denied' ||
           error?.code === 'unauthenticated';
  }

  /**
   * Handle Firebase internal assertion errors
   */
  private static handleInternalAssertionError(error: any): FirebaseErrorInfo {
    console.warn('🔥 [FirebaseErrorHandler] Internal assertion error detected:', error.message);
    
    return {
      code: 'internal-assertion',
      message: error.message,
      userFriendlyMessage: 'Service temporairement indisponible. Veuillez réessayer dans quelques instants.',
      canRetry: true,
      severity: 'medium'
    };
  }

  /**
   * Handle network errors
   */
  private static handleNetworkError(error: any): FirebaseErrorInfo {
    return {
      code: error.code || 'network-error',
      message: error.message,
      userFriendlyMessage: 'Problème de connexion. Vérifiez votre internet et réessayez.',
      canRetry: true,
      severity: 'medium'
    };
  }

  /**
   * Handle permission errors
   */
  private static handlePermissionError(error: any): FirebaseErrorInfo {
    return {
      code: error.code,
      message: error.message,
      userFriendlyMessage: 'Accès non autorisé. Veuillez vous reconnecter.',
      canRetry: false,
      severity: 'high'
    };
  }

  /**
   * Handle generic Firebase errors
   */
  private static handleGenericFirebaseError(error: any): FirebaseErrorInfo {
    const firebaseError = error as FirebaseError;
    
    return {
      code: firebaseError.code || 'unknown',
      message: firebaseError.message,
      userFriendlyMessage: 'Une erreur s\'est produite. Veuillez réessayer.',
      canRetry: true,
      severity: 'low'
    };
  }

  /**
   * Get user-friendly error message for display
   */
  static getUserFriendlyMessage(error: any): string {
    const errorInfo = this.handleError(error);
    return errorInfo.userFriendlyMessage;
  }

  /**
   * Check if operation should be retried
   */
  static shouldRetry(error: any): boolean {
    if (this.isCircuitBreakerActive()) {
      return false;
    }
    
    const errorInfo = this.handleError(error);
    return errorInfo.canRetry && errorInfo.severity !== 'critical';
  }

  /**
   * Get retry delay based on error count
   */
  static getRetryDelay(): number {
    return Math.min(this.retryDelay * Math.pow(2, this.errorCount), 30000); // Max 30 seconds
  }
}

/**
 * Wrapper for Firebase operations with automatic error handling and retry
 */
export async function withFirebaseErrorHandling<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      FirebaseErrorHandler.resetErrorCount();
      return result;
    } catch (error) {
      lastError = error;
      
      if (!FirebaseErrorHandler.shouldRetry(error) || attempt === maxRetries) {
        break;
      }
      
      const delay = FirebaseErrorHandler.getRetryDelay();
      console.warn(`🔥 [FirebaseErrorHandler] Retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
