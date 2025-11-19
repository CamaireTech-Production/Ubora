import React, { useState, useEffect, useRef } from 'react';
import { FormField, Form } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Toast } from '../ui/Toast';
import { useToast } from '@ubora/shared/hooks/useToast';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useUnivers } from '@ubora/shared/contexts/UniversContext';
import { UserSessionService } from '@ubora/shared/services/userSessionService';
import { listsService } from '@ubora/shared/services/listsService';
import { List, ListDefinition } from '../../types';
import { ArrowLeft, AlertCircle, Loader2, CheckSquare, Square } from 'lucide-react';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { FormMetadataEditor } from './FormMetadataEditor';
import { FormFieldsManager } from './FormFieldsManager/FormFieldsManager';
import { FormAssignment } from './FormAssignment/FormAssignment';
import { ValidationRules } from './FormValidation/ValidationRules';

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
  currentUser?: { id: string; name: string; email: string; role: string };
  universLists?: ListDefinition[]; // Lists from Univers wizard context
  universId?: string | null; // ID of the Univers being edited (for filtering lists)
  universInstanceId?: string | null; // ID of the Univers instance being edited (for filtering lists)
}

export const FormEditor: React.FC<FormEditorProps> = ({
  form,
  onSave,
  onCancel,
  employees,
  currentUser,
  universLists = [],
  universId: editingUniversId,
  universInstanceId: editingUniversInstanceId
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
  const [useTimeRange, setUseTimeRange] = useState(
    !!(form?.timeRestrictions?.startTime && form?.timeRestrictions?.endTime)
  );
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const { toast, showSuccess, showError } = useToast();
  const { user } = useAuth();
  const { activeUniversId, activeInstanceId } = useUnivers();
  const [fileUploadAccess, setFileUploadAccess] = useState<{ canRead: boolean; canWrite: boolean; source: string } | null>(null);
  
  // Charger les permissions d'upload de fichiers
  useEffect(() => {
    const loadFileUploadAccess = async () => {
      if (!user) {
        setFileUploadAccess({ canRead: false, canWrite: false, source: 'none' });
        return;
      }

      try {
        const access = await UserSessionService.canUseFileUploadsAsync(user, activeUniversId);
        setFileUploadAccess(access);
      } catch (error) {
        console.error('Erreur lors du chargement des permissions:', error);
        // Fallback sur la version synchrone
        const canUpload = UserSessionService.canUseFileUploads(user);
        setFileUploadAccess({ 
          canRead: canUpload, 
          canWrite: canUpload, 
          source: canUpload ? 'package' : 'none' 
        });
      }
    };

    loadFileUploadAccess();
  }, [user, activeUniversId]);

  const canUseFileUploads = fileUploadAccess?.canWrite ?? false;
  
  // Lists state for select fields
  const [availableLists, setAvailableLists] = useState<List[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
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
        setLoadingLists(false);
        loadingListsRef.current = false;
        return;
      }
      
      // Si on est déjà en train de charger, ne pas relancer
      if (loadingListsRef.current) return;
      
      loadingListsRef.current = true;
      setLoadingLists(true);
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
          setLoadingLists(false);
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
        setLoadingLists(false);
        loadingListsRef.current = false;
      } catch (error) {
        console.error('❌ [FormEditor] Erreur lors du chargement des listes:', error);
        setAvailableLists([]);
        setLoadingLists(false);
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

  // Update state when form prop changes
  useEffect(() => {
    if (form) {
      setTitle(form.title);
      setDescription(form.description);
      setAssignedTo(form.assignedTo || []);
      setFields(form.fields || []);
      setTimeRestrictions(form.timeRestrictions || {});
      setUseTimeRange(!!(form.timeRestrictions?.startTime && form.timeRestrictions?.endTime));
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




  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation avec messages d'erreur détaillés
    const validationResult = ValidationRules.validateForm({
      title,
      description,
      fields,
      assignedTo,
      canUseFileUploads: canUseFileUploads && (fileUploadAccess?.canWrite ?? false),
      userRole: user?.role,
      hasDirectorDashboardAccess: user?.hasDirectorDashboardAccess
    });

    // Ajouter validation spécifique pour read-only univers
    if (!canUseFileUploads && fileUploadAccess?.canRead && !fileUploadAccess?.canWrite && fileUploadAccess?.source === 'univers') {
      const hasFileFields = fields.some(f => f.type === 'file');
      if (hasFileFields) {
        validationResult.errors.push('Vous ne pouvez pas créer ou modifier des champs de type Fichier. Cette fonctionnalité est disponible en lecture seule via votre univers activé. Pour créer/modifier des champs de fichiers, mettez à niveau votre package vers Starter.');
        validationResult.isValid = false;
      }
    }

    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
      return;
    }

    // Réinitialiser les erreurs si validation OK
    setErrors([]);

    setIsSubmitting(true);
    
    try {
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

      // Sanitize time restrictions: in single-time mode, keep only endTime
      const sanitizedTimeRestrictions = (() => {
        if (Object.keys(timeRestrictions).length === 0) return undefined;
        const { startTime, endTime, allowedDays } = timeRestrictions;
        const hasRange = useTimeRange && startTime && endTime;
        
        if (hasRange) {
          return { 
            startTime, 
            endTime, 
            // Default to all days only when allowedDays is undefined (user didn't choose days)
            allowedDays: allowedDays === undefined ? [0,1,2,3,4,5,6] : allowedDays 
          };
        }
        
        // single-time mode: prefer endTime; if only startTime exists (legacy), treat it as endTime
        const singleEnd = endTime || startTime;
        if (!singleEnd && (!allowedDays || allowedDays.length === 0)) return undefined;
        
        return { 
          endTime: singleEnd, 
          // Default to all days only when allowedDays is undefined (user didn't choose days)
          allowedDays: allowedDays === undefined ? [0,1,2,3,4,5,6] : allowedDays 
        };
      })();

      const formData = {
        title,
        description,
        fields,
        assignedTo,
        timeRestrictions: sanitizedTimeRestrictions,
      };

      // Nettoyer les valeurs undefined avant l'envoi à Firebase
      const cleanedFormData = removeUndefinedValues(formData);
      await onSave(cleanedFormData);
      
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
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Modifier le formulaire' : 'Créer un nouveau formulaire'}
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
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormMetadataEditor
            title={title}
            description={description}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            titleError={errors.find(e => e.includes('titre'))}
            descriptionError={errors.find(e => e.includes('description'))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Assigner aux utilisateurs *
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
                
                // Show director option first if current user is a director and matches search
                const showDirectorOption = currentUser?.role === 'directeur' && 
                  (!employeeSearchTerm || 
                   currentUser.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                   currentUser.email.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                   'moi'.includes(employeeSearchTerm.toLowerCase()));
                
                if (employees.length === 0 && !showDirectorOption) {
                  return <p className="text-gray-500 text-sm">Aucun employé disponible</p>;
                }
                
                if (filteredEmployees.length === 0 && !showDirectorOption) {
                  return <p className="text-gray-500 text-sm">Aucun employé trouvé pour "{employeeSearchTerm}"</p>;
                }
                
                return (
                  <>
                    {/* Show director option first */}
                    {showDirectorOption && (
                      <label className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded bg-blue-50 border border-blue-200">
                        <input
                          type="checkbox"
                          checked={assignedTo.includes(currentUser.id)}
                          onChange={() => toggleEmployeeAssignment(currentUser.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-blue-900">Moi ({currentUser.name})</span>
                          <span className="text-xs text-blue-600 ml-2">({currentUser.email})</span>
                        </div>
                      </label>
                    )}
                    
                    {/* Show employees */}
                    {filteredEmployees.map(employee => (
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
                    ))}
                  </>
                );
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
            onUpdateField={(fieldId, updates) => {
              // Bloquer le changement vers 'file' si pas de permission write
              if (updates.type === 'file' && !canUseFileUploads) {
                showError('Vous ne pouvez pas créer des champs de type Fichier. Cette fonctionnalité nécessite un package Starter ou supérieur.');
                return;
              }
              updateField(fieldId, updates);
            }}
            canUseFileUploads={canUseFileUploads && (fileUploadAccess?.canWrite ?? false)}
            availableLists={availableLists}
            userRole={user?.role}
            hasDirectorDashboardAccess={user?.hasDirectorDashboardAccess}
          />

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
