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
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

interface DynamicFormProps {
  form: Form;
  onSubmit: (answers: Record<string, any>) => void;
  onCancel: () => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  form,
  onSubmit,
  onCancel
}) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});

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

      // Upload file
      const attachment = await FileUploadService.uploadFile(
        file,
        fieldId,
        form.id,
        user.id,
        user.agencyId,
        (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            [fieldId]: progress
          }));
        }
      );

      // Add to attachments
      setFileAttachments(prev => {
        // Remove existing attachment for this field
        const filtered = prev.filter(att => att.fieldId !== fieldId);
        return [...filtered, attachment];
      });

      // Update answers with file info
      setAnswers(prev => ({
        ...prev,
        [fieldId]: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploaded: true
        }
      }));

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Include file attachments in submission
      const submissionData = {
        ...answers,
        fileAttachments: fileAttachments
      };
      onSubmit(submissionData);
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
            <FileInput
              label={field.label + (field.required ? ' *' : '')}
              value={fileAnswer?.uploaded ? new File([], fileAnswer.fileName) : null}
              onChange={(file) => handleFileUpload(field.id, file)}
              placeholder={field.placeholder}
              error={errors[field.id]}
              required={field.required}
              acceptedTypes={field.acceptedTypes}
            />
            
            {/* Upload Progress */}
            {progress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  {progress.status === 'uploading' && (
                    <Upload className="h-4 w-4 text-blue-600 animate-pulse" />
                  )}
                  {progress.status === 'completed' && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  {progress.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm text-gray-700">{progress.fileName}</span>
                  {progress.status === 'uploading' && (
                    <span className="text-xs text-blue-600">{progress.progress}%</span>
                  )}
                </div>
                {progress.status === 'error' && progress.error && (
                  <p className="text-xs text-red-600 mt-1">{progress.error}</p>
                )}
              </div>
            )}
            
            {/* File Preview */}
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
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {form.fields.map(field => renderField(field))}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200">
            <Button type="submit" className="w-full sm:flex-1">
              Soumettre le formulaire
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