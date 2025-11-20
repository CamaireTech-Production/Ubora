import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePermissions } from '@ubora/shared/hooks/usePermissions';
import { SplashScreen } from '../loading/SplashScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'directeur' | 'employe')[];
  requireDirectorDashboardAccess?: boolean; // Nouvelle prop pour l'accès au dashboard directeur
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  requireDirectorDashboardAccess = false
}) => {
  const { user, isLoading } = useAuth();
  const { hasDirectorDashboardAccess } = usePermissions();
  

  // Show splash screen only for initial authentication (when user is not yet loaded)
  if (isLoading && !user) {
    return <SplashScreen message="Chargement d'Ubora..." />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Vérifier les rôles autorisés
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  // Vérifier l'accès au dashboard directeur si requis
  if (requireDirectorDashboardAccess && !hasDirectorDashboardAccess()) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};