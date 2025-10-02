import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

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
  

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Vérifier les rôles autorisés
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Vérifier l'accès au dashboard directeur si requis
  if (requireDirectorDashboardAccess && !hasDirectorDashboardAccess()) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};