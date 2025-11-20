import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@ubora/shared/utils/logger';

/**
 * Hook to handle notification clicks from service worker
 * This hook listens for messages from the service worker and handles navigation
 * with highlighting for unified notifications
 */
export const useNotificationClickHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNotificationClick = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { url, notificationType, highlightData, data } = event.data;
        
        logger.debug('NotificationClick: Handling notification click', {
          url,
          notificationType,
          highlightData,
          data
        });

        // Navigate to the specified URL
        if (url && url !== window.location.pathname) {
          navigate(url);
        }

        // Handle highlighting based on notification type
        if (highlightData) {
          handleHighlighting(notificationType, highlightData);
        }
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', handleNotificationClick);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleNotificationClick);
    };
  }, [navigate]);
};

/**
 * Handle highlighting for different notification types
 */
const handleHighlighting = (notificationType: string, highlightData: any) => {
  logger.debug('NotificationClick: Handling highlighting', { notificationType, highlightData }, 'useNotificationClickHandler');

  switch (notificationType) {
    case 'form_assignment':
      handleFormAssignmentHighlighting(highlightData);
      break;
    case 'form_reminder':
      handleFormReminderHighlighting(highlightData);
      break;
    case 'metric_reminder':
      handleMetricReminderHighlighting(highlightData);
      break;
    case 'programmed_instruction':
      handleProgrammedInstructionHighlighting(highlightData);
      break;
    default:
      logger.warn('NotificationClick: Unknown notification type', { notificationType }, 'useNotificationClickHandler');
  }
};

/**
 * Handle form assignment highlighting
 */
const handleFormAssignmentHighlighting = (highlightData: any) => {
  if (highlightData.formId && highlightData.scrollToForm) {
    // Scroll to the specific form in the forms list
    setTimeout(() => {
      const formElement = document.querySelector(`[data-form-id="${highlightData.formId}"]`);
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight effect
        formElement.classList.add('notification-highlight');
        setTimeout(() => {
          formElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 500); // Wait for navigation to complete
  }
};

/**
 * Handle form reminder highlighting
 */
const handleFormReminderHighlighting = (highlightData: any) => {
  if (highlightData.formId && highlightData.autoFill) {
    // Auto-focus the first input field in the form
    setTimeout(() => {
      const firstInput = document.querySelector('form input, form textarea, form select');
      if (firstInput) {
        (firstInput as HTMLElement).focus();
        // Add highlight effect to the form
        const formElement = firstInput.closest('form');
        if (formElement) {
          formElement.classList.add('notification-highlight');
          setTimeout(() => {
            formElement.classList.remove('notification-highlight');
          }, 3000);
        }
      }
    }, 500);
  }
};

/**
 * Handle metric reminder highlighting
 */
const handleMetricReminderHighlighting = (highlightData: any) => {
  if (highlightData.metricId && highlightData.scrollToMetric) {
    // Scroll to the specific metric in the dashboard
    setTimeout(() => {
      const metricElement = document.querySelector(`[data-metric-id="${highlightData.metricId}"]`);
      if (metricElement) {
        metricElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight effect
        metricElement.classList.add('notification-highlight');
        setTimeout(() => {
          metricElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 500);
  }
};

/**
 * Handle programmed instruction highlighting
 */
const handleProgrammedInstructionHighlighting = (highlightData: any) => {
  if (highlightData.instructionId && highlightData.autoOpen) {
    // Auto-open the response interface
    setTimeout(() => {
      const responseElement = document.querySelector(`[data-instruction-id="${highlightData.instructionId}"]`);
      if (responseElement) {
        // Trigger click on response button or expand response section
        const responseButton = responseElement.querySelector('[data-action="show-response"]');
        if (responseButton) {
          (responseButton as HTMLElement).click();
        }
        // Add highlight effect
        responseElement.classList.add('notification-highlight');
        setTimeout(() => {
          responseElement.classList.remove('notification-highlight');
        }, 3000);
      }
    }, 500);
  }
};

export default useNotificationClickHandler;
