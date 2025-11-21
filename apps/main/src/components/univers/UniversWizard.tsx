import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Circle, Loader2 } from 'lucide-react';
import { useUniversWizardProgress } from '@ubora/shared/hooks/useUniversWizardProgress';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { UniversDefinitions, UniversMetadata, UniversOwnership, Univers } from '../../types';
import { logger } from '@ubora/shared/utils/logger';

interface UniversWizardProps {
  onComplete: (universData: {
    metadata: UniversMetadata;
    ownership: Omit<UniversOwnership, 'approvedBy' | 'approvedAt' | 'rejectionReason'>;
    definitions: UniversDefinitions;
  }) => void;
  onCancel: () => void;
  renderStep: (props: UniversWizardStepProps) => React.ReactNode;
  initialData?: Partial<{
    metadata: Partial<UniversMetadata>;
    definitions: Partial<UniversDefinitions>;
  }>;
  readOnly?: boolean;
  templateData?: Univers;
}

const TOTAL_STEPS = 7;

const STEP_LABELS = [
  'Métadonnées',
  'Listes',
  'Formulaires',
  'Tableaux de bord',
  'Rapports',
  'Instructions',
  'Résumé & Publication'
];

export const UniversWizard: React.FC<UniversWizardProps> = ({
  onComplete,
  onCancel,
  renderStep,
  initialData,
  readOnly = false,
  templateData
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadProgress, saveProgressDebounced, clearProgress } = useUniversWizardProgress(user?.id);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoad = useRef(true);

  // Wizard state
  const [wizardData, setWizardData] = useState<{
    metadata: Partial<UniversMetadata>;
    definitions: Partial<UniversDefinitions>;
  }>({
    metadata: {
      name: '',
      description: '',
      iconUrl: undefined,
      category: '',
      tags: [],
      version: 1,
      createdAt: new Date()
    },
    definitions: {
      forms: [],
      dashboards: [],
      instructions: [],
      lists: [],
      reports: []
    },
    ...initialData
  });

  // Load saved progress on mount
  useEffect(() => {
    const saved = loadProgress();
    if (saved) {
      setCurrentStep(saved.currentStep || 1);
      setWizardData(prev => ({
        metadata: { ...prev.metadata, ...saved.metadata },
        definitions: {
          forms: saved.forms || [],
          dashboards: saved.dashboards || [],
          instructions: saved.instructions || [],
          lists: saved.lists || [],
          reports: saved.reports || []
        }
      }));
      
      // Mark completed steps
      const completed = new Set<number>();
      if (saved.metadata?.name) completed.add(1);
      // Step 2: Lists - coming soon, can't be completed yet
      if (saved.lists && saved.lists.length > 0) completed.add(2); // Lists is now step 2
      if (saved.forms && saved.forms.length > 0) completed.add(3);
      if (saved.dashboards && saved.dashboards.length > 0) completed.add(4);
      if (saved.reports && saved.reports.length > 0) completed.add(5); // Reports is now step 5
      if (saved.instructions && saved.instructions.length > 0) completed.add(6); // Instructions is now step 6
      setCompletedSteps(completed);
    }
    // Mark initial load as complete after a short delay
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 500);
  }, [loadProgress]);

  // Auto-save progress on data change (debounced)
  useEffect(() => {
    // Skip save during initial load
    if (isInitialLoad.current) {
      return;
    }

    saveProgressDebounced({
      currentStep,
      metadata: wizardData.metadata,
      forms: wizardData.definitions.forms,
      dashboards: wizardData.definitions.dashboards,
      instructions: wizardData.definitions.instructions,
      lists: wizardData.definitions.lists,
      reports: wizardData.definitions.reports
    });
  }, [wizardData, currentStep, saveProgressDebounced]);

  const updateWizardData = useCallback((updates: Partial<typeof wizardData>) => {
    setWizardData(prev => ({
      ...prev,
      ...updates,
      metadata: { ...prev.metadata, ...updates.metadata },
      definitions: { ...prev.definitions, ...updates.definitions }
    }));
  }, []);

  const markStepCompleted = useCallback((step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  }, []);

  const markStepSkipped = useCallback((step: number) => {
    setSkippedSteps(prev => new Set([...prev, step]));
    setCompletedSteps(prev => {
      const updated = new Set(prev);
      updated.delete(step);
      return updated;
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);

  const goToNextStep = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    markStepSkipped(currentStep);
    goToNextStep();
  }, [currentStep, markStepSkipped, goToNextStep]);

  const handleComplete = useCallback(async () => {
           if (!user?.id || !user?.agencyId) {
             logger.error('User data missing', null, 'UniversWizard');
             return;
           }

           // Validate minimum requirements
           if (!wizardData.metadata.name || !wizardData.metadata.name.trim()) {
             logger.error('Univers name is required', null, 'UniversWizard');
             return;
           }

           // Forms are required (step 3, but validate here)
           if (!wizardData.definitions.forms || wizardData.definitions.forms.length === 0) {
             logger.error('At least one form is required', null, 'UniversWizard');
             return;
           }

           // Validation: prix valide si marketplace
           const publishOption = (wizardData.metadata as any).publishOption || 'private';
           if (publishOption === 'marketplace') {
             const price = (wizardData.metadata as any).price;
             const isFree = price === 0 || price === null || price === undefined;
             if (!isFree && (price < 0 || !(wizardData.metadata as any).currency)) {
               logger.error('Prix invalide pour Univers marketplace payant', null, 'UniversWizard');
               return;
             }
           }

           setIsLoading(true);
           try {
             // Get publish option from step 7 data if available (stored temporarily in metadata)
             // Default to 'private' if not set
             const publishOption = (wizardData.metadata as any).publishOption || 'private';

             const universMetadata: UniversMetadata = {
               name: wizardData.metadata.name!,
               description: wizardData.metadata.description || '',
               iconUrl: wizardData.metadata.iconUrl,
               category: wizardData.metadata.category,
               tags: wizardData.metadata.tags || [],
               version: 1,
               createdAt: new Date(),
               // Prix et devise pour marketplace
               price: publishOption === 'marketplace' ? (wizardData.metadata.price ?? null) : undefined,
               currency: publishOption === 'marketplace' ? (wizardData.metadata.currency || 'XAF') : undefined
             };

             const universOwnership: Omit<UniversOwnership, 'approvedBy' | 'approvedAt' | 'rejectionReason'> = {
               createdBy: user.id,
               agencyId: publishOption === 'private' ? undefined : user.agencyId,
               isMarketplaceTemplate: publishOption === 'marketplace',
               approvalStatus: publishOption === 'marketplace' ? 'pending' as const : 'approved' as const
             };

             const universDefinitions: UniversDefinitions = {
               forms: wizardData.definitions.forms || [],
               dashboards: wizardData.definitions.dashboards || [],
               instructions: wizardData.definitions.instructions || [],
               lists: wizardData.definitions.lists || [], // Can be empty
               reports: wizardData.definitions.reports || [] // Can be empty
             };

             await onComplete({
               metadata: universMetadata,
               ownership: universOwnership,
               definitions: universDefinitions
             });

             // Clear progress on successful completion
             clearProgress();
             
             // En mode readOnly (template), ne pas remettre isLoading à false
             // car la page parente gère son propre état de chargement
             if (!readOnly) {
               setIsLoading(false);
             }
           } catch (error) {
             logger.error('Error completing Univers wizard', error, 'UniversWizard');
             // En cas d'erreur, toujours remettre isLoading à false
             setIsLoading(false);
           }
         }, [wizardData, user, onComplete, clearProgress]);

  const getStepStatus = (step: number): 'completed' | 'current' | 'skipped' | 'pending' => {
    if (completedSteps.has(step)) return 'completed';
    if (currentStep === step) return 'current';
    if (skippedSteps.has(step)) return 'skipped';
    return 'pending';
  };

  const canGoToNext = () => {
    // Step 1: Metadata - name required
    if (currentStep === 1) {
      return !!wizardData.metadata.name?.trim();
    }
    // Step 2: Lists - can be skipped (coming soon)
    if (currentStep === 2) {
      return true; // Can always skip lists for now
    }
    // Step 3: Forms - at least 1 required
    if (currentStep === 3) {
      return wizardData.definitions.forms && wizardData.definitions.forms.length > 0;
    }
    // Step 4: Dashboards - can be skipped, but if dashboards exist, forms must exist
    if (currentStep === 4) {
      const hasDashboards = wizardData.definitions.dashboards && wizardData.definitions.dashboards.length > 0;
      const hasForms = wizardData.definitions.forms && wizardData.definitions.forms.length > 0;
      // If no dashboards, can proceed. If dashboards exist, forms must exist
      return !hasDashboards || hasForms;
    }
    // Other steps can be skipped
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with progress */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onCancel) {
                  onCancel();
                }
              }}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg px-2 py-1"
              aria-label="Annuler et retourner"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Annuler</span>
            </button>
            <div className="text-sm text-gray-600">
              Étape {currentStep} sur {TOTAL_STEPS}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          {/* Step indicator - Desktop */}
          <div className="hidden md:flex items-center justify-between">
            {STEP_LABELS.map((label, index) => {
              const step = index + 1;
              const status = getStepStatus(step);
              return (
                <button
                  key={step}
                  onClick={() => goToStep(step)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                    status === 'current'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : status === 'completed'
                      ? 'text-green-600 hover:bg-green-50'
                      : status === 'skipped'
                      ? 'text-gray-400 hover:bg-gray-50'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {status === 'completed' ? (
                    <Check className="h-4 w-4" />
                  ) : status === 'current' ? (
                    <Circle className="h-4 w-4 fill-current" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium">{label}</span>
                  {step < TOTAL_STEPS && (
                    <ChevronRight className="h-4 w-4 ml-2 text-gray-300" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Step indicator - Mobile */}
          <div className="md:hidden text-center">
            <div className="text-sm font-medium text-gray-900 mb-1">
              {STEP_LABELS[currentStep - 1]}
            </div>
            <div className="flex items-center justify-center space-x-1">
              {STEP_LABELS.map((_, index) => {
                const step = index + 1;
                const status = getStepStatus(step);
                return (
                  <div
                    key={step}
                    className={`h-2 w-2 rounded-full transition-all ${
                      status === 'current'
                        ? 'bg-blue-600 w-8'
                        : status === 'completed'
                        ? 'bg-green-600'
                        : status === 'skipped'
                        ? 'bg-gray-300'
                        : 'bg-gray-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Wizard content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          {/* Step content */}
          <div className="min-h-[400px]">
            {renderStep({
              step: currentStep,
              wizardData,
              updateWizardData,
              markStepCompleted,
              markStepSkipped,
              goToStep,
              goToNextStep,
              goToPreviousStep,
              readOnly,
              templateData
            })}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              {currentStep > 1 && (
                <Button
                  variant="secondary"
                  onClick={goToPreviousStep}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Précédent</span>
                </Button>
              )}
              {currentStep < TOTAL_STEPS && (
                <Button
                  variant="secondary"
                  onClick={handleSkip}
                  className="flex items-center space-x-2"
                >
                  <span>Ignorer</span>
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {currentStep < TOTAL_STEPS ? (
                <Button
                  onClick={goToNextStep}
                  disabled={!canGoToNext()}
                  className="flex items-center space-x-2"
                >
                  <span>Suivant</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={isLoading || !canGoToNext()}
                  className="flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Création...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Créer le Univers</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export helper to render step content
export interface UniversWizardStepProps {
  step: number;
  wizardData: {
    metadata: Partial<UniversMetadata>;
    definitions: Partial<UniversDefinitions>;
  };
  updateWizardData: (updates: Partial<{
    metadata: Partial<UniversMetadata>;
    definitions: Partial<UniversDefinitions>;
  }>) => void;
  markStepCompleted: (step: number) => void;
  readOnly?: boolean;
  templateData?: Univers;
  markStepSkipped: (step: number) => void;
  goToStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  universId?: string | null; // ID of the Univers being edited (for filtering lists)
  universInstanceId?: string | null; // ID of the Univers instance being edited (for filtering lists)
}

