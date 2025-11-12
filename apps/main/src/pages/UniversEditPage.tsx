import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Layout } from '../components/Layout';
import { UniversEditor } from '../components/UniversEditor';
import { Univers } from '../types';
import { universService } from '@ubora/shared/services/universService';
import { useToast } from '@ubora/shared/hooks/useToast';
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
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (id && user?.id && user?.agencyId && !isNavigating) {
      loadUnivers();
    }
  }, [id, user, isNavigating]);

  const loadUnivers = async () => {
    if (!id || !user?.id || !user?.agencyId || isNavigating) return;

    setIsLoading(true);
    try {
      // Récupérer avec userId pour avoir accès au draft si c'est le créateur
      const universData = await universService.getById(id, user.id);
      
      if (isNavigating) return; // Component unmounted, don't update state
      
      if (!universData) {
        showError('Univers non trouvé');
        navigate('/univers', { replace: true });
        return;
      }

      setUnivers(universData as any);

      // Check edit permissions (only creator can edit)
      const canEdit = universData.ownership.createdBy === user.id || user.role === 'admin';
      setHasEditPermission(canEdit);
      
      if (!canEdit) {
        showError('Vous n\'avez pas la permission de modifier ce Univers');
        setTimeout(() => navigate('/univers', { replace: true }), 2000);
      }
    } catch (error) {
      if (isNavigating) return; // Component unmounted, don't update state
      console.error('Erreur lors du chargement du Univers:', error);
      showError('Erreur lors du chargement du Univers');
      navigate('/univers', { replace: true });
    } finally {
      if (!isNavigating) {
        setIsLoading(false);
      }
    }
  };

  const handleSave = async (updatedUnivers: Partial<Univers>, saveAsDraft?: boolean, publishToMarketplace?: boolean) => {
    if (!id || !univers || !user?.id) return;

    try {
      const isMarketplace = univers.ownership.isMarketplaceTemplate;
      const isOwner = univers.ownership.createdBy === user.id;

      // Pour les univers marketplace et le créateur : utiliser saveDraft() ou publishDraft()
      if (isMarketplace && isOwner) {
        if (saveAsDraft) {
          // Sauvegarder comme draft
          await universService.saveDraft(id, updatedUnivers as any, user.id);
          // Recharger l'univers pour mettre à jour hasUnpublishedChanges
          const updatedUniversData = await universService.getById(id, user.id);
          if (updatedUniversData) {
            setUnivers(updatedUniversData as any);
          }
          // Afficher le toast de succès
          showSuccess('Brouillon sauvegardé avec succès. Vous pouvez tester vos modifications avant de les publier.');
          // Ne pas naviguer, permettre à l'utilisateur de continuer à éditer
          return;
        } else if (publishToMarketplace) {
          // D'abord sauvegarder le draft, puis le publier
          await universService.saveDraft(id, updatedUnivers as any, user.id);
          await universService.publishDraft(id, user.id);
          // Naviguer après publication
          setIsNavigating(true);
          setTimeout(() => {
            navigate('/univers', { replace: true });
          }, 500);
          return;
        }
      }

      // Pour les univers privés : comportement normal avec update()
      await universService.update(id, updatedUnivers as any, user.id);
      showSuccess('Univers mis à jour avec succès');
      
      // Navigate back to Univers listing page after successful update
      setIsNavigating(true);
      setTimeout(() => {
        navigate('/univers', { replace: true });
      }, 500); // Small delay to show success message
    } catch (error) {
      console.error('Erreur lors de la mise à jour du Univers:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erreur lors de la mise à jour du Univers';
      showError(errorMessage);
    }
  };

  const handleCancel = () => {
    setIsNavigating(true);
    navigate('/univers', { replace: true });
  };

  // Don't render if navigating away
  if (isNavigating) {
    return null;
  }

  if (isLoading) {
    return (
      <Layout title="Modifier le Univers">
        <WireframeLoader type="univers-detail" />
      </Layout>
    );
  }

  if (!univers) {
    return (
      <Layout title="Univers non trouvé">
        <div className="text-center py-12">
          <p className="text-gray-600">Univers non trouvé</p>
          <button
            onClick={() => navigate('/univers', { replace: true })}
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
            onClick={() => navigate('/univers', { replace: true })}
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
          userId={user?.id}
        />
      </Layout>

      {toast && <Toast {...toast} />}
    </>
  );
};

