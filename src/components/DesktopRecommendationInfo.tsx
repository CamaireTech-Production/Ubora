import React from 'react';
import { Monitor } from 'lucide-react';

interface DesktopRecommendationInfoProps {
  className?: string;
}

export const DesktopRecommendationInfo: React.FC<DesktopRecommendationInfoProps> = ({ 
  className = '' 
}) => {
  return (
    <div className={`p-3 rounded-lg border bg-blue-50 border-blue-200 ${className}`}>
      <div className="flex items-start space-x-2">
        <Monitor className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm sm:text-base font-medium text-blue-800">
            💡 Recommandation
          </p>
          <p className="text-sm sm:text-base text-blue-700 mt-1">
            La création de formulaires conditionnels est optimisée pour la version desktop. 
            Pour une meilleure expérience, utilisez un écran plus large.
          </p>
        </div>
      </div>
    </div>
  );
};
