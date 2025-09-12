import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { Building2, Lock, Mail, AlertCircle, UserPlus } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, login, loginWithGoogle, register, isLoading, error } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'directeur' | 'employe'>('employe');
  const [agencyId, setAgencyId] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isInviteLink, setIsInviteLink] = useState(false);

  // Gérer les paramètres d'invitation depuis l'URL
  useEffect(() => {
    const invite = searchParams.get('invite');
    const inviteAgencyId = searchParams.get('agencyId');
    const inviteRole = searchParams.get('role');
    
    if (invite === 'true') {
      setIsInviteLink(true);
      setIsRegisterMode(true);
      
      if (inviteAgencyId) {
        setAgencyId(inviteAgencyId);
      }
      
      if (inviteRole === 'employe') {
        setRole('employe');
      }
    }
  }, [searchParams]);

  // Rediriger si déjà connecté
  if (user) {
    if (user.role === 'directeur') {
      return <Navigate to="/directeur/chat" replace />;
    } else if (user.role === 'employe') {
      return <Navigate to="/employe/dashboard" replace />;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    try {
      if (isRegisterMode) {
        const success = await register(email, password, name, role, agencyId);
        if (success) {
          setIsRegisterMode(false);
          setEmail('');
          setPassword('');
          setName('');
        }
      } else {
        await login(email, password);
      }
    } catch (err) {
      setLocalError('Une erreur est survenue');
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      setLocalError('Erreur lors de la connexion Google');
    }
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="text-center mb-8">
          {isInviteLink ? (
            <UserPlus className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 mx-auto mb-4" />
          ) : (
            <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 mx-auto mb-4" />
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Multi-Agences</h1>
          <p className="text-sm sm:text-base text-gray-600">
            {isInviteLink 
              ? 'Vous avez été invité à rejoindre l\'équipe' 
              : isRegisterMode 
                ? 'Créer un compte' 
                : 'Connectez-vous à votre espace'
            }
          </p>
          {isInviteLink && (
            <p className="text-xs text-green-600 mt-2 font-medium">
              Rôle employé pré-sélectionné
            </p>
          )}
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {isRegisterMode && (
              <>
                <Input
                  label="Nom complet"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom complet"
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'directeur' | 'employe')}
                    disabled={isInviteLink}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${
                      isInviteLink 
                        ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed' 
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="employe">Employé</option>
                    <option value="directeur">Directeur</option>
                  </select>
                  {isInviteLink && (
                    <p className="text-xs text-green-600 mt-1">
                      Rôle défini par l'invitation
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Agence
                  </label>
                  <input
                    type="text"
                    value={agencyId}
                    onChange={(e) => setAgencyId(e.target.value)}
                    placeholder="Entrez votre ID d'agence"
                    disabled={isInviteLink}
                    required
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${
                      isInviteLink 
                        ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed' 
                        : 'border-gray-300'
                    }`}
                  />
                  {isInviteLink && (
                    <p className="text-xs text-green-600 mt-1">
                      Agence définie par l'invitation
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="pl-10"
                required
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10"
                required
              />
            </div>

            {displayError && (
              <div className="flex items-start space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="break-words">{displayError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Chargement...' : (isRegisterMode ? 'Créer le compte' : 'Se connecter')}
            </Button>
          </form>

          {!isRegisterMode && (
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full mt-4"
              >
                Continuer avec Google
              </Button>
            </div>
          )}

          <div className="mt-4 sm:mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLocalError('');
              }}
              className="text-blue-600 hover:text-blue-500 text-sm break-words"
            >
              {isRegisterMode 
                ? 'Déjà un compte ? Se connecter' 
                : 'Pas de compte ? S\'inscrire'
              }
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};