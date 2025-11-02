import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Report, ReportPlaceholder, ReportMapping, Form, Dashboard } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { FileInput } from './FileInput';
import { ArrowLeft, FileText, Upload, Edit, MapPin, X, Loader2, AlertCircle, CheckCircle, FileBarChart, Hash } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { reportService } from '../services/reportService';
import { PDFTextExtractionService } from '@ubora/shared/services/pdfTextExtractionService';
import { FileUploadService } from '@ubora/shared/services/fileUploadService';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface ReportBuilderProps {
  onSave: (report: {
    name: string;
    description?: string;
    templateType: 'pdf' | 'word' | 'text';
    templateContent?: string;
    templateFileUrl?: string;
    templateFileStoragePath?: string;
    templateFileName?: string;
    placeholders: ReportPlaceholder[];
    mappings: ReportMapping[];
  }) => void;
  onCancel: () => void;
  initialReport?: Report;
  isLoading?: boolean;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  onSave,
  onCancel,
  initialReport,
  isLoading = false
}) => {
  const { user } = useAuth();
  const { forms, dashboards } = useApp();
  const { showSuccess, showError } = useToast();

  // Basic fields
  const [name, setName] = useState(initialReport?.name || '');
  const [description, setDescription] = useState(initialReport?.description || '');
  const [templateType, setTemplateType] = useState<'pdf' | 'word' | 'text'>(
    initialReport?.templateType || 'text'
  );

  // Template content (for text type)
  const [templateContent, setTemplateContent] = useState(
    initialReport?.templateContent || ''
  );

  // File upload (for PDF/Word types)
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateFileUrl, setTemplateFileUrl] = useState(initialReport?.templateFileUrl || '');
  const [templateFileStoragePath, setTemplateFileStoragePath] = useState(initialReport?.templateFileStoragePath || '');
  const [templateFileName, setTemplateFileName] = useState(initialReport?.templateFileName || '');
  const [extractedText, setExtractedText] = useState<string>('');
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    fieldId: string;
    fileName: string;
    progress: number;
    status: 'uploading' | 'extracting' | 'completed' | 'error';
  } | undefined>();

  // Placeholders and mappings
  const [placeholders, setPlaceholders] = useState<ReportPlaceholder[]>(
    initialReport?.placeholders || []
  );
  const [mappings, setMappings] = useState<ReportMapping[]>(
    initialReport?.mappings || []
  );

  // UI state
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<string | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);

  // Helper function to extract plain text from HTML for placeholder detection
  const extractTextFromHTML = (html: string): string => {
    if (!html) return '';
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  // Extract placeholders when template content changes
  useEffect(() => {
    if (templateType === 'text' && templateContent) {
      // Extract text from HTML to find placeholders
      const plainText = extractTextFromHTML(templateContent);
      const extracted = reportService.extractPlaceholdersFromTemplate(plainText);
      setPlaceholders(extracted);
    } else if (templateType === 'pdf' && extractedText) {
      const extracted = reportService.extractPlaceholdersFromTemplate(extractedText);
      setPlaceholders(extracted);
    }
  }, [templateContent, extractedText, templateType]);

  // ReactQuill modules configuration
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': [] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['clean']
    ]
  }), []);

  const quillFormats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'align',
    'blockquote', 'code-block',
    'link', 'image'
  ];

  // Handle file upload for PDF/Word
  const handleFileUpload = async (file: File | null) => {
    if (!file) {
      setTemplateFile(null);
      setTemplateFileUrl('');
      setTemplateFileStoragePath('');
      setTemplateFileName('');
      setExtractedText('');
      return;
    }

    setTemplateFile(file);
    setTemplateFileName(file.name);

    // Upload file to Firebase Storage
    if (user?.id && user?.agencyId) {
      try {
        setIsExtractingText(true);
        setUploadProgress({
          fieldId: 'template',
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        });

        // For PDF files, extract text
        if (PDFTextExtractionService.isPDF(file)) {
          setUploadProgress({
            fieldId: 'template',
            fileName: file.name,
            progress: 50,
            status: 'extracting'
          });

          const extractionResult = await PDFTextExtractionService.extractTextFromPDF(file, user.id);
          
          if (extractionResult.success && extractionResult.text) {
            const cleanedText = PDFTextExtractionService.cleanExtractedText(extractionResult.text);
            setExtractedText(cleanedText);
            
            // Extract placeholders from extracted text
            const extracted = reportService.extractPlaceholdersFromTemplate(cleanedText);
            setPlaceholders(extracted);
            
            setUploadProgress({
              fieldId: 'template',
              fileName: file.name,
              progress: 100,
              status: 'completed'
            });
            
            showSuccess('Texte extrait du PDF avec succès');
          } else {
            throw new Error(extractionResult.error || 'Échec de l\'extraction du texte');
          }
        }

        // Upload file (for storage) - For now, we'll store the file reference
        // Actual upload will happen when saving the report
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const storagePath = `reports/${user.agencyId}/${user.id}/${timestamp}.${fileExtension}`;
        
        // Store file metadata (actual upload can be done later if needed)
        setTemplateFileUrl(`firestore://reports/${user.agencyId}/${user.id}/${timestamp}`);
        setTemplateFileStoragePath(storagePath);
        setUploadProgress({
          fieldId: 'template',
          fileName: file.name,
          progress: 100,
          status: 'completed'
        });

        showSuccess('Fichier téléchargé avec succès');
      } catch (error) {
        console.error('Erreur lors du téléchargement du fichier:', error);
        showError(error instanceof Error ? error.message : 'Erreur lors du téléchargement du fichier');
        setUploadProgress({
          fieldId: 'template',
          fileName: file.name,
          progress: 0,
          status: 'error'
        });
      } finally {
        setIsExtractingText(false);
        setTimeout(() => setUploadProgress(undefined), 2000);
      }
    }
  };

  // Handle placeholder mapping
  const handleMapPlaceholder = (placeholderId: string) => {
    setSelectedPlaceholder(placeholderId);
    setShowMappingModal(true);
  };

  const handleSaveMapping = (mapping: ReportMapping) => {
    const existingIndex = mappings.findIndex(m => m.placeholderId === mapping.placeholderId);
    
    if (existingIndex >= 0) {
      // Update existing mapping
      const newMappings = [...mappings];
      newMappings[existingIndex] = mapping;
      setMappings(newMappings);
    } else {
      // Add new mapping
      setMappings([...mappings, mapping]);
    }

    setShowMappingModal(false);
    setSelectedPlaceholder(null);
    showSuccess('Mapping enregistré');
  };

  const handleRemoveMapping = (placeholderId: string) => {
    setMappings(mappings.filter(m => m.placeholderId !== placeholderId));
    showSuccess('Mapping supprimé');
  };

  // Handle save
  const handleSave = () => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Le nom du rapport est requis');
    }

    if (templateType === 'text') {
      // Check if content is empty (after stripping HTML tags)
      const plainText = extractTextFromHTML(templateContent);
      if (!plainText.trim()) {
        newErrors.push('Le contenu du template est requis pour les templates texte');
      }
    }

    if ((templateType === 'pdf' || templateType === 'word') && !templateFileUrl) {
      newErrors.push('Le fichier template est requis pour les templates PDF/Word');
    }

    if (errors.length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare report data
    const reportData = {
      name: name.trim(),
      description: description?.trim() || undefined,
      templateType,
      templateContent: templateType === 'text' ? templateContent : undefined,
      templateFileUrl: (templateType === 'pdf' || templateType === 'word') ? templateFileUrl : undefined,
      templateFileStoragePath: (templateType === 'pdf' || templateType === 'word') ? templateFileStoragePath : undefined,
      templateFileName: (templateType === 'pdf' || templateType === 'word') ? templateFileName : undefined,
      placeholders,
      mappings
    };

    onSave(reportData);
  };

  const getMappedSource = (placeholderId: string): string => {
    const mapping = mappings.find(m => m.placeholderId === placeholderId);
    if (!mapping) return 'Non mappé';

    const source = mapping.sourceType === 'form' 
      ? forms.find(f => f.id === mapping.sourceId)
      : dashboards.find(d => d.id === mapping.sourceId);

    if (!source) return 'Source non trouvée';

    const sourceName = mapping.sourceType === 'form' 
      ? (source as Form).title 
      : (source as Dashboard).name;

    const fieldName = mapping.fieldId 
      ? (mapping.sourceType === 'form'
          ? (source as Form).fields.find(f => f.id === mapping.fieldId)?.label
          : (source as Dashboard).metrics.find(m => m.id === mapping.fieldId)?.name)
      : '';

    return `${sourceName}${fieldName ? ` - ${fieldName}` : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="secondary"
          onClick={onCancel}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Annuler</span>
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">
          {initialReport ? 'Modifier le rapport' : 'Créer un rapport'}
        </h2>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">Erreurs</h3>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Basic Information */}
      <Card title="Informations de base">
        <div className="space-y-4">
          <Input
            label="Nom du rapport *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Rapport mensuel des ventes"
            error={errors.includes('Le nom du rapport est requis') ? 'Ce champ est requis' : undefined}
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description du rapport (optionnel)"
            rows={3}
          />
        </div>
      </Card>

      {/* Template Type Selection */}
      <Card title="Type de template">
        <div className="space-y-4">
          <Select
            label="Type de template *"
            value={templateType}
            onChange={(e) => {
              const newType = e.target.value as 'pdf' | 'word' | 'text';
              setTemplateType(newType);
              // Clear file/content when switching types
              if (newType !== 'text') {
                setTemplateContent('');
                setPlaceholders([]);
                setMappings([]);
              }
              if (newType === 'text') {
                setTemplateFile(null);
                setTemplateFileUrl('');
                setTemplateFileStoragePath('');
                setTemplateFileName('');
                setExtractedText('');
              }
            }}
            options={[
              { value: 'text', label: 'Éditeur de texte' },
              { value: 'pdf', label: 'Document PDF' },
              { value: 'word', label: 'Document Word' }
            ]}
          />
        </div>
      </Card>

      {/* Template Content/Upload */}
      <Card title={templateType === 'text' ? 'Contenu du template' : 'Fichier template'}>
        {templateType === 'text' ? (
          <div className="space-y-4">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contenu du template *
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <ReactQuill
                  theme="snow"
                  value={templateContent}
                  onChange={setTemplateContent}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder='Utilisez {{placeholder}} pour marquer les emplacements à remplir. Ex: "Le total des ventes est {{totalVentes}}"'
                  className="report-template-editor"
                  style={{
                    minHeight: '300px'
                  }}
                />
              </div>
              {errors.includes('Le contenu du template est requis pour les templates texte') && (
                <p className="mt-1 text-sm text-red-600">Ce champ est requis</p>
              )}
              <style>{`
                .report-template-editor .ql-container {
                  min-height: 300px;
                  font-size: 14px;
                  font-family: inherit;
                }
                .report-template-editor .ql-editor {
                  min-height: 300px;
                }
                .report-template-editor .ql-editor.ql-blank::before {
                  color: #9ca3af;
                  font-style: normal;
                }
                .report-template-editor .ql-toolbar {
                  border-top-left-radius: 0.5rem;
                  border-top-right-radius: 0.5rem;
                  background: #f9fafb;
                  border-bottom: 1px solid #e5e7eb;
                }
                .report-template-editor .ql-container {
                  border-bottom-left-radius: 0.5rem;
                  border-bottom-right-radius: 0.5rem;
                }
                /* Mobile responsive toolbar */
                @media (max-width: 768px) {
                  .report-template-editor .ql-toolbar {
                    padding: 8px;
                  }
                  .report-template-editor .ql-toolbar .ql-formats {
                    margin-right: 4px;
                  }
                  .report-template-editor .ql-toolbar button,
                  .report-template-editor .ql-toolbar .ql-picker-label {
                    padding: 4px;
                  }
                }
                /* Highlight placeholders in editor */
                .report-template-editor .ql-editor {
                  color: #1f2937;
                }
              `}</style>
            </div>
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-1">💡 Astuce:</p>
              <p>Utilisez la syntaxe <code className="bg-white px-1 rounded">{'{{nomDuPlaceholder}}'}</code> pour marquer les emplacements à remplir dans votre template.</p>
              <p className="mt-2 text-xs">Vous pouvez formater votre texte avec les options de la barre d'outils : gras, italique, titres, couleurs, etc.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FileInput
              label="Fichier template *"
              value={templateFile}
              onChange={handleFileUpload}
              acceptedTypes={templateType === 'pdf' ? ['.pdf'] : ['.doc', '.docx']}
              placeholder={templateType === 'pdf' ? 'Sélectionner un fichier PDF' : 'Sélectionner un fichier Word'}
              error={errors.includes('Le fichier template est requis pour les templates PDF/Word') ? 'Ce fichier est requis' : undefined}
              progress={uploadProgress}
            />
            
            {extractedText && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Texte extrait:</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">{extractedText.substring(0, 1000)}...</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Placeholders Detection */}
      {placeholders.length > 0 && (
        <Card title={`Placeholders détectés (${placeholders.length})`}>
          <div className="space-y-3">
            {placeholders.map((placeholder) => {
              const mapping = mappings.find(m => m.placeholderId === placeholder.id);
              const isMapped = !!mapping;

              return (
                <div
                  key={placeholder.id}
                  className={`p-4 border rounded-lg ${
                    isMapped ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {isMapped ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                        )}
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {placeholder.placeholder}
                        </code>
                      </div>
                      
                      {isMapped ? (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Mappé vers:</span> {getMappedSource(placeholder.id)}
                          </p>
                          {mapping.calculationType && (
                            <p className="text-xs text-gray-500 mt-1">
                              Calcul: {mapping.calculationType}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-yellow-600 mt-2">
                          Non mappé - Cliquez sur "Mapper" pour associer ce placeholder à une source de données
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {isMapped ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMapPlaceholder(placeholder.id)}
                          className="flex items-center space-x-1"
                        >
                          <Edit className="h-4 w-4" />
                          <span>Modifier</span>
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleMapPlaceholder(placeholder.id)}
                          className="flex items-center space-x-1"
                        >
                          <MapPin className="h-4 w-4" />
                          <span>Mapper</span>
                        </Button>
                      )}
                      {isMapped && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRemoveMapping(placeholder.id)}
                          className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mapping Modal */}
      {showMappingModal && selectedPlaceholder && (
        <PlaceholderMappingModal
          placeholder={placeholders.find(p => p.id === selectedPlaceholder)!}
          existingMapping={mappings.find(m => m.placeholderId === selectedPlaceholder)}
          forms={forms}
          dashboards={dashboards}
          onSave={handleSaveMapping}
          onCancel={() => {
            setShowMappingModal(false);
            setSelectedPlaceholder(null);
          }}
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-end space-x-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Enregistrement...</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>Enregistrer</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Placeholder Mapping Modal Component
interface PlaceholderMappingModalProps {
  placeholder: ReportPlaceholder;
  existingMapping?: ReportMapping;
  forms: Form[];
  dashboards: Dashboard[];
  onSave: (mapping: ReportMapping) => void;
  onCancel: () => void;
}

const PlaceholderMappingModal: React.FC<PlaceholderMappingModalProps> = ({
  placeholder,
  existingMapping,
  forms,
  dashboards,
  onSave,
  onCancel
}) => {
  const [sourceType, setSourceType] = useState<'form' | 'dashboard'>(
    existingMapping?.sourceType || 'form'
  );
  const [sourceId, setSourceId] = useState(existingMapping?.sourceId || '');
  const [fieldId, setFieldId] = useState(existingMapping?.fieldId || '');
  const [calculationType, setCalculationType] = useState<
    'sum' | 'average' | 'count' | 'min' | 'max' | 'custom' | undefined
  >(existingMapping?.calculationType);
  const [defaultValue, setDefaultValue] = useState(existingMapping?.defaultValue || '');

  const selectedSource = sourceType === 'form'
    ? forms.find(f => f.id === sourceId)
    : dashboards.find(d => d.id === sourceId);

  const handleSave = () => {
    if (!sourceId) {
      return;
    }

    const mapping: ReportMapping = {
      placeholderId: placeholder.id,
      sourceType,
      sourceId,
      fieldId: fieldId || undefined,
      calculationType,
      defaultValue: defaultValue || undefined
    };

    onSave(mapping);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Mapper le placeholder: <code className="bg-gray-100 px-2 py-1 rounded">{placeholder.placeholder}</code>
            </h3>
            <Button variant="secondary" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <Select
              label="Type de source *"
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value as 'form' | 'dashboard');
                setSourceId('');
                setFieldId('');
              }}
              options={[
                { value: 'form', label: 'Formulaire' },
                { value: 'dashboard', label: 'Tableau de bord' }
              ]}
            />

            <Select
              label={`${sourceType === 'form' ? 'Formulaire' : 'Tableau de bord'} *`}
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setFieldId('');
              }}
              options={
                sourceType === 'form'
                  ? forms.map(f => ({ value: f.id, label: f.title }))
                  : dashboards.map(d => ({ value: d.id, label: d.name }))
              }
              placeholder="Sélectionner..."
            />

            {selectedSource && (
              <>
                {sourceType === 'form' ? (
                  <Select
                    label="Champ (optionnel)"
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value)}
                    options={[
                      { value: '', label: 'Aucun champ spécifique' },
                      ...(selectedSource as Form).fields.map(f => ({
                        value: f.id,
                        label: `${f.label} (${f.type})`
                      }))
                    ]}
                  />
                ) : (
                  <Select
                    label="Métrique (optionnel)"
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value)}
                    options={[
                      { value: '', label: 'Aucune métrique spécifique' },
                      ...(selectedSource as Dashboard).metrics.map(m => ({
                        value: m.id,
                        label: m.name
                      }))
                    ]}
                  />
                )}

                {(selectedSource as Form).fields.find(f => f.id === fieldId)?.type === 'number' ||
                 (selectedSource as Dashboard).metrics.find(m => m.id === fieldId)?.fieldType === 'number' ? (
                  <Select
                    label="Type de calcul (optionnel)"
                    value={calculationType || ''}
                    onChange={(e) => setCalculationType(e.target.value as any || undefined)}
                    options={[
                      { value: '', label: 'Aucun calcul' },
                      { value: 'sum', label: 'Somme' },
                      { value: 'average', label: 'Moyenne' },
                      { value: 'count', label: 'Nombre' },
                      { value: 'min', label: 'Minimum' },
                      { value: 'max', label: 'Maximum' }
                    ]}
                  />
                ) : null}

                <Input
                  label="Valeur par défaut (optionnel)"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="Valeur à utiliser si aucune donnée n'est disponible"
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            <Button variant="secondary" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!sourceId}
            >
              Enregistrer le mapping
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
