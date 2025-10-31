import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UniversWizard } from '../components/UniversWizard';
import { UniversWizardStep1 } from '../components/UniversWizardStep1';
import { UniversWizardStep2 } from '../components/UniversWizardStep2';
import { UniversWizardStep3 } from '../components/UniversWizardStep3';
import { UniversWizardStep4 } from '../components/UniversWizardStep4';
import { UniversWizardStep5 } from '../components/UniversWizardStep5';
import { UniversWizardStep6 } from '../components/UniversWizardStep6';
import { UniversWizardStep7 } from '../components/UniversWizardStep7';
import { UniversCreationLoading } from '../components/UniversCreationLoading';
import { UniversDefinitions, UniversMetadata, UniversOwnership } from '../types';
import { universService } from '../services/universService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { UniversWizardStepProps } from '../components/UniversWizard';
import { Card } from '../components/Card';

// Placeholder components for coming steps (will be implemented later)
const ComingSoonStep: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  return (
    <Card>
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">🚧</span>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
        <p className="text-sm text-gray-500 mt-4">Cette fonctionnalité sera disponible prochainement</p>
      </div>
    </Card>
  );
};

export const UniversCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createdUniversId, setCreatedUniversId] = useState<string | null>(null);

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
        metadata: universData.metadata,
        ownership: universData.ownership,
        definitions: universData.definitions,
        usage: {
          totalUsages: 0,
          lastUsedAt: undefined
        }
      });

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
    if (createdUniversId) {
      showSuccess('Univers créé avec succès !');
      navigate(`/univers/${createdUniversId}`);
    }
    setIsCreating(false);
    setCreatedUniversId(null);
  };

  const handleCancel = () => {
    navigate('/univers');
  };

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
      <UniversWizard
        onComplete={handleComplete}
        onCancel={handleCancel}
        renderStep={renderStep}
      />
      {isCreating && (
        <UniversCreationLoading
          isVisible={isCreating}
          onComplete={handleLoadingComplete}
        />
      )}
    </>
  );
};

