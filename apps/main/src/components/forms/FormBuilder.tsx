import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormField, Form } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { FormMetadataEditor } from './FormMetadataEditor';
import { FormFieldsManager } from './FormFieldsManager/FormFieldsManager';
import { FormAssignment } from './FormAssignment/FormAssignment';
import { ValidationRules } from './FormValidation/ValidationRules';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useUnivers } from '@ubora/shared/contexts/UniversContext';
import { UserSessionService } from '@ubora/shared/services/userSessionService';
import { listsService } from '@ubora/shared/services/listsService';
import { List, ListDefinition } from '../../types';

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
  universLists?: ListDefinition[]; // Lists from Univers wizard context
  universId?: string | null; // ID of the Univers being edited (for filtering lists)
  universInstanceId?: string | null; // ID of the Univers instance being edited (for filtering lists)
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  onSave,
  onCancel,
  employees,
  currentUser,
  initialForm,
  isLoading = false,
  universLists = [],
  universId: editingUniversId,
  universInstanceId: editingUniversInstanceId
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeUniversId, activeInstanceId } = useUnivers();
  const canUseFileUploads = user ? UserSessionService.canUseFileUploads(user) : false;
  // Initialiser les états avec les valeurs du formulaire existant ou vides
  const [title, setTitle] = useState(initialForm?.title || '');
  const [description, setDescription] = useState(initialForm?.description || '');
  const [assignedTo, setAssignedTo] = useState<string[]>(initialForm?.assignedTo || []);
  const [fields, setFields] = useState<FormField[]>(initialForm?.fields || []);
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  
  // Lists state for select fields
  const [availableLists, setAvailableLists] = useState<List[]>([]);
  const loadingListsRef = useRef(false);
  
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
  
  // Load available lists for agency + merge Univers lists
  useEffect(() => {
    const loadLists = async () => {
      if (!user?.id || !user?.agencyId) {
        setAvailableLists([]);
        loadingListsRef.current = false;
        return;
      }
      
      // Si on est déjà en train de charger, ne pas relancer
      if (loadingListsRef.current) return;
      
      loadingListsRef.current = true;
      try {
        // Convert ListDefinitions to List format (for Univers context)
        const universListObjects: List[] = (universLists || []).map(listDef => ({
          id: listDef.id,
          name: listDef.name,
          description: listDef.description,
          columns: listDef.columns,
          rows: listDef.rows,
          createdBy: user.id,
          createdByRole: user.role as 'directeur' | 'employe',
          agencyId: user.agencyId,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        
        // Si on est dans le contexte d'édition d'un Univers (universLists fourni),
        // utiliser SEULEMENT les listes du Univers, ne pas charger depuis la DB
        if (universLists && universLists.length > 0) {
          setAvailableLists(universListObjects);
          loadingListsRef.current = false;
          return;
        }
        
        // Sinon, charger depuis la DB avec filtrage par univers/instance
        const universIdToUse = editingUniversId ?? activeUniversId;
        const instanceIdToUse = editingUniversInstanceId ?? activeInstanceId;
        
        const dbLists = await listsService.getByUser(
          user.id, 
          user.agencyId, 
          user.role, 
          universIdToUse,
          instanceIdToUse
        );
        
        // Utiliser uniquement les listes de la DB
        setAvailableLists(dbLists);
        loadingListsRef.current = false;
      } catch (error) {
        console.error('❌ [FormBuilder] Erreur lors du chargement des listes:', error);
        setAvailableLists([]);
        loadingListsRef.current = false;
      }
    };
    
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.agencyId, user?.role, activeUniversId, activeInstanceId]);

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
    setFields(fields.map(field => {
      if (field.id !== id) return field;
      
      // Créer un nouvel objet sans les propriétés undefined
      const cleanedUpdates: Partial<FormField> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          (cleanedUpdates as any)[key] = value;
        }
      }
      
      // Si on supprime listId explicitement (undefined), supprimer aussi displayColumnId et options
      if (updates.listId === undefined && field.listId !== undefined && !('listId' in cleanedUpdates && cleanedUpdates.listId !== undefined)) {
        const { listId, displayColumnId, options, ...rest } = { ...field, ...cleanedUpdates };
        return rest;
      }
      
      // Si on met à jour displayColumnId mais que listId est présent dans les updates, préserver listId
      if ('displayColumnId' in cleanedUpdates && 'listId' in cleanedUpdates && cleanedUpdates.listId !== undefined) {
        // Les deux sont dans les updates, les utiliser tous les deux
        return { ...field, ...cleanedUpdates };
      }
      
      // Si on met à jour displayColumnId seul, préserver listId existant
      if ('displayColumnId' in cleanedUpdates && field.listId !== undefined) {
        return { ...field, ...cleanedUpdates, listId: field.listId };
      }
      
      // Si on supprime options, ne pas l'inclure dans l'objet
      if (updates.options === undefined && field.options !== undefined && updates.listId !== undefined) {
        const { options, ...rest } = { ...field, ...cleanedUpdates };
        return rest;
      }
      
      return { ...field, ...cleanedUpdates };
    }));
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


  // Helper function to remove undefined values and empty strings from objects recursively
  const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj.map(removeUndefinedValues).filter(item => item !== null && item !== undefined);
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          // Remove empty strings for listId/displayColumnId (they indicate "not selected yet")
          if ((key === 'listId' || key === 'displayColumnId') && value === '') {
            continue; // Skip empty string values for these fields
          }
          const cleanedValue = removeUndefinedValues(value);
          if (cleanedValue !== null && cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      }
      return cleaned;
    }
    return obj;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation avec messages d'erreur détaillés
    const validationResult = ValidationRules.validateForm({
      title,
      description,
      fields,
      assignedTo,
      canUseFileUploads,
      userRole: user?.role,
      hasDirectorDashboardAccess: user?.hasDirectorDashboardAccess
    });

    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
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
              // Default to all days only when allowedDays is undefined (user didn't choose days)
              allowedDays: allowedDays === undefined ? [0,1,2,3,4,5,6] : allowedDays 
            } 
          };
        }
        
        // single-time mode: prefer endTime; if only startTime exists (legacy), treat it as endTime
        const singleEnd = endTime || startTime;
        if (!singleEnd && (!allowedDays || allowedDays.length === 0)) return {};
        
        return { 
          timeRestrictions: { 
            endTime: singleEnd, 
            // Default to all days only when allowedDays is undefined (user didn't choose days)
            allowedDays: allowedDays === undefined ? [0,1,2,3,4,5,6] : allowedDays 
          } 
        };
      })())
    };

    // Nettoyer les valeurs undefined avant l'envoi à Firebase
    const cleanedFormData = removeUndefinedValues(formData);
    onSave(cleanedFormData);
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
          <FormMetadataEditor
            title={title}
            description={description}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            titleError={errors.find(e => e.includes('titre'))}
            descriptionError={errors.find(e => e.includes('description'))}
          />

          <FormAssignment
            assignedTo={assignedTo}
            employees={employees}
            currentUser={currentUser}
            onToggleAssignment={toggleEmployeeAssignment}
            isEditMode={isEditMode}
            error={errors.find(e => e.includes('employé'))}
          />

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

          <FormFieldsManager
            fields={fields}
            onAddField={addField}
            onRemoveField={removeField}
            onUpdateField={updateField}
            canUseFileUploads={canUseFileUploads}
            availableLists={availableLists}
            onFileUploadsUpgrade={() => navigate('/packages/manage?section=packages&highlight=starter')}
            userRole={user?.role}
            hasDirectorDashboardAccess={user?.hasDirectorDashboardAccess}
          />

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