import { Component, ErrorInfo, ReactNode } from 'react';

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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Add error reporting service (Sentry, Bugsnag, etc.)
      console.error('Production error:', { error: error.message, stack: error.stack, errorInfo });
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

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 rounded-full mb-4">
              <span className="text-2xl">{errorInfo.icon}</span>
            </div>
            <h2 className="text-lg font-medium text-gray-900 text-center mb-2">
              {errorInfo.title}
            </h2>
            <p className="text-sm text-gray-600 text-center mb-6">
              {errorInfo.message}
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Recharger la page
              </button>
              <button
                onClick={() => window.location.href = '/login'}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Aller à la connexion admin
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-3 bg-gray-100 rounded text-xs">
                <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                  Détails techniques (développement)
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <strong>Type:</strong> {this.state.errorType}
                  </div>
                  <div>
                    <strong>Message:</strong>
                    <pre className="mt-1 whitespace-pre-wrap text-red-600 text-xs">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-gray-600 text-xs">
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