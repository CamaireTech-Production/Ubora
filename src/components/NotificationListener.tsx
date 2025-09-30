import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notificationListenerService } from '../services/notificationListenerService';

/**
 * Component that handles notification listening for the current user
 * This component should be placed high in the component tree to ensure
 * notifications are listened to throughout the app
 */
export const NotificationListener: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      console.log('🔔 [NotificationListener] Starting notification listener for user:', user.id);
      notificationListenerService.startListening(user.id);
    }

    // Cleanup when component unmounts or user changes
    return () => {
      console.log('🔔 [NotificationListener] Stopping notification listener');
      notificationListenerService.stopListening();
    };
  }, [user?.id]);

  // This component doesn't render anything
  return null;
};
