import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { reminderNotificationService } from '../services/reminderNotificationService';
import { metricReminderService } from '../services/metricReminderService';
import { scheduledQuestionExecutor } from '../services/scheduledQuestionExecutor';

export const ReminderServiceInitializer: React.FC = () => {
  const { user } = useAuth();
  const { forms, dashboards, formEntries } = useApp();

  useEffect(() => {
    // Only start the reminder service for authenticated users
    if (user) {
      
      // Only admins should attempt global cleanup to avoid permission errors for employees
      if (user.role === 'admin') {
        reminderNotificationService.cleanupDuplicateReminders();
      }
      
      // Create a forms provider function that gets current forms from context
      const formsProvider = () => {
        return forms;
      };
      
      reminderNotificationService.startCronjob(formsProvider, user.agencyId);

      // Minute tick for metric reminders (one-off)
      const runMetricTick = async () => {
        if (!user?.id || !user?.agencyId) return;
        await metricReminderService.runTick({
          directorId: user.id,
          agencyId: user.agencyId,
          dashboards,
          formEntries
        });
      };

      const intervalId = setInterval(runMetricTick, 60 * 1000);
      // Run once immediately for current minute
      runMetricTick();

      // Start scheduled question executor for this user
      // Note: Temporarily disabled until backend service is implemented
      // scheduledQuestionExecutor.start(user.id, user.agencyId);
    }

    // Cleanup function to stop the service when component unmounts
    return () => {
      if (user) {
        reminderNotificationService.stopCronjob();
        // scheduledQuestionExecutor.stop();
      }
      // Clear metric runner
      // Note: intervalId is in closure
      // @ts-ignore - captured from setup
      if (typeof intervalId !== 'undefined') clearInterval(intervalId);
    };
  }, [user?.id, forms, dashboards, formEntries]); // Use user?.id instead of user to prevent unnecessary re-renders

  // This component doesn't render anything
  return null;
};
