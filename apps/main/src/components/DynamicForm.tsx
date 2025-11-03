import React, { useState, useEffect, useCallback } from 'react';
import { Form, FormField, FileAttachment } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { FileInput } from './FileInput';
import { FileUploadService, UploadProgress } from '@ubora/shared/services/fileUploadService';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useFormDraft } from '@ubora/shared/hooks/useFormDraft';
import { db, auth } from '@ubora/shared/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, Clock, AlertTriangle, Loader2, Calculator, Trash2 } from 'lucide-react';
import { useToast } from '@ubora/shared/hooks/useToast';
import { ExpressionCalculator } from '@ubora/shared/utils/ExpressionCalculator';
import { ConditionalLogicEvaluator } from '@ubora/shared/utils/ConditionalLogicEvaluator';
import { getFileBlobUrl } from '@ubora/shared/utils/simpleFileDownload';
import { TextExtractionReviewModal } from './TextExtractionReviewModal';
import { UserSessionService } from '@ubora/shared/services/userSessionService';

// Helper function to convert field IDs back to user-friendly field names in formulas
const convertFormulaToUserFriendly = (formula: string, fields: FormField[]): string => {
  if (!formula || !fields) return formula;
  
  let userFriendlyFormula = formula;
  
  // Replace field IDs with their labels
  fields.forEach(field => {
    if (field.id && field.label) {
      // Create a clean field name for display (remove special characters, make lowercase)
      const cleanFieldName = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanFieldName) {
        const regex = new RegExp(`\\b${field.id}\\b`, 'g');
        userFriendlyFormula = userFriendlyFormula.replace(regex, cleanFieldName);
      }
    }
  });
  
  return userFriendlyFormula;
};

