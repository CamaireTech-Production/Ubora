import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { FileInput } from './FileInput';
import { Univers, Form, UniversDefinitions } from '../types';
import { UniversWizardStep3 } from './UniversWizardStep3';
import { UniversWizardStep4 } from './UniversWizardStep4';
import { UniversWizardStep5 } from './UniversWizardStep5';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  ArrowLeft,
  Save,
  FileText,
  BarChart3,
  Calendar,
  List,
  FileBarChart,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Loader2
} from 'lucide-react';

// Categories for Univers templates
const CATEGORIES = [
  { value: '', label: 'Aucune catégorie' },
  { value: 'hr', label: 'Ressources Humaines' },
  { value: 'finance', label: 'Finance' },
  { value: 'sales', label: 'Ventes' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operations', label: 'Opérations' },
  { value: 'it', label: 'Technologie' },
  { value: 'compliance', label: 'Conformité' },
  { value: 'other', label: 'Autre' }
];

type EditSection = 'metadata' | 'forms' | 'dashboards' | 'instructions' | 'lists' | 'reports';

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
  const { employees } = useApp();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  // Metadata state
  const [name, setName] = useState(univers.metadata.name);
  const [description, setDescription] = useState(univers.metadata.description || '');
  const [iconUrl, setIconUrl] = useState(univers.metadata.iconUrl || '');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [category, setCategory] = useState(univers.metadata.category || '');
  const [tags, setTags] = useState<string[]>(univers.metadata.tags || []);
  const [newTag, setNewTag] = useState('');

  // Definitions state (for editing aspects)
  const [definitions, setDefinitions] = useState<UniversDefinitions>(univers.definitions);

  // Current editing section
  const [activeSection, setActiveSection] = useState<EditSection>('metadata');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update hasChanges when any field changes
  useEffect(() => {
    const metadataChanged = 
      name !== univers.metadata.name ||
      description !== (univers.metadata.description || '') ||
      iconUrl !== (univers.metadata.iconUrl || '') ||
      category !== (univers.metadata.category || '') ||
      JSON.stringify(tags) !== JSON.stringify(univers.metadata.tags || []);

    const definitionsChanged = 
      JSON.stringify(definitions) !== JSON.stringify(univers.definitions);

    setHasChanges(metadataChanged || definitionsChanged);
  }, [name, description, iconUrl, category, tags, definitions, univers]);

  const handleIconFileChange = (file: File | null) => {
    setIconFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setIconUrl(univers.metadata.iconUrl || '');
    }
  };

  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconUrl('');
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showError('Le nom du Univers est requis');
      return;
    }

    setIsSaving(true);
    try {
      // Prepare updated Univers
      const updatedUnivers: Partial<Univers> = {
        metadata: {
          ...univers.metadata,
          name: name.trim(),
          description: description.trim() || undefined,
          iconUrl: iconUrl || undefined,
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined,
          version: univers.metadata.version + 1 // Increment version
        },
        definitions: definitions
      };

      await onSave(updatedUnivers);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving Univers:', error);
      // Error handling is done in parent component
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('Vous avez des modifications non enregistrées. Voulez-vous vraiment annuler ?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  // Wizard data for aspect editing components
  const wizardData = useMemo(() => ({
    metadata: {
      name,
      description,
      iconUrl,
      category,
      tags
    },
    definitions: definitions
  }), [name, description, iconUrl, category, tags, definitions]);

  const updateWizardData = (updates: Partial<typeof wizardData>) => {
    if (updates.metadata) {
      setName(updates.metadata.name || name);
      setDescription(updates.metadata.description || description);
      setIconUrl(updates.metadata.iconUrl || iconUrl);
      setCategory(updates.metadata.category || category);
      setTags(updates.metadata.tags || tags);
    }
    if (updates.definitions) {
      setDefinitions(updates.definitions);
    }
  };

  const markStepCompleted = () => {};
  const markStepSkipped = () => {};
  const goToStep = () => {};
  const goToNextStep = () => {};
  const goToPreviousStep = () => {};

  const wizardStepProps = {
    step: 1,
    wizardData,
    updateWizardData,
    markStepCompleted,
    markStepSkipped,
    goToStep,
    goToNextStep,
    goToPreviousStep
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              Version {univers.metadata.version} • Créé le {univers.metadata.createdAt.toLocaleDateString('fr-FR')}
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
            disabled={isSaving || !hasChanges || !name.trim()}
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

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {[
            { id: 'metadata' as EditSection, label: 'Métadonnées', icon: FileText },
            { id: 'forms' as EditSection, label: 'Formulaires', icon: FileText, count: definitions.forms.length },
            { id: 'dashboards' as EditSection, label: 'Tableaux de bord', icon: BarChart3, count: definitions.dashboards.length },
            { id: 'instructions' as EditSection, label: 'Instructions', icon: Calendar, count: definitions.instructions.length },
            { id: 'lists' as EditSection, label: 'Listes', icon: List, disabled: true },
            { id: 'reports' as EditSection, label: 'Rapports', icon: FileBarChart, disabled: true }
          ].map(({ id, label, icon: Icon, count, disabled }) => (
            <button
              key={id}
              onClick={() => !disabled && setActiveSection(id)}
              disabled={disabled}
              className={`
                flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  activeSection === id
                    ? 'border-blue-500 text-blue-600'
                    : disabled
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {count !== undefined && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {count}
                </span>
              )}
              {disabled && (
                <span className="bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full text-xs">
                  Bientôt
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Sections */}
      <div className="space-y-6">
        {/* Metadata Section */}
        {activeSection === 'metadata' && (
          <div className="space-y-6">
            <Card title="Informations générales">
              <div className="space-y-5">
                <Input
                  label="Nom du Univers *"
                  placeholder="Ex: Mon Univers de Gestion des Ventes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Décrivez votre Univers en quelques mots..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />

                {/* Icon Upload/URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icône du Univers (optionnel)
                  </label>
                  <div className="flex items-center space-x-3">
                    {iconUrl ? (
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border border-gray-200 flex-shrink-0">
                        <img src={iconUrl} alt="Univers Icon" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={handleRemoveIcon}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600"
                          title="Supprimer l'icône"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 flex-shrink-0">
                        <FileText className="h-8 w-8" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <FileInput
                        label=""
                        value={iconFile}
                        onChange={handleIconFileChange}
                        acceptedTypes={['image/jpeg', 'image/png', 'image/gif']}
                        placeholder="Télécharger une image (JPG, PNG, GIF, max 2MB)"
                        className="w-full"
                      />
                      <Input
                        label=""
                        placeholder="Ou entrez une URL d'icône"
                        value={iconUrl}
                        onChange={(e) => setIconUrl(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <Select
                  label="Catégorie (optionnel)"
                  options={CATEGORIES}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (optionnel)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-2 -mr-1 h-4 w-4 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Ajouter un tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="flex-1"
                    />
                    <Button type="button" onClick={handleAddTag}>
                      Ajouter
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Forms Section */}
        {activeSection === 'forms' && (
          <div className="space-y-6">
            <Card title="Formulaires">
              <p className="text-gray-600 mb-4">
                Modifiez les formulaires de votre Univers
              </p>
            </Card>
            <UniversWizardStep3 {...wizardStepProps} step={3} />
          </div>
        )}

        {/* Dashboards Section */}
        {activeSection === 'dashboards' && (
          <div className="space-y-6">
            <Card title="Tableaux de bord">
              <p className="text-gray-600 mb-4">
                Modifiez les tableaux de bord de votre Univers
              </p>
            </Card>
            <UniversWizardStep4 {...wizardStepProps} step={4} />
          </div>
        )}

        {/* Instructions Section */}
        {activeSection === 'instructions' && (
          <div className="space-y-6">
            <Card title="Instructions programmées">
              <p className="text-gray-600 mb-4">
                Modifiez les instructions programmées de votre Univers
              </p>
            </Card>
            <UniversWizardStep5 {...wizardStepProps} step={5} />
          </div>
        )}

        {/* Lists Section - Coming Soon */}
        {activeSection === 'lists' && (
          <Card title="Listes">
            <div className="text-center py-12">
              <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Listes - Bientôt disponible
              </h3>
              <p className="text-gray-600">
                La fonctionnalité Listes sera disponible prochainement.
              </p>
            </div>
          </Card>
        )}

        {/* Reports Section - Coming Soon */}
        {activeSection === 'reports' && (
          <Card title="Rapports">
            <div className="text-center py-12">
              <FileBarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Rapports - Bientôt disponible
              </h3>
              <p className="text-gray-600">
                La fonctionnalité Rapports sera disponible prochainement.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Save Indicator */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
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

