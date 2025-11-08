import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Layout } from './Layout';

/**
 * LayoutWrapper - Wrapper component that provides persistent Layout for routes
 * This ensures the header and footer don't remount on navigation
 */
export const LayoutWrapper: React.FC<{ defaultTitle?: string }> = ({ defaultTitle = 'Ubora' }) => {
  const location = useLocation();
  
  // Determine title based on current route
  const getTitleFromRoute = (pathname: string): string => {
    // Route-specific titles
    const routeTitles: Record<string, string> = {
      '/directeur/dashboard': 'Dashboard Directeur',
      '/directeur/chat': 'ARCHA - Chat',
      '/employe/dashboard': 'Dashboard Employé',
      '/notifications': 'Notifications',
      '/packages/manage': 'Gestion des Packages',
      '/packages': 'Sélection de Package',
      '/directeur/settings': 'Paramètres',
      '/lists': 'Listes',
      '/reports': 'Rapports',
      '/univers': 'Univers',
      '/univers/marketplace': 'Marketplace Univers',
      '/directeur/employees': 'Gestion des Employés',
    };
    
    // Check for exact match first
    if (routeTitles[pathname]) {
      return routeTitles[pathname];
    }
    
    // Check for route patterns
    if (pathname.startsWith('/directeur/dashboards/')) {
      return 'Détail du Tableau de bord';
    }
    if (pathname.startsWith('/univers/')) {
      return 'Détail Univers';
    }
    if (pathname.startsWith('/lists/')) {
      return 'Liste';
    }
    if (pathname.startsWith('/reports/')) {
      return 'Rapport';
    }
    if (pathname.startsWith('/responses/')) {
      return 'Réponses';
    }
    
    return defaultTitle;
  };
  
  const title = getTitleFromRoute(location.pathname);
  
  return (
    <Layout title={title}>
      <Outlet />
    </Layout>
  );
};

