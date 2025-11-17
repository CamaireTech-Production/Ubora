import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';

export const usePWANavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const historyStack = useRef<string[]>([]);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    // Add current location to history stack
    if (!isNavigatingRef.current) {
      historyStack.current.push(location.pathname);
      // Keep only last 10 entries to prevent memory issues
      if (historyStack.current.length > 10) {
        historyStack.current = historyStack.current.slice(-10);
      }
    }
    isNavigatingRef.current = false;
  }, [location.pathname]);

  const handleBackNavigation = () => {
    // Remove current location from stack
    historyStack.current.pop();
    
    // Find the last valid authorized page
    const validPages = getValidPagesForUser(user?.role);
    let targetPage = null;
    
    // Look for the most recent valid page in history
    for (let i = historyStack.current.length - 1; i >= 0; i--) {
      const page = historyStack.current[i];
      if (isPageAuthorizedForUser(page, validPages)) {
        targetPage = page;
        break;
      }
    }
    
    // If no valid page found, go to default dashboard
    if (!targetPage) {
      targetPage = getDefaultDashboardForRole(user?.role);
    }
    
    isNavigatingRef.current = true;
    navigate(targetPage, { replace: true });
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      handleBackNavigation();
    };

    // Only intercept back navigation in PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [user?.role]);

  return { handleBackNavigation };
};

const getValidPagesForUser = (role?: string): string[] => {
  switch (role) {
    case 'admin':
      return ['/admin/dashboard', '/admin/users'];
    case 'directeur':
      return ['/directeur/dashboard', '/directeur/chat', '/directeur/employees', '/directeur/settings'];
    case 'employe':
      return ['/employe/dashboard', '/employe/chat'];
    default:
      return ['/login'];
  }
};

const isPageAuthorizedForUser = (page: string, validPages: string[]): boolean => {
  return validPages.some(validPage => page.startsWith(validPage));
};

const getDefaultDashboardForRole = (role?: string): string => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'directeur':
      return '/directeur/dashboard';
    case 'employe':
      return '/employe/dashboard';
    default:
      return '/login';
  }
};