interface DynamicFormProps {
  form: Form;
  onSubmit: (answers: Record<string, unknown>, fileAttachments?: FileAttachment[]) => void;
  onCancel: () => void;
  initialAnswers?: Record<string, unknown>;
  initialFileAttachments?: FileAttachment[];
  isDraft?: boolean;
  isEditMode?: boolean;
  isLoading?: boolean;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  form,
  onSubmit,
  onCancel,
  initialAnswers = {},
  initialFileAttachments = [],
  isDraft = false,
  isEditMode = false,
  isLoading = false
}: DynamicFormProps) => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>(initialFileAttachments);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleFields, setVisibleFields] = useState<string[]>(form.fields.map((f: FormField) => f.id));
  
  // Image text extraction review modal state
  const [imageTextModal, setImageTextModal] = useState<{
    isOpen: boolean;
    fieldId: string | null;
    fileName?: string;
    text: string;
  }>({ isOpen: false, fieldId: null, fileName: undefined, text: '' });

  // Draft persistence to avoid data loss on re-mounts
  const { loadDraft, saveDraftDebounced } = useFormDraft<Record<string, unknown>>(form.id, user?.uid);

  // Hydrate from local draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && Object.keys(draft).length > 0) {
      setAnswers(prev => ({ ...prev, ...draft }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Function to update visible fields based on conditional logic
  const updateVisibleFields = useCallback((currentAnswers: Record<string, unknown>) => {
    const visible = ConditionalLogicEvaluator.getVisibleFields(form.fields, currentAnswers);
    
    
    setVisibleFields(visible);
  }, [form.fields]);

  // Update visible fields when answers or form.fields change
  useEffect(() => {
    updateVisibleFields(answers);
  }, [answers, form.fields, updateVisibleFields]);
  
  

  const formatTimeRestrictions = (restrictions?: {
    startTime?: string;
    endTime?: string;
    allowedDays?: number[];
  }): string => {
    if (!restrictions || (!restrictions.startTime && !restrictions.endTime)) {
      return '';
    }

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    let timeStr = '';
    if (restrictions.startTime && restrictions.endTime) {
      // Range mode: between start and end
      timeStr = `entre ${restrictions.startTime} et ${restrictions.endTime}`;
    } else if (restrictions.endTime && !restrictions.startTime) {
      // Single-time mode: from 00:00 until endTime
      timeStr = `jusqu'à ${restrictions.endTime}`;
    } else if (restrictions.startTime && !restrictions.endTime) {
      // Fallback (shouldn't happen in our UX), treat as from 00:00 until startTime
      timeStr = `jusqu'à ${restrictions.startTime}`;
    }

    let dayStr = '';
    if (restrictions.allowedDays && restrictions.allowedDays.length > 0) {
      const selectedDays = restrictions.allowedDays
        .sort((a, b) => a - b)
        .map(day => dayNames[day])
        .join(', ');
      dayStr = ` les ${selectedDays}`;
    }

    return `${timeStr}${dayStr}`;
  };

  const isWithinTimeRestrictions = (): boolean => {
    if (!form.timeRestrictions || (!form.timeRestrictions.startTime && !form.timeRestrictions.endTime)) {
      return true; // No restrictions
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Check day restrictions
    if (form.timeRestrictions.allowedDays && form.timeRestrictions.allowedDays.length > 0) {
      if (!form.timeRestrictions.allowedDays.includes(currentDay)) {
        return false;
      }
    }

    // Check time restrictions
    const { startTime, endTime } = form.timeRestrictions;
    if (startTime && endTime) {
      // Range mode: between start and end
      return currentTime >= startTime && currentTime <= endTime;
    } else if (!startTime && endTime) {
      // Single-time mode: from 00:00 until endTime
      return currentTime <= endTime;
    } else if (startTime && !endTime) {
      // Fallback: treat startTime as endTime (from 00:00 until startTime)
      return currentTime <= startTime;
    }

    return true;
  };

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [fieldId]: value
      };
      
      // Recalculate all calculated fields that depend on this field
      const updatedAnswers = recalculateDependentFields(fieldId, newAnswers);
      
      // Update visible fields based on new answers
      const newVisibleFields = ConditionalLogicEvaluator.getVisibleFields(form.fields, updatedAnswers);
      
      // Clear values for fields that are no longer visible
      const cleanedAnswers = { ...updatedAnswers };
      form.fields.forEach((field: FormField) => {
        if (!newVisibleFields.includes(field.id) && field.id !== fieldId) {
          delete cleanedAnswers[field.id];
        }
      });
      
      // Persist draft (debounced) to survive possible re-mounts
      saveDraftDebounced(cleanedAnswers as Record<string, unknown>);
      return cleanedAnswers;
    });
    
    // Supprimer l'erreur si le champ est rempli
    if (errors[fieldId] && value) {
      setErrors(prev => ({
        ...prev,
        [fieldId]: ''
      }));
    }
  };

  // Function to recalculate all calculated fields
  const recalculateAllCalculatedFields = useCallback((currentAnswers: Record<string, unknown>): Record<string, unknown> => {
    const updatedAnswers = { ...currentAnswers };
    
    form.fields.forEach((field: FormField) => {
      if (field.type === 'calculated' && field.calculationFormula) {
        try {
          const calculatedValue = ExpressionCalculator.evaluate(field.calculationFormula, updatedAnswers, form.fields);
          updatedAnswers[field.id] = calculatedValue;
        } catch (error) {
          console.error(`❌ Error in initial calculation ${field.label}:`, error);
          updatedAnswers[field.id] = 0;
        }
      }
    });
    
    return updatedAnswers;
  }, [form.fields]);

  // Function to recalculate fields that depend on a changed field
  const recalculateDependentFields = useCallback((changedFieldId: string, currentAnswers: Record<string, unknown>): Record<string, unknown> => {
    const updatedAnswers = { ...currentAnswers };
    
    form.fields.forEach((field: FormField) => {
      if (field.type === 'calculated' && field.calculationFormula) {
        // Check if this calculated field depends on the changed field
        const dependsOnChangedField = field.dependsOn?.includes(changedFieldId);
        
        // Also recalculate if the formula contains the changed field ID
        const formulaContainsField = field.calculationFormula.includes(changedFieldId);
        
        if (dependsOnChangedField || formulaContainsField) {
          try {
            const calculatedValue = ExpressionCalculator.evaluate(field.calculationFormula, updatedAnswers, form.fields);
            updatedAnswers[field.id] = calculatedValue;
          } catch (error) {
            console.error(`❌ Error calculating ${field.label}:`, error);
            updatedAnswers[field.id] = 0;
          }
        }
      }
    });
    
    return updatedAnswers;
  }, [form.fields]);

  // Initialize answers and recalculate when initialAnswers change
  useEffect(() => {
    setAnswers(initialAnswers);
  }, [initialAnswers]);

  // Recalculate all calculated fields when form loads or answers change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      const recalculatedAnswers = recalculateAllCalculatedFields(answers);
      // Only update if there are actual changes to prevent infinite loops
      const hasChanges = Object.keys(recalculatedAnswers).some(key => 
        recalculatedAnswers[key] !== answers[key]
      );
      if (hasChanges) {
        setAnswers(recalculatedAnswers);
      }
    }
  }, [form.fields, recalculateAllCalculatedFields]); // Remove answers from dependencies to prevent infinite loop

  const handleFileUpload = async (fieldId: string, file: File | null) => {
    if (!file || !user) return;

    try {
      // Get current user info
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get user data to get agencyId
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        throw new Error('User data not found');
      }
      const userData = userDoc.data();

      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        [fieldId]: {
          fieldId,
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        }
      }));


      // Process file locally (extract text only)
        const attachment = await FileUploadService.processFile(
          file,
          fieldId,
          currentUser.uid, // Pass userId for token charging
          (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [fieldId]: progress
            }));
          },
          (pdfResult) => {
            // Document (PDF/Word) extraction result (success or failure)
            if (pdfResult.extractionStatus === 'completed') {
              console.log(`✅ Document ${pdfResult.fileName} processed successfully`);
              console.log(`📝 Extracted text length: ${pdfResult.extractedText?.length || 0} characters`);
              // Show success toast without disrupting form
              showSuccess(`Document ${pdfResult.fileName} traité avec succès`);
            } else if (pdfResult.extractionStatus === 'failed') {
              console.error(`❌ Document ${pdfResult.fileName} extraction failed:`, pdfResult.error);
              // Show user-friendly error message without disrupting form
              showError(`Erreur d'extraction: ${pdfResult.error || 'Impossible d\'extraire le texte du document'}`);
            }
          },
          (imageResult) => {
            // Only for images: show review modal with extracted text
            if (imageResult.extractionStatus === 'completed') {
              setImageTextModal({
                isOpen: true,
                fieldId,
                fileName: imageResult.fileName,
                text: imageResult.extractedText || ''
              });
            }
          }
        );

      // Add to attachments
      setFileAttachments(prev => {
        // Remove existing attachment for this field
        const filtered = prev.filter(att => att.fieldId !== fieldId);
        return [...filtered, attachment];
      });

      // Update answers with file info including downloadUrl and storagePath
      const fileAnswerData = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploaded: true,
        downloadUrl: attachment.downloadUrl,
        storagePath: attachment.storagePath,
        uploadedAt: attachment.uploadedAt,
        extractedText: attachment.extractedText,
        textExtractionStatus: attachment.textExtractionStatus
      };


      setAnswers(prev => ({
        ...prev,
        [fieldId]: fileAnswerData
      }));

      // Clear progress when completed
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fieldId];
        return newProgress;
      });

    } catch (error) {
      console.error('File upload error:', error);
      
      // Show user-friendly error message without disrupting form
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du traitement du fichier';
      showError(`Erreur de fichier: ${errorMessage}`);
      
      setErrors(prev => ({
        ...prev,
        [fieldId]: errorMessage
      }));
      
      // Clear progress on error
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fieldId];
        return newProgress;
      });
      
      // Don't throw the error to prevent UI disruption
      console.warn('File upload failed but continuing form operation');
    }
  };

  const acceptExtractedText = () => {
    if (!imageTextModal.fieldId) {
      setImageTextModal({ isOpen: false, fieldId: null, text: '' });
      return;
    }
    // Put extracted text into a sibling textarea field if exists, else keep it in attachment metadata
    const targetFieldId = imageTextModal.fieldId;
    const existing = answers[targetFieldId];
    if (existing && typeof existing === 'object') {
      const updated = { ...(existing as Record<string, unknown>), extractedText: imageTextModal.text };
      setAnswers(prev => ({ ...prev, [targetFieldId]: updated }));
    }
    setImageTextModal({ isOpen: false, fieldId: null, fileName: undefined, text: '' });
  };

  const reuploadImage = () => {
    if (imageTextModal.fieldId) {
      handleFileRemove(imageTextModal.fieldId);
    }
    setImageTextModal({ isOpen: false, fieldId: null, fileName: undefined, text: '' });
  };

  const handleFileRemove = (fieldId: string) => {
    // Remove from attachments
    setFileAttachments(prev => prev.filter(att => att.fieldId !== fieldId));
    
    
    // Clear answer
    setAnswers(prev => ({
      ...prev,
      [fieldId]: null
    }));

    // Clear progress
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fieldId];
      return newProgress;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
 
    form.fields.forEach((field: FormField) => {
      const value = answers[field.id];

      if (field.required) {
        if (field.type === 'file') {
          // For file fields, check for null/undefined or missing required file properties
          if (
            !value ||
            typeof value !== 'object' ||
            !('uploaded' in value) ||
            !value.uploaded
          ) {
            newErrors[field.id] = `${field.label} est obligatoire`;
          }
        } else if (field.type === 'textarea') {
          // For textarea, check for empty string or only whitespace
          if (
            value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '')
          ) {
            newErrors[field.id] = `${field.label} est obligatoire`;
          }
        } else if (field.type === 'email') {
          // For email, check for empty and valid email format
          if (
            value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '')
          ) {
            newErrors[field.id] = `${field.label} est obligatoire`;
          } else if (
            typeof value === 'string' &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
          ) {
            newErrors[field.id] = `${field.label} doit être une adresse email valide`;
          }
        } else {
          // For other fields, check for empty string or falsy value
          if (
            value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '')
          ) {
        newErrors[field.id] = `${field.label} est obligatoire`;
          }
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check time restrictions first
    if (!isWithinTimeRestrictions()) {
      showError('Ce formulaire ne peut pas être soumis en dehors des heures autorisées.');
      return;
    }
    
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        // If in edit mode, use the onSubmit callback (which should handle updates)
        if (isEditMode) {
          onSubmit(answers, fileAttachments);
          return;
        }

        // ALWAYS treat as draft submission - no direct Firebase upload
        // The parent component will handle the actual submission
        onSubmit(answers, fileAttachments);

      } catch (error) {
        console.error('❌ Error storing form response:', error);
        showError('Erreur lors de la sauvegarde de la réponse. Veuillez réessayer.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };


  const renderField = (field: FormField) => {
    const commonProps = {
      label: field.label + (field.required ? ' *' : ''),
      placeholder: field.placeholder,
      value: String(answers[field.id] || ''),
      error: errors[field.id],
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea 
            key={field.id} 
            {...commonProps}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'number':
        return (
          <Input
            key={field.id}
            {...commonProps}
            type="number"
            value={
              typeof answers[field.id] === 'number' || answers[field.id] === ''
                ? String(answers[field.id])
                : ''
            }
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value;
              handleFieldChange(
                field.id,
                val === '' ? '' : isNaN(Number(val)) ? '' : Number(val)
              );
            }}
          />
        );
      
      case 'email':
        return (
          <Input 
            key={field.id} 
            {...commonProps} 
            type="email"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'date':
        return (
          <Input 
            key={field.id} 
            {...commonProps} 
            type="date"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'select':
        return (
          <Select
            key={field.id}
            {...commonProps}
            options={[
              { value: '', label: 'Sélectionner...' },
              ...(field.options || []).map((option: string) => ({ value: option, label: option }))
            ]}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.id}
              checked={Boolean(answers[field.id])}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.id, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor={field.id} className="text-sm font-medium text-gray-700">
              {field.label} {field.required && '*'}
            </label>
            {errors[field.id] && (
              <span className="text-sm text-red-600">{errors[field.id]}</span>
            )}
          </div>
        );
      
      case 'file': {
        // If current user's package doesn't allow file uploads, render info instead of input
        const canUpload = user ? UserSessionService.canUseFileUploads(user) : false;
        if (!canUpload) {
          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {field.label + (field.required ? ' *' : '')}
              </label>
              <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
                {/* Role-specific messages */}
                {user?.role === 'directeur' ? (
                  <>
                    <strong>📁 Téléversement de fichiers indisponible :</strong> Cette fonctionnalité est disponible à partir du package Starter. 
                    <div className="mt-2">
                      <button 
                        onClick={() => window.location.href = '/packages/manage?section=packages&highlight=starter'}
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        Mettre à niveau vers Starter →
                      </button>
                    </div>
                  </>
                ) : user?.role === 'employe' && user?.hasDirectorDashboardAccess ? (
                  <>
                    <strong>💡 Contactez votre directeur :</strong> En tant qu'employé avec accès directeur, vous ne pouvez pas effectuer de paiements. 
                    Veuillez contacter votre directeur pour mettre à niveau le package et activer les téléversements de fichiers.
                  </>
                ) : (
                  <>
                    <strong>📁 Téléversement de fichiers indisponible :</strong> Cette fonctionnalité n'est pas disponible pour votre rôle actuel. 
                    Contactez votre directeur pour plus d'informations.
                  </>
                )}
              </div>
            </div>
          );
        }
        const fileAnswer = answers[field.id] as {
          fileName?: string;
          fileSize?: number;
          uploaded?: boolean;
        } | null | undefined;
        const progress = uploadProgress[field.id];
        
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label + (field.required ? ' *' : '')}
            </label>
            
            {/* Show file input only when no file is uploaded */}
            {!fileAnswer?.uploaded && (
              <FileInput
                label=""
                value={null}
                onChange={(file: File | null) => handleFileUpload(field.id, file)}
                placeholder={field.placeholder}
                error={errors[field.id]}
                required={field.required}
                acceptedTypes={field.acceptedTypes}
                progress={progress}
              />
            )}
            
            {/* Show completed file with remove option */}
            {fileAnswer?.uploaded && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-700">{fileAnswer.fileName}</span>
                    <span className="text-xs text-gray-500">
                      ({FileUploadService.formatFileSize(fileAnswer.fileSize || 0)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFileRemove(field.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Supprimer le fichier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            
          </div>
        );
      }
      
      case 'calculated': {
        const calculatedValue = answers[field.id] || 0;
        const dependentFields = field.dependsOn || [];
        // const dependentFieldLabels = dependentFields
        //   .map(fieldId => form.fields.find(f => f.id === fieldId)?.label)
        //   .filter(Boolean);
        
        // Get current values of dependent fields for display
        const dependentFieldValues = dependentFields.map(fieldId => {
          const value = answers[fieldId];
          const field = form.fields.find((f: FormField) => f.id === fieldId);
          return { id: fieldId, label: field?.label || fieldId, value: value || 0 };
        });
        
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label + (field.required ? ' *' : '')}
            </label>
            
            {/* Display calculation formula and current values */}
            {field.calculationFormula && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-2">Calcul automatique :</div>
                  <div className="space-y-1">
                    <div><span className="font-mono text-xs bg-white px-2 py-1 rounded border">{convertFormulaToUserFriendly(field.calculationFormula, form.fields)}</span></div>
                    {dependentFieldValues.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium">Valeurs actuelles :</span>
                        <div className="mt-1 space-y-1">
                          {dependentFieldValues.map(({ label, value }) => (
                            <div key={label} className="flex justify-between">
                              <span>{label}:</span>
                              <span className="font-mono">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-1 border-t border-blue-200">
                      <span className="font-medium">Résultat :</span>
                      <span className="font-mono ml-2 text-lg font-bold">{String(calculatedValue)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="relative">
              <Input
                {...commonProps}
                type="number"
                value={String(calculatedValue)}
                readOnly
                className="bg-gray-50 border-gray-300 pr-10 w-full"
                placeholder="Calculé automatiquement"
                aria-label="Valeur calculée"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Calculator className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            {errors[field.id] && (
              <span className="text-sm text-red-600">{errors[field.id]}</span>
            )}
          </div>
        );
      }
      
      default: {
        return (
          <Input 
            key={field.id} 
            {...commonProps} 
            type="text"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.id, e.target.value)}
          />
        );
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 break-words">{form.title}</h2>
          {form.description && (
            <p className="text-sm sm:text-base text-gray-600 break-words">{form.description}</p>
          )}
          
          {/* Time Restrictions Notice */}
          {form.timeRestrictions && formatTimeRestrictions(form.timeRestrictions) && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isWithinTimeRestrictions() 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start space-x-2">
                {isWithinTimeRestrictions() ? (
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    isWithinTimeRestrictions() ? 'text-blue-800' : 'text-yellow-800'
                  }`}>
                    {isWithinTimeRestrictions() ? '⏰ Période autorisée' : '⚠️ Période restreinte'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isWithinTimeRestrictions() ? 'text-blue-700' : 'text-yellow-700'
                  }`}>
                    Ce formulaire peut être rempli {formatTimeRestrictions(form.timeRestrictions)}.
                    {!isWithinTimeRestrictions() && (
                      <span className="block mt-1 font-medium">
                        Vous êtes actuellement en dehors de cette période.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* File Attachments Display */}
          {fileAttachments.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                📎 Fichiers joints ({fileAttachments.length})
              </h3>
              <div className="space-y-2">
                {fileAttachments.map((attachment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-blue-200 rounded-md">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">
                        {attachment.fileType === 'application/pdf' ? '📄' : '📎'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{attachment.fileName}</p>
                        <p className="text-xs text-gray-500">
                          {attachment.fileType === 'application/pdf' ? 'Document PDF' : 'Fichier joint'}
                          {attachment.fileSize && ` • ${(attachment.fileSize / 1024).toFixed(1)} KB`}
                          {attachment.textExtractionStatus && (
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                              attachment.textExtractionStatus === 'completed' 
                                ? 'bg-green-100 text-green-700' 
                                : attachment.textExtractionStatus === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {attachment.textExtractionStatus === 'completed' 
                                ? '✅ Texte extrait' 
                                : attachment.textExtractionStatus === 'failed'
                                ? '❌ Erreur extraction'
                                : '⏳ Extraction...'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {attachment.downloadUrl && (
                        <button
                          onClick={async () => {
                            try {
                              const blobUrl = await getFileBlobUrl(attachment);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = attachment.fileName;
                              link.click();
                              URL.revokeObjectURL(blobUrl);
                            } catch (error) {
                              console.error('Download failed:', error);
                            }
                          }}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          📥 Télécharger
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const visibleFieldsToRender = form.fields.filter((field: FormField) => visibleFields.includes(field.id));
            
            
            return visibleFieldsToRender.map((field: FormField) => renderField(field));
          })()}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200">
            <Button 
              type="submit" 
              className="w-full sm:flex-1"
              disabled={!isWithinTimeRestrictions() || isLoading || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enregistrement...
                </>
              ) : isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isDraft ? 'Sauvegarde...' : isEditMode ? 'Modification...' : 'Ajout en cours...'}
                </>
              ) : !isWithinTimeRestrictions() 
                ? 'Soumission non autorisée' 
                : isDraft 
                  ? 'Sauvegarder le brouillon' 
                  : isEditMode
                    ? 'Modifier la réponse'
                    : 'Ajouter la réponse'
              }
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
              Annuler
            </Button>
          </div>
        </form>
      </Card>
      
      <TextExtractionReviewModal
        isOpen={imageTextModal.isOpen}
        title="Vérifier le texte extrait"
        fileName={imageTextModal.fileName}
        extractedText={imageTextModal.text}
        onAccept={acceptExtractedText}
        onReupload={reuploadImage}
        onClose={() => setImageTextModal({ isOpen: false, fieldId: null, fileName: undefined, text: '' })}
      />
    </div>
  );
};