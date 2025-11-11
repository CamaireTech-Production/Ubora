import React, { useState, useEffect, useCallback } from 'react';
import { ConnectionQuality } from '@ubora/shared/utils/errorHandling';

// Debounce utility function
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

interface ConnectionQualityIndicatorProps {
  quality: ConnectionQuality;
  showWarning?: boolean;
  className?: string;
}

const ConnectionQualityIndicator: React.FC<ConnectionQualityIndicatorProps> = ({
  quality,
  showWarning = true,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    console.log('🔍 ConnectionQualityIndicator: Quality changed', { 
      isSlow: quality.isSlow, 
      isPoor: quality.isPoor,
      estimatedSpeed: quality.estimatedSpeed 
    });
    
    if (quality.isSlow || quality.isPoor) {
      console.log('🔍 ConnectionQualityIndicator: Showing indicator');
      setIsVisible(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        console.log('🔍 ConnectionQualityIndicator: Auto-hiding indicator');
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      console.log('🔍 ConnectionQualityIndicator: Hiding indicator');
      setIsVisible(false);
    }
  }, [quality.isSlow, quality.isPoor]);

  if (!isVisible || !showWarning) {
    return null;
  }

  const getIcon = () => {
    if (quality.isPoor) return '🐌';
    if (quality.isSlow) return '⏳';
    return '✅';
  };

  const getMessage = () => {
    if (quality.isPoor) {
      return 'Connexion très lente détectée. Les réponses peuvent prendre plus de temps.';
    }
    if (quality.isSlow) {
      return 'Connexion lente détectée. Veuillez patienter.';
    }
    return '';
  };

  const getColorClass = () => {
    if (quality.isPoor) return 'bg-red-100 border-red-300 text-red-800';
    if (quality.isSlow) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-green-100 border-green-300 text-green-800';
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm ${className}`}>
      <div className={`rounded-lg border p-3 shadow-lg transition-all duration-300 ${getColorClass()}`}>
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getIcon()}</span>
          <div className="flex-1">
            <p className="text-sm font-medium">{getMessage()}</p>
            <p className="text-xs opacity-75">
              Qualité: {quality.estimatedSpeed}
            </p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-lg opacity-50 hover:opacity-75 transition-opacity"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary rerenders
export const MemoizedConnectionQualityIndicator = React.memo(ConnectionQualityIndicator);

/**
 * Hook to track connection quality
 */
export const useConnectionQuality = () => {
  const [quality, setQuality] = useState<ConnectionQuality>({
    isSlow: false,
    isPoor: false,
    estimatedSpeed: 'fast'
  });

  // Debounced quality update to prevent excessive rerenders
  const updateQuality = useCallback(
    debounce((responseTime: number) => {
      console.log('🔍 useConnectionQuality: updateQuality called', { responseTime });
      
      const newQuality = {
        isSlow: responseTime > 3000,
        isPoor: responseTime > 8000,
        estimatedSpeed: responseTime < 1000 ? 'fast' as const :
                       responseTime < 3000 ? 'medium' as const :
                       responseTime < 8000 ? 'slow' as const : 'poor' as const
      };
      
      console.log('🔍 useConnectionQuality: Setting new quality', newQuality);
      setQuality(newQuality);
      console.log('🔍 useConnectionQuality: Quality state updated');
    }, 500), // 500ms debounce to prevent rapid updates
    []
  );

  return { quality, updateQuality };
};
