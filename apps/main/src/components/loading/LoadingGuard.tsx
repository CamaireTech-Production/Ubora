import React, { useRef } from 'react';
import { WireframeLoader } from './WireframeLoader';

interface LoadingGuardProps {
  isLoading: boolean;
  user: any;
  firebaseUser: any;
  children: React.ReactNode;
  wireframeType: 'dashboard' | 'chat' | 'form' | 'list' | 'card' | 'chart' | 'metric' | 'notification' | 'univers' | 'univers-card' | 'univers-detail';
}

const LoadingGuardComponent: React.FC<LoadingGuardProps> = ({ 
  isLoading, 
  user, 
  firebaseUser, 
  children, 
  wireframeType
}) => {
  // Afficher le chargement si :
  // - L'authentification est en cours
  // - L'utilisateur Firebase est connecté mais le profil utilisateur n'est pas encore chargé
  // Use ref to track if we've already shown the loading screen to prevent multiple renders
  const hasShownLoadingRef = useRef(false);
  
  if (isLoading || (firebaseUser && !user)) {
    if (!hasShownLoadingRef.current) {
      hasShownLoadingRef.current = true;
    }
    
    // Always use wireframe loader with specified type
    return (
      <div className="min-h-screen bg-gray-50">
        <WireframeLoader type={wireframeType} />
      </div>
    );
  }
  
  // Reset flag when loading is complete
  if (hasShownLoadingRef.current && !isLoading && user) {
    hasShownLoadingRef.current = false;
  }

  // Afficher le contenu seulement si tout est chargé
  if (!firebaseUser || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-2">Session non disponible</p>
          <p className="text-sm text-gray-500">Veuillez vous reconnecter.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const LoadingGuard = React.memo(LoadingGuardComponent);