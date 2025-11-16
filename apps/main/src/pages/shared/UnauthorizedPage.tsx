import React, { useState } from 'react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Footer } from '../components/layout/Footer';
import { LogoutConfirmationModal } from '../components/modals/LogoutConfirmationModal';
import { AlertTriangle } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const { logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-sm sm:max-w-md w-full text-center">
          <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Accès non autorisé</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <Button onClick={() => setShowLogoutModal(true)} variant="secondary" className="w-full sm:w-auto">
            Retour à la connexion
          </Button>
        </Card>
      </div>
      
      <Footer />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </div>
  );
};