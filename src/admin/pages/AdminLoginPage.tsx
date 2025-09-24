import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { Lock, Mail, AlertCircle, Shield } from 'lucide-react';
import { ActivityLogger } from '../../services/activityLogService';
import { AnalyticsService } from '../../services/analyticsService';

export const AdminLoginPage: React.FC = () => {
  const { user, login, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Redirect if already logged in as admin
  if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Veuillez remplir tous les champs');
      return;
    }

    const success = await login(email, password);
    
    if (success && user?.role === 'admin') {
      // Log admin login activity
      await ActivityLogger.logAdminLogin(user.id, user.email, user.name);
      await AnalyticsService.logAdminActivity(user.id, 'admin_login');
    } else if (success && user?.role !== 'admin') {
      setLocalError('Accès refusé. Seuls les administrateurs peuvent accéder à cette page.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-full">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-blue-200">Accès administrateur sécurisé</p>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email administrateur
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {(error || localError) && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">{error || localError}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Retour à l'application{' '}
              <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Connexion utilisateur
              </a>
            </p>
          </div>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-blue-200 text-sm">
            © 2024 Ubora - Panel d'administration
          </p>
        </div>
      </div>
    </div>
  );
};
