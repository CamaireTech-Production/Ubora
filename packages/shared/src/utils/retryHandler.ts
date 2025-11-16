/**
 * Gestionnaire de retry pour les opérations réseau
 * Permet de réessayer automatiquement les opérations qui échouent à cause d'erreurs réseau temporaires
 */

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 seconde
  backoffMultiplier: 2,
  retryableErrors: [
    'network-error',
    'unavailable',
    'deadline-exceeded',
    'internal',
    'unknown',
    'cancelled'
  ]
};

/**
 * Vérifie si une erreur est retryable (réseau temporaire, etc.)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorCode = error.code || error.message || '';
  const errorString = String(errorCode).toLowerCase();
  
  // Erreurs Firebase spécifiques
  const firebaseRetryableCodes = [
    'unavailable',
    'deadline-exceeded',
    'internal',
    'unknown',
    'cancelled',
    'aborted'
  ];
  
  // Erreurs réseau génériques
  const networkErrors = [
    'network',
    'timeout',
    'fetch',
    'connection',
    'econnrefused',
    'enotfound'
  ];
  
  // Vérifier les codes Firebase
  if (firebaseRetryableCodes.some(code => errorString.includes(code))) {
    return true;
  }
  
  // Vérifier les erreurs réseau génériques
  if (networkErrors.some(keyword => errorString.includes(keyword))) {
    return true;
  }
  
  // Vérifier si c'est une erreur de type "Failed to fetch" ou similaire
  if (errorString.includes('failed to fetch') || 
      errorString.includes('network request failed') ||
      errorString.includes('networkerror')) {
    return true;
  }
  
  return false;
}

/**
 * Calcule le délai avant le prochain retry avec backoff exponentiel
 */
function calculateRetryDelay(attempt: number, baseDelay: number, multiplier: number): number {
  return baseDelay * Math.pow(multiplier, attempt - 1);
}

/**
 * Exécute une fonction avec retry automatique en cas d'erreur réseau
 * 
 * @param fn Fonction à exécuter (peut être async)
 * @param options Options de retry
 * @returns Résultat de la fonction
 * @throws La dernière erreur si tous les retries échouent
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Si ce n'est pas la dernière tentative et que l'erreur est retryable
      if (attempt < opts.maxRetries && isRetryableError(error)) {
        const delay = calculateRetryDelay(attempt, opts.retryDelay, opts.backoffMultiplier);
        
        console.warn(
          `⚠️ [Retry] Tentative ${attempt}/${opts.maxRetries} échouée. ` +
          `Nouvelle tentative dans ${delay}ms...`,
          error.message || error.code || error
        );
        
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, delay));
        
        continue;
      }
      
      // Si l'erreur n'est pas retryable ou c'est la dernière tentative, propager l'erreur
      throw error;
    }
  }
  
  // Si on arrive ici, tous les retries ont échoué
  console.error(`❌ [Retry] Toutes les tentatives (${opts.maxRetries}) ont échoué.`, lastError);
  throw lastError;
}

/**
 * Wrapper pour les opérations Firestore avec retry
 */
export function withFirestoreRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(fn, {
    ...options,
    retryableErrors: [
      ...(options.retryableErrors || DEFAULT_OPTIONS.retryableErrors),
      'permission-denied', // Peut être temporaire dans certains cas
      'unauthenticated' // Peut être temporaire
    ]
  });
}

/**
 * Wrapper pour les opérations Firebase Auth avec retry
 */
export function withAuthRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(fn, {
    ...options,
    retryableErrors: [
      ...(options.retryableErrors || DEFAULT_OPTIONS.retryableErrors),
      'auth/network-request-failed',
      'auth/too-many-requests'
    ]
  });
}

