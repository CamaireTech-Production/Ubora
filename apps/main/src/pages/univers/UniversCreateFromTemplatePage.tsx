import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { logger } from '@ubora/shared/utils/logger';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { PaymentStep } from '../../components/payments/PaymentStep';
import { UniversWizard } from '../../components/univers/UniversWizard';
import { UniversWizardStep1 } from '../../components/univers/UniversWizardStep1';
import { UniversWizardStep2 } from '../../components/univers/UniversWizardStep2';
import { UniversWizardStep3 } from '../../components/univers/UniversWizardStep3';
import { UniversWizardStep4 } from '../../components/univers/UniversWizardStep4';
import { UniversWizardStep5 } from '../../components/univers/UniversWizardStep5';
import { UniversWizardStep6 } from '../../components/univers/UniversWizardStep6';
import { UniversWizardStep7 } from '../../components/univers/UniversWizardStep7';
import { Univers } from '../../types';
import { universService } from '@ubora/shared/services/universService';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { WireframeLoader } from '../../components/loading/WireframeLoader';

export const UniversCreateFromTemplatePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [templateUnivers, setTemplateUnivers] = useState<Univers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<'payment' | 'wizard'>('payment');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (id && user?.id && user?.agencyId) {
      loadTemplate();
    }
  }, [id, user]);

  const loadTemplate = async () => {
    if (!id || !user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const univers = await universService.getById(id);

      if (!univers) {
        showError('Template Univers non trouvé');
        navigate('/univers');
        return;
      }

      // Vérifier que c'est un Univers marketplace approuvé
      if (!univers.ownership.isMarketplaceTemplate || univers.ownership.approvalStatus !== 'approved') {
        showError('Ce Univers n\'est pas disponible dans le marketplace');
        navigate('/univers');
        return;
      }

      setTemplateUnivers(univers);

      // Si gratuit, passer directement au wizard
      const isFree = univers.metadata.price === 0 || univers.metadata.price === null || univers.metadata.price === undefined;
      if (isFree) {
        setCurrentStep('wizard');
      }
    } catch (error) {
      logger.error('Erreur lors du chargement du template', error, 'UniversCreateFromTemplatePage');
      showError('Erreur lors du chargement du template');
      navigate('/univers');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentComplete = (paymentId: string) => {
    setPaymentId(paymentId);
    setCurrentStep('wizard');
  };

  const handlePaymentSkip = () => {
    setCurrentStep('wizard');
  };

  const handleComplete = async () => {
    if (!templateUnivers || !user?.id || !user?.agencyId) return;

    // Vérifier que l'utilisateur est un directeur
    if (user.role !== 'directeur') {
      showError('Seuls les directeurs peuvent créer des Univers depuis un template');
      return;
    }

    // Validation: vérifier le paiement si nécessaire
    const price = templateUnivers.metadata.price ?? 0;
    const isFree = price === 0 || price === null || price === undefined;
    if (!isFree && !paymentId) {
      showError('Le paiement est requis pour ce Univers. Veuillez effectuer le paiement avant de continuer.');
      return;
    }

    setIsCreating(true);
    try {
      // Créer l'instance via purchaseUnivers()
      const instanceId = await universService.purchaseUnivers(
        templateUnivers.id,
        user.id,
        user.agencyId,
        paymentId || undefined
      );

      logger.info(`Instance créée avec succès: ${instanceId}`, null, 'UniversCreateFromTemplatePage');
      
      showSuccess(
        `Univers acheté et instancié avec succès ! L'instance est maintenant disponible.`
      );

      // Rediriger vers la liste des Univers après un court délai
      setTimeout(() => {
        setIsCreating(false);
        navigate('/univers', { replace: true });
      }, 1000);
    } catch (error) {
      logger.error('Erreur lors de l\'achat du Univers', error, 'UniversCreateFromTemplatePage');
      showError(
        error instanceof Error
          ? error.message
          : 'Erreur lors de l\'achat du Univers'
      );
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    navigate('/univers');
  };

  const renderStep = (props: any) => {
    switch (props.step) {
      case 1:
        return <UniversWizardStep1 {...props} readOnly={true} templateData={templateUnivers || undefined} />;
      case 2:
        return <UniversWizardStep2 {...props} readOnly={true} templateData={templateUnivers || undefined} />;
      case 3:
        return <UniversWizardStep3 {...props} readOnly={true} templateData={templateUnivers || undefined} />;
      case 4:
        return <UniversWizardStep4 {...props} readOnly={true} templateData={templateUnivers || undefined} />;
      case 5:
        // Step 5 = Rapports (UniversWizardStep6 affiche les rapports)
        return <UniversWizardStep6 {...props} readOnly={true} templateData={templateUnivers || undefined} />;
      case 6:
        // Step 6 = Instructions (UniversWizardStep5 affiche les instructions)
        return <UniversWizardStep5 {...props} readOnly={true} templateData={templateUnivers || undefined} />;
      case 7:
        return <UniversWizardStep7 {...props} readOnly={true} templateData={templateUnivers || undefined} />;
      default:
        return null;
    }
  };

  if (!user?.id || !user?.agencyId) {
    return (
      <Layout title="Créer depuis un template">
        <WireframeLoader type="univers-detail" />
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Créer depuis un template">
        <WireframeLoader type="univers-detail" />
      </Layout>
    );
  }

  if (!templateUnivers) {
    return (
      <Layout title="Template non trouvé">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Template Univers non trouvé</p>
          <Button onClick={() => navigate('/univers')}>
            Retour à la liste
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Créer depuis: ${templateUnivers.metadata.name}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Créer depuis un template
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {templateUnivers.metadata.name}
            </p>
          </div>
        </div>

        {/* Payment Step */}
        {currentStep === 'payment' && (
          <PaymentStep
            universName={templateUnivers.metadata.name}
            price={templateUnivers.metadata.price ?? null}
            currency={templateUnivers.metadata.currency || 'XAF'}
            universId={templateUnivers.id}
            onPaymentComplete={handlePaymentComplete}
            onSkip={handlePaymentSkip}
            isLoading={isCreating}
          />
        )}

        {/* Wizard Step */}
        {currentStep === 'wizard' && (
          <UniversWizard
            onComplete={handleComplete}
            onCancel={handleCancel}
            renderStep={renderStep}
            initialData={{
              metadata: templateUnivers.metadata,
              definitions: templateUnivers.definitions
            }}
            readOnly={true}
            templateData={templateUnivers}
          />
        )}
      </div>
    </Layout>
  );
};

