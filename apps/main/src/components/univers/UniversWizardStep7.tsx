import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { UniversWizardStepProps } from './UniversWizard';
import { UniversMetadata, UniversDefinitions } from '../../types';
import {
  FileText,
  BarChart3,
  Calendar,
  List,
  FileBarChart,
  CheckCircle,
  AlertCircle,
  Globe,
  User,
  Info
} from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { UniversCard } from './UniversCard';

interface PublishOption {
  id: 'private' | 'marketplace';
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
  goToStep,
  readOnly = false,
  templateData
}) => {
  const { user } = useAuth();

  // En mode lecture seule, utiliser les données du template
  const displayData = readOnly && templateData ? {
    metadata: templateData.metadata,
    definitions: templateData.definitions
  } : {
    metadata: wizardData.metadata || {},
    definitions: wizardData.definitions || {}
  };

  // Extract data from wizard
  const metadata: Partial<UniversMetadata> = displayData.metadata;
  const definitions: Partial<UniversDefinitions> = displayData.definitions;

  const [selectedPublishOption, setSelectedPublishOption] = useState<'private' | 'marketplace'>(
    (metadata.publishOption as 'private' | 'marketplace') || 'private'
  );
  const [price, setPrice] = useState<number | null>(metadata.price ?? null);
  const [isFree, setIsFree] = useState<boolean>(
    metadata.price === 0 || metadata.price === null || metadata.price === undefined
  );
  const [currency, setCurrency] = useState<string>(metadata.currency || 'XAF');
  const [packageAccess, setPackageAccess] = useState<{
    free: boolean;
    starter: boolean;
    standard: boolean;
  }>(metadata.packageAccess || { free: false, starter: false, standard: false });

  // Count items
  const formsCount = (definitions.forms as any[])?.length || 0;
  const dashboardsCount = (definitions.dashboards as any[])?.length || 0;
  const instructionsCount = (definitions.instructions as any[])?.length || 0;
  const listsCount = (definitions.lists as any[])?.length || 0;
  const reportsCount = (definitions.reports as any[])?.length || 0;

  // Validation
  const isValid = metadata.name && metadata.name.trim() && formsCount > 0;

  // Mark step as viewable (completed when viewed)
  useEffect(() => {
    if (metadata.name) {
      markStepCompleted(step);
    }
  }, [metadata.name, markStepCompleted, step]);

  const handlePublishOptionChange = (optionId: 'private' | 'marketplace') => {
    setSelectedPublishOption(optionId);
    // Si on passe à "private", le prix doit être null
    if (optionId === 'private') {
      setPrice(null);
      setIsFree(true);
    }
  };

  const handlePriceChange = (value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setPrice(null);
    } else {
      setPrice(numValue);
    }
  };

  const handleFreeToggle = (checked: boolean) => {
    setIsFree(checked);
    if (checked) {
      setPrice(0);
    }
  };

  const handleGoToStep = (stepNumber: number) => {
    goToStep(stepNumber);
  };

  // Store publish option and price in wizard data when changed (seulement si pas en lecture seule)
  useEffect(() => {
    if (!readOnly) {
      const metadataUpdate = {
        ...metadata,
        publishOption: selectedPublishOption, // Store temporarily for wizard's handleComplete
        price: isFree ? 0 : (price || null),
        currency: currency,
        packageAccess: packageAccess
      };
      
      console.log('🔍 UniversWizardStep7 - Updating wizard data:', {
        selectedPublishOption,
        price: isFree ? 0 : (price || null),
        currency,
        metadataUpdate
      });
      
      updateWizardData({
        metadata: metadataUpdate
      });
    }
    // En mode lecture seule, marquer comme complété automatiquement
    if (readOnly && metadata.name) {
      markStepCompleted(step);
    }
    }, [selectedPublishOption, price, isFree, currency, packageAccess, updateWizardData, metadata, readOnly, markStepCompleted, step]);

  // En mode lecture seule, afficher uniquement le résumé
  if (readOnly) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Résumé du Univers
          </h2>
          <p className="text-gray-600">
            Aperçu du Univers template.
          </p>
        </div>

        {/* Summary Card (Read-only) */}
        <Card>
          <div className="space-y-6">
            {/* Metadata */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Métadonnées</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-700">Nom:</span>
                  <p className="text-gray-900">{metadata.name || 'Non spécifié'}</p>
                </div>
                {metadata.description && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Description:</span>
                    <p className="text-gray-900">{metadata.description}</p>
                  </div>
                )}
                {metadata.category && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Catégorie:</span>
                    <p className="text-gray-900">{metadata.category}</p>
                  </div>
                )}
                {metadata.tags && metadata.tags.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Tags:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {metadata.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Definitions Summary */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contenu</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{listsCount}</div>
                  <div className="text-sm text-gray-600">Liste{listsCount > 1 ? 's' : ''}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{formsCount}</div>
                  <div className="text-sm text-gray-600">Formulaire{formsCount > 1 ? 's' : ''}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{dashboardsCount}</div>
                  <div className="text-sm text-gray-600">Tableau{dashboardsCount > 1 ? 'x' : ''} de bord</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{reportsCount}</div>
                  <div className="text-sm text-gray-600">Rapport{reportsCount > 1 ? 's' : ''}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{instructionsCount}</div>
                  <div className="text-sm text-gray-600">Instruction{instructionsCount > 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>

            {/* Pricing (if marketplace) */}
            {metadata.publishOption === 'marketplace' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Prix</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  {metadata.price === 0 || metadata.price === null || metadata.price === undefined ? (
                    <span className="text-lg font-semibold text-gray-900">Gratuit</span>
                  ) : (
                    <span className="text-lg font-semibold text-gray-900">
                      {metadata.price} {metadata.currency || 'XAF'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

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

              {/* Lists */}
              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center space-x-3">
                  <List className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Listes</p>
                    <p className="text-sm text-gray-600">
                      {listsCount > 0 ? `${listsCount} liste${listsCount > 1 ? 's' : ''}` : 'Aucune liste'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {listsCount > 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(2)}
                  >
                    {listsCount > 0 ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
              </div>

              {/* Reports */}
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center space-x-3">
                  <FileBarChart className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Rapports</p>
                    <p className="text-sm text-gray-600">
                      {reportsCount > 0 ? `${reportsCount} rapport${reportsCount > 1 ? 's' : ''}` : 'Aucun rapport'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {reportsCount > 0 && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGoToStep(5)}
                  >
                    {reportsCount > 0 ? 'Modifier' : 'Ajouter'}
                  </Button>
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

            {/* Pricing section for marketplace */}
            {selectedPublishOption === 'marketplace' && (
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2 mb-3">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-blue-800">
                        Votre Univers sera soumis à approbation. Vous recevrez une notification une fois approuvé ou rejeté.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        checked={isFree}
                        onChange={(e) => handleFreeToggle(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Gratuit</span>
                    </label>
                  </div>

                  {!isFree && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          label="Prix"
                          value={price?.toString() || ''}
                          onChange={(e) => handlePriceChange(e.target.value)}
                          placeholder="0"
                          min="0"
                          step="0.01"
                          className="flex-1"
                        />
                        <div className="flex-shrink-0 pt-7">
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                          >
                            <option value="XAF">XAF</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>
                      {price !== null && price > 0 && (
                        <p className="text-xs text-gray-600">
                          Prix: {price.toLocaleString('fr-FR')} {currency}
                        </p>
                      )}
                    </div>
                  )}

                  {isFree && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Gratuit</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Package Access Configuration */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Accès par package
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Définissez quels packages peuvent accéder à ce Univers gratuitement
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={packageAccess.free}
                        onChange={(e) => setPackageAccess({ ...packageAccess, free: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Package Gratuit</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={packageAccess.starter}
                        onChange={(e) => setPackageAccess({ ...packageAccess, starter: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Package Starter</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={packageAccess.standard}
                        onChange={(e) => setPackageAccess({ ...packageAccess, standard: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Package Standard</span>
                    </label>
                  </div>
                  {!packageAccess.free && !packageAccess.starter && !packageAccess.standard && (
                    <p className="text-xs text-gray-500 mt-2">
                      Aucun package sélectionné. Ce Univers ne sera accessible que par achat (marketplace payant).
                    </p>
                  )}
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

    </div>
  );
};

