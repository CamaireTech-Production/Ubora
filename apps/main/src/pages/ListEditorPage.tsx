import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Layout } from '../components/Layout';
import { ListEditor } from '../components/ListEditor';
import { List } from '../types';
import { listsService } from '@ubora/shared/services/listsService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../components/Toast';
import { WireframeLoader } from '../components/loading/WireframeLoader';

export const ListEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast, showSuccess, showError } = useToast();
  const [list, setList] = useState<List | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasEditPermission, setHasEditPermission] = useState(false);

  useEffect(() => {
    if (id && user?.id && user?.agencyId) {
      loadList();
    } else if (!id) {
      // Creating new list - no need to load
      setIsLoading(false);
      setHasEditPermission(true);
    }
  }, [id, user]);

  const loadList = async () => {
    if (!id || !user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const listData = await listsService.getById(id);
      
      if (!listData) {
        showError('Liste non trouvée');
        navigate('/lists');
        return;
      }

      setList(listData);

      // Check edit permissions (only creator or director can edit)
      const canEdit = 
        listData.createdBy === user.id || 
        user.role === 'admin' ||
        (user.role === 'directeur' && listData.agencyId === user.agencyId);
      
      setHasEditPermission(canEdit);
      
      if (!canEdit) {
        showError('Vous n\'avez pas la permission de modifier cette liste');
        setTimeout(() => navigate('/lists'), 2000);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la liste:', error);
      showError('Erreur lors du chargement de la liste');
      navigate('/lists');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (listData: {
    name: string;
    description?: string;
    columns: any[];
    rows: any[];
  }) => {
    if (!user?.id || !user?.agencyId) {
      showError('Données utilisateur manquantes');
      return;
    }

    setIsSaving(true);
    try {
      if (id && list) {
        // Update existing list
        await listsService.update(id, {
          name: listData.name,
          description: listData.description,
          columns: listData.columns,
          rows: listData.rows,
          updatedAt: new Date()
        });
        showSuccess('Liste mise à jour avec succès');
      } else {
        // Create new list
        const listId = await listsService.create({
          name: listData.name,
          description: listData.description,
          columns: listData.columns,
          rows: listData.rows,
          createdBy: user.id,
          createdByRole: user.role === 'employe' ? 'employe' : 'directeur',
          createdByEmployeeId: user.role === 'employe' ? user.id : undefined,
          agencyId: user.agencyId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        showSuccess('Liste créée avec succès');
        // Navigate to edit page for the newly created list
        navigate(`/lists/${listId}/edit`);
        return;
      }
      
      // Reload to get updated data
      if (id) {
        await loadList();
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la liste:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde de la liste');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/lists');
  };

  if (isLoading) {
    return (
      <Layout title={id ? "Modifier la liste" : "Créer une liste"}>
        <WireframeLoader type="form" />
      </Layout>
    );
  }

  if (id && !list) {
    return (
      <Layout title="Liste non trouvée">
        <div className="text-center py-12">
          <p className="text-gray-600">Liste non trouvée</p>
          <button
            onClick={() => navigate('/lists')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Retour à la liste
          </button>
        </div>
      </Layout>
    );
  }

  if (id && !hasEditPermission) {
    return (
      <Layout title="Accès refusé">
        <div className="text-center py-12">
          <p className="text-gray-600">Vous n'avez pas la permission de modifier cette liste</p>
          <button
            onClick={() => navigate('/lists')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Retour à la liste
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout title={id ? `Modifier: ${list?.name || 'Liste'}` : "Créer une nouvelle liste"}>
        <ListEditor
          list={list || undefined}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </Layout>

      {toast && <Toast {...toast} />}
    </>
  );
};

