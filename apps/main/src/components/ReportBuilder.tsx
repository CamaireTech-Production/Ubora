import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Report, ReportPlaceholder, ReportMapping, Dashboard, StaticValueType } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { FileInput } from './FileInput';
import { Edit, MapPin, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { reportService } from '../services/reportService';
import { DocumentExtractionService } from '@ubora/shared/services';
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
  dashboards?: Dashboard[]; // Optional: if provided, use these instead of all dashboards from context
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  onSave,
  onCancel,
  initialReport,
  isLoading = false,
  dashboards: providedDashboards
}) => {
  const { user } = useAuth();
  const { dashboards: allDashboards } = useApp();
  const { showSuccess, showError } = useToast();

  // Use provided dashboards if available, otherwise use all dashboards from context
  const dashboards = providedDashboards || allDashboards;

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
    } else if ((templateType === 'pdf' || templateType === 'word') && extractedText) {
      const extracted = reportService.extractPlaceholdersFromTemplate(extractedText);
      setPlaceholders(extracted);
    }
  }, [templateContent, extractedText, templateType]);

  // ReactQuill modules configuration
  const quillModules = useMemo(() => {
    return {
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
    };
  }, []);

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
      // When file is removed, clear all file-related state and mappings
      setTemplateFile(null);
      setTemplateFileUrl('');
      setTemplateFileStoragePath('');
      setTemplateFileName('');
      setExtractedText('');
      setPlaceholders([]);
      setMappings([]);
      setUploadProgress(undefined);
      return;
    }

    setTemplateFile(file);
    setTemplateFileName(file.name);

    // Upload file to Firebase Storage
    if (user?.id && user?.agencyId) {
      try {
        setUploadProgress({
          fieldId: 'template',
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        });

        // Extract text from PDF or Word files
        if (DocumentExtractionService.isSupportedDocument(file)) {
          setUploadProgress({
            fieldId: 'template',
            fileName: file.name,
            progress: 50,
            status: 'extracting'
          });

          // Use unified document extraction service
          const extractionResult = await DocumentExtractionService.extractDocument(file, {
            method: 'basic',
            userId: user.id
          });
          
          if (extractionResult.success && extractionResult.text) {
            setExtractedText(extractionResult.text);
            
            // Extract placeholders from extracted text
            const extracted = reportService.extractPlaceholdersFromTemplate(extractionResult.text);
            setPlaceholders(extracted);
            
            setUploadProgress({
              fieldId: 'template',
              fileName: file.name,
              progress: 100,
              status: 'completed'
            });
            
            const fileTypeLabel = extractionResult.documentType === 'word' ? 'Word' : 'PDF';
            showSuccess(`Texte extrait du document ${fileTypeLabel} avec succès`);
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

    // Validate required name
    if (!name.trim()) {
      newErrors.push('Le nom du rapport est requis');
    }

    // Validate template content based on type
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

    // Validate that all placeholders are mapped
    if (placeholders.length > 0) {
      const unmappedPlaceholders = placeholders.filter(
        p => !mappings.some(m => m.placeholderId === p.id)
      );
      
      if (unmappedPlaceholders.length > 0) {
        newErrors.push(`Tous les placeholders doivent être mappés. ${unmappedPlaceholders.length} placeholder(s) non mappé(s).`);
      }
    }

    // If there are errors, set them and return without saving
    if (newErrors.length > 0) {
      setErrors(newErrors);
      showError(newErrors.join(', '));
      return;
    }

    // Clear errors if validation passes
    setErrors([]);

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

    if (mapping.sourceType === 'static') {
      const staticLabels: Record<string, string> = {
        'agency_name': 'Nom de l\'agence',
        'agency_id': 'ID de l\'agence',
        'user_email': 'Email de l\'utilisateur',
        'user_name': 'Nom de l\'utilisateur',
        'user_id': 'ID de l\'utilisateur',
        'current_date': 'Date actuelle',
        'current_time': 'Heure actuelle',
        'current_datetime': 'Date et heure actuelles',
        'report_generation_date': 'Date de génération',
        'report_generation_time': 'Heure de génération'
      };
      return staticLabels[mapping.staticValueType || ''] || 'Valeur statique';
    }

    // Dashboard mapping
    if (!mapping.sourceId) return 'Dashboard non spécifié';
    
    const dashboard = dashboards.find(d => d.id === mapping.sourceId);
    if (!dashboard) return 'Dashboard non trouvé';

    if (!mapping.metricId) return `${dashboard.name} - Métrique non spécifiée`;

    const metric = dashboard.metrics.find(m => m.id === mapping.metricId);
    if (!metric) return `${dashboard.name} - Métrique non trouvée`;

    const metricTypeLabel = metric.metricType === 'graph' ? 'Graphique' : metric.metricType === 'table' ? 'Tableau' : 'Valeur';
    return `${dashboard.name} - ${metric.name} (${metricTypeLabel})`;
  };

  return (
    <div className="space-y-6">

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
          disabled={
            isLoading ||
            !name.trim() ||
            (templateType === 'text' && !extractTextFromHTML(templateContent).trim()) ||
            ((templateType === 'pdf' || templateType === 'word') && !templateFileUrl) ||
            (placeholders.length > 0 && placeholders.some(p => !mappings.some(m => m.placeholderId === p.id)))
          }
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
  dashboards: Dashboard[]; // Forms removed
  onSave: (mapping: ReportMapping) => void;
  onCancel: () => void;
}

const PlaceholderMappingModal: React.FC<PlaceholderMappingModalProps> = ({
  placeholder,
  existingMapping,
  dashboards,
  onSave,
  onCancel
}) => {
  // Source type: dashboard or static
  const [sourceType, setSourceType] = useState<'dashboard' | 'static'>(
    existingMapping?.sourceType || 'dashboard'
  );
  
  // Dashboard-related state
  const [dashboardId, setDashboardId] = useState(existingMapping?.sourceId || '');
  const [metricId, setMetricId] = useState(() => {
    const existingMetricId = existingMapping?.metricId || (existingMapping as any)?.fieldId;
    // Ensure we only store IDs, not display text
    if (existingMetricId && typeof existingMetricId === 'string') {
      // Check if it looks like a display label (contains parentheses)
      if (existingMetricId.includes('(') || existingMetricId.includes(')')) {
        console.warn('Existing metricId looks like display text, resetting:', existingMetricId);
        return '';
      }
      return existingMetricId;
    }
    return '';
  });
  
  // Static value state
  const [staticValueType, setStaticValueType] = useState<StaticValueType | ''>(
    existingMapping?.staticValueType || ''
  );
  
  const [defaultValue, setDefaultValue] = useState(existingMapping?.defaultValue || '');

  // Debug: Log dashboards on mount
  useEffect(() => {
    console.log('PlaceholderMappingModal mounted');
    console.log('Dashboards received:', dashboards);
    console.log('Dashboard IDs:', dashboards.map(d => d.id));
    console.log('Dashboard names:', dashboards.map(d => d.name));
    console.log('Existing mapping:', existingMapping);
    console.log('Initial dashboardId:', dashboardId);
  }, []);

  const selectedDashboard = sourceType === 'dashboard' ? dashboards.find(d => d.id === dashboardId) : null;
  const selectedMetric = selectedDashboard?.metrics?.find(m => m.id === metricId);
  
  // Debug: Log selected dashboard and metrics
  useEffect(() => {
    if (dashboardId) {
      console.log('Dashboard ID selected:', dashboardId);
      console.log('All dashboards:', dashboards);
      const found = dashboards.find(d => d.id === dashboardId);
      console.log('Selected Dashboard:', found);
      if (found) {
        console.log('Dashboard Metrics:', found.metrics);
        console.log('Metrics Count:', found.metrics?.length || 0);
      } else {
        console.warn('Dashboard not found with ID:', dashboardId);
      }
    }
  }, [dashboardId, dashboards]);

  // Get metric type label
  const getMetricTypeLabel = (metricType?: 'value' | 'graph' | 'table'): string => {
    switch (metricType) {
      case 'value':
        return 'Valeur';
      case 'graph':
        return 'Graphique';
      case 'table':
        return 'Tableau';
      default:
        return 'Valeur';
    }
  };

  // Get static value label
  const getStaticValueLabel = (type: StaticValueType): string => {
    const labels: Record<StaticValueType, string> = {
      'agency_name': 'Nom de l\'agence',
      'agency_id': 'ID de l\'agence',
      'user_email': 'Email de l\'utilisateur',
      'user_name': 'Nom de l\'utilisateur',
      'user_id': 'ID de l\'utilisateur',
      'current_date': 'Date actuelle',
      'current_time': 'Heure actuelle',
      'current_datetime': 'Date et heure actuelles',
      'report_generation_date': 'Date de génération du rapport',
      'report_generation_time': 'Heure de génération du rapport'
    };
    return labels[type];
  };

  const handleSave = () => {
    if (sourceType === 'dashboard') {
      if (!dashboardId || !metricId) {
        console.warn('Cannot save: missing dashboardId or metricId', { dashboardId, metricId });
      return;
    }

      // Validate that metricId is a valid ID (not display text)
      const metric = selectedDashboard?.metrics?.find(m => m.id === metricId);
      if (!metric) {
        console.error('Metric not found:', { 
          metricId, 
          dashboardId, 
          availableMetrics: selectedDashboard?.metrics,
          metricIds: selectedDashboard?.metrics?.map(m => m.id),
          metricNames: selectedDashboard?.metrics?.map(m => `${m.name} (${getMetricTypeLabel(m.metricType || 'value')})`)
        });
        
        // Try to find by name if somehow the label was selected
        const metricByName = selectedDashboard?.metrics?.find(m => 
          `${m.name} (${getMetricTypeLabel(m.metricType || 'value')})` === metricId
        );
        
        if (metricByName) {
          console.warn('Found metric by name, using its ID instead:', metricByName.id);
          setMetricId(metricByName.id);
          // Retry save with correct ID
          setTimeout(() => {
            const correctedMetric = selectedDashboard?.metrics?.find(m => m.id === metricByName.id);
            if (correctedMetric) {
    const mapping: ReportMapping = {
      placeholderId: placeholder.id,
                sourceType: 'dashboard',
                sourceId: dashboardId,
                metricId: correctedMetric.id,
                metricType: (correctedMetric.metricType === 'graph' ? 'graph' : (correctedMetric.metricType === 'table' ? 'table' : 'value')),
                defaultValue: defaultValue || undefined
              };
              onSave(mapping);
            }
          }, 0);
          return;
        }
        
        return;
      }

      const mapping: ReportMapping = {
        placeholderId: placeholder.id,
        sourceType: 'dashboard',
        sourceId: dashboardId,
        metricId: metricId,
        metricType: (metric.metricType === 'graph' ? 'graph' : (metric.metricType === 'table' ? 'table' : 'value')),
      defaultValue: defaultValue || undefined
    };

    onSave(mapping);
    } else {
      // Static value mapping
      if (!staticValueType) {
        console.warn('Cannot save: missing staticValueType', { staticValueType });
        return;
      }

      const mapping: ReportMapping = {
        placeholderId: placeholder.id,
        sourceType: 'static',
        staticValueType: staticValueType,
        defaultValue: defaultValue || undefined
      };

      onSave(mapping);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[99999] p-4"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        // Close modal when clicking on overlay
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Card>
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
            {/* Source Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de source *
              </label>
              <div className="flex space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sourceType"
                            value="dashboard"
                            checked={sourceType === 'dashboard'}
                            onChange={() => {
                              setSourceType('dashboard');
                              setStaticValueType(''); // Reset static value
                            }}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Tableau de bord</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sourceType"
                            value="static"
                            checked={sourceType === 'static'}
                            onChange={() => {
                              setSourceType('static');
                              setDashboardId(''); // Reset dashboard
                              setMetricId(''); // Reset metric
                            }}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Valeur statique</span>
                        </label>
              </div>
            </div>

            {sourceType === 'dashboard' ? (
              <React.Fragment>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tableau de bord *
                  </label>
                  <select
                    value={dashboardId}
              onChange={(e) => {
                      const newDashboardId = e.target.value;
                      console.log('Dashboard selection changed:', newDashboardId);
                      console.log('Previous dashboardId:', dashboardId);
                      setDashboardId(newDashboardId);
                      setMetricId(''); // Reset metric when dashboard changes
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner un tableau de bord...</option>
                    {dashboards.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {dashboardId && (
                    <p className="text-xs text-gray-500 mt-1">Dashboard ID: {dashboardId}</p>
                  )}
                </div>

                {dashboardId ? (
                  <React.Fragment>
                    {selectedDashboard ? (
                      <React.Fragment>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Métrique *
                          </label>
                          <select
                            value={metricId}
                            onChange={(e) => {
                              const selectedValue = e.target.value;
                              console.log('Metric selection changed:', {
                                selectedValue,
                                allMetricIds: selectedDashboard.metrics?.map(m => ({ id: m.id, name: m.name })),
                                currentMetricId: metricId
                              });
                              
                              // Primary: set ID directly
                              let nextId = selectedValue;
                              // Safety: if somehow the value is the display label, resolve by name
                              if (selectedDashboard.metrics && !selectedDashboard.metrics.some(m => m.id === nextId)) {
                                const foundByLabel = selectedDashboard.metrics.find(m => `${m.name} (${getMetricTypeLabel(m.metricType || 'value')})` === selectedValue);
                                if (foundByLabel) {
                                  console.warn('Metric value looked like label; resolved to ID:', { selectedValue, resolvedId: foundByLabel.id });
                                  nextId = foundByLabel.id;
                                }
                              }
                              setMetricId(nextId);
                            }}
                            disabled={!selectedDashboard.metrics || selectedDashboard.metrics.length === 0}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">Sélectionner une métrique...</option>
                            {selectedDashboard.metrics && selectedDashboard.metrics.length > 0 && selectedDashboard.metrics.map(m => {
                              const displayLabel = `${m.name} (${getMetricTypeLabel(m.metricType || 'value')})`;
                              return (
                                <option key={m.id} value={m.id}>
                                  {displayLabel}
                                </option>
                              );
                            })}
                          </select>
                          {metricId && (
                            <p className="text-xs text-blue-500 mt-1">
                              Metric ID sélectionné: {metricId}
                            </p>
                          )}
                          {selectedDashboard.metrics && selectedDashboard.metrics.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              {selectedDashboard.metrics.length} métrique(s) disponible(s)
                            </p>
                          )}
                        </div>

                        {(!selectedDashboard.metrics || selectedDashboard.metrics.length === 0) && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-sm text-yellow-800">
                              ⚠️ Ce tableau de bord n'a aucune métrique. Veuillez créer des métriques dans le tableau de bord avant de le mapper.
                            </p>
                            <p className="text-xs text-yellow-700 mt-2">
                              Dashboard: {selectedDashboard.name} | Metrics: {selectedDashboard.metrics?.length || 0}
                            </p>
                          </div>
                        )}

                        {selectedMetric && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">
                              <strong>Type:</strong> {getMetricTypeLabel(selectedMetric.metricType || 'value')}
                              {selectedMetric.metricType === 'graph' && ' - Le graphique sera inséré tel quel'}
                              {selectedMetric.metricType === 'value' && ' - La valeur calculée sera insérée'}
                              {selectedMetric.metricType === 'table' && ' - Le tableau sera inséré tel quel'}
                            </p>
                          </div>
                        )}
                      </React.Fragment>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-800">
                          ⚠️ Dashboard non trouvé avec l'ID: {dashboardId}
                        </p>
                        <p className="text-xs text-red-700 mt-2">
                          Dashboards disponibles: {dashboards.map(d => d.id).join(', ')}
                        </p>
                      </div>
                    )}
                  </React.Fragment>
                ) : (
                  dashboards.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm text-gray-600">
                        Veuillez sélectionner un tableau de bord pour afficher les métriques disponibles.
                      </p>
                    </div>
                  )
                )}
              </React.Fragment>
            ) : (
              <React.Fragment>
                {/* Static Value Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valeur statique *
                  </label>
                  <select
                    value={staticValueType}
                    onChange={(e) => {
                      setStaticValueType(e.target.value as StaticValueType);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner une valeur statique...</option>
                    <option value="agency_name">Nom de l'agence</option>
                    <option value="agency_id">ID de l'agence</option>
                    <option value="user_email">Email de l'utilisateur</option>
                    <option value="user_name">Nom de l'utilisateur</option>
                    <option value="user_id">ID de l'utilisateur</option>
                    <option value="current_date">Date actuelle</option>
                    <option value="current_time">Heure actuelle</option>
                    <option value="current_datetime">Date et heure actuelles</option>
                    <option value="report_generation_date">Date de génération du rapport</option>
                    <option value="report_generation_time">Heure de génération du rapport</option>
                  </select>
                  {staticValueType && (
                    <p className="text-xs text-blue-500 mt-1">
                      Valeur: {getStaticValueLabel(staticValueType)}
                    </p>
                  )}
                </div>
              </React.Fragment>
            )}

                <Input
                  label="Valeur par défaut (optionnel)"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="Valeur à utiliser si aucune donnée n'est disponible"
                />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            <Button variant="secondary" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={
                sourceType === 'dashboard' 
                  ? (!dashboardId || !metricId)
                  : !staticValueType
              }
            >
              Enregistrer le mapping
            </Button>
          </div>
        </div>
      </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
