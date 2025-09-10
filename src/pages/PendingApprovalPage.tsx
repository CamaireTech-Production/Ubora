import React from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Clock, Mail, Building2, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const PendingApprovalPage: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="text-center">
          <div className="mb-6">
            <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Compte en attente d'approbation
            </h1>
            <p className="text-gray-600 mb-6">
              Votre compte a été créé avec succès, mais il doit être approuvé par votre directeur avant de pouvoir accéder à l'application.
            </p>
          </div>

          {user && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-3">Détails de votre compte</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{user.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Agence: {user.agencyId || 'Non spécifiée'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Prochaines étapes</h4>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>• Votre directeur recevra une notification de votre demande</li>
                <li>• Il examinera votre profil et approuvera ou rejettera votre compte</li>
                <li>• Vous recevrez un email de confirmation une fois approuvé</li>
                <li>• Vous pourrez alors vous connecter et accéder à l'application</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">En cas de problème</h4>
              <p className="text-sm text-yellow-800">
                Si vous pensez qu'il y a une erreur ou si vous avez des questions, 
                contactez votre directeur ou l'administrateur système.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Se déconnecter</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
