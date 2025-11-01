import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import PageTrackingService from '@ubora/shared/services/pageTrackingService';

export const usePageTracking = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isInitialized = useRef(false);
  const previousPath = useRef<string>('');

  useEffect(() => {
    // Only proceed if user is properly authenticated with all required data
    if (!user || !user.uid || !user.email) {
      return;
    }

    // Initialize session on first load
    if (!isInitialized.current) {
      PageTrackingService.initializeSession(
        user.uid,
        user.email,
        user.displayName || user.email || 'Unknown User'
      );
      isInitialized.current = true;
    }

    // Track page view when location changes
    if (location.pathname !== previousPath.current) {
      const pageName = getPageNameFromPath(location.pathname);
      
      PageTrackingService.trackPageView(
        pageName,
        location.pathname,
        user.uid,
        user.email,
        user.displayName || user.email || 'Unknown User',
        previousPath.current || undefined
      );

      previousPath.current = location.pathname;
    }
  }, [location, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (user && user.uid) {
        PageTrackingService.endSession();
      }
    };
  }, [user]);
};

/**
 * Convert path to readable page name
 */
const getPageNameFromPath = (path: string): string => {
  const pathMap: Record<string, string> = {
    '/': 'Home',
    '/dashboard': 'Dashboard',
    '/forms': 'Forms',
    '/forms/create': 'Create Form',
    '/forms/edit': 'Edit Form',
    '/admin': 'Admin Dashboard',
    '/admin/users': 'Admin - Users',
    '/admin/analytics': 'Admin - Analytics',
    '/admin/activities': 'Admin - Activities',
    '/admin/notifications': 'Admin - Notifications',
    '/admin/system': 'Admin - System',
    '/profile': 'Profile',
    '/settings': 'Settings',
    '/notifications': 'Notifications',
    '/conversations': 'Conversations',
    '/chat': 'Chat',
    '/login': 'Login',
    '/register': 'Register',
    '/forgot-password': 'Forgot Password'
  };

  // Check for exact matches first
  if (pathMap[path]) {
    return pathMap[path];
  }

  // Check for dynamic routes
  if (path.startsWith('/forms/')) {
    if (path.includes('/edit/')) return 'Edit Form';
    if (path.includes('/view/')) return 'View Form';
    if (path.includes('/responses/')) return 'Form Responses';
    return 'Form Details';
  }

  if (path.startsWith('/admin/users/')) {
    return 'User Details';
  }

  if (path.startsWith('/conversations/')) {
    return 'Conversation';
  }

  // Default fallback
  return path.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Page';
};
