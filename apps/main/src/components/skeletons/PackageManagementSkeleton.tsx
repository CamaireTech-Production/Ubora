import React from 'react';

/**
 * Skeleton pour la page de gestion des packages
 */
export const PackageManagementSkeleton: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 px-3 sm:px-4 lg:px-6">
      {/* Current Package Status Skeleton */}
      <div className="relative overflow-hidden mx-2 sm:mx-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl"></div>
        
        <div className="relative backdrop-blur-sm bg-white/80 border border-white/20 rounded-2xl shadow-xl shadow-blue-500/10 p-4 sm:p-6 lg:p-8">
          {/* Header Section Skeleton */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4 lg:mb-0">
              {/* Package Icon Skeleton */}
              <div className="relative self-center sm:self-auto">
                <div className="p-3 sm:p-4 rounded-2xl bg-gray-200 animate-pulse w-16 h-16"></div>
              </div>
              
              <div className="text-center sm:text-left space-y-2">
                <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mx-auto sm:mx-0"></div>
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mx-auto sm:mx-0"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mx-auto sm:mx-0"></div>
              </div>
            </div>
            
            <div className="text-center sm:text-right">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mx-auto sm:mx-auto sm:ml-auto"></div>
            </div>
          </div>

          {/* Subscription Status Skeleton */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-gray-100 rounded-xl p-3 sm:p-4 border border-gray-200 animate-pulse">
                <div className="h-4 w-24 bg-gray-300 rounded mb-2"></div>
                <div className="h-6 w-32 bg-gray-300 rounded"></div>
              </div>
              <div className="bg-gray-100 rounded-xl p-3 sm:p-4 border border-gray-200 animate-pulse">
                <div className="h-4 w-32 bg-gray-300 rounded mb-2"></div>
                <div className="h-6 w-32 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>

          {/* Resource Usage Skeleton */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center space-x-2 mb-4 sm:mb-6">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse"></div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/30 animate-pulse">
                  <div className="flex items-center justify-center mb-2 sm:mb-3">
                    <div className="p-1.5 sm:p-2 bg-gray-200 rounded-lg w-10 h-10"></div>
                  </div>
                  <div className="h-3 w-16 bg-gray-200 rounded mx-auto mb-1"></div>
                  <div className="h-6 w-20 bg-gray-200 rounded mx-auto mb-1"></div>
                  <div className="h-3 w-24 bg-gray-200 rounded mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

