import React from 'react';

/**
 * Skeleton pour l'affichage de l'univers actif dans le header
 */
export const ActiveUniversSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-2 px-2 py-1 rounded-md border text-xs font-medium bg-gray-100 border-gray-200 animate-pulse ${className}`}>
      <div className="h-4 w-4 bg-gray-300 rounded"></div>
      <div className="h-3 w-24 bg-gray-300 rounded"></div>
    </div>
  );
};

