import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Footer } from '../../components/layout/Footer';
import { User, Building2, AlertCircle } from 'lucide-react';

export const ProfileCompletionPage: React.FC = () => {
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [agencyId, setAgencyId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect if user is not logged in or doesn't need profile completion
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if profile is already complete
    if (user.agencyId && user.agencyId.trim() !== '') {
      // Profile is complete, redirect to appropriate dashboard
      if (user.role === 'directeur') {
        if (user.needsPackageSelection) {
          navigate('/packages');
        } else {
          navigate('/directeur/chat');
        }
      } else if (user.role === 'employe') {
        navigate('/employe/dashboard');
      }
      return;
    }
  }, [user, navigate]);

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agencyId.trim()) {
      setError('Veuillez entrer votre ID d\'agence');
      return;
    }

    if (!user) {
      setError('Utilisateur non connecté');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Update user profile with agency ID
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        agencyId: agencyId.trim(),
        updatedAt: serverTimestamp()
      });

      // Refresh user data
      await refreshUserData();

      // Redirect based on role
      if (user.role === 'directeur') {
        if (user.needsPackageSelection) {
          navigate('/packages');
        } else {
          navigate('/directeur/chat');
        }
      } else if (user.role === 'employe') {
        navigate('/employe/dashboard');
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du profil:', err);
      setError('Une erreur est survenue lors de la mise à jour du profil');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-sm sm:max-w-md">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-4">
              <img 
                src="/favicon-base.jpg" 
                alt="Ubora Logo" 
                className="w-12 h-12 rounded-full shadow-lg mb-3 object-cover"
              />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Ubora</h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Complétez votre profil pour continuer
            </p>
          </div>

          <Card>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Bienvenue, {user.name} !
              </h2>
              
              <p className="text-sm text-gray-600">
                Pour finaliser votre inscription, veuillez compléter les informations suivantes.
              </p>
            </div>

            <form onSubmit={handleCompleteProfile} className="space-y-4 sm:space-y-6">
              <div className="relative">
                <Building2 className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
                <Input
                  label="ID Agence *"
                  type="text"
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value)}
                  placeholder="Entrez votre ID d'agence"
                  className="pl-10"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Information importante :</p>
                    <p>
                      {user.role === 'directeur' 
                        ? 'L\'ID d\'agence est nécessaire pour créer et gérer votre équipe.'
                        : 'L\'ID d\'agence vous a été fourni par votre directeur lors de l\'invitation.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Mise à jour...' : 'Compléter le profil'}
              </Button>
            </form>

            <div className="mt-4 sm:mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:text-blue-500 text-sm"
              >
                Retour à la connexion
              </button>
            </div>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};
