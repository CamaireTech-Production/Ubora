import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@ubora/shared/firebaseConfig';
import { logger } from '@ubora/shared/utils/logger';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Footer } from '../../components/layout/Footer';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';

export const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidCode, setIsValidCode] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(true);

  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    const validateResetCode = async () => {
      if (!oobCode) {
        setError('Code de réinitialisation invalide ou manquant');
        setIsValidatingCode(false);
        return;
      }

      try {
        await verifyPasswordResetCode(auth, oobCode);
        setIsValidCode(true);
      } catch (err: any) {
        logger.error('Erreur de validation du code', err, 'PasswordResetPage');
        setError('Code de réinitialisation invalide ou expiré');
      } finally {
        setIsValidatingCode(false);
      }
    };

    validateResetCode();
  }, [oobCode]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword.trim()) {
      setError('Veuillez entrer un nouveau mot de passe');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (!oobCode) {
      setError('Code de réinitialisation manquant');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      logger.error('Erreur de réinitialisation', err, 'PasswordResetPage');
      setError(getErrorMessage(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/expired-action-code':
        return 'Le code de réinitialisation a expiré. Veuillez demander un nouveau lien.';
      case 'auth/invalid-action-code':
        return 'Code de réinitialisation invalide. Veuillez demander un nouveau lien.';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères';
      case 'auth/network-request-failed':
        return 'Erreur de connexion réseau. Réessayez plus tard.';
      default:
        return 'Une erreur est survenue lors de la réinitialisation';
    }
  };

  if (isValidatingCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Validation du code de réinitialisation...</p>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isValidCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Code invalide
            </h1>
            
            <p className="text-gray-600 mb-6">
              {error || 'Le code de réinitialisation est invalide ou a expiré.'}
            </p>
            
            <Button
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Retour à la connexion
            </Button>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Mot de passe réinitialisé !
            </h1>
            
            <p className="text-gray-600 mb-6">
              Votre mot de passe a été réinitialisé avec succès. 
              Vous allez être redirigé vers la page de connexion.
            </p>
            
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </Card>
        </div>
        <Footer />
      </div>
    );
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
              Réinitialisez votre mot de passe
            </p>
          </div>

          <Card>
            <form onSubmit={handlePasswordReset} className="space-y-4 sm:space-y-6">
              <div className="relative">
                <Lock className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
                <Input
                  label="Nouveau mot de passe *"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
                <Input
                  label="Confirmer le mot de passe *"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                />
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
                {isLoading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
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
