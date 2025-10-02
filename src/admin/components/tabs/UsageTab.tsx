import React from 'react';
import { AppUsageTab } from '../../../components/AppUsageTab';

interface UsageTabProps {
  onRefresh: () => void;
}

export const UsageTab: React.FC<UsageTabProps> = ({ onRefresh }) => {
  return <AppUsageTab onRefresh={onRefresh} />;
};
