import React, { useState } from 'react';
import { FormField, ConditionalRule } from '../types';
import { Button } from './Button';
import { Select } from './Select';
import { ConditionRule } from './ConditionRule';
import { Card } from './Card';
import { Plus, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface ConditionalLogicBuilderProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (conditionalLogic: FormField['conditionalLogic']) => void;
}

export const ConditionalLogicBuilder: React.FC<ConditionalLogicBuilderProps> = ({
  field,
  allFields,
  onUpdate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get available fields (exclude current field and calculated fields)
  const availableFields = allFields.filter(f => 
    f.id !== field.id && 
    f.type !== 'calculated' &&
    f.type !== 'file' // File fields are not suitable for conditions
  );

  const conditionalLogic = field.conditionalLogic || {
    isEnabled: false,
    action: 'show' as const,
    operator: 'and' as const,
    conditions: []
  };

  const addCondition = () => {
    if (availableFields.length === 0) return;

    const newCondition: ConditionalRule = {
      id: `condition_${Date.now()}`,
      fieldId: availableFields[0].id,
      operator: 'equals',
      fieldType: availableFields[0].type === 'file' || availableFields[0].type === 'calculated' ? 'text' : availableFields[0].type
    };

    onUpdate({
      ...conditionalLogic,
      conditions: [...conditionalLogic.conditions, newCondition]
    });
  };

  const updateCondition = (index: number, updatedCondition: ConditionalRule) => {
    const newConditions = [...conditionalLogic.conditions];
    newConditions[index] = updatedCondition;
    onUpdate({
      ...conditionalLogic,
      conditions: newConditions
    });
  };

  const removeCondition = (index: number) => {
    const newConditions = conditionalLogic.conditions.filter((_, i) => i !== index);
    onUpdate({
      ...conditionalLogic,
      conditions: newConditions
    });
  };

  const toggleEnabled = () => {
    onUpdate({
      ...conditionalLogic,
      isEnabled: !conditionalLogic.isEnabled
    });
  };

  const updateAction = (action: 'show' | 'hide') => {
    onUpdate({
      ...conditionalLogic,
      action
    });
  };

  const updateOperator = (operator: 'and' | 'or') => {
    onUpdate({
      ...conditionalLogic,
      operator
    });
  };

  const getActionDescription = () => {
    if (!conditionalLogic.isEnabled) return '';
    
    const actionText = conditionalLogic.action === 'show' ? 'afficher' : 'masquer';
    const operatorText = conditionalLogic.operator === 'and' ? 'ET' : 'OU';
    
    if (conditionalLogic.conditions.length === 0) {
      return `Ce champ sera ${actionText} selon les conditions définies.`;
    }
    
    if (conditionalLogic.conditions.length === 1) {
      return `Ce champ sera ${actionText} si la condition est remplie.`;
    }
    
    return `Ce champ sera ${actionText} si toutes les conditions sont remplies (${operatorText}).`;
  };

  if (availableFields.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        Aucun champ disponible pour créer des conditions.
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900">
              Logique conditionnelle
            </h4>
            {conditionalLogic.isEnabled && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                {conditionalLogic.action === 'show' ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                <span className="capitalize">{conditionalLogic.action}</span>
              </div>
            )}
          </div>
          
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs"
          >
            {isExpanded ? 'Masquer' : 'Configurer'}
          </Button>
        </div>

        {/* Description */}
        {conditionalLogic.isEnabled && (
          <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
            {getActionDescription()}
          </div>
        )}

        {/* Toggle Switch */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={conditionalLogic.isEnabled}
              onChange={toggleEnabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Activer la logique conditionnelle
            </span>
          </label>
        </div>

        {/* Configuration Panel */}
        {isExpanded && conditionalLogic.isEnabled && (
          <div className="space-y-4 border-t pt-4">
            {/* Action Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <Select
                  value={conditionalLogic.action}
                  onChange={(e) => updateAction(e.target.value as 'show' | 'hide')}
                  options={[
                    { value: 'show', label: 'Afficher le champ' },
                    { value: 'hide', label: 'Masquer le champ' }
                  ]}
                />
              </div>

              {/* Operator Selection (only show if multiple conditions) */}
              {conditionalLogic.conditions.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Combinaison
                  </label>
                  <Select
                    value={conditionalLogic.operator}
                    onChange={(e) => updateOperator(e.target.value as 'and' | 'or')}
                    options={[
                      { value: 'and', label: 'Toutes les conditions (ET)' },
                      { value: 'or', label: 'Au moins une condition (OU)' }
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Conditions
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addCondition}
                  disabled={availableFields.length === 0}
                  className="text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Ajouter une condition
                </Button>
              </div>

              {conditionalLogic.conditions.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Aucune condition définie</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Cliquez sur "Ajouter une condition" pour commencer
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conditionalLogic.conditions.map((condition, index) => (
                    <div key={condition.id} className="relative">
                      {/* Condition Rule */}
                      <ConditionRule
                        condition={condition}
                        availableFields={availableFields}
                        onUpdate={(updatedCondition) => updateCondition(index, updatedCondition)}
                        onRemove={() => removeCondition(index)}
                        canRemove={conditionalLogic.conditions.length > 1}
                      />
                      
                      {/* Operator indicator for multiple conditions */}
                      {index < conditionalLogic.conditions.length - 1 && (
                        <div className="flex justify-center my-2">
                          <div className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded">
                            {conditionalLogic.operator === 'and' ? 'ET' : 'OU'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Validation Messages */}
            {conditionalLogic.conditions.length > 0 && (
              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <p className="font-medium mb-1">Résumé :</p>
                <p>
                  Ce champ sera <strong>{conditionalLogic.action === 'show' ? 'affiché' : 'masqué'}</strong> quand{' '}
                  {conditionalLogic.conditions.length === 1 ? (
                    'la condition ci-dessus est remplie'
                  ) : (
                    <>
                      <strong>{conditionalLogic.operator === 'and' ? 'toutes' : 'au moins une'}</strong> des conditions ci-dessus{' '}
                      {conditionalLogic.operator === 'and' ? 'sont' : 'est'} remplie{conditionalLogic.operator === 'and' ? 's' : ''}
                    </>
                  )}
                  .
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
