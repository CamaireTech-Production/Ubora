import React, { useState } from 'react';
import { Form, FormField } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';

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
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      onSubmit(answers);
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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{form.title}</h2>
          {form.description && (
            <p className="text-gray-600">{form.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {form.fields.map(field => renderField(field))}

          <div className="flex space-x-4 pt-6 border-t border-gray-200">
            <Button type="submit" className="flex-1">
              Soumettre le formulaire
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};