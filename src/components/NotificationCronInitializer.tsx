import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notificationCronService } from '../services/notificationCronService';
import { notificationFallbackService } from '../services/notificationFallbackService';

export const NotificationCronInitializer: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.id && user.agencyId) {
      console.log('🚀 [NotificationCronInitializer] Starting notification services for user:', user.id);
      
      // Start the smart cron job
      notificationCronService.start(user.id, user.agencyId);
      
      // Start the fallback service
      notificationFallbackService.start(user.id, user.agencyId);
      
      console.log('✅ [NotificationCronInitializer] Notification services started');
    }

    // Cleanup function to stop services when component unmounts or user changes
    return () => {
      console.log('🛑 [NotificationCronInitializer] Stopping notification services');
      notificationCronService.stop();
      notificationFallbackService.stop();
    };
  }, [user]);

  // This component doesn't render anything
  return null;
};
