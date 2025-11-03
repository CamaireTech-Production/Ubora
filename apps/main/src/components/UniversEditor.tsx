import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Univers, UniversDefinitions } from '../types';
import { UniversWizardStep1 } from './UniversWizardStep1';
import { UniversWizardStep2 } from './UniversWizardStep2';
import { UniversWizardStep3 } from './UniversWizardStep3';
import { UniversWizardStep4 } from './UniversWizardStep4';
import { UniversWizardStep5 } from './UniversWizardStep5';
import { UniversWizardStep6 } from './UniversWizardStep6';
import { UniversWizardStep7 } from './UniversWizardStep7';
import { useToast } from '@ubora/shared/hooks/useToast';
import { UniversWizardStepProps } from './UniversWizard';
import {
  ArrowLeft,
  Save,
  FileText,
  BarChart3,
  Calendar,
  Database,
  FileBarChart,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

// Tab order matching creation wizard steps
type EditTab = 'metadata' | 'lists' | 'forms' | 'dashboards' | 'reports' | 'instructions' | 'summary';

interface TabConfig {
  id: EditTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  step: number; // Corresponding wizard step number
  getCount?: (definitions: UniversDefinitions) => number;
}

const TAB_CONFIGS: TabConfig[] = [
  { id: 'metadata', label: 'Métadonnées', icon: FileText, step: 1 },
  { id: 'lists', label: 'Listes', icon: Database, step: 2, getCount: (d) => d.lists?.length || 0 },
  { id: 'forms', label: 'Formulaires', icon: FileText, step: 3, getCount: (d) => d.forms?.length || 0 },
  { id: 'dashboards', label: 'Tableaux de bord', icon: BarChart3, step: 4, getCount: (d) => d.dashboards?.length || 0 },
  { id: 'reports', label: 'Rapports', icon: FileBarChart, step: 5, getCount: (d) => d.reports?.length || 0 },
  { id: 'instructions', label: 'Instructions', icon: Calendar, step: 6, getCount: (d) => d.instructions?.length || 0 },
  { id: 'summary', label: 'Résumé', icon: CheckCircle, step: 7 }
];

interface UniversEditorProps {
  univers: Univers;
  onSave: (updatedUnivers: Partial<Univers>) => void;
  onCancel: () => void;
}

export const UniversEditor: React.FC<UniversEditorProps> = ({
  univers,
  onSave,
  onCancel
}) => {
  const { showSuccess, showError } = useToast();

  // State mirrors univers with all editable data
  const [metadata, setMetadata] = useState(univers.metadata);
  const [definitions, setDefinitions] = useState<UniversDefinitions>(univers.definitions);

  // Current active tab
  const [activeTab, setActiveTab] = useState<EditTab>('metadata');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track completed steps for visual feedback
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Initialize completed steps based on existing data
  useEffect(() => {
    const completed = new Set<number>();
    if (metadata.name?.trim()) completed.add(1);
    if (definitions.lists && definitions.lists.length > 0) completed.add(2);
    if (definitions.forms && definitions.forms.length > 0) completed.add(3);
    if (definitions.dashboards && definitions.dashboards.length > 0) completed.add(4);
    if (definitions.reports && definitions.reports.length > 0) completed.add(5);
    if (definitions.instructions && definitions.instructions.length > 0) completed.add(6);
    setCompletedSteps(completed);
  }, []); // Only on mount

  // Check for changes
  useEffect(() => {
    const metadataChanged = 
      JSON.stringify(metadata) !== JSON.stringify(univers.metadata);
    const definitionsChanged = 
      JSON.stringify(definitions) !== JSON.stringify(univers.definitions);

    setHasChanges(metadataChanged || definitionsChanged);
  }, [metadata, definitions, univers]);

  // Wizard data structure for step components
  const wizardData = useMemo(() => ({
    metadata: {
      name: metadata.name || '',
      description: metadata.description || '',
      iconUrl: metadata.iconUrl,
      category: metadata.category,
      tags: metadata.tags || [],
      version: metadata.version || 1,
      createdAt: metadata.createdAt
    },
    definitions: definitions
  }), [metadata, definitions]);

  // Update wizard data function - memoized to prevent infinite loops
  const updateWizardData = useCallback((updates: {
    metadata?: Partial<typeof wizardData.metadata>;
    definitions?: Partial<UniversDefinitions>;
  }) => {
    if (updates.metadata) {
      setMetadata(prev => {
        // Only update if there are actual changes
        const newMetadata = {
          ...prev,
          ...(updates.metadata || {}),
          version: prev.version || 1, // Keep current version, will be incremented on save
          createdAt: prev.createdAt // Keep original creation date
        };
        
        // Check if anything actually changed
        const hasChanges = Object.keys(newMetadata).some(key => {
          const prevValue = prev[key as keyof typeof prev];
          const newValue = newMetadata[key as keyof typeof newMetadata];
          return JSON.stringify(prevValue) !== JSON.stringify(newValue);
        });
        
        if (!hasChanges) {
          return prev; // Return same reference to avoid re-render
        }
        
        return newMetadata;
      });
    }
    if (updates.definitions) {
      setDefinitions(prev => {
        // Only update if there are actual changes
        if (JSON.stringify(prev) === JSON.stringify(updates.definitions)) {
          return prev; // Return same reference to avoid re-render
        }
        return { ...prev, ...updates.definitions } as UniversDefinitions;
      });
    }
  }, []); // Empty deps - function should be stable

  // Step management functions
  const markStepCompleted = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const markStepSkipped = (step: number) => {
    setCompletedSteps(prev => {
      const updated = new Set(prev);
      updated.delete(step);
      return updated;
    });
  };

  const goToStep = (step: number) => {
    const tabConfig = TAB_CONFIGS.find(t => t.step === step);
    if (tabConfig) {
      setActiveTab(tabConfig.id);
    }
  };

  const goToNextStep = () => {
    const currentIndex = TAB_CONFIGS.findIndex(t => t.id === activeTab);
    if (currentIndex < TAB_CONFIGS.length - 1) {
      setActiveTab(TAB_CONFIGS[currentIndex + 1].id);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = TAB_CONFIGS.findIndex(t => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(TAB_CONFIGS[currentIndex - 1].id);
    }
  };

  // Wizard step props for each step component
  const getWizardStepProps = (step: number): UniversWizardStepProps => ({
    step,
    wizardData,
    updateWizardData,
    markStepCompleted,
    markStepSkipped,
    goToStep,
    goToNextStep,
    goToPreviousStep
  });

  // Save handler
  const handleSave = async () => {
    if (!metadata.name?.trim()) {
      showError('Le nom du Univers est requis');
      return;
    }

    if (!definitions.forms || definitions.forms.length === 0) {
      showError('Au moins un formulaire est requis');
      return;
    }

    setIsSaving(true);
    try {
      // Prepare updated Univers with incremented version
      const updatedUnivers: Partial<Univers> = {
        metadata: {
          ...metadata,
          version: (metadata.version || 1) + 1 // Increment version
        },
        definitions: definitions
      };

      await onSave(updatedUnivers);
      setHasChanges(false);
      showSuccess('Univers mis à jour avec succès');
    } catch (error) {
      console.error('Error saving Univers:', error);
      // Error handling is done in parent component
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel handler
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('Vous avez des modifications non enregistrées. Voulez-vous vraiment annuler ?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Modifier le Univers
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Version {metadata.version} • Créé le {metadata.createdAt.toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || !metadata.name?.trim()}
            className="flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Enregistrer les modifications</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs - Ordered to match creation flow */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto pb-0">
          {TAB_CONFIGS.map(({ id, label, icon: Icon, step, getCount }) => {
            const count = getCount ? getCount(definitions) : undefined;
            const isCompleted = completedSteps.has(step);
            const isActive = activeTab === id;

            return (
            <button
              key={id}
                onClick={() => setActiveTab(id)}
              className={`
                  flex items-center space-x-2 py-4 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                ${
                    isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
                {count !== undefined && count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {count}
                </span>
              )}
                {isCompleted && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </button>
            );
          })}
        </nav>
      </div>

      {/* Content Sections - Using Wizard Step Components */}
      <div className="space-y-6">
        {/* Tab 1: Metadata (Step 1) */}
        {activeTab === 'metadata' && (
          <div className="space-y-6">
            <Card title="Métadonnées">
              <p className="text-gray-600 mb-4">
                Modifiez les informations générales de votre Univers
              </p>
            </Card>
            <UniversWizardStep1 {...getWizardStepProps(1)} />
                      </div>
                    )}

        {/* Tab 2: Lists (Step 2) */}
        {activeTab === 'lists' && (
          <div className="space-y-6">
            <Card title="Listes">
              <p className="text-gray-600 mb-4">
                Gérez les listes de votre Univers
              </p>
            </Card>
            <UniversWizardStep2 {...getWizardStepProps(2)} />
          </div>
        )}

        {/* Tab 3: Forms (Step 3) */}
        {activeTab === 'forms' && (
          <div className="space-y-6">
            <Card title="Formulaires">
              <p className="text-gray-600 mb-4">
                Modifiez les formulaires de votre Univers
              </p>
            </Card>
            <UniversWizardStep3 {...getWizardStepProps(3)} />
          </div>
        )}

        {/* Tab 4: Dashboards (Step 4) */}
        {activeTab === 'dashboards' && (
          <div className="space-y-6">
            <Card title="Tableaux de bord">
              <p className="text-gray-600 mb-4">
                Modifiez les tableaux de bord de votre Univers
              </p>
            </Card>
            <UniversWizardStep4 {...getWizardStepProps(4)} />
          </div>
        )}

        {/* Tab 5: Reports (Step 5 / Wizard Step 6) */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <Card title="Rapports">
              <p className="text-gray-600 mb-4">
                Gérez les rapports de votre Univers
              </p>
            </Card>
            <UniversWizardStep6 {...getWizardStepProps(5)} step={5} />
          </div>
        )}

        {/* Tab 6: Instructions (Step 6 / Wizard Step 5) */}
        {activeTab === 'instructions' && (
          <div className="space-y-6">
            <Card title="Instructions programmées">
              <p className="text-gray-600 mb-4">
                Modifiez les instructions programmées de votre Univers
              </p>
            </Card>
            <UniversWizardStep5 {...getWizardStepProps(6)} step={6} />
          </div>
        )}

        {/* Tab 7: Summary (Step 7) */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <Card title="Résumé & Publication">
              <p className="text-gray-600 mb-4">
                Vérifiez le résumé de votre Univers avant de sauvegarder
              </p>
          </Card>
            <UniversWizardStep7 {...getWizardStepProps(7)} step={7} />
            </div>
        )}
      </div>

      {/* Save Indicator */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-900">
                Modifications non enregistrées
              </p>
              <p className="text-xs text-yellow-700">
                N'oubliez pas d'enregistrer vos modifications
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
