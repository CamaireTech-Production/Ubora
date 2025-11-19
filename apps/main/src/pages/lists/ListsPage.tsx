import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { logger } from '@ubora/shared/utils/logger';
import { Layout } from '../../components/layout/Layout';
import { ListCard } from '../../components/lists/ListCard';
import { ListViewModal } from '../../components/lists/ListViewModal';
import { List } from '../../types';
import { listsService } from '@ubora/shared/services/listsService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../../components/ui/Toast';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, AlertTriangle } from 'lucide-react';
import { canDeleteList } from '@ubora/shared/utils/listUsageChecker';

export const ListsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeUniversId, activeInstanceId } = useApp();
  const { toast, showSuccess, showError } = useToast();
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [listToDelete, setListToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteCheckResult, setDeleteCheckResult] = useState<{
    canDelete: boolean;
    usages: { formId: string; formTitle: string; fieldLabel: string }[];
  } | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [viewingList, setViewingList] = useState<List | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    if (user?.id && user?.agencyId) {
      loadLists();
    }
  }, [user, activeUniversId, activeInstanceId]);

  const loadLists = async () => {
    if (!user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const userLists = await listsService.getByUser(user.id, user.agencyId, user.role, activeUniversId || null, activeInstanceId || null);
      setLists(userLists);
    } catch (error) {
      logger.error('Erreur lors du chargement des Lists', error, 'ListsPage');
      const errorMessage = error instanceof Error 
        ? `Erreur lors du chargement: ${error.message}`
        : 'Erreur lors du chargement des Lists. Veuillez réessayer.';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/lists/create');
  };

  const handleEdit = (list: List) => {
    navigate(`/lists/${list.id}/edit`);
  };

  const handleView = (list: List) => {
    setViewingList(list);
    setIsViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setViewingList(null);
  };

  const handleListUpdated = () => {
    loadLists();
  };

  const handleDelete = async (listId: string) => {
    const listToDeleteItem = lists.find(l => l.id === listId);
    if (!listToDeleteItem || !user?.agencyId) return;
    
    setIsCheckingUsage(true);
    try {
      // Check if list is used in any forms
      const checkResult = await canDeleteList(listId, user.agencyId);
      setDeleteCheckResult(checkResult);
      
      setListToDelete({
        id: listId,
        name: listToDeleteItem.name
      });
      setShowDeleteModal(true);
    } catch (error) {
      logger.error('Error checking list usage', error, 'ListsPage');
      showError('Erreur lors de la vérification de l\'utilisation de la liste');
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const confirmDelete = async () => {
    if (!listToDelete || !deleteCheckResult) return;

    // Prevent deletion if list is used in forms
    if (!deleteCheckResult.canDelete) {
      showError('Impossible de supprimer cette liste car elle est utilisée dans des formulaires');
      return;
    }

    setIsDeleting(true);
    try {
      await listsService.delete(listToDelete.id);
      showSuccess('Liste supprimée avec succès');
      setShowDeleteModal(false);
      setListToDelete(null);
      setDeleteCheckResult(null);
      await loadLists();
    } catch (error) {
      logger.error('Erreur lors de la suppression de la Liste', error, 'ListsPage');
      showError('Erreur lors de la suppression de la Liste');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter lists by search query
  const filteredLists = useMemo(() => {
    if (!searchQuery.trim()) {
      return lists;
    }

    const query = searchQuery.toLowerCase();
    return lists.filter(list =>
      list.name.toLowerCase().includes(query) ||
      list.description?.toLowerCase().includes(query) ||
      list.columns.some(col => col.name.toLowerCase().includes(query))
    );
  }, [lists, searchQuery]);

  if (!user?.id || !user?.agencyId) {
    return (
      <Layout title="Listes">
        <div className="text-center py-12">
          <p className="text-gray-600">Chargement...</p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout title="Listes">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Listes</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gérez vos listes de données réutilisables pour les formulaires
              </p>
            </div>
          </div>

          {/* Search and Create */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher une liste..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Create button */}
            <Button onClick={handleCreate} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Créer une liste</span>
              <span className="sm:hidden">Créer</span>
            </Button>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600">
            {filteredLists.length === 0 ? (
              <span>
                {searchQuery
                  ? 'Aucune liste ne correspond à votre recherche.'
                  : 'Aucune liste trouvée.'}
              </span>
            ) : (
              <span>
                {filteredLists.length} liste{filteredLists.length > 1 ? 's' : ''} trouvée{filteredLists.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Lists grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-sm text-gray-600">Chargement des listes...</p>
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <div className="inline-block p-3 bg-gray-100 rounded-full mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune liste trouvée
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {searchQuery
                  ? 'Essayez de modifier votre recherche.'
                  : 'Commencez par créer votre première liste.'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreate} className="flex items-center space-x-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  <span>Créer une liste</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setListToDelete(null);
          setDeleteCheckResult(null);
        }}
        onConfirm={confirmDelete}
        title="Supprimer la liste"
        message={
          deleteCheckResult && !deleteCheckResult.canDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Cette liste ne peut pas être supprimée car elle est utilisée dans {deleteCheckResult.usages.length} formulaire{deleteCheckResult.usages.length > 1 ? 's' : ''}.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">
                      Utilisée dans :
                    </h4>
                    <ul className="space-y-1 text-sm text-yellow-700">
                      {deleteCheckResult.usages.map((usage, index) => (
                        <li key={index}>
                          • <strong>{usage.formTitle}</strong> - Champ: {usage.fieldLabel}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Vous devez d'abord retirer cette liste des formulaires avant de pouvoir la supprimer.
              </p>
            </div>
          ) : (
            `Êtes-vous sûr de vouloir supprimer "${listToDelete?.name}" ? Cette action est irréversible.`
          )
        }
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={isDeleting || isCheckingUsage}
        disabled={deleteCheckResult ? !deleteCheckResult.canDelete : false}
      />

      {toast && <Toast {...toast} />}

      {/* List View Modal */}
      {viewingList && (
        <ListViewModal
          list={viewingList}
          isOpen={isViewModalOpen}
          onClose={handleCloseViewModal}
          onListUpdated={handleListUpdated}
        />
      )}
    </>
  );
};

