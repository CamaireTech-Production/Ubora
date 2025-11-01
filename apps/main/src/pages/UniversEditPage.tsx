import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Layout } from '../components/Layout';
import { UniversEditor } from '../components/UniversEditor';
import { Univers } from '../types';
import { universService } from '../services/universService';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { WireframeLoader } from '../components/loading/WireframeLoader';

export const UniversEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast, showSuccess, showError } = useToast();
  const [univers, setUnivers] = useState<Univers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasEditPermission, setHasEditPermission] = useState(false);

  useEffect(() => {
    if (id && user?.id && user?.agencyId) {
      loadUnivers();
    }
  }, [id, user]);

  const loadUnivers = async () => {
    if (!id || !user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const universData = await universService.getById(id);
      
      if (!universData) {
        showError('Univers non trouvé');
        navigate('/univers');
        return;
      }

      setUnivers(universData);

      // Check edit permissions (only creator can edit)
      const canEdit = universData.ownership.createdBy === user.id || user.role === 'admin';
      setHasEditPermission(canEdit);
      
      if (!canEdit) {
        showError('Vous n\'avez pas la permission de modifier ce Univers');
        setTimeout(() => navigate('/univers'), 2000);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du Univers:', error);
      showError('Erreur lors du chargement du Univers');
      navigate('/univers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (updatedUnivers: Partial<Univers>) => {
    if (!id || !univers) return;

    try {
      // Increment version if metadata changed
      const updates: Partial<Univers> = {
        ...updatedUnivers,
        metadata: {
          ...univers.metadata,
          ...updatedUnivers.metadata,
          version: updatedUnivers.metadata ? univers.metadata.version + 1 : univers.metadata.version
        }
      };

      await universService.update(id, updates);
      showSuccess('Univers mis à jour avec succès');
      
      // Reload to get updated data
      await loadUnivers();
      
      // Optionally navigate back to Univers page
      // navigate('/univers');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du Univers:', error);
      showError('Erreur lors de la mise à jour du Univers');
    }
  };

  const handleCancel = () => {
    navigate('/univers');
  };

  if (isLoading) {
    return (
      <Layout title="Modifier le Univers">
        <WireframeLoader type="form" />
      </Layout>
    );
  }

  if (!univers) {
    return (
      <Layout title="Univers non trouvé">
        <div className="text-center py-12">
          <p className="text-gray-600">Univers non trouvé</p>
          <button
            onClick={() => navigate('/univers')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Retour à la liste
          </button>
        </div>
      </Layout>
    );
  }

  if (!hasEditPermission) {
    return (
      <Layout title="Accès refusé">
        <div className="text-center py-12">
          <p className="text-gray-600">Vous n'avez pas la permission de modifier ce Univers</p>
          <button
            onClick={() => navigate('/univers')}
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
      <Layout title={`Modifier: ${univers.metadata.name}`}>
        <UniversEditor
          univers={univers}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </Layout>

      {toast && <Toast {...toast} />}
    </>
  );
};

