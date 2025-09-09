import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingGuardProps {
  isLoading: boolean;
  user: any;
  firebaseUser: any;
  children: React.ReactNode;
  message?: string;
}

export const LoadingGuard: React.FC<LoadingGuardProps> = ({ 
  isLoading, 
  user, 
  firebaseUser, 
  children, 
  message = "Chargement des données..." 
}) => {
  // Afficher le chargement si :
  // - L'authentification est en cours
  // - L'utilisateur Firebase est connecté mais le profil utilisateur n'est pas encore chargé
  if (isLoading || (firebaseUser && !user)) {
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

  // Afficher le contenu seulement si tout est chargé
  if (!firebaseUser || !user) {
    return null;
  }

  return <>{children}</>;
};