import React, { useState, useEffect } from 'react';
import { FormField, Form } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { Card } from './Card';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

interface FormEditorProps {
  form?: Form; // If provided, we're editing an existing form
  onSave: (form: {
    title: string;
    description: string;
    fields: FormField[];
    assignedTo: string[];
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

  // Update state when form prop changes
  useEffect(() => {
    if (form) {
      setTitle(form.title);
      setDescription(form.description);
      setAssignedTo(form.assignedTo || []);
      setFields(form.fields || []);
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
      updateField(fieldId, { options: [...options, ''] });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || assignedTo.length === 0 || fields.length === 0) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Valider que tous les champs ont un label
    const invalidFields = fields.filter(field => !field.label.trim());
    if (invalidFields.length > 0) {
      alert('Tous les champs doivent avoir un libellé');
      return;
    }

    onSave({
      title,
      description,
      fields,
      assignedTo,
    });
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
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {employees.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun employé disponible</p>
              ) : (
                employees.map(employee => (
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
                ))
              )}
            </div>
            {assignedTo.length === 0 && (
              <p className="text-sm text-red-600 mt-1">Veuillez sélectionner au moins un employé</p>
            )}
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

          <div className="flex space-x-4 pt-6 border-t border-gray-200">
            <Button type="submit" className="flex-1">
              {isEditing ? 'Mettre à jour le formulaire' : 'Créer le formulaire'}
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
