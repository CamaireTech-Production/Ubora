import React, { useCallback } from 'react';
import { FormField } from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Trash2, Calculator, Database, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { FormulaInput } from '../FormulaInput';
import { ConditionalLogicBuilder } from '../ConditionalLogicBuilder';
import { FileTypeSelector } from '../../core/FileTypeSelector';
import { FieldCSVImport } from '../../csv-import/FieldCSVImport';
import { FormulaParser } from '@ubora/shared/utils/FormulaParser';
import { logger } from '@ubora/shared/utils/logger';

interface FormFieldEditorProps {
  field: FormField;
  index: number;
  allFields: FormField[];
  onUpdate: (fieldId: string, updates: Partial<FormField>) => void;
  onRemove: (fieldId: string) => void;
  onMove?: (fieldId: string, direction: 'up' | 'down') => void;
  canUseFileUploads: boolean;
  availableLists: any[];
  loadingLists?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const FormFieldEditor: React.FC<FormFieldEditorProps> = ({
  field,
  index,
  allFields,
  onUpdate,
  onRemove,
  onMove,
  canUseFileUploads,
  availableLists,
  loadingLists = false,
  canMoveUp = false,
  canMoveDown = false
}) => {
  // Helper functions for select field options
  const addOption = () => {
    const options = field.options || [];
    onUpdate(field.id, { options: ['', ...options] });
  };

  const updateOption = (optionIndex: number, value: string) => {
    if (field.options) {
      const newOptions = [...field.options];
      newOptions[optionIndex] = value;
      onUpdate(field.id, { options: newOptions });
    }
  };

  const removeOption = (optionIndex: number) => {
    if (field.options) {
      const newOptions = field.options.filter((_, idx) => idx !== optionIndex);
      onUpdate(field.id, { options: newOptions });
    }
  };

  const handleFieldOptionsUpdate = (newOptions: string[]) => {
    onUpdate(field.id, { options: newOptions });
  };

  const handleFormulaChange = useCallback((formula: string, fieldIds: string[]) => {
    // Validate dependencies
    const invalidDeps = fieldIds.filter(id => 
      !allFields.find(f => f.id === id && ['number', 'calculated'].includes(f.type))
    );
    
    if (invalidDeps.length > 0) {
      logger.warn('Invalid dependencies detected', { invalidDeps }, 'FormFieldEditor');
      return;
    }
    
    // Check for circular dependencies
    if (FormulaParser.hasCircularDependency(field.id, fieldIds, allFields)) {
      logger.warn('Circular dependency detected', null, 'FormFieldEditor');
      return;
    }
    
    onUpdate(field.id, { 
      calculationFormula: formula,
      dependsOn: fieldIds,
      userFormula: FormulaParser.convertToUserFormula(formula, allFields)
    });
  }, [field.id, allFields, onUpdate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900">Champ {index + 1}</h4>
          <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
            ID: {field.id}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {onMove && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onMove(field.id, 'up')}
                disabled={!canMoveUp}
                title="Déplacer vers le haut"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onMove(field.id, 'down')}
                disabled={!canMoveDown}
                title="Déplacer vers le bas"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => onRemove(field.id)}
            className="flex items-center space-x-1"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Libellé du champ *"
          value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
          placeholder="Ex: Montant des ventes"
          required
        />
        
        <Select
          label="Type de champ"
          value={field.type}
          onChange={(e) => onUpdate(field.id, { type: e.target.value as FormField['type'] })}
          options={[
            { value: 'text', label: 'Texte' },
            { value: 'number', label: 'Nombre' },
            { value: 'email', label: 'Email' },
            { value: 'date', label: 'Date' },
            { value: 'textarea', label: 'Texte long' },
            { value: 'select', label: 'Liste déroulante' },
            { value: 'checkbox', label: 'Case à cocher' },
            ...(canUseFileUploads ? [{ value: 'file', label: 'Fichier' }] : []),
            { value: 'calculated', label: 'Champ calculé' },
          ]}
        />
      </div>
      
      <Input
        label="Placeholder"
        value={field.placeholder || ''}
        onChange={(e) => onUpdate(field.id, { placeholder: e.target.value })}
        placeholder="Texte d'aide..."
      />

      {/* Select field options */}
      {field.type === 'select' && (
        <div className="space-y-4">
          {/* Toggle between Manual Options and List */}
          <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`option-type-${field.id}`}
                checked={field.listId === undefined}
                onChange={() => {
                  const currentField = allFields.find(f => f.id === field.id);
                  onUpdate(field.id, { 
                    listId: undefined, 
                    displayColumnId: undefined,
                    options: currentField?.options && currentField.options.length > 0 
                      ? currentField.options 
                      : ['']
                  });
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Options manuelles</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`option-type-${field.id}`}
                checked={field.listId !== undefined}
                onChange={() => {
                  if (availableLists.length === 0) {
                    logger.warn('Aucune liste disponible pour ce champ', null, 'FormFieldEditor');
                    return;
                  }
                  
                  onUpdate(field.id, {
                    listId: '',
                    displayColumnId: undefined,
                    options: undefined
                  });
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={availableLists.length === 0}
              />
              <span className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                <Database className="h-4 w-4" />
                <span>Utiliser une Liste</span>
              </span>
            </label>
          </div>

          {/* Manual Options Section */}
          {field.listId === undefined && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Options de la liste *
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addOption}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {(field.options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center space-x-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeOption(optionIndex)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              {(!field.options || field.options.length === 0 || field.options.every(opt => !opt.trim())) && (
                <p className="text-sm text-red-600 mt-1">
                  Veuillez ajouter au moins une option pour cette liste déroulante
                </p>
              )}
              
              {/* CSV Import Option */}
              <FieldCSVImport
                fieldId={field.id}
                fieldLabel={field.label}
                currentOptions={field.options || []}
                onOptionsUpdate={handleFieldOptionsUpdate}
              />
            </div>
          )}

          {/* List Selection Section */}
          {field.listId !== undefined && (
            <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Database className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Configuration de la Liste</h4>
              </div>

              {/* List Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sélectionner une Liste *
                </label>
                <select
                  value={field.listId || ''}
                  onChange={(e) => {
                    const selectedListId = e.target.value;
                    if (!selectedListId) {
                      onUpdate(field.id, {
                        listId: undefined,
                        displayColumnId: undefined
                      });
                      return;
                    }
                    
                    const selectedList = availableLists.find(l => l.id === selectedListId);
                    if (selectedList && selectedList.columns.length > 0) {
                      onUpdate(field.id, {
                        listId: selectedListId,
                        displayColumnId: selectedList.columns[0].id,
                        options: undefined
                      });
                    }
                  }}
                  disabled={loadingLists && availableLists.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingLists && availableLists.length === 0 ? 'Chargement...' : availableLists.length === 0 ? 'Aucune liste disponible' : 'Sélectionner une liste'}
                  </option>
                  {availableLists.map(list => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.columns.length} colonnes, {list.rows.length} lignes)
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Column Selection */}
              {field.listId && field.listId !== '' && (() => {
                const selectedList = availableLists.find(l => l.id === field.listId);
                return selectedList && selectedList.columns.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Colonne à afficher dans le menu déroulant *
                    </label>
                    <select
                      value={field.displayColumnId || ''}
                      onChange={(e) => {
                        const newDisplayColumnId = e.target.value;
                        onUpdate(field.id, { 
                          displayColumnId: newDisplayColumnId || undefined,
                          listId: field.listId
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    >
                      <option value="">Sélectionner une colonne</option>
                      {selectedList.columns.map(col => (
                        <option key={col.id} value={col.id}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    Aucune liste sélectionnée ou la liste n'a pas de colonnes
                  </p>
                );
              })()}

              {field.listId && field.displayColumnId && (() => {
                const selectedList = availableLists.find(l => l.id === field.listId);
                const displayColumn = selectedList?.columns.find(c => c.id === field.displayColumnId);
                
                if (selectedList && displayColumn) {
                  return (
                    <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-600 mb-2">
                        <strong>Note:</strong> Lorsque l'utilisateur sélectionne une valeur, l'ensemble de la ligne sera stocké dans les réponses du formulaire.
                      </p>
                      <p className="text-xs text-gray-500">
                        Colonne d'affichage: <strong>{displayColumn.name}</strong> ({displayColumn.type})
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Données complètes: {selectedList.rows.length} ligne(s) disponibles
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {availableLists.length === 0 && !loadingLists && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Aucune liste disponible. <a href="/lists/create" className="underline font-medium">Créer une liste</a>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* File field configuration */}
      {field.type === 'file' && canUseFileUploads && (
        <FileTypeSelector
          label="Types de fichiers acceptés"
          selectedTypes={field.acceptedTypes || []}
          onChange={(types) => onUpdate(field.id, { acceptedTypes: types })}
        />
      )}

      {/* Calculated field configuration */}
      {field.type === 'calculated' && (
        <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            <h4 className="font-medium text-blue-900">Configuration du champ calculé</h4>
          </div>
          
          <FormulaInput
            value={field.calculationFormula || ''}
            onChange={(formula: string, fieldIds: string[]) => handleFormulaChange(formula, fieldIds)}
            fields={allFields}
            currentFieldId={field.id}
          />

          {/* Show field dependencies for reference */}
          {field.dependsOn && field.dependsOn.length > 0 && (
            <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Champs utilisés dans la formule :</p>
              <div className="flex flex-wrap gap-2">
                {field.dependsOn.map(fieldId => {
                  const dependentField = allFields.find(f => f.id === fieldId);
                  return dependentField ? (
                    <div key={fieldId} className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      <span>{dependentField.label}</span>
                      <span className="text-blue-600">({dependentField.type})</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}
      
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Champ obligatoire</span>
      </label>

      {/* Conditional Logic Section */}
      <div className="border-t pt-4">
        <ConditionalLogicBuilder
          field={field}
          allFields={allFields}
          availableLists={availableLists}
          onUpdate={(conditionalLogic) => onUpdate(field.id, { conditionalLogic })}
        />
      </div>
    </div>
  );
};

