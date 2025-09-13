import React, { useState, useEffect } from 'react';
import { FormField, Form } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { Card } from './Card';
import { FileTypeSelector } from './FileTypeSelector';
import { FieldCSVImport } from './FieldCSVImport';
import { Toast } from './Toast';
import { useToast } from '../hooks/useToast';
import { Plus, Trash2, ArrowLeft, CheckSquare, Square, Loader2 } from 'lucide-react';

interface FormEditorProps {
  form?: Form; // If provided, we're editing an existing form
  onSave: (form: {
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
}

export const FormEditor: React.FC<FormEditorProps> = ({
  form,
  onSave,
  onCancel,
  employees
}) => {
  const [title, setTitle] = useState(form?.title || '');
  const [description, setDescription] = useState(form?.description || '');
  const [assignedTo, setAssignedTo] = useState<string[]>(form?.assignedTo || []);
  const [fields, setFields] = useState<FormField[]>(form?.fields || []);
  const [timeRestrictions, setTimeRestrictions] = useState<{
    startTime?: string;
    endTime?: string;
    allowedDays?: number[];
  }>(form?.timeRestrictions || {});
  const [useTimeRange, setUseTimeRange] = useState(!!form?.timeRestrictions?.endTime);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast, showSuccess, showError } = useToast();

  // Update state when form prop changes
  useEffect(() => {
    if (form) {
      setTitle(form.title);
      setDescription(form.description);
      setAssignedTo(form.assignedTo || []);
      setFields(form.fields || []);
      setTimeRestrictions(form.timeRestrictions || {});
      setUseTimeRange(!!form.timeRestrictions?.endTime);
    }
  }, [form]);

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
    if (!checked) {
      // Clear end time when disabling range
      setTimeRestrictions(prev => ({ ...prev, endTime: undefined }));
    }
  };

  const handleSelectAllEmployees = () => {
    const filteredEmployees = getFilteredEmployees();
    const allEmployeeIds = filteredEmployees.map(emp => emp.id);
    setAssignedTo(allEmployeeIds);
  };

  const handleDeselectAllEmployees = () => {
    setAssignedTo([]);
  };

  const getFilteredEmployees = () => {
    if (!employeeSearchTerm.trim()) {
      return employees;
    }
    
    const searchLower = employeeSearchTerm.toLowerCase();
    return employees.filter(employee => 
      employee.name.toLowerCase().includes(searchLower) ||
      employee.email.toLowerCase().includes(searchLower)
    );
  };


  const handleFieldOptionsUpdate = (fieldId: string, newOptions: string[]) => {
    updateField(fieldId, { options: newOptions });
    showSuccess('Options importées avec succès');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || assignedTo.length === 0 || fields.length === 0) {
      showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Valider que tous les champs ont un label
    const invalidFields = fields.filter(field => !field.label.trim());
    if (invalidFields.length > 0) {
      showError('Tous les champs doivent avoir un libellé');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSave({
        title,
        description,
        fields,
        assignedTo,
        timeRestrictions: Object.keys(timeRestrictions).length > 0 ? timeRestrictions : undefined,
      });
      
      const successMessage = isEditing ? 'Formulaire mis à jour avec succès' : 'Formulaire créé avec succès';
      showSuccess(successMessage);
    } catch (error) {
      console.error('Error saving form:', error);
      const errorMessage = isEditing ? 'Erreur lors de la mise à jour du formulaire' : 'Erreur lors de la création du formulaire';
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!form;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour</span>
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Modifier le formulaire' : 'Créer un nouveau formulaire'}
        </h2>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
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
            
            {/* Search and Select All Controls */}
            <div className="space-y-3 mb-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Rechercher un employé..."
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectAllEmployees}
                    className="flex items-center space-x-1"
                    title="Tout sélectionner"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Tout sélectionner</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleDeselectAllEmployees}
                    className="flex items-center space-x-1"
                    title="Tout désélectionner"
                  >
                    <Square className="h-4 w-4" />
                    <span className="hidden sm:inline">Tout désélectionner</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Employee List */}
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {(() => {
                const filteredEmployees = getFilteredEmployees();
                
                if (employees.length === 0) {
                  return <p className="text-gray-500 text-sm">Aucun employé disponible</p>;
                }
                
                if (filteredEmployees.length === 0) {
                  return <p className="text-gray-500 text-sm">Aucun employé trouvé pour "{employeeSearchTerm}"</p>;
                }
                
                return filteredEmployees.map(employee => (
                  <label key={employee.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={assignedTo.includes(employee.id)}
                      onChange={() => toggleEmployeeAssignment(employee.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{employee.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({employee.email})</span>
                    </div>
                  </label>
                ));
              })()}
            </div>
            
            {/* Selection Summary */}
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {assignedTo.length} employé(s) sélectionné(s)
              </span>
              {employeeSearchTerm && (
                <span className="text-blue-600">
                  {getFilteredEmployees().length} résultat(s) pour "{employeeSearchTerm}"
                </span>
              )}
            </div>
            
            {assignedTo.length === 0 && (
              <p className="text-sm text-red-600 mt-1">Veuillez sélectionner au moins un employé</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Restrictions horaires (optionnel)
            </label>
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    {useTimeRange ? 'Heure de début' : 'Heure'}
                  </label>
                  <input
                    type="time"
                    value={timeRestrictions.startTime || ''}
                    onChange={(e) => updateTimeRestriction('startTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
              <h3 className="text-lg font-medium text-gray-900">Champs du formulaire</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addField}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Ajouter un champ</span>
              </Button>
            </div>

            {fields.length === 0 ? (
              <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
                Aucun champ ajouté. Cliquez sur "Ajouter un champ" pour commencer.
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="border-l-4 border-l-blue-500">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Champ {index + 1}</h4>
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              Options de la liste
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

          <div className="flex space-x-4 pt-6 border-t border-gray-200">
            <Button 
              type="submit" 
              className="flex-1 flex items-center justify-center space-x-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isEditing ? 'Mise à jour...' : 'Création...'}</span>
                </>
              ) : (
                <span>{isEditing ? 'Mettre à jour le formulaire' : 'Créer le formulaire'}</span>
              )}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Card>

      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
      />
    </div>
  );
};
