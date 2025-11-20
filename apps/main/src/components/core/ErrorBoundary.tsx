import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@ubora/shared/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorType?: 'firebase' | 'network' | 'general';
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Determine error type for better user messaging
    let errorType: 'firebase' | 'network' | 'general' = 'general';
    
    if (error.message.includes('INTERNAL ASSERTION FAILED') || 
        error.message.includes('Firestore') ||
        error.message.includes('Firebase')) {
      errorType = 'firebase';
    } else if (error.message.includes('Network') || 
               error.message.includes('fetch') ||
               error.message.includes('connection')) {
      errorType = 'network';
    }
    
    return { hasError: true, error, errorType };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error', { error, errorInfo }, 'ErrorBoundary');
    
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Add error reporting service (Sentry, Bugsnag, etc.)
      logger.error('Production error', { 
        error: error.message, 
        stack: error.stack, 
        errorInfo 
      }, 'ErrorBoundary');
    }
  }

  private getErrorMessage() {
    const { errorType } = this.state;
    
    switch (errorType) {
      case 'firebase':
        return {
          title: "Service temporairement indisponible",
          message: "Nous rencontrons des difficultés techniques. Veuillez réessayer dans quelques instants.",
          icon: "🔄"
        };
      case 'network':
        return {
          title: "Problème de connexion",
          message: "Vérifiez votre connexion internet et réessayez.",
          icon: "📡"
        };
      default:
        return {
          title: "Une erreur s'est produite",
          message: "L'application a rencontré une erreur inattendue. Veuillez recharger la page.",
          icon: "⚠️"
        };
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorInfo = this.getErrorMessage();
      const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8">
            {/* Error Icon */}
            <div className="flex items-center justify-center w-20 h-20 mx-auto bg-red-50 rounded-full mb-6">
              <svg 
                className="w-10 h-10 text-red-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>

            {/* Error Title */}
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
              {errorInfo.title}
            </h2>

            {/* Error Message */}
            <p className="text-base text-gray-600 text-center mb-8 leading-relaxed">
              {errorInfo.message}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-6 py-3 bg-blue-600 text-white text-base font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg"
              >
                Recharger la page
              </button>
              <button
                onClick={() => window.location.href = '/login'}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-base font-semibold rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all"
              >
                Aller à la connexion
              </button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-500 text-center">
              Si le problème persiste, contactez le support technique.
            </p>

            {/* Technical Details - Only in Development */}
            {isDevelopment && this.state.error && (
              <details className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900 text-sm mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Détails techniques (développement uniquement)
                </summary>
                <div className="mt-3 space-y-3 pt-3 border-t border-gray-200">
                  <div>
                    <strong className="text-xs text-gray-700">Type d'erreur:</strong>
                    <span className="ml-2 text-xs text-gray-600">{this.state.errorType || 'general'}</span>
                  </div>
                  <div>
                    <strong className="text-xs text-gray-700">Message:</strong>
                    <pre className="mt-1 p-2 bg-white rounded border border-gray-200 whitespace-pre-wrap text-red-600 text-xs font-mono overflow-auto max-h-32">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong className="text-xs text-gray-700">Stack trace:</strong>
                      <pre className="mt-1 p-2 bg-white rounded border border-gray-200 whitespace-pre-wrap text-gray-600 text-xs font-mono overflow-auto max-h-48">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}