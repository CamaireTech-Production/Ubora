import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Layout } from '../../components/layout/Layout';
import { UniversList } from '../../components/univers/UniversList';
import { Univers } from '../../types';
import { universService } from '@ubora/shared/services/universService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../../components/ui/Toast';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { UniversCreateModal } from '../../components/univers/UniversCreateModal';
import { Button } from '../../components/ui/Button';
import { Plus, Globe } from 'lucide-react';
import { WireframeLoader } from '../../components/loading/WireframeLoader';

export const UniversPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showSuccess, showError } = useToast();
  const [univers, setUnivers] = useState<Univers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [universToDelete, setUniversToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (user?.id && user?.agencyId) {
      loadUnivers();
    }
  }, [user]);

  const loadUnivers = async () => {
    if (!user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      // Charger uniquement les Univers du directeur (créés + achetés)
      const userUnivers = await universService.getUserUnivers(user.id, user.agencyId);
      setUnivers(userUnivers);
    } catch (error) {
      console.error('Erreur lors du chargement des Univers:', error);
      showError('Erreur lors du chargement des Univers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleCreateFromScratch = () => {
    setShowCreateModal(false);
    navigate('/univers/create');
  };

  const handleEdit = (univers: Univers) => {
    navigate(`/univers/${univers.id}/edit`);
  };

  const handleView = (univers: Univers) => {
    navigate(`/univers/${univers.id}`, { state: { from: 'my-univers' } });
  };

  const handleDelete = (universId: string) => {
    const universToDeleteItem = univers.find(u => u.id === universId);
    if (universToDeleteItem) {
      setUniversToDelete({
        id: universId,
        name: universToDeleteItem.metadata.name
      });
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!universToDelete) return;

    setIsDeleting(true);
    try {
      await universService.delete(universToDelete.id);
      showSuccess('Univers supprimé avec succès');
      setShowDeleteModal(false);
      setUniversToDelete(null);
      await loadUnivers();
    } catch (error) {
      console.error('Erreur lors de la suppression du Univers:', error);
      showError('Erreur lors de la suppression du Univers');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user?.id || !user?.agencyId) {
    return (
      <Layout title="Univer Ubora">
        <WireframeLoader type="univers" />
      </Layout>
    );
  }

  return (
    <>
      <Layout title="Univer Ubora">
        <div className="space-y-6">
          {/* Header avec gradient moderne */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 border border-blue-100">
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Mes Univers
                  </h1>
                  <p className="text-sm text-gray-600 mt-2">
                    Gérez vos Univers - templates regroupant formulaires, tableaux de bord, instructions, listes et rapports
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => navigate('/univers/marketplace')}
                    variant="secondary"
                    className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm hover:bg-white border border-gray-200 shadow-sm"
                  >
                    <Globe className="h-4 w-4" />
                    <span>Marketplace</span>
                  </Button>
                  <Button
                    onClick={handleCreate}
                    className="flex items-center space-x-2 shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Créer un Univers</span>
                  </Button>
                </div>
              </div>
            </div>
            {/* Pattern décoratif */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
          </div>

          <UniversList
            univers={univers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            currentUserId={user.id}
            isLoading={isLoading}
          />
        </div>
      </Layout>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUniversToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Supprimer le Univers"
        message={`Êtes-vous sûr de vouloir supprimer "${universToDelete?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={isDeleting}
      />

      <UniversCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateFromScratch={handleCreateFromScratch}
      />

      {toast && <Toast {...toast} />}
    </>
  );
};

