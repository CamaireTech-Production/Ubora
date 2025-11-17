import React from 'react';
// Note: PushNotificationsTab doesn't exist in admin app - using placeholder
const PushNotificationsTab = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="p-4">
    <p className="text-gray-600">Push Notifications feature coming soon</p>
  </div>
);

interface NotificationsTabProps {
  onRefresh: () => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ onRefresh }) => {
  return <PushNotificationsTab onRefresh={onRefresh} />;
};
