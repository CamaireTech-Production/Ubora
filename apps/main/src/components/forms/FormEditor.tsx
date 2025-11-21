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
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { FormMetadataEditor } from './FormMetadataEditor';
import { FormFieldsManager } from './FormFieldsManager/FormFieldsManager';
import { FormAssignment } from './FormAssignment/FormAssignment';
import { ValidationRules } from './FormValidation/ValidationRules';
import { logger } from '@ubora/shared/utils/logger';
import { TimeRestrictionsEditor } from './TimeRestrictionsEditor';

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
        logger.error('Erreur lors du chargement des permissions', error, 'FormEditor');
        // Fallback: vérifier directement user.package
        let canUpload = false;
        if (user.package && ['starter', 'standard', 'premium'].includes(user.package)) {
          const { PACKAGE_FEATURES } = await import('@ubora/shared/config/packageFeatures');
          const packageType = user.package === 'premium' ? 'standard' : user.package;
          const features = PACKAGE_FEATURES[packageType as keyof typeof PACKAGE_FEATURES];
          canUpload = !!features && (features as any).allowFileUploads === true;
        }
        // Si toujours false, essayer la version synchrone
        if (!canUpload) {
          canUpload = UserSessionService.canUseFileUploads(user);
        }
        setFileUploadAccess({ 
          canRead: canUpload, 
          canWrite: canUpload, 
          source: canUpload ? 'package' : 'none' 
        });
      }
    };

    loadFileUploadAccess();
  }, [user, activeUniversId]);

  // Calculer canUseFileUploads : true si on a canWrite, false seulement si on est sûr qu'on n'a pas accès (pas pendant le chargement)
  const canUseFileUploads = fileUploadAccess !== null ? (fileUploadAccess?.canWrite ?? false) : false;
  
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
        logger.error('Erreur lors du chargement des listes', error, 'FormEditor');
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
      logger.error('Error saving form', error, 'FormEditor');
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

          <FormAssignment
            assignedTo={assignedTo}
            employees={employees}
            currentUser={currentUser}
            onToggleAssignment={toggleEmployeeAssignment}
            isEditMode={isEditing}
            error={errors.find(e => e.includes('employé'))}
          />

          <TimeRestrictionsEditor
            timeRestrictions={timeRestrictions}
            useTimeRange={useTimeRange}
            onTimeRestrictionsChange={setTimeRestrictions}
            onTimeRangeToggle={setUseTimeRange}
          />

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
            canUseFileUploads={canUseFileUploads}
            isFileUploadAccessLoading={fileUploadAccess === null}
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
