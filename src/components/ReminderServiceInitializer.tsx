import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { reminderNotificationService } from '../services/reminderNotificationService';

export const ReminderServiceInitializer: React.FC = () => {
  const { user } = useAuth();
  const { forms } = useApp();

  useEffect(() => {
    // Only start the reminder service for authenticated users
    if (user) {
      
      // Clean up any existing duplicate notifications on startup
      reminderNotificationService.cleanupDuplicateReminders();
      
      // Create a forms provider function that gets current forms from context
      const formsProvider = () => {
        return forms;
      };
      
      reminderNotificationService.startCronjob(formsProvider, user.agencyId);
    }

    // Cleanup function to stop the service when component unmounts
    return () => {
      if (user) {
        reminderNotificationService.stopCronjob();
      }
    };
  }, [user, forms]);

  // This component doesn't render anything
  return null;
};
