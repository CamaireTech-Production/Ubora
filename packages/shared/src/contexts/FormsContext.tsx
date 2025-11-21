import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Form } from '../types';
import { useAuth } from './AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { PermissionManager } from '../utils/PermissionManager';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { notificationService } from '../services/notificationService';
import { universService } from '../services/universService';
import { useUnivers } from './UniversContext';
import { logger } from '../utils/logger';
import { universInstanceResourceService } from '../services/universInstanceResourceService';

interface FormsContextType {
  forms: Form[];
  createForm: (form: Omit<Form, 'id' | 'createdAt'>) => Promise<void>;
  updateForm: (formId: string, form: Partial<Omit<Form, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => Promise<void>;
  deleteForm: (formId: string) => Promise<void>;
  getFormsForEmployee: (employeeId: string) => Form[];
  isLoading: boolean;
  error: string | null;
}

const FormsContext = createContext<FormsContextType | undefined>(undefined);

export const FormsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  const { activeUniversId, activeInstanceId } = useUnivers();
  const { canCreateForm } = usePackageAccess();
  
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les formulaires depuis Firestore
  useEffect(() => {
    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      setForms([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // NOUVELLE LOGIQUE : Pour les directeurs avec activeInstanceId, utiliser l'instance comme source de vérité
    if (user.role === 'directeur' && activeInstanceId) {
      // Utiliser le service pour récupérer les formulaires depuis l'instance
      const unsubscribe = universInstanceResourceService.subscribeToInstanceResources(
        activeInstanceId,
        (resources) => {
          // Trier par createdAt décroissant
          const sortedForms = resources.forms.sort((a, b) => {
            const aTime = a.createdAt?.getTime() || 0;
            const bTime = b.createdAt?.getTime() || 0;
            return bTime - aTime;
          });
          setForms(sortedForms);
          setIsLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    }

    // ANCIENNE LOGIQUE : Pour les employés ou les directeurs sans instance (rétrocompatibilité)
    // Écouter les formulaires selon le rôle de l'utilisateur
    // Filtrer par Univers actif et instance active si disponible
    let formsQuery;
    if (user.role === 'directeur') {
      // Les directeurs voient les formulaires du Univers actif
      if (activeUniversId) {
        // Rétrocompatibilité : filtrer par universId si pas d'instance
        formsQuery = query(
          collection(db, 'forms'),
          where('agencyId', '==', user.agencyId),
          where('universId', '==', activeUniversId),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Rétrocompatibilité temporaire : si pas de Univers actif, charger tous les forms
        formsQuery = query(
          collection(db, 'forms'),
          where('agencyId', '==', user.agencyId),
          orderBy('createdAt', 'desc')
        );
      }
    } else {
      // Les employés voient les formulaires qui leur sont assignés ET ceux qu'ils ont créés
      // Note: Firestore ne supporte pas les requêtes OR complexes, donc on récupère tous les formulaires
      // et on filtre côté client
      // Pour les employés, on filtre aussi par Univers actif et instance active s'il existe
      if (activeUniversId) {
        // Si activeInstanceId est disponible, filtrer par universInstanceId
        if (activeInstanceId) {
          formsQuery = query(
            collection(db, 'forms'),
            where('agencyId', '==', user.agencyId),
            where('universInstanceId', '==', activeInstanceId),
            orderBy('createdAt', 'desc')
          );
        } else {
          formsQuery = query(
            collection(db, 'forms'),
            where('agencyId', '==', user.agencyId),
            where('universId', '==', activeUniversId),
            orderBy('createdAt', 'desc')
          );
        }
      } else {
        formsQuery = query(
          collection(db, 'forms'),
          where('agencyId', '==', user.agencyId),
          orderBy('createdAt', 'desc')
        );
      }
    }

    const unsubscribeForms = onSnapshot(formsQuery, (snapshot) => {
      const allFormsData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Handle createdAt: could be Timestamp, Date, or already converted
        let createdAt: Date;
        if (data.createdAt) {
          if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt;
          } else {
            createdAt = new Date(data.createdAt);
          }
        } else {
          createdAt = new Date();
        }
        
        return {
          id: doc.id,
          ...data,
          createdAt
        };
      }) as Form[];
      
      // Filtrer les formulaires selon le rôle de l'utilisateur
      let filteredForms = allFormsData;
      if (user.role === 'employe' && !user.hasDirectorDashboardAccess) {
        // Regular employees see only forms assigned to them or created by them
        filteredForms = allFormsData.filter(form => 
          form.assignedTo.includes(user.id) || 
          form.createdByEmployeeId === user.id ||
          form.createdBy === user.id
        );
      }
      // Employees with director dashboard access see ALL forms (same as directors)
      
      setForms(filteredForms);
      setIsLoading(false);
    }, (err) => {
      console.error('Erreur lors du chargement des formulaires:', err);
      setError('Erreur lors du chargement des formulaires');
      setIsLoading(false);
    });

    return () => {
      unsubscribeForms();
    };
  }, [user, firebaseUser, activeUniversId, activeInstanceId]);

  const createForm = async (formData: Omit<Form, 'id' | 'createdAt'>) => {
    if (!user || !user.agencyId) {
      throw new Error('Données utilisateur manquantes');
    }

    // Vérifier les permissions selon le rôle
    if (user.role === 'employe') {
      // Les employés peuvent créer des formulaires s'ils ont la permission
      if (!PermissionManager.canCreateForms(user)) {
        throw new Error('Vous n\'avez pas la permission de créer des formulaires');
      }
    } else if (user.role !== 'directeur') {
      throw new Error('Seuls les directeurs et employés autorisés peuvent créer des formulaires');
    }

    // Vérifier les limites du package (pour les directeurs et employés avec accès directeur)
    // Note: Si un univers actif existe, canCreateForm() retourne true automatiquement
    // car les ressources dans un univers actif peuvent dépasser les limites du package
    if ((user.role === 'directeur' || (user.role === 'employe' && user.hasDirectorDashboardAccess)) && !canCreateForm(forms.length)) {
      if (user.role === 'employe') {
        throw new Error('Limite de formulaires atteinte. Contactez votre directeur pour cette agence.');
      } else {
        throw new Error('Limite de formulaires atteinte pour votre package. Veuillez mettre à niveau votre abonnement.');
      }
    }

    try {
      setError(null);
      
      // Récupérer l'Univers actif pour associer automatiquement la ressource
      let universIdToAssociate: string | null = null;
      let universInstanceIdToAssociate: string | null = null;
      
      if (user.role === 'directeur' && activeUniversId) {
        // Pour les directeurs, utiliser l'Univers actif déjà chargé
        universIdToAssociate = activeUniversId;
        
        // Créer l'instance à la demande si elle n'existe pas encore
        try {
          const activeUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
          if (activeUnivers && !activeUnivers.activeInstanceId) {
            // Créer l'instance à la demande pour la première ressource
            const instanceId = await universService.ensureInstanceForActiveUnivers(user.id, user.agencyId);
            if (instanceId) {
              universInstanceIdToAssociate = instanceId;
            }
          } else if (activeUnivers?.activeInstanceId) {
            universInstanceIdToAssociate = activeUnivers.activeInstanceId;
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors de la création de l\'instance à la demande (non bloquant):', error);
        }
      } else if (user.role === 'employe') {
        // Pour les employés, récupérer l'Univers actif de l'agence (via le directeur)
        try {
          const directorsSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('agencyId', '==', user.agencyId),
              where('role', '==', 'directeur')
            )
          );
          if (!directorsSnapshot.empty) {
            const directorId = directorsSnapshot.docs[0].id;
            const activeUnivers = await universService.getActiveUnivers(directorId, user.agencyId);
            if (activeUnivers) {
              universIdToAssociate = activeUnivers.activeUniversId;
              universInstanceIdToAssociate = activeUnivers.activeInstanceId || null;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'Univers actif pour l\'employé:', error);
          // Continue sans associer au Univers si erreur
        }
      }

      // Helper function to remove undefined values from objects recursively
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

      // Garantir que tous les champs requis sont présents
      const docData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        createdBy: user.id,
        createdByRole: user.role,
        assignedTo: formData.assignedTo || [],
        fields: formData.fields || [],
        agencyId: user.agencyId,
        createdAt: serverTimestamp()
      };

      // Associer automatiquement au Univers actif si disponible
      if (universIdToAssociate) {
        docData.universId = universIdToAssociate;
      }
      
      // Associer à l'instance si disponible
      if (universInstanceIdToAssociate) {
        docData.universInstanceId = universInstanceIdToAssociate;
      }

      // Only add createdByEmployeeId if the user is an employee
      if (user.role === 'employe') {
        docData.createdByEmployeeId = user.id;
      }

      // Only add timeRestrictions if it's defined and has content
      if (formData.timeRestrictions && Object.keys(formData.timeRestrictions).length > 0) {
        docData.timeRestrictions = formData.timeRestrictions;
      }

      // Nettoyer les valeurs undefined avant l'envoi à Firebase
      const cleanedDocData = removeUndefinedValues(docData);
      const formRef = await addDoc(collection(db, 'forms'), cleanedDocData);
      
      // Ajouter la ressource à l'instance si elle existe
      if (universInstanceIdToAssociate && user.role === 'directeur') {
        try {
          await universService.addResourceToInstance(user.id, user.agencyId, formRef.id, 'form');
        } catch (error) {
          console.warn('⚠️ Erreur lors de l\'ajout de la ressource à l\'instance (non bloquant):', error);
        }
      }
      
      // Track form creation in subscription session (only for directors)
      // Only track if this is NOT a Univers instantiation (instantiation doesn't use this context)
      // Check: if fromUnivers is set, this means it's from instantiation - don't track
      // Since FormsContext is only used for new creations (not instantiation), we always track
      if (user.role === 'directeur' && firebaseUser) {
        try {
          // Only track if this is a new creation, not from Univers instantiation
          // Univers instantiation creates forms directly and doesn't call this context
          // So if we're here, it's always a new creation that should be tracked
          await SubscriptionSessionService.updateUsage(firebaseUser.uid, 'forms', 1);
          logger.debug('Form creation usage tracked', {
            userId: firebaseUser.uid,
            formId: formRef.id,
            universId: universIdToAssociate
          }, 'FormsContext');
        } catch (trackingError) {
          logger.error('Error tracking form creation usage', trackingError, 'FormsContext');
          // Silent fail - don't block form creation
        }
      }

      // Send notifications to assigned employees
      if (formData.assignedTo && formData.assignedTo.length > 0) {
        try {
          await notificationService.notifyFormCreated(
            formRef.id,
            formData.title,
            formData.assignedTo,
            user.name || user.email
          );
        } catch (notificationError) {
          // Don't throw here - form creation should succeed even if notifications fail
        }
      }

      // Schedule form reminders if deadline is set
      if (formData.deadline) {
        try {
          const { formReminderService } = await import('../services/formReminderService');
          const formWithId = {
            ...formData,
            id: formRef.id,
            createdAt: new Date(),
          };
          await formReminderService.scheduleFormReminders(formWithId);
        } catch (reminderError) {
          console.error('Error scheduling form reminders:', reminderError);
          // Don't throw here - form creation should succeed even if reminders fail
        }
      }
    } catch (err) {
      console.error('Erreur lors de la création du formulaire:', err);
      setError('Erreur lors de la création du formulaire');
      throw err;
    }
  };

