import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { UniversWizardStepProps } from './UniversWizard';
import { UniversMetadata, UniversOwnership, UniversDefinitions } from '../types';
import {
  FileText,
  BarChart3,
  Calendar,
  List,
  FileBarChart,
  CheckCircle,
  AlertCircle,
  Globe,
  Building2,
  User,
  Loader2,
  Info,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { UniversCard } from './UniversCard';

interface PublishOption {
  id: 'private' | 'agency' | 'marketplace';
  label: string;
  description: string;
  icon: React.ReactNode;
  approvalRequired: boolean;
}

const PUBLISH_OPTIONS: PublishOption[] = [
  {
    id: 'private',
    label: 'Privé',
    description: 'Visible uniquement par vous',
    icon: <User className="h-5 w-5" />,
    approvalRequired: false
  },
  {
    id: 'agency',
    label: 'Partagé avec l\'agence',
    description: 'Visible par tous les membres de votre agence',
    icon: <Building2 className="h-5 w-5" />,
    approvalRequired: false
  },
  {
    id: 'marketplace',
    label: 'Publier sur le marketplace',
    description: 'Soumis à approbation admin pour publication publique',
    icon: <Globe className="h-5 w-5" />,
    approvalRequired: true
  }
];

export const UniversWizardStep7: React.FC<UniversWizardStepProps> = ({
  wizardData,
  updateWizardData,
  markStepCompleted,
  step,
  goToStep
}) => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [selectedPublishOption, setSelectedPublishOption] = useState<'private' | 'agency' | 'marketplace'>('private');
  const [isCreating, setIsCreating] = useState(false);

  // Extract data from wizard
  const metadata: Partial<UniversMetadata> = wizardData.metadata || {};
  const definitions: Partial<UniversDefinitions> = wizardData.definitions || {};

  // Count items
  const formsCount = (definitions.forms as any[])?.length || 0;
  const dashboardsCount = (definitions.dashboards as any[])?.length || 0;
  const instructionsCount = (definitions.instructions as any[])?.length || 0;
  const listsCount = (definitions.lists as any[])?.length || 0;
  const reportsCount = (definitions.reports as any[])?.length || 0;

  // Validation
  const isValid = metadata.name && metadata.name.trim() && formsCount > 0;
  const hasOptionalItems = dashboardsCount > 0 || instructionsCount > 0;

  // Mark step as viewable (completed when viewed)
  useEffect(() => {
    if (metadata.name) {
      markStepCompleted(step);
    }
  }, [metadata.name, markStepCompleted, step]);

  const handlePublishOptionChange = (optionId: 'private' | 'agency' | 'marketplace') => {
    setSelectedPublishOption(optionId);
  };

  const handleGoToStep = (stepNumber: number) => {
    goToStep(stepNumber);
  };

  const getPublishOptionDetails = () => {
    return PUBLISH_OPTIONS.find(opt => opt.id === selectedPublishOption);
  };

  // Store publish option in wizard data when changed
  useEffect(() => {
    updateWizardData({
      metadata: {
        ...metadata,
        publishOption: selectedPublishOption // Store temporarily for wizard's handleComplete
      }
    });
  }, [selectedPublishOption, updateWizardData, metadata]);

  const handleCreate = async () => {
    if (!user?.id || !user?.agencyId) {
      showError('Données utilisateur manquantes');
      return;
    }

    if (!isValid) {
      showError('Le nom du Univers et au moins un formulaire sont requis');
      return;
    }

    setIsCreating(true);

    try {
      // Prepare Univers metadata
      const universMetadata: UniversMetadata = {
        name: metadata.name!,
        description: metadata.description || '',
        iconUrl: metadata.iconUrl,
        category: metadata.category,
        tags: metadata.tags || [],
        version: 1,
        createdAt: new Date()
      };

      // Store publish option in metadata for wizard to use
      updateWizardData({
        metadata: {
          ...universMetadata,
          publishOption: selectedPublishOption // Store temporarily in metadata
        },
        definitions: universDefinitions
      });

      showSuccess('Configuration enregistrée ! Le Univers sera créé lorsque vous cliquerez sur "Créer le Univers".');
    } catch (error) {
      console.error('Error preparing Univers:', error);
      showError('Erreur lors de la préparation du Univers');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Résumé & Publication
        </h2>
        <p className="text-gray-600">
          Vérifiez votre Univers et choisissez comment le publier
        </p>
      </div>

      {/* Validation warning */}
      {!isValid && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                Informations requises manquantes
              </h3>
              <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                {!metadata.name?.trim() && <li>Le nom du Univers est requis</li>}
                {formsCount === 0 && <li>Au moins un formulaire est requis</li>}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {!metadata.name?.trim() && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(1)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Aller à Métadonnées
                  </Button>
                )}
                {formsCount === 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(3)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Aller aux Formulaires
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Univers Preview */}
          <Card title="Aperçu du Univers">
            <div className="flex justify-center py-4">
              <UniversCard
                univers={{
                  id: 'preview',
                  metadata: {
                    name: metadata.name || 'Nom du Univers',
                    description: metadata.description || 'Description...',
                    iconUrl: metadata.iconUrl,
                    category: metadata.category,
                    tags: metadata.tags || [],
                    version: 1,
                    createdAt: new Date()
                  },
                  ownership: {
                    createdBy: user?.id || '',
                    agencyId: selectedPublishOption === 'private' ? undefined : user?.agencyId,
                    isMarketplaceTemplate: selectedPublishOption === 'marketplace',
                    approvalStatus: selectedPublishOption === 'marketplace' ? 'pending' : 'approved'
                  },
                  definitions: {
                    forms: definitions.forms || [],
                    dashboards: definitions.dashboards || [],
                    instructions: definitions.instructions || [],
                    lists: definitions.lists || [],
                    reports: definitions.reports || []
                  },
                  usage: { totalUsages: 0 }
                }}
                onView={() => {}}
                showActions={false}
              />
            </div>
          </Card>

          {/* Aspects Summary */}
          <Card title="Contenu du Univers">
            <div className="space-y-4">
              {/* Forms */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Formulaires</p>
                    <p className="text-sm text-gray-600">
                      {formsCount > 0 ? `${formsCount} formulaire${formsCount > 1 ? 's' : ''}` : 'Aucun formulaire'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {formsCount > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(3)}
                  >
                    {formsCount > 0 ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
              </div>

              {/* Dashboards */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Tableaux de bord</p>
                    <p className="text-sm text-gray-600">
                      {dashboardsCount > 0 ? `${dashboardsCount} tableau${dashboardsCount > 1 ? 'x' : ''}` : 'Aucun tableau de bord'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {dashboardsCount > 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(4)}
                  >
                    {dashboardsCount > 0 ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Instructions programmées</p>
                    <p className="text-sm text-gray-600">
                      {instructionsCount > 0 ? `${instructionsCount} instruction${instructionsCount > 1 ? 's' : ''}` : 'Aucune instruction'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {instructionsCount > 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(5)}
                  >
                    {instructionsCount > 0 ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
              </div>

              {/* Lists - Coming Soon */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-75">
                <div className="flex items-center space-x-3">
                  <List className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-700">Listes</p>
                    <p className="text-sm text-gray-500">Bientôt disponible</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Reports - Coming Soon */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-75">
                <div className="flex items-center space-x-3">
                  <FileBarChart className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-700">Rapports</p>
                    <p className="text-sm text-gray-500">Bientôt disponible</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </Card>

          {/* Metadata Summary */}
          {(metadata.description || metadata.category || (metadata.tags && metadata.tags.length > 0)) && (
            <Card title="Métadonnées">
              <div className="space-y-3">
                {metadata.description && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                    <p className="text-sm text-gray-600">{metadata.description}</p>
                  </div>
                )}
                {metadata.category && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Catégorie</p>
                    <p className="text-sm text-gray-600">{metadata.category}</p>
                  </div>
                )}
                {metadata.tags && metadata.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {metadata.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(1)}
                  >
                    Modifier les métadonnées
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Publish Options Sidebar */}
        <div className="lg:col-span-1">
          <Card title="Options de publication">
            <div className="space-y-3">
              {PUBLISH_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handlePublishOptionChange(option.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPublishOption === option.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${
                      selectedPublishOption === option.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {option.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {option.label}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {option.description}
                      </p>
                      {option.approvalRequired && (
                        <div className="mt-2 flex items-center space-x-1 text-xs text-yellow-700">
                          <Info className="h-3 w-3" />
                          <span>Approbation admin requise</span>
                        </div>
                      )}
                    </div>
                    {selectedPublishOption === option.id && (
                      <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Info about marketplace */}
            {selectedPublishOption === 'marketplace' && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-yellow-800">
                      Votre Univers sera soumis à approbation. Vous recevrez une notification une fois approuvé ou rejeté.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Ready to create */}
          {isValid && (
            <Card className="bg-green-50 border-green-200 mt-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-900">
                    Prêt à être créé
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Toutes les conditions requises sont remplies
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Note about Lists and Reports */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Note sur les Listes et Rapports
            </h3>
            <p className="text-sm text-blue-800">
              Les fonctionnalités Listes et Rapports seront disponibles prochainement. 
              Vous pourrez les ajouter à votre Univers une fois disponibles. 
              Le Univers peut être créé sans ces aspects.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

