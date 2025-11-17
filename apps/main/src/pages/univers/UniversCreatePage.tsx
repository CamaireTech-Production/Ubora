import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UniversWizard } from '../../components/univers/UniversWizard';
import { UniversWizardStep1 } from '../../components/univers/UniversWizardStep1';
import { UniversWizardStep2 } from '../../components/univers/UniversWizardStep2';
import { UniversWizardStep3 } from '../../components/univers/UniversWizardStep3';
import { UniversWizardStep4 } from '../../components/univers/UniversWizardStep4';
import { UniversWizardStep5 } from '../../components/univers/UniversWizardStep5';
import { UniversWizardStep6 } from '../../components/univers/UniversWizardStep6';
import { UniversWizardStep7 } from '../../components/univers/UniversWizardStep7';
import { UniversCreationLoading } from '../../components/univers/UniversCreationLoading';
import { DraftSaveModal } from '../../components/modals/DraftSaveModal';
import { UniversDefinitions, UniversMetadata, UniversOwnership } from '../../types';
import { universService } from '@ubora/shared/services/universService';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { useUniversWizardProgress } from '@ubora/shared/hooks/useUniversWizardProgress';
import { UniversWizardStepProps } from '../../components/univers/UniversWizard';
export const UniversCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { clearProgress, loadProgress } = useUniversWizardProgress(user?.id);
  const [isCreating, setIsCreating] = useState(false);
  const [createdUniversId, setCreatedUniversId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const handleComplete = async (universData: {
    metadata: UniversMetadata;
    ownership: Omit<UniversOwnership, 'approvedBy' | 'approvedAt' | 'rejectionReason'>;
    definitions: UniversDefinitions;
  }) => {
    if (!user?.id || !user?.agencyId) {
      showError('Données utilisateur manquantes');
      return;
    }

    // Show loading animation immediately
    setIsCreating(true);

    try {
      // Small delay to ensure loading UI is visible before async operation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create Univers in Firestore
      const universId = await universService.create({
        metadata: {
          ...universData.metadata,
          price: universData.metadata.price ?? undefined
        },
        ownership: universData.ownership,
        definitions: universData.definitions,
        usage: {
          totalUsages: 0,
          lastUsedAt: undefined
        }
      } as any);

      setCreatedUniversId(universId);
      // The loading component will handle the navigation after animation
    } catch (error) {
      console.error('Error creating Univers:', error);
      setIsCreating(false);
      setCreatedUniversId(null);
      showError('Erreur lors de la création du Univers. Veuillez réessayer.');
    }
  };

  const handleLoadingComplete = () => {
    // Clear localStorage progress
    clearProgress();
    
    if (createdUniversId) {
      // Set navigating state to hide wizard
      setIsNavigating(true);
      // Hide loading animation first
      setIsCreating(false);
      
      showSuccess('Univers créé avec succès !');
      
      // Navigate to list page after a small delay to ensure state is cleaned up
      setTimeout(() => {
        navigate('/univers', { replace: true });
      }, 300);
    } else {
      setIsCreating(false);
      setCreatedUniversId(null);
    }
  };

  const handleCancel = () => {
    // Check if there's any progress saved
    const saved = loadProgress();
  const hasProgress = Boolean(
    saved && (
      saved.metadata?.name ||
      (saved.forms && saved.forms.length > 0) ||
      (saved.dashboards && saved.dashboards.length > 0) ||
      (saved.instructions && saved.instructions.length > 0)
    )
  );

    if (hasProgress) {
      // Show modal to let user choose
      setShowDraftModal(true);
    } else {
      // No progress, just navigate
      setIsNavigating(true);
      navigate('/univers', { replace: true });
    }
  };

  const handleSaveAsDraft = () => {
    // Progress is already saved by auto-save, just navigate
    setIsNavigating(true);
    setShowDraftModal(false);
    showSuccess('Brouillon sauvegardé. Vous pourrez reprendre plus tard.');
    setTimeout(() => {
      navigate('/univers', { replace: true });
    }, 300);
  };

  const handleAbandonDraft = () => {
    // Clear progress and navigate
    clearProgress();
    setIsNavigating(true);
    setShowDraftModal(false);
    setTimeout(() => {
      navigate('/univers', { replace: true });
    }, 300);
  };

  const handleCloseDraftModal = () => {
    setShowDraftModal(false);
  };

  // Check if there's progress saved
  const saved = loadProgress();
  const hasProgress = Boolean(
    saved &&
      (saved.metadata?.name ||
        (saved.forms && saved.forms.length > 0) ||
        (saved.dashboards && saved.dashboards.length > 0) ||
        (saved.instructions && saved.instructions.length > 0))
  );

  const renderStep = (props: UniversWizardStepProps): React.ReactNode => {
    const { step } = props;

    switch (step) {
      case 1:
        return <UniversWizardStep1 {...props} />;
      case 2:
        // Lists step - Coming Soon (now step 2)
        return <UniversWizardStep2 {...props} />;
      case 3:
        // Forms step
        return <UniversWizardStep3 {...props} />;
      case 4:
        // Dashboards step
        return <UniversWizardStep4 {...props} />;
      case 5:
        // Reports step - Coming Soon
        return <UniversWizardStep6 {...props} />;
      case 6:
        // Instructions step
        return <UniversWizardStep5 {...props} />;
      case 7:
        // Summary step
        return <UniversWizardStep7 {...props} />;
      default:
        return <div>Étape non reconnue</div>;
    }
  };

  return (
    <>
      {!isNavigating && (
        <UniversWizard
          onComplete={handleComplete}
          onCancel={handleCancel}
          renderStep={renderStep}
        />
      )}
      {isCreating && (
        <UniversCreationLoading
          isVisible={isCreating}
          onComplete={handleLoadingComplete}
        />
      )}
      <DraftSaveModal
        isOpen={showDraftModal}
        onClose={handleCloseDraftModal}
        onSaveAsDraft={handleSaveAsDraft}
        onAbandon={handleAbandonDraft}
        hasProgress={hasProgress || false}
      />
    </>
  );
};

