import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FormField, Form } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { Card } from './Card';
import { FileTypeSelector } from './FileTypeSelector';
import { FieldCSVImport } from './FieldCSVImport';
import { Plus, Trash2, ArrowLeft, AlertCircle, Calculator } from 'lucide-react';
import { FormulaInput } from './FormulaInput';
import { FormulaParser } from '../utils/FormulaParser';
import { ConditionalLogicBuilder } from './ConditionalLogicBuilder';
import { DesktopRecommendationInfo } from './DesktopRecommendationInfo';
import { ConfirmationModal } from './ConfirmationModal';
import { useAuth } from '../contexts/AuthContext';
import { UserSessionService } from '../services/userSessionService';

interface FormBuilderProps {
  onSave: (form: {
    id?: string;
    title: string;
    description: string;
    fields: FormField[];
    assignedTo: string[];
    timeRestrictions?: {
      startTime?: string;
      endTime?: string;
      allowedDays?: number[];
    };
  }) => void;
  onCancel: () => void;
  employees: Array<{ id: string; name: string; email: string }>;
  currentUser?: { id: string; name: string; email: string; role: string };
  initialForm?: Pick<Form, 'id' | 'title' | 'description' | 'fields' | 'assignedTo' | 'timeRestrictions'>;
  isLoading?: boolean;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  onSave,
  onCancel,
  employees,
  currentUser,
  initialForm,
  isLoading = false
}) => {
  const { user } = useAuth();
  const canUseFileUploads = user ? UserSessionService.canUseFileUploads(user) : false;
  // Initialiser les états avec les valeurs du formulaire existant ou vides
  const [title, setTitle] = useState(initialForm?.title || '');
  const [description, setDescription] = useState(initialForm?.description || '');
  const [assignedTo, setAssignedTo] = useState<string[]>(initialForm?.assignedTo || []);
  const [fields, setFields] = useState<FormField[]>(initialForm?.fields || []);
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    fieldId: string | null;
    fieldLabel: string;
    dependentFields: Array<{ id: string; label: string }>;
  }>({
    isOpen: false,
    fieldId: null,
    fieldLabel: '',
    dependentFields: []
  });
  
  // Auto-scroll to errors when they appear (mobile-responsive)
  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      // Immediate scroll
      errorRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
      
      // Additional scroll after delay for mobile keyboard animations
      setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }
      }, 100);
    }
  }, [errors]);
  
  // Time restrictions settings
  const [timeRestrictions, setTimeRestrictions] = useState<{
    startTime?: string;
    endTime?: string;
    allowedDays?: number[];
  }>(initialForm?.timeRestrictions || {});
  const [useTimeRange, setUseTimeRange] = useState(
    !!(initialForm?.timeRestrictions?.startTime && initialForm?.timeRestrictions?.endTime)
  );

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
    const fieldToDelete = fields.find(field => field.id === id);
    if (!fieldToDelete) return;

    // Check for dependencies before deletion
    const dependentFields = fields.filter(field => 
      field.type === 'calculated' && 
      field.dependsOn?.includes(id)
    );
    
    if (dependentFields.length > 0) {
      // Show confirmation modal
      setConfirmationModal({
        isOpen: true,
        fieldId: id,
        fieldLabel: fieldToDelete.label,
        dependentFields: dependentFields.map(field => ({
          id: field.id,
          label: field.label
        }))
      });
    } else {
      // Safe to delete immediately
      setFields(fields.filter(field => field.id !== id));
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmationModal.fieldId) return;

    const fieldId = confirmationModal.fieldId;
    
    // Clean up dependencies in calculated fields
    setFields(prevFields => 
      prevFields.map(field => {
        if (field.type === 'calculated' && field.dependsOn?.includes(fieldId)) {
          return {
            ...field,
            dependsOn: field.dependsOn.filter(depId => depId !== fieldId),
            calculationFormula: '', // Clear invalid formula
            userFormula: ''
          };
        }
        return field;
      }).filter(field => field.id !== fieldId)
    );

    // Close modal
    setConfirmationModal({
      isOpen: false,
      fieldId: null,
      fieldLabel: '',
      dependentFields: []
    });
  };

  const handleCancelDelete = () => {
    setConfirmationModal({
      isOpen: false,
      fieldId: null,
      fieldLabel: '',
      dependentFields: []
    });
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

  const handleFormulaChange = useCallback((fieldId: string, formula: string, fieldIds: string[]) => {
    // Validate dependencies
    const invalidDeps = fieldIds.filter(id => 
      !fields.find(f => f.id === id && ['number', 'calculated'].includes(f.type))
    );
    
    if (invalidDeps.length > 0) {
      console.warn(`Invalid dependencies detected: ${invalidDeps.join(', ')}`);
      // Don't update if there are invalid dependencies
      return;
    }
    
    // Check for circular dependencies
    if (FormulaParser.hasCircularDependency(fieldId, fieldIds, fields)) {
      console.warn('Circular dependency detected');
      // Don't update if there's a circular dependency
      return;
    }
    
    updateField(fieldId, { 
      calculationFormula: formula,
      dependsOn: fieldIds,
      userFormula: FormulaParser.convertToUserFormula(formula, fields)
    });
  }, [fields, updateField]);

  const toggleDaySelection = (day: number) => {
    setTimeRestrictions(prev => {
      const currentDays = prev.allowedDays || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      return { ...prev, allowedDays: newDays };
    });
  };

  const updateTimeRestriction = (field: 'startTime' | 'endTime', value: string) => {
    setTimeRestrictions(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeRangeToggle = (checked: boolean) => {
    setUseTimeRange(checked);
    setTimeRestrictions(prev => {
      // If switching to single-time mode, treat the existing single value as end time
      if (!checked) {
        const singleTime = prev.endTime || prev.startTime;
        return { ...prev, startTime: undefined, endTime: singleTime };
      }
      // If switching to range mode and only an end time exists, initialize a start time
      if (checked && !prev.startTime && prev.endTime) {
        return { ...prev, startTime: '00:00' };
      }
      return prev;
    });
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation avec messages d'erreur détaillés
    const validationErrors: string[] = [];
    
    // Package-based restriction: block file fields for packages without uploads
    if (!canUseFileUploads) {
      const hasFileFields = fields.some(f => f.type === 'file');
      if (hasFileFields) {
        validationErrors.push('Votre package actuel ne permet pas les champs de type Fichier. Supprimez-les ou mettez à niveau votre package.');
      }
    }

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

    // Valider que les champs calculés ont une formule
    const calculatedFieldsWithoutFormula = fields.filter(field => 
      field.type === 'calculated' && !field.calculationFormula?.trim()
    );
    if (calculatedFieldsWithoutFormula.length > 0) {
      validationErrors.push(`${calculatedFieldsWithoutFormula.length} champ(s) calculé(s) n'ont pas de formule`);
    }

    // Valider les dépendances des champs
    const dependencyErrors = FormulaParser.validateFieldDependencies(fields);
    validationErrors.push(...dependencyErrors);

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
      ...(Object.keys(timeRestrictions).length > 0 && (() => {
        const { startTime, endTime, allowedDays } = timeRestrictions;
        const hasRange = useTimeRange && startTime && endTime;
        
        if (hasRange) {
          return { 
            timeRestrictions: { 
              startTime, 
              endTime, 
              allowedDays: allowedDays || [] 
            } 
          };
        }
        
        // single-time mode: prefer endTime; if only startTime exists (legacy), treat it as endTime
        const singleEnd = endTime || startTime;
        if (!singleEnd && (!allowedDays || allowedDays.length === 0)) return {};
        
        return { 
          timeRestrictions: { 
            endTime: singleEnd, 
            allowedDays: allowedDays || [] 
          } 
        };
      })())
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
        <Card ref={errorRef} className="border-red-200 bg-red-50">
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
              {/* Show director option first if current user is a director */}
              {currentUser?.role === 'directeur' && (
                <label className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded bg-blue-50 border border-blue-200">
                  <input
                    type="checkbox"
                    checked={assignedTo.includes(currentUser.id)}
                    onChange={() => toggleEmployeeAssignment(currentUser.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-blue-900 break-words">Moi ({currentUser.name})</span>
                    <span className="text-xs text-blue-600 block sm:inline sm:ml-2 break-all">({currentUser.email})</span>
                  </div>
                </label>
              )}
              
              {/* Show employees */}
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

          {/* Time Restrictions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Restrictions horaires (optionnel)
            </label>
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    {useTimeRange ? 'Heure de début' : 'Heure limite'}
                  </label>
                  <input
                    type="time"
                    value={useTimeRange ? (timeRestrictions.startTime || '') : (timeRestrictions.endTime || '')}
                    onChange={(e) => useTimeRange
                      ? updateTimeRestriction('startTime', e.target.value)
                      : updateTimeRestriction('endTime', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {!useTimeRange && (
                    <p className="text-xs text-gray-500 mt-1">
                      Les employés peuvent remplir ce formulaire de 00:00 jusqu'à cette heure
                    </p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useTimeRange"
                    checked={useTimeRange}
                    onChange={(e) => handleTimeRangeToggle(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="useTimeRange" className="text-sm text-gray-700">
                    Définir une plage horaire
                  </label>
                </div>
                
                {useTimeRange && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Heure de fin
                    </label>
                    <input
                      type="time"
                      value={timeRestrictions.endTime || ''}
                      onChange={(e) => updateTimeRestriction('endTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Les employés peuvent remplir ce formulaire entre ces deux heures
                    </p>
                  </div>
                )}
              </div>
              
              {(timeRestrictions.startTime || timeRestrictions.endTime) && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Jours autorisés
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 1, label: 'Lun' },
                      { value: 2, label: 'Mar' },
                      { value: 3, label: 'Mer' },
                      { value: 4, label: 'Jeu' },
                      { value: 5, label: 'Ven' },
                      { value: 6, label: 'Sam' },
                      { value: 0, label: 'Dim' }
                    ].map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDaySelection(day.value)}
                        className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                          timeRestrictions.allowedDays?.includes(day.value)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Laissez vide pour permettre tous les jours
                  </p>
                </div>
              )}
            </div>
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

            {/* Desktop Recommendation - Show when any field has conditional logic enabled */}
            {fields.some(field => field.conditionalLogic?.isEnabled) && (
              <DesktopRecommendationInfo className="mb-4" />
            )}

            {!canUseFileUploads && (
              <div className="mb-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                Les téléchargements de fichiers (images/PDF) sont disponibles à partir du package Starter. Mettez à niveau pour activer ce type de champ.
              </div>
            )}
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
                            ...(canUseFileUploads ? [{ value: 'file', label: 'Fichier' }] : []),
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

                      {field.type === 'file' && canUseFileUploads && (
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
                          
                          <FormulaInput
                            value={field.calculationFormula || ''}
                            onChange={(formula: string, fieldIds: string[]) => handleFormulaChange(field.id, formula, fieldIds)}
                            fields={fields}
                            currentFieldId={field.id}
                          />

                          {/* Show field dependencies for reference */}
                          {field.dependsOn && field.dependsOn.length > 0 && (
                            <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                              <p className="text-sm font-medium text-gray-700 mb-2">Champs utilisés dans la formule :</p>
                              <div className="flex flex-wrap gap-2">
                                {field.dependsOn.map(fieldId => {
                                  const dependentField = fields.find(f => f.id === fieldId);
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
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Champ obligatoire</span>
                      </label>

                      {/* Conditional Logic Section */}
                      <div className="border-t pt-4">
                        <ConditionalLogicBuilder
                          field={field}
                          allFields={fields}
                          onUpdate={(conditionalLogic) => updateField(field.id, { conditionalLogic })}
                        />
                      </div>
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Confirmer la suppression"
        message={
          confirmationModal.dependentFields.length > 0
            ? `Le champ "${confirmationModal.fieldLabel}" est utilisé dans ${confirmationModal.dependentFields.length} champ(s) calculé(s) :\n\n${confirmationModal.dependentFields.map(field => `• ${field.label}`).join('\n')}\n\nVoulez-vous vraiment le supprimer ? Les formules de ces champs calculés seront invalidées et devront être reconfigurées.`
            : `Êtes-vous sûr de vouloir supprimer le champ "${confirmationModal.fieldLabel}" ?`
        }
        confirmText="Supprimer"
        cancelText="Annuler"
        variant={confirmationModal.dependentFields.length > 0 ? 'warning' : 'danger'}
      />
    </div>
  );
};