  const updateForm = async (formId: string, formData: Partial<Omit<Form, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    if (!user || !user.agencyId || !PermissionManager.canUpdateForms(user)) {
      throw new Error('Seuls les directeurs et employés avec accès directeur peuvent modifier des formulaires');
    }

    try {
      setError(null);
      
      // Get current form data to compare assignments
      const currentFormDoc = await getDoc(doc(db, 'forms', formId));
      const currentForm = currentFormDoc.data() as Form;
      const currentAssignedTo = currentForm?.assignedTo || [];
      const newAssignedTo = formData.assignedTo || [];
      
      // Préparer les données à mettre à jour
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp()
      };

      // Ajouter seulement les champs fournis
      if (formData.title !== undefined) updateData.title = formData.title.trim();
      if (formData.description !== undefined) updateData.description = formData.description.trim();
      if (formData.assignedTo !== undefined) updateData.assignedTo = formData.assignedTo;
      if (formData.fields !== undefined) updateData.fields = formData.fields;
      
      // Handle timeRestrictions properly - only add if it has content, or remove if empty/undefined
      if (formData.timeRestrictions !== undefined) {
        if (formData.timeRestrictions && Object.keys(formData.timeRestrictions).length > 0) {
          updateData.timeRestrictions = formData.timeRestrictions;
        } else {
          // If timeRestrictions is empty, delete the field from Firestore to ensure clean state
          updateData.timeRestrictions = deleteField();
        }
      }

      await updateDoc(doc(db, 'forms', formId), updateData);

      // Send notifications for assignment changes
      if (formData.assignedTo !== undefined) {
        const newlyAssigned = newAssignedTo.filter(id => !currentAssignedTo.includes(id));
        const removedAssigned = currentAssignedTo.filter(id => !newAssignedTo.includes(id));
        
        if (newlyAssigned.length > 0 || removedAssigned.length > 0) {
          try {
            await notificationService.notifyFormAssignmentUpdate(
              formId,
              formData.title || currentForm.title,
              newlyAssigned,
              removedAssigned,
              user.name || user.email,
              user.agencyId
            );
          } catch (notificationError) {
            // Don't throw here - form update should succeed even if notifications fail
          }
        }
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour du formulaire:', err);
      setError('Erreur lors de la mise à jour du formulaire');
      throw err;
    }
  };

