import React, { useState, useEffect, useCallback } from 'react';
import { Form, FormField, FileAttachment } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { FileInput } from './FileInput';
import { FileUploadService, UploadProgress } from '../services/fileUploadService';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, Clock, AlertTriangle, Loader2, Calculator, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { ExpressionCalculator } from '../utils/ExpressionCalculator';
import { TextExtractionModal } from './modals/TextExtractionModal';
import { ConditionalLogicEvaluator } from '../utils/ConditionalLogicEvaluator';

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
  const { submitFormEntry } = useApp();
  const { showError, showSuccess } = useToast();
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>(initialFileAttachments);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleFields, setVisibleFields] = useState<string[]>(form.fields.map((f: FormField) => f.id));
  
  // Function to update visible fields based on conditional logic
  const updateVisibleFields = useCallback((currentAnswers: Record<string, unknown>) => {
    const visible = ConditionalLogicEvaluator.getVisibleFields(form.fields, currentAnswers);
    console.log('🔍 Updating visible fields:', {
      currentAnswers,
      visibleFields: visible,
      formFields: form.fields.map((f: FormField) => ({ id: f.id, label: f.label, conditionalLogic: f.conditionalLogic }))
    });
    setVisibleFields(visible);
  }, [form.fields]);

  // Update visible fields when answers or form.fields change
  useEffect(() => {
    updateVisibleFields(answers);
  }, [answers, form.fields, updateVisibleFields]);
  
  // Text extraction modal state
  const [textExtractionModal, setTextExtractionModal] = useState<{
    isOpen: boolean;
    fileName: string;
    extractedText: string;
    extractionStatus: 'completed' | 'failed';
    confidence?: number;
    error?: string;
    fileSize: number;
    engine?: string;
    pages?: number; // For PDF files
    fileType?: 'image' | 'pdf'; // To distinguish between image and PDF
    extractionStats?: {
      totalCharacters: number;
      totalWords: number;
      averageWordsPerPage: number;
      extractionTime: number;
      tablesDetected: number;
    };
    pendingSubmission?: boolean; // Track if we're waiting for user to proceed
  }>({
    isOpen: false,
    fileName: '',
    extractedText: '',
    extractionStatus: 'failed',
    fileSize: 0,
    pendingSubmission: false
  });
  

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
      timeStr = `entre ${restrictions.startTime} et ${restrictions.endTime}`;
    } else if (restrictions.startTime) {
      timeStr = `à partir de ${restrictions.startTime}`;
    } else if (restrictions.endTime) {
      timeStr = `jusqu'à ${restrictions.endTime}`;
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
    if (form.timeRestrictions.startTime && form.timeRestrictions.endTime) {
      return currentTime >= form.timeRestrictions.startTime && currentTime <= form.timeRestrictions.endTime;
    } else if (form.timeRestrictions.startTime) {
      return currentTime >= form.timeRestrictions.startTime;
    } else if (form.timeRestrictions.endTime) {
      return currentTime <= form.timeRestrictions.endTime;
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
      setAnswers(recalculatedAnswers);
    }
  }, [form.fields, answers, recalculateAllCalculatedFields]); // Recalculate when form fields or answers change

  const handleFileUpload = async (fieldId: string, file: File | null) => {
    if (!file || !user) return;

    try {
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

      // Process file locally (extract text, no Firebase upload yet)
        const attachment = await FileUploadService.uploadFile(
          file,
          fieldId,
          form.id,
          user?.id || '',
          user?.agencyId || '',
          (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [fieldId]: progress
            }));
          },
          (pdfResult) => {
            console.log('🔍 PDF extraction callback received:', pdfResult);
            // Show text extraction modal for PDFs as well
            setTextExtractionModal({
              isOpen: true,
              fileName: pdfResult.fileName,
              extractedText: pdfResult.extractedText,
              extractionStatus: pdfResult.extractionStatus,
              error: pdfResult.error,
              fileSize: pdfResult.fileSize,
              pages: pdfResult.pages,
              fileType: 'pdf',
              extractionStats: pdfResult.extractionStats,
              pendingSubmission: true // Mark as part of submission flow
            });
            console.log('✅ PDF text extraction modal state updated');
          },
          (imageResult) => {
            console.log('🔍 Image extraction callback received:', imageResult);
            // Show text extraction modal as part of form submission flow
            setTextExtractionModal({
              isOpen: true,
              fileName: imageResult.fileName,
              extractedText: imageResult.extractedText,
              extractionStatus: imageResult.extractionStatus,
              confidence: imageResult.confidence,
              error: imageResult.error,
              fileSize: imageResult.fileSize,
              engine: imageResult.engine,
              fileType: 'image',
              pendingSubmission: true // Mark as part of submission flow
            });
            console.log('✅ Text extraction modal state updated');
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
      setErrors(prev => ({
        ...prev,
        [fieldId]: error instanceof Error ? error.message : 'Upload failed'
      }));
    }
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

        // Only submit to Firebase if it's NOT a draft and NOT in edit mode
        if (!isDraft) {
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
          // const userData = userDoc.data();

          // Submit to Firebase via AppContext
          const formEntryData = {
            formId: form.id,
            answers: answers,
            fileAttachments: fileAttachments
          };

          // Submit to Firebase via AppContext
          await submitFormEntry(formEntryData);

        }

        // Always call the onSubmit prop (parent handles draft vs final submission)
        onSubmit(answers, fileAttachments);

      } catch (error) {
        console.error('❌ Error storing form response:', error);
        showError('Erreur lors de la sauvegarde de la réponse. Veuillez réessayer.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleProceedWithSubmission = () => {
    // Close the modal and allow user to continue filling the form
    setTextExtractionModal(prev => ({ ...prev, isOpen: false, pendingSubmission: false }));
    
    // Show a success message to inform user they can continue
    showSuccess('Texte extrait avec succès ! Vous pouvez continuer à remplir le formulaire.');
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
                    <div><span className="font-mono text-xs bg-white px-2 py-1 rounded border">{field.calculationFormula}</span></div>
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
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {attachment.textExtractionStatus === 'completed' ? '✅ Texte extrait' : '⏳ Extraction...'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {attachment.downloadUrl && (
                        <a
                          href={attachment.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          📥 Télécharger
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const visibleFieldsToRender = form.fields.filter((field: FormField) => visibleFields.includes(field.id));
            console.log('🎨 Rendering fields:', {
              allFields: form.fields.map((f: FormField) => ({ id: f.id, label: f.label })),
              visibleFields,
              visibleFieldsToRender: visibleFieldsToRender.map((f: FormField) => ({ id: f.id, label: f.label }))
            });
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
      
      {/* Text Extraction Modal */}
      <TextExtractionModal
        isOpen={textExtractionModal.isOpen}
        onClose={() => setTextExtractionModal(prev => ({ ...prev, isOpen: false }))}
        onProceed={handleProceedWithSubmission}
        fileName={textExtractionModal.fileName}
        extractedText={textExtractionModal.extractedText}
        extractionStatus={textExtractionModal.extractionStatus}
        confidence={textExtractionModal.confidence}
        error={textExtractionModal.error}
        fileSize={textExtractionModal.fileSize}
        engine={textExtractionModal.engine}
        pages={textExtractionModal.pages}
        fileType={textExtractionModal.fileType}
        extractionStats={textExtractionModal.extractionStats}
      />
      
    </div>
  );
};