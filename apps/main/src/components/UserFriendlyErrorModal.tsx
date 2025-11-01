// src/components/UserFriendlyErrorModal.tsx
import React from 'react';
import { X, RefreshCw, Wifi, AlertTriangle, Server } from 'lucide-react';
import { FirebaseErrorHandler, FirebaseErrorInfo } from '../services/firebaseErrorHandler';

interface UserFriendlyErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error?: any;
  onRetry?: () => void;
  title?: string;
  message?: string;
  showRetry?: boolean;
}

export const UserFriendlyErrorModal: React.FC<UserFriendlyErrorModalProps> = ({
  isOpen,
  onClose,
  error,
  onRetry,
  title,
  message,
  showRetry = true
}) => {
  if (!isOpen) return null;

  // Get error information
  const errorInfo: FirebaseErrorInfo = error ? FirebaseErrorHandler.handleError(error) : {
    code: 'custom',
    message: message || 'Une erreur s\'est produite',
    userFriendlyMessage: message || 'Une erreur s\'est produite',
    canRetry: showRetry,
    severity: 'medium'
  };

  const getIcon = () => {
    switch (errorInfo.code) {
      case 'internal-assertion':
      case 'unavailable':
        return <Server className="w-8 h-8 text-orange-500" />;
      case 'network-error':
      case 'deadline-exceeded':
        return <Wifi className="w-8 h-8 text-blue-500" />;
      case 'permission-denied':
      case 'unauthenticated':
        return <AlertTriangle className="w-8 h-8 text-red-500" />;
      default:
        return <AlertTriangle className="w-8 h-8 text-gray-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (errorInfo.severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'high':
        return 'bg-orange-50 border-orange-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const handleRetry = () => {
    if (onRetry && errorInfo.canRetry) {
      onRetry();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className={`relative w-full max-w-md rounded-lg border p-6 shadow-lg ${getBackgroundColor()}`}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
            {title || 'Service temporairement indisponible'}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 text-center mb-6">
            {errorInfo.userFriendlyMessage}
          </p>

          {/* Actions */}
          <div className="flex justify-center space-x-3">
            {errorInfo.canRetry && showRetry && onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Réessayer</span>
              </button>
            )}
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Fermer
            </button>
          </div>

          {/* Development details */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 p-3 bg-white rounded border text-xs">
              <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                Détails techniques (développement)
              </summary>
              <div className="mt-2 space-y-1">
                <div><strong>Code:</strong> {errorInfo.code}</div>
                <div><strong>Severity:</strong> {errorInfo.severity}</div>
                <div><strong>Can Retry:</strong> {errorInfo.canRetry ? 'Oui' : 'Non'}</div>
                <div><strong>Message:</strong></div>
                <pre className="whitespace-pre-wrap text-red-600 text-xs">
                  {errorInfo.message}
                </pre>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for managing user-friendly error modals
 */
export const useUserFriendlyError = () => {
  const [errorModal, setErrorModal] = React.useState<{
    isOpen: boolean;
    error?: any;
    onRetry?: () => void;
    title?: string;
    message?: string;
  }>({
    isOpen: false
  });

  const showError = (error: any, options?: {
    onRetry?: () => void;
    title?: string;
    message?: string;
  }) => {
    setErrorModal({
      isOpen: true,
      error,
      onRetry: options?.onRetry,
      title: options?.title,
      message: options?.message
    });
  };

  const hideError = () => {
    setErrorModal(prev => ({ ...prev, isOpen: false }));
  };

  const ErrorModal = () => (
    <UserFriendlyErrorModal
      isOpen={errorModal.isOpen}
      onClose={hideError}
      error={errorModal.error}
      onRetry={errorModal.onRetry}
      title={errorModal.title}
      message={errorModal.message}
    />
  );

  return {
    showError,
    hideError,
    ErrorModal
  };
};

