import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { Building2, Lock, Mail, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, login, loginWithGoogle, register, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'directeur' | 'employe'>('employe');
  const [agencyId, setAgencyId] = useState('agency1');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [localError, setLocalError] = useState('');

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Building2 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Multi-Agences</h1>
          <p className="text-gray-600">
            {isRegisterMode ? 'Créer un compte' : 'Connectez-vous à votre espace'}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="employe">Employé</option>
                    <option value="directeur">Directeur</option>
                  </select>
                </div>

                <Input
                  label="ID Agence"
                  type="text"
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value)}
                  placeholder="agency1"
                  required
                />
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
              <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{displayError}</span>
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

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLocalError('');
              }}
              className="text-blue-600 hover:text-blue-500 text-sm"
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