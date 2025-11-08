import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { FormBuilder } from './FormBuilder';
import { FormField } from '../types';
import { UniversWizardStepProps } from './UniversWizard';
import { Plus, Trash2, Edit, FileText, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';

// FormDefinition interface for Univers
interface FormDefinition {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  assignedTo: string[]; // Empty array - user will set when using template
  timeRestrictions?: {
    startTime?: string;
    endTime?: string;
    allowedDays?: number[];
  };
  deadline?: {
    date: string;
    time: string;
    timezone?: string;
  };
  notificationSettings?: {
    reminderIntervals: number[];
    enabled: boolean;
  };
}

export const UniversWizardStep3: React.FC<UniversWizardStepProps> = ({
  wizardData,
  updateWizardData,
  markStepCompleted,
  readOnly = false,
  templateData,
  universId,
  universInstanceId
}) => {
  const { employees } = useApp();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // En mode lecture seule, utiliser les données du template
  const initialForms = readOnly && templateData 
    ? (templateData.definitions.forms || [])
    : ((wizardData.definitions.forms as FormDefinition[]) || []);

  const [forms, setForms] = useState<FormDefinition[]>(initialForms);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  // Sync local state with wizardData when it changes (e.g., after loading from localStorage)
  useEffect(() => {
    const savedForms = (wizardData.definitions.forms as FormDefinition[]) || [];
    // Only update if the saved forms are different from current forms
    // Check by length first, then by deep comparison if needed
    if (savedForms.length !== forms.length) {
      setForms(savedForms);
    } else if (savedForms.length > 0) {
      // Deep comparison only if arrays have items
      const savedStr = JSON.stringify(savedForms);
      const currentStr = JSON.stringify(forms);
      if (savedStr !== currentStr) {
        setForms(savedForms);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.definitions.forms]);

  // Update wizard data when forms change (seulement si pas en lecture seule)
  useEffect(() => {
    if (!readOnly) {
      updateWizardData({
        definitions: {
          forms: forms
        }
      });

      // Mark step as completed if at least 1 form exists
      if (forms.length > 0) {
        markStepCompleted(3);
      }
    } else {
      // En mode lecture seule, marquer comme complété automatiquement
      markStepCompleted(3);
    }
  }, [forms, updateWizardData, markStepCompleted, readOnly]);

  const handleAddForm = () => {
    setEditingFormId(null);
    setSelectedFormId(null);
    setShowFormBuilder(true);
  };

  const handleEditForm = (formId: string) => {
    setEditingFormId(formId);
    setSelectedFormId(formId);
    setShowFormBuilder(true);
  };

  const handleDeleteForm = (formId: string) => {
    setForms(forms.filter(f => f.id !== formId));
    showSuccess('Formulaire supprimé');
  };

  const handleFormSave = (formData: {
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
  }) => {
    if (editingFormId) {
      // Update existing form
      setForms(forms.map(f => 
        f.id === editingFormId 
          ? { 
              ...f, 
              title: formData.title,
              description: formData.description,
              fields: formData.fields,
              assignedTo: formData.assignedTo || [], // Save assigned users
              timeRestrictions: formData.timeRestrictions
            }
          : f
      ));
      showSuccess('Formulaire modifié');
    } else {
      // Create new form
      const newForm: FormDefinition = {
        id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title,
        description: formData.description,
        fields: formData.fields,
        assignedTo: formData.assignedTo || [], // Save assigned users
        timeRestrictions: formData.timeRestrictions
      };
      setForms([...forms, newForm]);
      showSuccess('Formulaire ajouté');
    }

    setShowFormBuilder(false);
    setEditingFormId(null);
    setSelectedFormId(null);
  };

  const handleFormCancel = () => {
    setShowFormBuilder(false);
    setEditingFormId(null);
    setSelectedFormId(null);
  };

  const getFormIcon = (form: FormDefinition) => {
    const hasFileFields = form.fields.some(field => field.type === 'file');
    const hasDateFields = form.fields.some(field => field.type === 'date');
    const hasNumberFields = form.fields.some(field => field.type === 'number');
    
    if (hasFileFields) return <FileText className="h-5 w-5 text-blue-600" />;
    if (hasDateFields && hasNumberFields) return <FileText className="h-5 w-5 text-green-600" />;
    if (hasNumberFields) return <FileText className="h-5 w-5 text-orange-600" />;
    return <FileText className="h-5 w-5 text-indigo-600" />;
  };

  const editingForm = editingFormId ? forms.find(f => f.id === editingFormId) : null;

  // En mode lecture seule, afficher une vue en lecture seule
  if (readOnly) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Formulaires
          </h2>
          <p className="text-gray-600">
            Aperçu des formulaires du Univers template.
          </p>
        </div>

        {/* Forms Display (Read-only) avec détails complets */}
        {forms.length > 0 ? (
          <div className="space-y-4">
            {forms.map(form => (
              <Card key={form.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">{form.title}</h3>
                    </div>
                    {form.description && (
                      <p className="text-sm text-gray-600 mb-3">{form.description}</p>
                    )}
                    {form.fields && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {form.fields.length} champ{form.fields.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                {form.fields && form.fields.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Champs du formulaire:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {form.fields.map((field, fieldIndex) => (
                        <div key={fieldIndex} className="p-3 bg-white rounded-md border border-blue-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{field.label || `Champ ${fieldIndex + 1}`}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{field.type}</span>
                          </div>
                          {field.placeholder && (
                            <p className="text-xs text-gray-500 mt-1">Placeholder: {field.placeholder}</p>
                          )}
                          {field.required && (
                            <span className="text-xs text-red-600 mt-1 inline-block">Requis</span>
                          )}
                          {field.options && field.options.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">Options:</p>
                              <div className="flex flex-wrap gap-1">
                                {field.options.map((opt, optIndex) => (
                                  <span key={optIndex} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                    {typeof opt === 'string' ? opt : (opt as any).label || (opt as any).value || String(opt)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun formulaire dans ce Univers</p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (showFormBuilder) {
    return (
      <div className="space-y-6">
        <div>
          <Button
            variant="secondary"
            onClick={handleFormCancel}
            className="flex items-center space-x-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour à la liste</span>
          </Button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {editingFormId ? 'Modifier le formulaire' : 'Créer un formulaire'}
          </h2>
          <p className="text-gray-600">
            {editingFormId 
              ? 'Modifiez les informations du formulaire' 
              : 'Créez un nouveau formulaire pour votre Univers'}
          </p>
        </div>

        <FormBuilder
          onSave={handleFormSave}
          onCancel={handleFormCancel}
          employees={employees}
          currentUser={user ? {
            id: user.id,
            name: user.name || '',
            email: user.email || '',
            role: user.role
          } : undefined}
          initialForm={editingForm ? {
            id: editingForm.id,
            title: editingForm.title,
            description: editingForm.description,
            fields: editingForm.fields,
            assignedTo: editingForm.assignedTo || [], // Pass assigned users
            timeRestrictions: editingForm.timeRestrictions
          } : undefined}
          universLists={wizardData.definitions.lists as any[]}
          universId={universId}
          universInstanceId={universInstanceId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Formulaires
        </h2>
        <p className="text-gray-600">
          Créez et gérez les formulaires de votre Univers. Au moins un formulaire est requis.
        </p>
      </div>

      {/* Validation message */}
      {forms.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                Formulaire requis
              </h3>
              <p className="text-sm text-yellow-800">
                Vous devez créer au moins un formulaire pour votre Univers.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Add Form Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleAddForm}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter un formulaire</span>
        </Button>
      </div>

      {/* Forms List */}
      {forms.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun formulaire
            </h3>
            <p className="text-gray-600 mb-4">
              Commencez par créer votre premier formulaire
            </p>
            <Button onClick={handleAddForm} className="flex items-center space-x-2 mx-auto">
              <Plus className="h-4 w-4" />
              <span>Créer un formulaire</span>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <Card key={form.id} className="relative hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFormIcon(form)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {form.title}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {form.fields.length} champ{form.fields.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEditForm(form.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Modifier"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {form.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {form.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Formulaire configuré</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {forms.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {forms.length} formulaire{forms.length > 1 ? 's' : ''} {forms.length === 1 ? 'configuré' : 'configurés'}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Vous pouvez continuer à l'étape suivante
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

