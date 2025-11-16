import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { X, Plus, Upload } from 'lucide-react';
import { UniversWizardStepProps } from './UniversWizard';
import { useToast } from '@ubora/shared/hooks/useToast';

// Available categories for Univers templates
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

export const UniversWizardStep1: React.FC<UniversWizardStepProps> = ({
  wizardData,
  updateWizardData,
  markStepCompleted,
  readOnly = false,
  templateData
}) => {
  const { showError } = useToast();
  
  // En mode lecture seule, utiliser les données du template
  const displayData = readOnly && templateData ? {
    name: templateData.metadata.name,
    description: templateData.metadata.description || '',
    iconUrl: templateData.metadata.iconUrl || '',
    category: templateData.metadata.category || '',
    tags: templateData.metadata.tags || []
  } : {
    name: wizardData.metadata.name || '',
    description: wizardData.metadata.description || '',
    iconUrl: wizardData.metadata.iconUrl || '',
    category: wizardData.metadata.category || '',
    tags: wizardData.metadata.tags || []
  };

  const [name, setName] = useState(displayData.name);
  const [description, setDescription] = useState(displayData.description);
  const [iconUrl, setIconUrl] = useState(displayData.iconUrl);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(displayData.iconUrl || null);
  const [category, setCategory] = useState(displayData.category);
  const [tags, setTags] = useState<string[]>(displayData.tags);
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update wizard data when form changes (seulement si pas en lecture seule)
  useEffect(() => {
    if (!readOnly) {
      updateWizardData({
        metadata: {
          name,
          description,
          iconUrl: iconUrl || iconPreview || undefined,
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined
        }
      });

      // Mark step as completed if name is filled
      if (name.trim()) {
        markStepCompleted(1);
      }
    } else {
      // En mode lecture seule, marquer comme complété automatiquement
      markStepCompleted(1);
    }
  }, [name, description, iconUrl, iconPreview, category, tags, updateWizardData, markStepCompleted, readOnly]);

  const handleIconFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Veuillez sélectionner un fichier image (JPG, PNG, GIF)');
      return;
    }

    // Validate file size (max 2MB for icons)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      showError('L\'image doit faire moins de 2 MB');
      return;
    }

    setIconFile(file);
    setIconUrl(''); // Clear URL when file is selected

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleIconUrlChange = (url: string) => {
    setIconUrl(url);
    setIconFile(null);
    setIconPreview(url || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconUrl('');
    setIconPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {readOnly ? 'Métadonnées du Univers' : 'Métadonnées du Univers'}
        </h2>
        <p className="text-gray-600">
          {readOnly 
            ? 'Aperçu des métadonnées du Univers template.'
            : 'Définissez les informations de base de votre Univers. Ces informations aideront à identifier et organiser votre template.'}
        </p>
      </div>

      <Card>
        <div className="space-y-6">
          {/* Name - Required */}
          <Input
            label="Nom du Univers *"
            value={name}
            onChange={(e) => !readOnly && setName(e.target.value)}
            placeholder="Ex: Suivi des Ventes Mensuelles"
            required
            disabled={readOnly}
            error={!readOnly && !name.trim() ? 'Le nom est obligatoire' : undefined}
          />

          {/* Description */}
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => !readOnly && setDescription(e.target.value)}
            placeholder="Décrivez l'objectif et l'utilisation de ce Univers..."
            rows={4}
            disabled={readOnly}
          />

          {/* Icon Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icône du Univers (optionnel)
            </label>
            <div className="space-y-4">
              {/* URL Input */}
              {!readOnly && (
                <Input
                  label="Ou entrer une URL d'image"
                  value={iconUrl}
                  onChange={(e) => handleIconUrlChange(e.target.value)}
                  placeholder="https://example.com/icon.png"
                  disabled={readOnly}
                />
              )}

              {/* Icon Display/Upload */}
              <div>
                {readOnly ? (
                  // Mode lecture seule : afficher uniquement l'icône
                  iconPreview && (
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <img
                            src={iconPreview}
                            alt="Icon preview"
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          {iconUrl && (
                            <p className="text-sm text-gray-600">URL: {iconUrl}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  // Mode édition : afficher le formulaire d'upload
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ou télécharger une image
                    </label>
                    {!iconPreview ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 flex flex-col items-center justify-center space-y-2"
                      >
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-600 font-medium">
                          Cliquez pour sélectionner une image
                        </span>
                        <span className="text-xs text-gray-500">
                          JPG, PNG, GIF (max 2 MB)
                        </span>
                      </button>
                    ) : (
                      <div className="relative">
                        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <img
                                src={iconPreview}
                                alt="Icon preview"
                                className="h-16 w-16 rounded-lg object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              {iconFile && (
                                <p className="text-sm font-medium text-gray-900">{iconFile.name}</p>
                              )}
                              {iconUrl && (
                                <p className="text-sm text-gray-600">URL: {iconUrl}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveIcon}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleIconFileChange}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Category */}
          <Select
            label="Catégorie"
            value={category}
            disabled={readOnly}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORIES}
          />

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (optionnel)
            </label>
            {readOnly ? (
              // Mode lecture seule : afficher uniquement les tags
              tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucun tag</p>
              )
            ) : (
              // Mode édition : afficher le formulaire d'ajout de tags
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Ajouter un tag et appuyer sur Entrée"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Ajouter</span>
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!readOnly && (
              <p className="text-xs text-gray-500 mt-2">
                Les tags aident à retrouver votre Univers plus facilement
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Preview Card */}
      {(name || description || iconPreview || category || tags.length > 0) && (
        <Card title="Aperçu">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {iconPreview && (
                <img
                  src={iconPreview}
                  alt="Univers icon"
                  className="h-12 w-12 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {name || 'Nom du Univers'}
                </h3>
                {category && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                    {CATEGORIES.find(c => c.value === category)?.label || category}
                  </span>
                )}
              </div>
            </div>
            {description && (
              <p className="text-sm text-gray-600">{description}</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

