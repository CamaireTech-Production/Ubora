import React from 'react';
import { ConditionalRule, FormField, List } from '../../types';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Trash2 } from 'lucide-react';

interface ConditionRuleProps {
  condition: ConditionalRule;
  availableFields: FormField[];
  availableLists?: List[]; // Lists available for select fields
  onUpdate: (condition: ConditionalRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export const ConditionRule: React.FC<ConditionRuleProps> = ({
  condition,
  availableFields,
  availableLists = [],
  onUpdate,
  onRemove,
  canRemove
}) => {
  const selectedField = availableFields.find(f => f.id === condition.fieldId);

  const getOperatorsForFieldType = (fieldType: string) => {
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'textarea':
        return [
          { value: 'equals', label: 'Égal à' },
          { value: 'not_equals', label: 'Différent de' },
          { value: 'contains', label: 'Contient' },
          { value: 'not_contains', label: 'Ne contient pas' },
          { value: 'is_empty', label: 'Est vide' },
          { value: 'is_not_empty', label: 'N\'est pas vide' }
        ];
      
      case 'number':
        return [
          { value: 'equals', label: 'Égal à' },
          { value: 'not_equals', label: 'Différent de' },
          { value: 'greater_than', label: 'Supérieur à' },
          { value: 'less_than', label: 'Inférieur à' },
          { value: 'greater_equal', label: 'Supérieur ou égal à' },
          { value: 'less_equal', label: 'Inférieur ou égal à' },
          { value: 'is_empty', label: 'Est vide' },
          { value: 'is_not_empty', label: 'N\'est pas vide' }
        ];
      
      case 'select':
        return [
          { value: 'equals', label: 'Égal à' },
          { value: 'not_equals', label: 'Différent de' },
          { value: 'is_empty', label: 'Est vide' },
          { value: 'is_not_empty', label: 'N\'est pas vide' }
        ];
      
      case 'checkbox':
        return [
          { value: 'equals', label: 'Égal à' },
          { value: 'not_equals', label: 'Différent de' }
        ];
      
      case 'date':
        return [
          { value: 'equals', label: 'Égal à' },
          { value: 'not_equals', label: 'Différent de' },
          { value: 'greater_than', label: 'Après' },
          { value: 'less_than', label: 'Avant' },
          { value: 'greater_equal', label: 'Après ou égal à' },
          { value: 'less_equal', label: 'Avant ou égal à' },
          { value: 'is_empty', label: 'Est vide' },
          { value: 'is_not_empty', label: 'N\'est pas vide' }
        ];
      
      default:
        return [
          { value: 'equals', label: 'Égal à' },
          { value: 'not_equals', label: 'Différent de' },
          { value: 'is_empty', label: 'Est vide' },
          { value: 'is_not_empty', label: 'N\'est pas vide' }
        ];
    }
  };

  const needsValue = !['is_empty', 'is_not_empty'].includes(condition.operator);

  const renderValueInput = () => {
    if (!needsValue || !selectedField) return null;

    switch (selectedField.type) {
      case 'number':
        return (
          <Input
            type="number"
            value={typeof condition.value === 'number' ? condition.value.toString() : ''}
            onChange={(e) => onUpdate({
              ...condition,
              value: parseFloat(e.target.value) || 0
            })}
            placeholder="Valeur numérique"
            className="flex-1"
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={typeof condition.value === 'string' ? condition.value : ''}
            onChange={(e) => onUpdate({
              ...condition,
              value: e.target.value
            })}
            className="flex-1"
          />
        );
      
      case 'checkbox':
        return (
          <Select
            value={condition.value ? 'true' : 'false'}
            onChange={(e) => onUpdate({
              ...condition,
              value: e.target.value === 'true'
            })}
            options={[
              { value: 'true', label: 'Coché' },
              { value: 'false', label: 'Non coché' }
            ]}
            className="flex-1"
          />
        );
      
      case 'select':
        // Check if field uses a list
        if (selectedField?.listId && availableLists.length > 0) {
          const list = availableLists.find(l => l.id === selectedField.listId);
          if (list) {
            // Find display column (use displayColumnId or first column)
            const displayColumn = list.columns.find(c => c.id === selectedField.displayColumnId) || list.columns[0];
            if (displayColumn) {
              // Extract options from list rows
              const listOptions = list.rows.map((row, index) => {
                const displayValue = String(row[displayColumn.id] || '');
                return {
                  value: displayValue,
                  label: displayValue || `Ligne ${index + 1}`
                };
              });
              
              return (
                <Select
                  value={typeof condition.value === 'string' ? condition.value : ''}
                  onChange={(e) => onUpdate({
                    ...condition,
                    value: e.target.value
                  })}
                  options={[
                    { value: '', label: 'Sélectionner...' },
                    ...listOptions
                  ]}
                  className="flex-1"
                />
              );
            }
          }
        }
        
        // Fallback: use manual options (existing behavior)
        return (
          <Select
            value={typeof condition.value === 'string' ? condition.value : ''}
            onChange={(e) => onUpdate({
              ...condition,
              value: e.target.value
            })}
            options={[
              { value: '', label: 'Sélectionner...' },
              ...(selectedField?.options || []).map(option => ({
                value: option,
                label: option
              }))
            ]}
            className="flex-1"
          />
        );
      
      default:
        return (
          <Input
            type="text"
            value={typeof condition.value === 'string' ? condition.value : ''}
            onChange={(e) => onUpdate({
              ...condition,
              value: e.target.value
            })}
            placeholder="Valeur"
            className="flex-1"
          />
        );
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        {/* Field Selection */}
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Champ
          </label>
          <Select
            value={condition.fieldId}
            onChange={(e) => {
              const newField = availableFields.find(f => f.id === e.target.value);
              onUpdate({
                ...condition,
                fieldId: e.target.value,
                fieldType: newField?.type === 'file' || newField?.type === 'calculated' ? 'text' : newField?.type,
                operator: 'equals', // Reset to default operator
                value: undefined // Reset value when field changes
              });
            }}
            options={availableFields.map(field => ({
              value: field.id,
              label: field.label || `Champ ${field.id}`
            }))}
          />
        </div>

        {/* Operator Selection */}
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Condition
          </label>
          <Select
            value={condition.operator}
            onChange={(e) => onUpdate({
              ...condition,
              operator: e.target.value as ConditionalRule['operator'],
              value: ['is_empty', 'is_not_empty'].includes(e.target.value) ? undefined : condition.value
            })}
            options={selectedField ? getOperatorsForFieldType(selectedField.type) : []}
          />
        </div>

        {/* Value Input */}
        {needsValue && (
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valeur
            </label>
            {renderValueInput()}
          </div>
        )}

        {/* Remove Button */}
        {canRemove && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
