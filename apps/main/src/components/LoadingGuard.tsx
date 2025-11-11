import React, { useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingGuardProps {
  isLoading: boolean;
  user: any;
  firebaseUser: any;
  children: React.ReactNode;
  message?: string;
}

const LoadingGuardComponent: React.FC<LoadingGuardProps> = ({ 
  isLoading, 
  user, 
  firebaseUser, 
  children, 
  message = "Chargement des données..." 
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{message}</p>
          <p className="text-sm text-gray-400 mt-2">
            Vérification du profil utilisateur...
          </p>
        </div>
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