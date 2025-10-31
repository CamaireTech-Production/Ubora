import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UniversWizard } from '../components/UniversWizard';
import { UniversWizardStep1 } from '../components/UniversWizardStep1';
import { UniversWizardStep2 } from '../components/UniversWizardStep2';
import { UniversWizardStep3 } from '../components/UniversWizardStep3';
import { UniversWizardStep4 } from '../components/UniversWizardStep4';
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

  const handleComplete = async (universData: {
    metadata: UniversMetadata;
    ownership: Omit<UniversOwnership, 'approvedBy' | 'approvedAt' | 'rejectionReason'>;
    definitions: UniversDefinitions;
  }) => {
    if (!user?.id || !user?.agencyId) {
      showError('Données utilisateur manquantes');
      return;
    }

    try {
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

      showSuccess('Univers créé avec succès !');
      navigate(`/univers/${universId}`);
    } catch (error) {
      console.error('Error creating Univers:', error);
      showError('Erreur lors de la création du Univers. Veuillez réessayer.');
    }
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
        // Instructions step - will be implemented in next task
        return <ComingSoonStep title="Instructions programmées" description="Cette étape permettra de créer et configurer les instructions programmées du Univers." />;
      case 6:
        // Reports step - Coming Soon
        return <ComingSoonStep title="Rapports" description="Cette fonctionnalité sera disponible prochainement." />;
      case 7:
        // Summary step - will be implemented in next task
        return <ComingSoonStep title="Résumé & Publication" description="Cette étape affichera un résumé complet du Univers et permettra de le publier." />;
      default:
        return <div>Étape non reconnue</div>;
    }
  };

  return (
    <UniversWizard
      onComplete={handleComplete}
      onCancel={handleCancel}
      renderStep={renderStep}
    />
  );
};

