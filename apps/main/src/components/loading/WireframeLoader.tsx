import React from 'react';

interface WireframeLoaderProps {
  type: 'dashboard' | 'chat' | 'form' | 'list' | 'card' | 'chart' | 'metric' | 'notification' | 'univers' | 'univers-card' | 'univers-detail';
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
      case 'univers':
        return <UniversSkeleton />;
      case 'univers-card':
        return <UniversCardSkeleton />;
      case 'univers-detail':
        return <UniversDetailSkeleton />;
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

// Chat Skeleton - Modern and soft design with smooth animations
const ChatSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-white">
    {/* Container centré pour toute l'interface */}
    <div className="max-w-7xl mx-auto flex flex-col px-0 sm:px-6 lg:px-8 h-screen">
      {/* Top bar Skeleton - Soft glass effect */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-4 sm:px-6 lg:px-8 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full shimmer-soft ring-2 ring-blue-50"></div>
            <div className="space-y-2">
              <div className="h-6 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-xl w-32 shimmer-soft"></div>
              <div className="h-3 bg-gray-100/80 rounded-lg w-24 shimmer-soft"></div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-9 w-9 bg-gray-100/60 rounded-xl shimmer-soft"></div>
            <div className="h-9 w-9 bg-gray-100/60 rounded-xl shimmer-soft"></div>
          </div>
        </div>
      </div>

      {/* Messages list Skeleton */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        {/* Welcome Message Card - Soft card with subtle shadow */}
        <div className="flex justify-center mb-8 animate-soft-fade-in">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg shadow-blue-100/50 border border-gray-100/50 p-8 max-w-2xl w-full">
            <div className="flex items-center space-x-4 mb-5">
              <div className="h-14 w-14 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 rounded-2xl shimmer-soft ring-2 ring-blue-50/50"></div>
              <div className="flex-1 space-y-2.5">
                <div className="h-5 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-xl w-44 shimmer-soft"></div>
                <div className="h-4 bg-gray-100/70 rounded-lg w-36 shimmer-soft"></div>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="h-4 bg-gray-100/80 rounded-lg w-full shimmer-soft"></div>
              <div className="h-4 bg-gray-100/80 rounded-lg w-5/6 shimmer-soft"></div>
              <div className="h-4 bg-gray-100/80 rounded-lg w-4/6 shimmer-soft"></div>
            </div>
          </div>
        </div>

        {/* Chat Messages with smooth staggered animation */}
        {Array.from({ length: 4 }, (_, i) => (
          <div 
            key={i} 
            className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} animate-soft-slide-up`} 
            style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'both' }}
          >
            <div className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${i % 2 === 0 ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {/* Avatar - Soft gradient */}
              <div className={`h-9 w-9 rounded-2xl flex-shrink-0 shimmer-soft ring-2 ${
                i % 2 === 0 
                  ? 'bg-gradient-to-br from-blue-100 to-indigo-100 ring-blue-50/50' 
                  : 'bg-gradient-to-br from-gray-100 to-gray-50 ring-gray-50/50'
              }`}></div>
              
              {/* Message Bubble - Modern rounded with soft colors */}
              <div className={`rounded-3xl px-5 py-4 shadow-md backdrop-blur-sm ${
                i % 2 === 0 
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-500 rounded-br-md shadow-blue-200/30' 
                  : 'bg-white/90 border border-gray-100/80 rounded-bl-md shadow-gray-200/20'
              }`}>
                <div className="space-y-2.5">
                  {i === 0 ? (
                    // First message - longer text with soft lines
                    <>
                      <div className={`h-4 rounded-lg w-full shimmer-soft ${
                        i % 2 === 0 ? 'bg-blue-400/60' : 'bg-gray-200/60'
                      }`}></div>
                      <div className={`h-4 rounded-lg w-5/6 shimmer-soft ${
                        i % 2 === 0 ? 'bg-blue-400/60' : 'bg-gray-200/60'
                      }`}></div>
                      <div className={`h-4 rounded-lg w-4/6 shimmer-soft ${
                        i % 2 === 0 ? 'bg-blue-400/60' : 'bg-gray-200/60'
                      }`}></div>
                    </>
                  ) : i === 1 ? (
                    // Second message - with graph/table placeholder
                    <>
                      <div className={`h-4 rounded-lg w-full shimmer-soft ${
                        i % 2 === 0 ? 'bg-blue-400/60' : 'bg-gray-200/60'
                      }`}></div>
                      <div className="mt-3 bg-gray-50/80 rounded-2xl p-4 border border-gray-100/50 backdrop-blur-sm">
                        <div className="h-36 bg-gradient-to-br from-gray-100/60 to-gray-50/60 rounded-xl shimmer-soft"></div>
                      </div>
                    </>
                  ) : (
                    // Other messages - shorter
                    <>
                      <div className={`h-4 rounded-lg w-full shimmer-soft ${
                        i % 2 === 0 ? 'bg-blue-400/60' : 'bg-gray-200/60'
                      }`}></div>
                      <div className={`h-4 rounded-lg w-3/4 shimmer-soft ${
                        i % 2 === 0 ? 'bg-blue-400/60' : 'bg-gray-200/60'
                      }`}></div>
                    </>
                  )}
                </div>
                {/* Timestamp - Subtle */}
                <div className={`mt-3 h-2.5 rounded-full w-20 shimmer-soft ${
                  i % 2 === 0 ? 'bg-blue-400/40' : 'bg-gray-200/40'
                }`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composer Skeleton - Modern glass effect */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200/50 px-4 sm:px-6 lg:px-8 py-5 shadow-lg shadow-gray-100/50">
        {/* Format selector skeleton - Soft pills */}
        <div className="mb-4 flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="h-9 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full w-24 shimmer-soft border border-blue-100/50 flex-shrink-0"></div>
          <div className="h-9 bg-gray-50/80 rounded-full w-28 shimmer-soft border border-gray-100/50 flex-shrink-0"></div>
          <div className="h-9 bg-gray-50/80 rounded-full w-32 shimmer-soft border border-gray-100/50 flex-shrink-0"></div>
        </div>
        
        {/* Input area - Soft rounded with glass effect */}
        <div className="flex items-end space-x-3">
          <div className="flex-1 bg-gray-50/60 backdrop-blur-sm rounded-3xl px-5 py-4 min-h-[56px] flex items-center border border-gray-100/50 shadow-inner">
            <div className="h-5 bg-gray-200/50 rounded-xl w-full shimmer-soft"></div>
          </div>
          <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shimmer-soft shadow-lg shadow-blue-200/30 ring-2 ring-blue-100/50">
            <div className="h-5 w-5 bg-white/80 rounded-lg shimmer-soft"></div>
          </div>
        </div>
        
        {/* Footer info - Subtle */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="h-6 w-6 bg-gray-100/60 rounded-lg shimmer-soft"></div>
            <div className="h-6 w-6 bg-gray-100/60 rounded-lg shimmer-soft"></div>
          </div>
          <div className="h-3.5 bg-gray-100/60 rounded-lg w-28 shimmer-soft"></div>
        </div>
      </div>
    </div>
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

// Univers Skeleton - Page principale avec liste
const UniversSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 border border-blue-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-3 flex-1">
          <div className="h-8 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-lg w-48 shimmer-animation"></div>
          <div className="h-4 bg-gray-200 rounded w-96 max-w-full shimmer-animation"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 bg-white/80 rounded-lg w-32 shimmer-animation"></div>
          <div className="h-10 bg-white/80 rounded-lg w-40 shimmer-animation"></div>
        </div>
      </div>
    </div>

    {/* Search bar */}
    <div className="h-12 bg-white rounded-xl border border-gray-200 shimmer-animation"></div>

    {/* Univers Grid */}
    <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-3 sm:p-4 lg:p-6 space-y-3">
            {/* Icon */}
            <div className="h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-xl shimmer-animation"></div>
            
            {/* Title */}
            <div className="space-y-2">
              <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4 shimmer-animation"></div>
              <div className="h-3 bg-gray-200 rounded w-full shimmer-animation"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3 shimmer-animation"></div>
            </div>

            {/* Metadata */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <div className="h-3 bg-gray-200 rounded w-1/2 shimmer-animation"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3 shimmer-animation"></div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="h-8 bg-gray-100 rounded-lg shimmer-animation"></div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Univers Card Skeleton - Pour les cartes individuelles
const UniversCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
    <div className="p-3 sm:p-4 lg:p-6 space-y-3">
      {/* Icon */}
      <div className="h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-xl shimmer-animation"></div>
      
      {/* Title */}
      <div className="space-y-2">
        <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4 shimmer-animation"></div>
        <div className="h-3 bg-gray-200 rounded w-full shimmer-animation"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3 shimmer-animation"></div>
      </div>

      {/* Metadata */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <div className="h-3 bg-gray-200 rounded w-1/2 shimmer-animation"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3 shimmer-animation"></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
        {Array.from({ length: 4 }, (_, j) => (
          <div key={j} className="h-8 bg-gray-100 rounded-lg shimmer-animation"></div>
        ))}
      </div>
    </div>
  </div>
);

// Univers Detail Skeleton - Pour la page de détail
const UniversDetailSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-col gap-4">
      <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
        <div className="h-10 w-10 bg-gray-200 rounded-lg shimmer-animation"></div>
        <div className="flex-1 space-y-2">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-64 shimmer-animation"></div>
          <div className="h-4 bg-gray-200 rounded w-96 max-w-full shimmer-animation"></div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-10 bg-blue-200 rounded-lg w-24 shimmer-animation"></div>
        <div className="h-10 bg-gray-200 rounded-lg w-24 shimmer-animation"></div>
      </div>
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
        {/* Metadata Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4 shimmer-animation"></div>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 bg-gray-200 rounded-lg shimmer-animation"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 shimmer-animation"></div>
                <div className="h-3 bg-gray-200 rounded w-32 shimmer-animation"></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-20 shimmer-animation"></div>
              <div className="h-8 bg-gray-200 rounded w-32 shimmer-animation"></div>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-40 mb-6 shimmer-animation"></div>
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded-t-lg w-24 shimmer-animation"></div>
              ))}
            </div>
            {/* Tab Content */}
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="h-5 bg-gray-200 rounded w-24 mb-2 shimmer-animation"></div>
                  <div className="h-8 bg-gray-200 rounded w-16 shimmer-animation"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 sm:space-y-6">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4 shimmer-animation"></div>
            <div className="space-y-3">
              <div className="h-8 bg-gray-200 rounded w-16 shimmer-animation"></div>
              <div className="h-4 bg-gray-200 rounded w-24 shimmer-animation"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
