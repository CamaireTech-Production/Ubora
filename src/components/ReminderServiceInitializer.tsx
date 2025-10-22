import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { metricReminderService } from '../services/metricReminderService';
import { scheduledQuestionExecutor } from '../services/scheduledQuestionExecutor';

export const ReminderServiceInitializer: React.FC = () => {
  const { user } = useAuth();
  const { forms, dashboards, formEntries } = useApp();

  useEffect(() => {
    // Only start the metric reminder service for authenticated users
    if (user) {
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
      console.log('🚀 [ReminderServiceInitializer] Starting scheduled question executor for user:', user.id);
      scheduledQuestionExecutor.start(user.id, user.agencyId);

      // Cleanup function to stop the service when component unmounts
      return () => {
        console.log('⏹️ [ReminderServiceInitializer] Stopping scheduled question executor');
        scheduledQuestionExecutor.stop();
        // Clear metric runner
        clearInterval(intervalId);
      };
    }
  }, [user?.id, forms, dashboards, formEntries]); // Use user?.id instead of user to prevent unnecessary re-renders

  // This component doesn't render anything
  return null;
};
