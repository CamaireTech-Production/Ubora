import React, { useState } from 'react';
import { FormField, Form } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { Card } from './Card';
import { FileTypeSelector } from './FileTypeSelector';
import { FieldCSVImport } from './FieldCSVImport';
import { Plus, Trash2, ArrowLeft, AlertCircle, Calculator, Copy, Check } from 'lucide-react';
import { ExpressionCalculator } from '../utils/ExpressionCalculator';

interface FormBuilderProps {
  onSave: (form: {
    id?: string;
    title: string;
    description: string;
    fields: FormField[];
    assignedTo: string[];
  }) => void;
  onCancel: () => void;
  employees: Array<{ id: string; name: string; email: string }>;
  initialForm?: Pick<Form, 'id' | 'title' | 'description' | 'fields' | 'assignedTo'>;
  isLoading?: boolean;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  onSave,
  onCancel,
  employees,
  initialForm,
  isLoading = false
}) => {
  // Initialiser les états avec les valeurs du formulaire existant ou vides
  const [title, setTitle] = useState(initialForm?.title || '');
  const [description, setDescription] = useState(initialForm?.description || '');
  const [assignedTo, setAssignedTo] = useState<string[]>(initialForm?.assignedTo || []);
  const [fields, setFields] = useState<FormField[]>(initialForm?.fields || []);
  const [errors, setErrors] = useState<string[]>([]);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [formulaValidation, setFormulaValidation] = useState<Record<string, { isValid: boolean; error?: string }>>({});

  // Déterminer le mode (création ou édition)
  const isEditMode = !!initialForm;

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(field => field.id !== id));
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  const addOption = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const options = field.options || [];
      updateField(fieldId, { options: ['', ...options] });
    }
  };

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && field.options) {
      const newOptions = [...field.options];
      newOptions[optionIndex] = value;
      updateField(fieldId, { options: newOptions });
    }
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && field.options) {
      const newOptions = field.options.filter((_, index) => index !== optionIndex);
      updateField(fieldId, { options: newOptions });
    }
  };

  const toggleEmployeeAssignment = (employeeId: string) => {
    setAssignedTo(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleFieldOptionsUpdate = (fieldId: string, newOptions: string[]) => {
    updateField(fieldId, { options: newOptions });
  };

  const copyFieldId = async (fieldId: string) => {
    try {
      await navigator.clipboard.writeText(fieldId);
      setCopiedFieldId(fieldId);
      setTimeout(() => setCopiedFieldId(null), 2000);
    } catch (err) {
      console.error('Failed to copy field ID:', err);
    }
  };

  const generateFormula = (calculationType: string, dependsOn: string[]) => {
    if (!dependsOn || dependsOn.length === 0) return '';
    
    switch (calculationType) {
      case 'sum':
        return dependsOn.join(' + ');
      case 'average':
        return `(${dependsOn.join(' + ')}) / ${dependsOn.length}`;
      case 'multiply':
        return dependsOn.join(' * ');
      case 'percentage':
        return dependsOn.length > 0 ? `${dependsOn[0]} * 0.1` : '';
      default:
        return '';
    }
  };

  const validateFormula = (fieldId: string, formula: string) => {
    const validation = ExpressionCalculator.validateFormula(formula, fields);
    setFormulaValidation(prev => ({
      ...prev,
      [fieldId]: validation
    }));
    return validation;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation avec messages d'erreur détaillés
    const validationErrors: string[] = [];
    
    if (!title.trim()) {
      validationErrors.push('Le titre du formulaire est obligatoire');
    }
    
    if (assignedTo.length === 0) {
      validationErrors.push('Veuillez sélectionner au moins un employé');
    }
    
    if (fields.length === 0) {
      validationErrors.push('Veuillez ajouter au moins un champ au formulaire');
    }

    // Valider que tous les champs ont un label
    const invalidFields = fields.filter(field => !field.label.trim());
    if (invalidFields.length > 0) {
      validationErrors.push(`${invalidFields.length} champ(s) n'ont pas de libellé`);
    }

    // Valider que les champs select ont au moins une option
    const selectFieldsWithoutOptions = fields.filter(field => 
      field.type === 'select' && (!field.options || field.options.length === 0 || field.options.every(opt => !opt.trim()))
    );
    if (selectFieldsWithoutOptions.length > 0) {
      validationErrors.push(`${selectFieldsWithoutOptions.length} liste(s) déroulante(s) n'ont pas d'options`);
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Réinitialiser les erreurs si validation OK
    setErrors([]);

    // Préparer les données à sauvegarder
    const formData = {
      ...(isEditMode && initialForm?.id ? { id: initialForm.id } : {}),
      title,
      description,
      fields,
      assignedTo,
    };

    onSave(formData);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-2 sm:space-x-4 mb-4 sm:mb-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour</span>
        </Button>
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900">
          {isEditMode ? 'Modifier le formulaire' : 'Créer un nouveau formulaire'}
        </h2>
      </div>

      {/* Affichage des erreurs de validation */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                Veuillez corriger les erreurs suivantes :
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <Input
            label="Titre du formulaire *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Rapport de ventes mensuel"
            required
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez l'objectif de ce formulaire..."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Assigner aux employés *
            </label>
            <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {employees.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun employé disponible</p>
              ) : (
                employees.map(employee => (
                  <label key={employee.id} className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={assignedTo.includes(employee.id)}
                      onChange={() => toggleEmployeeAssignment(employee.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 break-words">{employee.name}</span>
                      <span className="text-xs text-gray-500 block sm:inline sm:ml-2 break-all">({employee.email})</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            {assignedTo.length === 0 && (
              <p className="text-sm text-red-600 mt-1">Veuillez sélectionner au moins un employé</p>
            )}
            {isEditMode && (
              <p className="text-xs text-blue-600 mt-1">
                💡 Vous pouvez modifier les employés assignés même après la création du formulaire
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-medium text-gray-900">Champs du formulaire</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addField}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Ajouter un champ</span>
                <span className="sm:hidden">Ajouter</span>
              </Button>
            </div>

            {fields.length === 0 ? (
              <p className="text-gray-500 text-center py-6 sm:py-8 bg-gray-50 rounded-lg text-sm sm:text-base">
                Aucun champ ajouté. Cliquez sur "Ajouter un champ" pour commencer.
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="border-l-4 border-l-blue-500">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">Champ {index + 1}</h4>
                          <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                            ID: {field.id}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => removeField(field.id)}
                          className="flex items-center space-x-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Libellé du champ *"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          placeholder="Ex: Montant des ventes"
                          required
                        />
                        
                        <Select
                          label="Type de champ"
                          value={field.type}
                          onChange={(e) => updateField(field.id, { type: e.target.value as FormField['type'] })}
                          options={[
                            { value: 'text', label: 'Texte' },
                            { value: 'number', label: 'Nombre' },
                            { value: 'email', label: 'Email' },
                            { value: 'date', label: 'Date' },
                            { value: 'textarea', label: 'Texte long' },
                            { value: 'select', label: 'Liste déroulante' },
                            { value: 'checkbox', label: 'Case à cocher' },
                            { value: 'file', label: 'Fichier' },
                            { value: 'calculated', label: 'Champ calculé' },
                          ]}
                        />
                      </div>
                      
                      <Input
                        label="Placeholder"
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        placeholder="Texte d'aide..."
                      />

                      {field.type === 'select' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Options de la liste *
                            </label>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => addOption(field.id)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {(field.options || []).map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center space-x-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(field.id, optionIndex, e.target.value)}
                                  placeholder={`Option ${optionIndex + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => removeOption(field.id, optionIndex)}
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

                      {field.type === 'file' && (
                        <FileTypeSelector
                          label="Types de fichiers acceptés"
                          selectedTypes={field.acceptedTypes || []}
                          onChange={(types) => updateField(field.id, { acceptedTypes: types })}
                        />
                      )}

                      {field.type === 'calculated' && (
                        <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Calculator className="h-5 w-5 text-blue-600" />
                            <h4 className="font-medium text-blue-900">Configuration du champ calculé</h4>
                          </div>
                          

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Champs dépendants *
                            </label>
                            <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                              {fields
                                .filter(f => f.id !== field.id)
                                .map(dependentField => (
                                  <label key={dependentField.id} className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                    <input
                                      type="checkbox"
                                      checked={field.dependsOn?.includes(dependentField.id) || false}
                                      onChange={(e) => {
                                        const currentDependsOn = field.dependsOn || [];
                                        const newDependsOn = e.target.checked
                                          ? [...currentDependsOn, dependentField.id]
                                          : currentDependsOn.filter(id => id !== dependentField.id);
                                        
                                        updateField(field.id, { dependsOn: newDependsOn });
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <span className="text-sm font-medium text-gray-900">{dependentField.label}</span>
                                      <div className="text-xs text-gray-500 space-y-1">
                                        <div>({dependentField.type})</div>
                                        <div className="flex items-center space-x-2">
                                          <span className="font-mono bg-gray-100 px-2 py-1 rounded flex-1">
                                            {dependentField.id}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              copyFieldId(dependentField.id);
                                            }}
                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                            title="Copier l'ID du champ"
                                          >
                                            {copiedFieldId === dependentField.id ? (
                                              <Check className="h-3 w-3 text-green-600" />
                                            ) : (
                                              <Copy className="h-3 w-3 text-gray-500" />
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </label>
                                ))}
                            </div>
                            {(!field.dependsOn || field.dependsOn.length === 0) && (
                              <p className="text-sm text-red-600 mt-1">Veuillez sélectionner au moins un champ dépendant</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Formule de calcul *
                            </label>
                            <div>
                              <Input
                                value={field.calculationFormula || ''}
                                onChange={(e) => {
                                  const newFormula = e.target.value;
                                  updateField(field.id, { calculationFormula: newFormula });
                                  validateFormula(field.id, newFormula);
                                }}
                                placeholder="Ex: field_id1 + field_id2 * 0.2"
                                className={formulaValidation[field.id]?.isValid === false ? 'border-red-500 focus:border-red-500' : ''}
                              />
                              {formulaValidation[field.id] && (
                                <div className={`mt-1 text-xs ${formulaValidation[field.id].isValid ? 'text-green-600' : 'text-red-600'}`}>
                                  {formulaValidation[field.id].isValid ? (
                                    <span className="flex items-center">
                                      <Check className="h-3 w-3 mr-1" />
                                      Formule valide
                                    </span>
                                  ) : (
                                    <span className="flex items-center">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      {formulaValidation[field.id].error}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Champs disponibles :</p>
                                <div className="flex flex-wrap gap-1">
                                  {field.dependsOn?.map(fieldId => {
                                    const dependentField = fields.find(f => f.id === fieldId);
                                    return dependentField ? (
                                      <div key={fieldId} className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs">
                                        <span className="font-mono">{fieldId}</span>
                                        <span className="text-gray-400">({dependentField.label})</span>
                                        <button
                                          type="button"
                                          onClick={() => copyFieldId(fieldId)}
                                          className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                          title="Copier l'ID du champ"
                                        >
                                          {copiedFieldId === fieldId ? (
                                            <Check className="h-3 w-3 text-green-600" />
                                          ) : (
                                            <Copy className="h-3 w-3 text-gray-500" />
                                          )}
                                        </button>
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                              
                              <div className="text-xs">
                                <p className="font-medium text-gray-700 mb-2">Opérateurs et Fonctions :</p>
                                <div className="grid grid-cols-2 gap-2 text-gray-600">
                                  <div><code className="bg-gray-100 px-1 rounded">+</code> Addition</div>
                                  <div><code className="bg-gray-100 px-1 rounded">SUM()</code> Somme</div>
                                  <div><code className="bg-gray-100 px-1 rounded">-</code> Soustraction</div>
                                  <div><code className="bg-gray-100 px-1 rounded">AVG()</code> Moyenne</div>
                                  <div><code className="bg-gray-100 px-1 rounded">*</code> Multiplication</div>
                                  <div><code className="bg-gray-100 px-1 rounded">MAX()</code> Maximum</div>
                                  <div><code className="bg-gray-100 px-1 rounded">/</code> Division</div>
                                  <div><code className="bg-gray-100 px-1 rounded">MIN()</code> Minimum</div>
                                  <div><code className="bg-gray-100 px-1 rounded">( )</code> Parenthèses</div>
                                </div>
                              </div>
                              
                              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                                <p className="text-xs text-yellow-800">
                                  <strong>Exemples :</strong><br/>
                                  • <code>field_id1 + field_id2</code> - Addition<br/>
                                  • <code>field_id1 * 1.2</code> - Multiplication avec constante<br/>
                                  • <code>(field_id1 + field_id2) / 2</code> - Moyenne<br/>
                                  • <code>field_id1 * 0.1</code> - 10% d'un champ
                                </p>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Champ obligatoire</span>
                      </label>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200">
            <Button 
              type="submit" 
              className="w-full sm:flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditMode ? 'Mise à jour...' : 'Création...'}
                </>
              ) : (
                isEditMode ? 'Mettre à jour le formulaire' : 'Créer le formulaire'
              )}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onCancel} 
              className="w-full sm:w-auto"
              disabled={isLoading}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};