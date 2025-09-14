import React, { useState } from 'react';
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
import { Upload, CheckCircle, AlertCircle, X, Clock, AlertTriangle, Loader2 } from 'lucide-react';

interface DynamicFormProps {
  form: Form;
  onSubmit: (answers: Record<string, any>, fileAttachments?: any[]) => void;
  onCancel: () => void;
  initialAnswers?: Record<string, any>;
  initialFileAttachments?: any[];
  isDraft?: boolean;
  isLoading?: boolean;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  form,
  onSubmit,
  onCancel,
  initialAnswers = {},
  initialFileAttachments = [],
  isDraft = false,
  isLoading = false
}) => {
  const { user } = useAuth();
  const { submitFormEntry } = useApp();
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>(initialFileAttachments);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  

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

  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Supprimer l'erreur si le champ est rempli
    if (errors[fieldId] && value) {
      setErrors(prev => ({
        ...prev,
        [fieldId]: ''
      }));
    }
  };

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
            // Log PDF extraction results to console
            console.log('🎉 PDF Text Extraction Completed:', {
              fileName: pdfResult.fileName,
              textLength: pdfResult.extractedText.length,
              pages: pdfResult.pages,
              status: pdfResult.extractionStatus
            });
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

      console.log('🔍 Storing file answer data:', {
        fieldId,
        fileAnswerData,
        attachment
      });

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
    
    form.fields.forEach(field => {
      if (field.required && (!answers[field.id] || answers[field.id].toString().trim() === '')) {
        newErrors[field.id] = `${field.label} est obligatoire`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check time restrictions first
    if (!isWithinTimeRestrictions()) {
      alert('Ce formulaire ne peut pas être soumis en dehors des heures autorisées.');
      return;
    }
    
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        // Only submit to Firebase if it's NOT a draft
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
          const userData = userDoc.data();

          // Submit to Firebase via AppContext
          const formEntryData = {
            formId: form.id,
            answers: answers,
            fileAttachments: fileAttachments
          };

          // Submit to Firebase via AppContext
          await submitFormEntry(formEntryData);

          // Log successful submission
          console.log('🎉 Form Response Successfully Submitted to Firebase!');
          console.log('📋 Response Details:', {
            formId: form.id,
            formTitle: form.title,
            totalAnswers: Object.keys(answers).length,
            fileAttachments: fileAttachments.length,
            userId: currentUser.uid,
            agencyId: userData.agencyId
          });

          // Log file attachment details
          if (fileAttachments.length > 0) {
            console.log('📎 File Attachments Details:');
            fileAttachments.forEach((attachment, index) => {
              console.log(`  ${index + 1}. ${attachment.fileName}`, {
                fieldId: attachment.fieldId,
                fileSize: attachment.fileSize,
                fileType: attachment.fileType,
                downloadUrl: attachment.downloadUrl,
                storagePath: attachment.storagePath,
                hasExtractedText: !!attachment.extractedText,
                textLength: attachment.extractedText?.length || 0,
                extractionStatus: attachment.textExtractionStatus
              });
            });
          }
        }

        // Always call the onSubmit prop (parent handles draft vs final submission)
        onSubmit(answers, fileAttachments);

      } catch (error) {
        console.error('❌ Error storing form response:', error);
        alert('Erreur lors de la sauvegarde de la réponse. Veuillez réessayer.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      label: field.label + (field.required ? ' *' : ''),
      placeholder: field.placeholder,
      value: answers[field.id] || '',
      error: errors[field.id],
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea 
            key={field.id} 
            {...commonProps}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'number':
        return (
          <Input
            key={field.id}
            {...commonProps}
            type="number"
            onChange={(e) => handleFieldChange(field.id, parseFloat(e.target.value) || '')}
          />
        );
      
      case 'email':
        return (
          <Input 
            key={field.id} 
            {...commonProps} 
            type="email"
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'date':
        return (
          <Input 
            key={field.id} 
            {...commonProps} 
            type="date"
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'select':
        return (
          <Select
            key={field.id}
            {...commonProps}
            options={[
              { value: '', label: 'Sélectionner...' },
              ...(field.options || []).map(option => ({ value: option, label: option }))
            ]}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );
      
      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.id}
              checked={answers[field.id] || false}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
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
      
      case 'file':
        const fileAnswer = answers[field.id];
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
                onChange={(file) => handleFileUpload(field.id, file)}
                placeholder={field.placeholder}
                error={errors[field.id]}
                required={field.required}
                acceptedTypes={field.acceptedTypes}
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
                      ({FileUploadService.formatFileSize(fileAnswer.fileSize)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFileRemove(field.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Upload Progress - only show when processing */}
            {progress && progress.status !== 'completed' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  {progress.status === 'uploading' && (
                    <Upload className="h-4 w-4 text-blue-600 animate-pulse" />
                  )}
                  {progress.status === 'extracting' && (
                    <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
                  )}
                  {progress.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm text-gray-700">{progress.fileName}</span>
                  {progress.status === 'uploading' && (
                    <span className="text-xs text-blue-600">{progress.progress}%</span>
                  )}
                  {progress.status === 'extracting' && (
                    <span className="text-xs text-yellow-600">Extraction...</span>
                  )}
                </div>
                {progress.status === 'error' && progress.error && (
                  <p className="text-xs text-red-600 mt-1">{progress.error}</p>
                )}
              </div>
            )}
            
          </div>
        );
      
      default:
        return (
          <Input 
            key={field.id} 
            {...commonProps} 
            type="text"
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );
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
          {form.fields.map(field => renderField(field))}

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
                  {isDraft ? 'Sauvegarde...' : 'Ajout en cours...'}
                </>
              ) : !isWithinTimeRestrictions() 
                ? 'Soumission non autorisée' 
                : isDraft 
                  ? 'Sauvegarder le brouillon' 
                  : 'Ajouter la réponse'
              }
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
              Annuler
            </Button>
          </div>
        </form>
      </Card>
      
    </div>
  );
};