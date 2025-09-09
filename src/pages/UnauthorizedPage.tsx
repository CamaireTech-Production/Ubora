import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { AlertTriangle } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-sm sm:max-w-md w-full text-center">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Accès non autorisé</h1>
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        <Button onClick={logout} variant="secondary" className="w-full sm:w-auto">
          Retour à la connexion
        </Button>
      </Card>
    </div>
  );
};