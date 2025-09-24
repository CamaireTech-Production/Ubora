import React from 'react';
import { PushNotificationsTab } from '../../../components/PushNotificationsTab';

interface NotificationsTabProps {
  onRefresh: () => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ onRefresh }) => {
  return <PushNotificationsTab onRefresh={onRefresh} />;
};
