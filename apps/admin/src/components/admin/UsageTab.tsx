import React from 'react';
// Note: AppUsageTab doesn't exist in admin app - using placeholder
const AppUsageTab = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="p-4">
    <p className="text-gray-600">App Usage analytics coming soon</p>
  </div>
);

interface UsageTabProps {
  onRefresh: () => void;
}

export const UsageTab: React.FC<UsageTabProps> = ({ onRefresh }) => {
  return <AppUsageTab onRefresh={onRefresh} />;
};
