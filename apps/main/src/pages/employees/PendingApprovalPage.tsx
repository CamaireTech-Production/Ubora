import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Footer } from '../../components/layout/Footer';
import { LogoutConfirmationModal } from '../../components/modals/LogoutConfirmationModal';
import { Clock, Mail, Building2, LogOut, User } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { logger } from '@ubora/shared/utils/logger';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';

interface DirectorInfo {
  name: string;
  email: string;
}

export const PendingApprovalPage: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [directorInfo, setDirectorInfo] = useState<DirectorInfo | null>(null);
  const [isLoadingDirector, setIsLoadingDirector] = useState(true);

  // Auto-redirect if employee is approved
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'employe' && user.isApproved === true) {
        navigate('/employe/dashboard', { replace: true });
      } else if (user.role !== 'employe') {
        // Redirect non-employees away from this page
        navigate('/login', { replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  // Fetch director information
  useEffect(() => {
    const fetchDirectorInfo = async () => {
      if (!user || !user.agencyId) {
        setIsLoadingDirector(false);
        return;
      }

      try {
        const directorsQuery = query(
          collection(db, 'users'),
          where('agencyId', '==', user.agencyId),
          where('role', '==', 'directeur')
        );
        
        const directorsSnapshot = await getDocs(directorsQuery);
        
        if (!directorsSnapshot.empty) {
          const director = directorsSnapshot.docs[0].data();
          setDirectorInfo({
            name: director.name || 'Directeur',
            email: director.email || ''
          });
        }
      } catch (error) {
        logger.error('Erreur lors de la récupération des informations du directeur', error, 'PendingApprovalPage');
      } finally {
        setIsLoadingDirector(false);
      }
    };

    fetchDirectorInfo();
  }, [user]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      logger.error('Erreur lors de la déconnexion', error, 'PendingApprovalPage');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="text-center">
            <div className="mb-6">
              <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Compte en attente d'approbation
              </h1>
              <p className="text-gray-600 mb-6">
                Votre compte est en attente de validation par votre directeur. Vous recevrez une notification une fois votre compte approuvé.
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

          {directorInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Votre directeur</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-800 font-medium">Nom:</span>
                  <span className="text-blue-700">{directorInfo.name}</span>
                </div>
                {directorInfo.email && (
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-800 font-medium">Email:</span>
                    <a 
                      href={`mailto:${directorInfo.email}`}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {directorInfo.email}
                    </a>
                  </div>
                )}
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
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center justify-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Se déconnecter</span>
            </Button>
          </div>
          </Card>
        </div>
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
