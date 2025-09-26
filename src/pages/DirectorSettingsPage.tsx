import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DirectorPackageOverview } from '../components/DirectorPackageOverview';
import { SubscriptionHistoryModal } from '../components/SubscriptionHistoryModal';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { UserSessionService } from '../services/userSessionService';
import { ArrowLeft, Settings, User, Bell, Shield, Calendar } from 'lucide-react';

export const DirectorSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasDirectorDashboardAccess } = usePermissions();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Get subscription history data
  const subscriptionHistory = user ? UserSessionService.getSubscriptionHistory(user) : null;

  if (!user || user.role !== 'directeur') {
    return (
      <Layout title="Paramètres">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Accès refusé</h1>
            <p className="text-gray-600">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Paramètres">
      <div className="max-w-4xl mx-auto space-y-6 px-4">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/directeur/dashboard')}
              className="flex items-center space-x-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Paramètres
              </h1>
              <p className="text-gray-600">
                Gérez vos paramètres de compte et votre abonnement
              </p>
            </div>
          </div>
          
          {/* Subscription History Button */}
          {user && subscriptionHistory && subscriptionHistory.totalSessions > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center space-x-2"
            >
              <Calendar className="h-4 w-4" />
              <span>Historique</span>
            </Button>
          )}
        </div>

        {/* Package Overview Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Abonnement et Consommation
            </h2>
          </div>
          <DirectorPackageOverview />
        </div>

        {/* Account Settings Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Informations du Compte
            </h2>
          </div>
          
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {user.name}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {user.email}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    Directeur
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agence
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {user.agencyName || 'Non spécifiée'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Agence
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md font-mono">
                    {user.agencyId || 'Non spécifiée'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Membre depuis
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {(() => {
                      if (!user.createdAt) return 'Non spécifié';
                      
                      // Handle Firestore timestamp conversion
                      let date: Date;
                      if (user.createdAt && typeof user.createdAt.toDate === 'function') {
                        date = user.createdAt.toDate();
                      } else if (user.createdAt instanceof Date) {
                        date = user.createdAt;
                      } else if (typeof user.createdAt === 'string' || typeof user.createdAt === 'number') {
                        date = new Date(user.createdAt);
                      } else {
                        return 'Non spécifié';
                      }
                      
                      return date.toLocaleDateString('fr-FR');
                    })()}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Package activé le
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {(() => {
                      // Get current active session start date
                      const currentSession = user.subscriptionSessions?.find(session => session.isActive);
                      if (!currentSession?.startDate) return 'Non spécifié';
                      
                      // Handle Firestore timestamp conversion
                      let date: Date;
                      if (currentSession.startDate && typeof currentSession.startDate.toDate === 'function') {
                        date = currentSession.startDate.toDate();
                      } else if (currentSession.startDate instanceof Date) {
                        date = currentSession.startDate;
                      } else if (typeof currentSession.startDate === 'string' || typeof currentSession.startDate === 'number') {
                        date = new Date(currentSession.startDate);
                      } else {
                        return 'Non spécifié';
                      }
                      
                      return date.toLocaleDateString('fr-FR');
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Actions Rapides
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/packages/manage')}
              className="flex items-center justify-center space-x-2 h-16"
            >
              <Shield className="h-5 w-5" />
              <span>Gérer les Packages</span>
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => navigate('/notifications')}
              className="flex items-center justify-center space-x-2 h-16"
            >
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => navigate('/directeur/employees')}
              className="flex items-center justify-center space-x-2 h-16"
            >
              <User className="h-5 w-5" />
              <span>Gérer les Employés</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Subscription History Modal */}
      {user && (
        <SubscriptionHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          sessions={subscriptionHistory?.totalSessions ? SubscriptionSessionService.getAllSessions(user) : []}
          currentSession={subscriptionHistory?.currentSession}
        />
      )}
    </Layout>
  );
};
