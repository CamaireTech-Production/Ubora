import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePermissions } from '@ubora/shared/hooks/usePermissions';

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
  

  // Only show loading skeleton for initial authentication, not during data updates
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Show wireframe immediately for any loading state */}
          <div className="space-y-6">
            {/* Header skeleton */}
            <div className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
            
            {/* Content skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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