import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to manage global loading state during navigation
 * Prevents multiple simultaneous loading states when navigating between routes
 */
export const useNavigationLoading = () => {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    // Detect route change
    if (previousPathRef.current !== location.pathname) {
      setIsNavigating(true);
      previousPathRef.current = location.pathname;

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Set a minimum loading time to prevent flickering
      loadingTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 100); // Minimum 100ms loading state
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [location.pathname]);

  return isNavigating;
};