  const deleteForm = async (formId: string) => {
    if (!user || !PermissionManager.canDeleteForms(user)) {
      throw new Error('Seuls les directeurs et employés avec accès directeur peuvent supprimer des formulaires');
    }

    try {
      setError(null);
      await deleteDoc(doc(db, 'forms', formId));
    } catch (err) {
      console.error('Erreur lors de la suppression du formulaire:', err);
      setError('Erreur lors de la suppression du formulaire');
      throw err;
    }
  };

  const getFormsForEmployee = (employeeId: string): Form[] => {
    // Always return only forms assigned to this specific employee
    // Director dashboard access only affects what they see on the director dashboard, not employee dashboard
    return forms.filter(form => 
      form.assignedTo && form.assignedTo.includes(employeeId)
    );
  };

  return (
    <FormsContext.Provider value={{
      forms,
      createForm,
      updateForm,
      deleteForm,
      getFormsForEmployee,
      isLoading,
      error
    }}>
      {children}
    </FormsContext.Provider>
  );
};

export const useForms = () => {
  const context = useContext(FormsContext);
  if (context === undefined) {
    // During initialization, return default values instead of throwing
    return {
      forms: [],
      createForm: async () => {},
      updateForm: async () => {},
      deleteForm: async () => {},
      getFormsForEmployee: () => [],
      isLoading: true,
      error: null
    };
  }
  return context;
};

