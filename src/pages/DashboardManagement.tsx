import React, { useState } from 'react';
import { Dashboard } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DashboardDisplay } from '../components/DashboardDisplay';
import { DashboardCreationModal } from '../components/DashboardCreationModal';
import { DashboardDetailModal } from '../components/DashboardDetailModal';
import { LoadingGuard } from '../components/LoadingGuard';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { Plus, BarChart3, Grid, List } from 'lucide-react';

export const DashboardManagement: React.FC = () => {
  const { user, firebaseUser, isLoading } = useAuth();
  const { 
    forms,
    formEntries,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    getDashboardsForDirector,
    isLoading: appLoading
  } = useApp();
  const { toast, showSuccess, showError } = useToast();
  
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);

  const directorDashboards = user?.id ? getDashboardsForDirector(user.id) : [];

  const handleCreateDashboard = async (dashboardData: any) => {
    try {
      await createDashboard(dashboardData);
      setShowDashboardModal(false);
      showSuccess('Tableau de bord créé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la création du tableau de bord:', error);
      showError('Erreur lors de la création du tableau de bord. Veuillez réessayer.');
      throw error; // Re-throw to let the modal handle the error display
    }
  };

  const handleEditDashboard = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setShowDashboardModal(true);
  };

  const handleUpdateDashboard = async (dashboardData: any) => {
    if (!editingDashboard) return;
    
    try {
      await updateDashboard(editingDashboard.id, dashboardData);
      setShowDashboardModal(false);
      setEditingDashboard(null);
      showSuccess('Tableau de bord mis à jour avec succès !');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du tableau de bord:', error);
      showError('Erreur lors de la mise à jour du tableau de bord. Veuillez réessayer.');
    }
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    try {
      await deleteDashboard(dashboardId);
      showSuccess('Tableau de bord supprimé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la suppression du tableau de bord:', error);
      showError('Erreur lors de la suppression du tableau de bord. Veuillez réessayer.');
    }
  };

  const handleCloseModal = () => {
    setShowDashboardModal(false);
    setEditingDashboard(null);
  };

  const handleViewDashboard = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedDashboard(null);
  };

  const handleEditMetric = (dashboard: Dashboard, metricIndex: number) => {
    // For now, we'll just show an alert. In a real implementation, 
    // you'd open a metric editing modal
    alert(`Édition de la métrique "${dashboard.metrics[metricIndex].name}" - Fonctionnalité à implémenter`);
  };

  const handleDeleteMetric = async (dashboard: Dashboard, metricIndex: number) => {
    try {
      const updatedMetrics = dashboard.metrics.filter((_, index) => index !== metricIndex);
      await updateDashboard(dashboard.id, {
        metrics: updatedMetrics
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la métrique:', error);
      alert('Erreur lors de la suppression de la métrique. Veuillez réessayer.');
    }
  };

  return (
    <LoadingGuard 
      isLoading={isLoading || appLoading} 
      user={user} 
      firebaseUser={firebaseUser}
      message="Chargement des tableaux de bord..."
    >
      {user?.role !== 'directeur' ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Accès refusé</h1>
            <p className="text-gray-600">Seuls les directeurs peuvent accéder à cette page.</p>
          </Card>
        </div>
      ) : (
        <Layout title="Gestion des Tableaux de Bord">
          <div className="space-y-6">
            {/* Header avec actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Mes Tableaux de Bord</h1>
                <p className="text-gray-600 mt-1">
                  Gérez vos tableaux de bord personnalisés et leurs métriques
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* View mode toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="p-2"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="p-2"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button
                  onClick={() => setShowDashboardModal(true)}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-5 w-5" />
                  <span>Nouveau tableau de bord</span>
                </Button>
              </div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-8 w-8 opacity-80" />
                  <div>
                    <p className="text-blue-100">Tableaux de bord</p>
                    <p className="text-xl sm:text-2xl font-bold">{directorDashboards.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-8 w-8 opacity-80" />
                  <div>
                    <p className="text-green-100">Métriques totales</p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {directorDashboards.reduce((sum, dashboard) => sum + dashboard.metrics.length, 0)}
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-8 w-8 opacity-80" />
                  <div>
                    <p className="text-purple-100">Formulaires utilisés</p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {new Set(directorDashboards.flatMap(d => d.metrics.map(m => m.formId))).size}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Liste des tableaux de bord */}
            {directorDashboards.length === 0 ? (
              <Card className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun tableau de bord créé
                </h3>
                <p className="text-gray-600 mb-6">
                  Créez votre premier tableau de bord pour visualiser vos métriques personnalisées.
                </p>
                <Button onClick={() => setShowDashboardModal(true)}>
                  Créer mon premier tableau de bord
                </Button>
              </Card>
            ) : (
              <div className={
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
                  : 'relative'
              }>
                {viewMode === 'list' ? (
                  <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide horizontal-scroll-dashboards">
                    {directorDashboards.map(dashboard => (
                      <div key={dashboard.id} className="flex-shrink-0 w-64 sm:w-72">
                        <DashboardDisplay
                          dashboard={dashboard}
                          formEntries={formEntries}
                          forms={forms}
                          onEdit={handleEditDashboard}
                          onDelete={handleDeleteDashboard}
                          onView={handleViewDashboard}
                          showActions={true}
                          minimal={true}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  directorDashboards.map(dashboard => (
                    <DashboardDisplay
                      key={dashboard.id}
                      dashboard={dashboard}
                      formEntries={formEntries}
                      forms={forms}
                      onEdit={handleEditDashboard}
                      onDelete={handleDeleteDashboard}
                      onView={handleViewDashboard}
                      showActions={true}
                      minimal={false}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Dashboard Creation/Edit Modal */}
          <DashboardCreationModal
            isOpen={showDashboardModal}
            onClose={handleCloseModal}
            onSave={editingDashboard ? handleUpdateDashboard : handleCreateDashboard}
            forms={forms}
            currentUserId={user?.id || ''}
            agencyId={user?.agencyId || ''}
          />

          {/* Dashboard Detail Modal */}
          <DashboardDetailModal
            isOpen={showDetailModal}
            onClose={handleCloseDetailModal}
            dashboard={selectedDashboard}
            formEntries={formEntries}
            forms={forms}
            onEditDashboard={handleEditDashboard}
            onDeleteDashboard={handleDeleteDashboard}
            onEditMetric={handleEditMetric}
            onDeleteMetric={handleDeleteMetric}
          />

          {/* Toast Notification */}
          <Toast
            show={toast.show}
            message={toast.message}
            type={toast.type}
          />
        </Layout>
      )}
    </LoadingGuard>
  );
};

