import React from 'react';
import { FormDefinition, FormField, ListDefinition } from '@ubora/shared/types';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';

interface FormPreviewProps {
  form: FormDefinition;
  universLists?: ListDefinition[];
}

/**
 * FormPreview component - displays a read-only preview of a form
 * Shows all fields as they would appear when rendered, but in preview mode
 */
export const FormPreview: React.FC<FormPreviewProps> = ({ form, universLists = [] }) => {
  if (!form.fields || form.fields.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Aucun champ dans ce formulaire</p>
      </div>
    );
  }

  const renderField = (field: FormField) => {
    const commonProps = {
      label: field.label + (field.required ? ' *' : ''),
      placeholder: field.placeholder || '',
      value: '', // Empty value for preview
      disabled: true, // Disabled for preview
      className: 'bg-gray-50 cursor-not-allowed',
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            key={field.id}
            {...commonProps}
            value=""
            readOnly
          />
        );

      case 'number':
        return (
          <Input
            key={field.id}
            {...commonProps}
            type="number"
            value=""
            readOnly
          />
        );

      case 'email':
        return (
          <Input
            key={field.id}
            {...commonProps}
            type="email"
            value=""
            readOnly
          />
        );

      case 'date':
        return (
          <Input
            key={field.id}
            {...commonProps}
            type="date"
            value=""
            readOnly
          />
        );

      case 'select':
        // Check if this field uses a List
        let options: Array<{ value: string; label: string }> = [];
        
        if (field.listId && universLists.length > 0) {
          // Find the list
          const list = universLists.find(l => l.id === field.listId);
          if (list && list.rows && list.rows.length > 0) {
            // Find the display column
            const displayColumn = list.columns.find(col => {
              const colId = (col as any).id;
              return colId === field.displayColumnId;
            }) || list.columns[0];
            
            if (displayColumn) {
              const displayColumnId = (displayColumn as any).id;
              // Build options from list rows
              options = list.rows.map((row, index) => {
                const displayValue = displayColumnId 
                  ? String((row as any)[displayColumnId] || '')
                  : String(row[displayColumn as any] || '');
                return {
                  value: `list-${index}`,
                  label: displayValue || `Ligne ${index + 1}`
                };
              });
            }
          }
        }
        
        // Fallback to manual options if no list found
        if (options.length === 0) {
          options = field.options 
            ? field.options.map((opt) => ({
                value: typeof opt === 'string' ? opt : (opt as any).label || (opt as any).value || String(opt),
                label: typeof opt === 'string' ? opt : (opt as any).label || (opt as any).value || String(opt),
              }))
            : [{ value: '', label: 'Sélectionner...' }];
        } else {
          // Add default option at the beginning
          options = [{ value: '', label: 'Sélectionner...' }, ...options];
        }

        return (
          <Select
            key={field.id}
            {...commonProps}
            value=""
            options={options}
            disabled
          />
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.id}
              disabled
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-not-allowed bg-gray-50"
            />
            <label htmlFor={field.id} className="text-sm font-medium text-gray-700">
              {field.label} {field.required && '*'}
            </label>
          </div>
        );

      case 'file':
        return (
          <div key={field.id} className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && ' *'}
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed text-gray-500 text-sm">
              {field.placeholder || 'Aucun fichier sélectionné'}
            </div>
            {field.acceptedTypes && field.acceptedTypes.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Types acceptés: {field.acceptedTypes.join(', ')}
              </p>
            )}
          </div>
        );

      case 'calculated':
        return (
          <div key={field.id} className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && ' *'}
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed text-gray-500 text-sm">
              {field.userFormula || field.calculationFormula || 'Champ calculé'}
            </div>
            {field.userFormula && (
              <p className="mt-1 text-xs text-gray-500">
                Formule: {field.userFormula}
              </p>
            )}
          </div>
        );

      case 'text':
      default:
        return (
          <Input
            key={field.id}
            {...commonProps}
            type="text"
            value=""
            readOnly
          />
        );
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          {form.fields.map((field) => renderField(field))}
        </div>
      </div>
      <div className="text-xs text-gray-500 text-center py-2">
        Aperçu du formulaire - Les champs sont en lecture seule
      </div>
    </div>
  );
};

