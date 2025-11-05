import React from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export const Toast: React.FC<ToastProps> = ({ show, message, type }) => {
  if (!show) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-green-50 border-green-200 text-green-800',
          icon: 'bg-green-500',
          iconComponent: CheckCircle
        };
      case 'error':
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: 'bg-red-500',
          iconComponent: XCircle
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: 'bg-yellow-500',
          iconComponent: AlertTriangle
        };
      case 'info':
      default:
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: 'bg-blue-500',
          iconComponent: Info
        };
    }
  };

  const styles = getToastStyles();
  const IconComponent = styles.iconComponent;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg border ${styles.container}`}>
        <div className={`w-2 h-2 rounded-full ${styles.icon}`}></div>
        <IconComponent className="h-4 w-4" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
};
