import React from 'react';

interface WireframeLoaderProps {
  type: 'dashboard' | 'chat' | 'form' | 'list' | 'card' | 'chart' | 'metric' | 'notification';
  count?: number;
  className?: string;
}

export const WireframeLoader: React.FC<WireframeLoaderProps> = ({ 
  type, 
  count = 1, 
  className = "" 
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'dashboard':
        return <DashboardSkeleton />;
      case 'chat':
        return <ChatSkeleton />;
      case 'form':
        return <FormSkeleton />;
      case 'list':
        return <ListSkeleton />;
      case 'card':
        return <CardSkeleton />;
      case 'chart':
        return <ChartSkeleton />;
      case 'metric':
        return <MetricSkeleton />;
      case 'notification':
        return <NotificationSkeleton />;
      default:
        return <CardSkeleton />;
    }
  };

  if (count === 1) {
    return <div className={className}>{renderSkeleton()}</div>;
  }

  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="mb-4">
          {renderSkeleton()}
        </div>
      ))}
    </div>
  );
};

// Dashboard Skeleton
const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
      <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
    </div>
    
    {/* Metrics Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-16 mb-2 animate-pulse"></div>
          <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
        </div>
      ))}
    </div>
    
    {/* Content Cards */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Chat Skeleton
const ChatSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          i % 2 === 0 ? 'bg-blue-500' : 'bg-gray-200'
        }`}>
          <div className={`h-4 rounded w-full animate-pulse ${
            i % 2 === 0 ? 'bg-blue-400' : 'bg-gray-300'
          }`}></div>
        </div>
      </div>
    ))}
  </div>
);

// Form Skeleton
const FormSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
    <div className="space-y-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-full animate-pulse"></div>
        </div>
      ))}
    </div>
    <div className="flex space-x-4">
      <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
      <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
    </div>
  </div>
);

// List Skeleton
const ListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-gray-200">
        <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
      </div>
    ))}
  </div>
);

// Card Skeleton
const CardSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-lg border border-gray-200">
    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4 animate-pulse"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse"></div>
    </div>
    <div className="mt-4 flex space-x-2">
      <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
      <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
    </div>
  </div>
);

// Chart Skeleton
const ChartSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-lg border border-gray-200">
    <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
    <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
    <div className="mt-4 flex justify-center space-x-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center space-x-2">
          <div className="h-3 w-3 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
        </div>
      ))}
    </div>
  </div>
);

// Metric Skeleton
const MetricSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-lg border border-gray-200">
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
      <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
    </div>
    <div className="h-8 bg-gray-200 rounded w-16 mb-2 animate-pulse"></div>
    <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
  </div>
);

// Notification Skeleton
const NotificationSkeleton: React.FC = () => (
  <div className="flex items-start space-x-3 p-4 bg-white rounded-lg border border-gray-200">
    <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
      <div className="h-3 bg-gray-200 rounded w-full mb-1 animate-pulse"></div>
      <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
    </div>
    <div className="h-3 bg-gray-200 rounded w-12 animate-pulse"></div>
  </div>
);
