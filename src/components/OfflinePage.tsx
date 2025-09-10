import React from 'react';
import { Card } from './Card';
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

export const OfflinePage: React.FC = () => {
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="text-center">
          <div className="mb-6">
            <WifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Vous êtes hors ligne
            </h1>
            <p className="text-gray-600 mb-6">
              Vérifiez votre connexion internet et réessayez.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Que pouvez-vous faire ?</h3>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>• Vérifiez votre connexion Wi-Fi ou mobile</li>
                <li>• Déplacez-vous vers une zone avec un meilleur signal</li>
                <li>• Réessayez dans quelques instants</li>
                <li>• Certaines fonctionnalités peuvent être disponibles hors ligne</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleRefresh}
                className="flex-1 flex items-center justify-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Actualiser</span>
              </Button>
              
              <Button
                onClick={handleGoHome}
                variant="secondary"
                className="flex-1 flex items-center justify-center space-x-2"
              >
                <Home className="h-4 w-4" />
                <span>Accueil</span>
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Cette application fonctionne mieux avec une connexion internet active.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
