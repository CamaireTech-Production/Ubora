import React from 'react';

/**
 * Skeleton pour l'affichage des informations de package dans le header
 */
export const PackageInfoSkeleton: React.FC = () => {
  return (
    <div className="relative flex flex-col items-center space-y-1">
      {/* Package badge skeleton */}
      <div className="flex items-center space-x-2 px-2 py-1 rounded-md border text-xs font-medium bg-gray-100 border-gray-200 animate-pulse">
        <div className="h-4 w-4 bg-gray-300 rounded"></div>
        <div className="h-3 w-16 bg-gray-300 rounded"></div>
      </div>
      
      {/* Tokens skeleton */}
      <div className="flex items-center space-x-1 text-xs">
        <div className="h-3 w-3 bg-gray-300 rounded animate-pulse"></div>
        <div className="h-3 w-20 bg-gray-300 rounded animate-pulse"></div>
      </div>
    </div>
  );
};

