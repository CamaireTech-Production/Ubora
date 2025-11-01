import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { UniversList } from '../components/UniversList';
import { Univers } from '../types';
import { universService } from '../services/universService';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { UniversCreateModal } from '../components/UniversCreateModal';

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
      // Load all Univers the user has access to
      const [
        myUnivers,
        marketplaceUnivers
      ] = await Promise.all([
        universService.getByUser(user.id, user.agencyId),
        universService.getMarketplaceTemplates()
      ]);

      // Combine and deduplicate
      const allUnivers = new Map<string, Univers>();
      
      [...myUnivers, ...marketplaceUnivers].forEach(u => {
        allUnivers.set(u.id, u);
      });

      setUnivers(Array.from(allUnivers.values()));
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
    navigate(`/univers/${univers.id}`);
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
        <div className="text-center py-12">
          <p className="text-gray-600">Chargement...</p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout title="Univer Ubora">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Univer Ubora</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gérez vos Univers - templates regroupant formulaires, tableaux de bord, instructions, listes et rapports
              </p>
            </div>
          </div>

          <UniversList
            univers={univers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            onCreate={handleCreate}
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

