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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Form, FormEntry, User, DraftResponse, Dashboard } from '../types';
import { DraftService } from '../services/draftService';
import { useAuth } from './AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { PermissionManager } from '../utils/PermissionManager';

interface AppContextType {
  forms: Form[];
  formEntries: FormEntry[];
  employees: User[];
  dashboards: Dashboard[];
  createForm: (form: Omit<Form, 'id' | 'createdAt'>) => Promise<void>;
  updateForm: (formId: string, form: Partial<Omit<Form, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => Promise<void>;
  submitFormEntry: (entry: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>) => Promise<void>;
  updateFormEntry: (entryId: string, entry: Partial<Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>>) => Promise<void>;
  submitMultipleFormEntries: (entries: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>[]) => Promise<void>;
  deleteForm: (formId: string) => Promise<void>;
  getFormsForEmployee: (employeeId: string) => Form[];
  getEntriesForForm: (formId: string) => FormEntry[];
  getEntriesForEmployee: (employeeId: string) => FormEntry[];
  getEmployeesForAgency: (agencyId: string) => User[];
  getPendingEmployees: () => User[];
  refreshData: () => void;
  // Dashboard management
  createDashboard: (dashboard: Omit<Dashboard, 'id' | 'createdAt'>) => Promise<void>;
  updateDashboard: (dashboardId: string, dashboard: Partial<Omit<Dashboard, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => Promise<void>;
  deleteDashboard: (dashboardId: string) => Promise<void>;
  getDashboardsForDirector: (directorId: string) => Dashboard[];
  // Draft management
  getDraftsForForm: (userId: string, formId: string) => DraftResponse[];
  saveDraft: (draft: DraftResponse) => void;
  deleteDraft: (draftId: string) => void;
  deleteDraftsForForm: (userId: string, formId: string) => void;
  createDraft: (formId: string, userId: string, agencyId: string, answers?: Record<string, any>, fileAttachments?: any[]) => DraftResponse;
  isLoading: boolean;
  error: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  const { canCreateForm, canCreateDashboard } = usePackageAccess();
  const [forms, setForms] = useState<Form[]>([]);
  const [formEntries, setFormEntries] = useState<FormEntry[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les données depuis Firestore quand l'utilisateur est connecté
  useEffect(() => {
    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      setForms([]);
      setFormEntries([]);
      setEmployees([]);
      setDashboards([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    console.log('Chargement des données pour l\'agence:', user.agencyId);

    // Écouter les formulaires selon le rôle de l'utilisateur
    let formsQuery;
    if (user.role === 'directeur') {
      // Les directeurs voient tous les formulaires de leur agence
      formsQuery = query(
        collection(db, 'forms'),
        where('agencyId', '==', user.agencyId),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Les employés voient les formulaires qui leur sont assignés ET ceux qu'ils ont créés
      // Note: Firestore ne supporte pas les requêtes OR complexes, donc on récupère tous les formulaires
      // et on filtre côté client
      formsQuery = query(
        collection(db, 'forms'),
        where('agencyId', '==', user.agencyId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeForms = onSnapshot(formsQuery, (snapshot) => {
      const allFormsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Form[];
      
      // Filtrer les formulaires selon le rôle de l'utilisateur
      let filteredForms = allFormsData;
      if (user.role === 'employe') {
        filteredForms = allFormsData.filter(form => 
          form.assignedTo.includes(user.id) || 
          form.createdByEmployeeId === user.id ||
          form.createdBy === user.id
        );
      }
      
      setForms(filteredForms);
      console.log('Formulaires chargés:', {
        count: filteredForms.length,
        userRole: user.role,
        userAgencyId: user.agencyId,
        forms: filteredForms.map(f => ({ 
          id: f.id, 
          title: f.title, 
          assignedTo: f.assignedTo,
          agencyId: f.agencyId,
          createdBy: f.createdBy,
          createdByRole: f.createdByRole,
          createdByEmployeeId: f.createdByEmployeeId
        }))
      });
    }, (err) => {
      console.error('Erreur lors du chargement des formulaires:', err);
      setError('Erreur lors du chargement des formulaires');
    });

    // Écouter les entrées de formulaires de l'agence
    if (!user.agencyId) {
      console.error('❌ User has no agencyId, cannot load form entries');
      setError('Utilisateur sans agence assignée');
      return;
    }

    // Try with orderBy first, fallback to simple query if it fails
    let entriesQuery;
    try {
      if (user.role === 'directeur') {
        // Directors can see all entries in their agency
        entriesQuery = query(
          collection(db, 'formEntries'),
          where('agencyId', '==', user.agencyId),
          orderBy('submittedAt', 'desc')
        );
      } else {
        // Employees can only see their own entries
        entriesQuery = query(
          collection(db, 'formEntries'),
          where('agencyId', '==', user.agencyId),
          where('userId', '==', user.id),
          orderBy('submittedAt', 'desc')
        );
      }
    } catch (orderByError) {
      console.warn('⚠️ OrderBy failed, using simple query:', orderByError);
      if (user.role === 'directeur') {
        entriesQuery = query(
          collection(db, 'formEntries'),
          where('agencyId', '==', user.agencyId)
        );
      } else {
        entriesQuery = query(
          collection(db, 'formEntries'),
          where('agencyId', '==', user.agencyId),
          where('userId', '==', user.id)
        );
      }
    }

    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
      const entriesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          submittedAt: data.submittedAt?.toDate() || new Date()
        };
      }) as FormEntry[];
      
      setFormEntries(entriesData);
    }, (err) => {
      console.error('Erreur lors du chargement des entrées:', err);
      setError('Erreur lors du chargement des entrées');
    });

    // Écouter les employés de l'agence (sans orderBy pour éviter les problèmes d'index)
    const employeesQuery = query(
      collection(db, 'users'),
      where('agencyId', '==', user.agencyId),
      where('role', '==', 'employe')
    );

    const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
      const employeesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      
      // Sort employees by name in JavaScript
      employeesData.sort((a, b) => a.name.localeCompare(b.name));
      
      setEmployees(employeesData);
      console.log('Employés chargés:', employeesData.length);
    }, (err) => {
      console.error('Erreur lors du chargement des employés:', err);
      setError('Erreur lors du chargement des employés');
    });

    // Écouter les tableaux de bord de l'agence
    let unsubscribeDashboards: (() => void) | undefined;
    
    // Les directeurs et employés avec accès peuvent voir les tableaux de bord
    if (user.role === 'directeur' || PermissionManager.hasDirectorDashboardAccess(user)) {
      const dashboardsQuery = query(
        collection(db, 'dashboards'),
        where('agencyId', '==', user.agencyId),
        orderBy('createdAt', 'desc')
      );

      unsubscribeDashboards = onSnapshot(dashboardsQuery, (snapshot) => {
        const allDashboardsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as Dashboard[];
        
        // Filtrer les tableaux de bord selon le rôle de l'utilisateur
        let filteredDashboards = allDashboardsData;
        if (user.role === 'employe') {
          // Les employés voient les tableaux de bord qu'ils ont créés ET ceux de l'agence
          // (car ils ont accès au dashboard directeur)
          filteredDashboards = allDashboardsData.filter(dashboard => 
            dashboard.createdByEmployeeId === user.id ||
            dashboard.createdBy === user.id ||
            dashboard.createdByRole === 'directeur' // Tableaux de bord créés par le directeur
          );
        }
        
        setDashboards(filteredDashboards);
        setIsLoading(false);
        console.log('Tableaux de bord chargés:', {
          count: filteredDashboards.length,
          userRole: user.role,
          dashboards: filteredDashboards.map(d => ({ 
            id: d.id, 
            name: d.name, 
            createdBy: d.createdBy,
            createdByRole: d.createdByRole,
            createdByEmployeeId: d.createdByEmployeeId
          }))
        });
      }, (err) => {
        console.error('Erreur lors du chargement des tableaux de bord:', err);
        setError('Erreur lors du chargement des tableaux de bord');
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      unsubscribeForms();
      unsubscribeEntries();
      unsubscribeEmployees();
      if (unsubscribeDashboards) {
        unsubscribeDashboards();
      }
    };
  }, [user, firebaseUser]);

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

    // Vérifier les limites du package (seulement pour les directeurs)
    if (user.role === 'directeur' && !canCreateForm(forms.length)) {
      throw new Error('Limite de formulaires atteinte pour votre package. Veuillez mettre à niveau votre abonnement.');
    }

    try {
      setError(null);
      
      // Garantir que tous les champs requis sont présents
      const docData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        createdBy: user.id,
        createdByRole: user.role,
        createdByEmployeeId: user.role === 'employe' ? user.id : undefined,
        assignedTo: formData.assignedTo || [],
        fields: formData.fields || [],
        agencyId: user.agencyId,
        createdAt: serverTimestamp()
      };

      // Only add timeRestrictions if it's defined and has content
      if (formData.timeRestrictions && Object.keys(formData.timeRestrictions).length > 0) {
        docData.timeRestrictions = formData.timeRestrictions;
      }

      console.log('Création du formulaire:', docData);
      await addDoc(collection(db, 'forms'), docData);
    } catch (err) {
      console.error('Erreur lors de la création du formulaire:', err);
      setError('Erreur lors de la création du formulaire');
      throw err;
    }
  };

  const updateForm = async (formId: string, formData: Partial<Omit<Form, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    if (!user || user.role !== 'directeur' || !user.agencyId) {
      throw new Error('Seuls les directeurs peuvent modifier des formulaires');
    }

    try {
      setError(null);
      
      // Préparer les données à mettre à jour
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp()
      };

      // Ajouter seulement les champs fournis
      if (formData.title !== undefined) updateData.title = formData.title.trim();
      if (formData.description !== undefined) updateData.description = formData.description.trim();
      if (formData.assignedTo !== undefined) updateData.assignedTo = formData.assignedTo;
      if (formData.fields !== undefined) updateData.fields = formData.fields;
      
      // Handle timeRestrictions properly - only add if it has content, or remove if undefined
      if (formData.timeRestrictions !== undefined) {
        if (formData.timeRestrictions && Object.keys(formData.timeRestrictions).length > 0) {
          updateData.timeRestrictions = formData.timeRestrictions;
        } else {
          // If timeRestrictions is undefined or empty, remove the field from Firestore
          updateData.timeRestrictions = null;
        }
      }

      console.log('Mise à jour du formulaire:', { formId, updateData });
      await updateDoc(doc(db, 'forms', formId), updateData);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du formulaire:', err);
      setError('Erreur lors de la mise à jour du formulaire');
      throw err;
    }
  };

  const submitFormEntry = async (entryData: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>) => {
    // Guard: Vérifier que l'utilisateur est connecté et a un profil complet
    if (!firebaseUser || !user || !user.agencyId) {
      throw new Error('Utilisateur non connecté ou profil incomplet');
    }

    try {
      setError(null);
      
      // Forcer les champs requis selon les spécifications
      const docData = {
        formId: entryData.formId,
        userId: firebaseUser.uid, // Forcer auth.uid
        agencyId: user.agencyId, // Hérité du user
        answers: entryData.answers || {},
        fileAttachments: entryData.fileAttachments || [],
        submittedAt: serverTimestamp() // Forcer serverTimestamp
      };

      console.log('Soumission du formulaire vers formEntries:', docData);
      await addDoc(collection(db, 'formEntries'), docData);
      console.log('✅ Formulaire soumis avec succès');
    } catch (err) {
      console.error('Erreur lors de la soumission du formulaire:', err);
      if (err instanceof Error) {
        if (err.message.includes('Missing or insufficient permissions')) {
          setError('Permissions insuffisantes. Vérifiez que vous êtes assigné à ce formulaire.');
        } else {
          setError(`Erreur lors de la soumission: ${err.message}`);
        }
      } else {
        setError('Erreur lors de la soumission du formulaire');
      }
      throw err;
    }
  };

  const updateFormEntry = async (entryId: string, entryData: Partial<Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>>) => {
    // Guard: Vérifier que l'utilisateur est connecté et a un profil complet
    if (!firebaseUser || !user || !user.agencyId) {
      throw new Error('Utilisateur non connecté ou profil incomplet');
    }

    try {
      setError(null);
      
      // Préparer les données à mettre à jour
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp()
      };

      // Ajouter seulement les champs fournis
      if (entryData.formId !== undefined) updateData.formId = entryData.formId;
      if (entryData.answers !== undefined) updateData.answers = entryData.answers;
      if (entryData.fileAttachments !== undefined) updateData.fileAttachments = entryData.fileAttachments;

      console.log('Mise à jour de la réponse:', { entryId, updateData });
      await updateDoc(doc(db, 'formEntries', entryId), updateData);
      console.log('✅ Réponse mise à jour avec succès');
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la réponse:', err);
      if (err instanceof Error) {
        if (err.message.includes('Missing or insufficient permissions')) {
          setError('Permissions insuffisantes pour modifier cette réponse.');
        } else {
          setError(`Erreur lors de la mise à jour: ${err.message}`);
        }
      } else {
        setError('Erreur lors de la mise à jour de la réponse');
      }
      throw err;
    }
  };

  const deleteForm = async (formId: string) => {
    if (!user || user.role !== 'directeur') {
      throw new Error('Seuls les directeurs peuvent supprimer des formulaires');
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
    return forms.filter(form => 
      form.assignedTo && form.assignedTo.includes(employeeId)
    );
  };

  const getEntriesForForm = (formId: string): FormEntry[] => {
    return formEntries.filter(entry => entry.formId === formId);
  };

  const getEntriesForEmployee = (employeeId: string): FormEntry[] => {
    return formEntries.filter(entry => entry.userId === employeeId);
  };

  const getEmployeesForAgency = (agencyId: string): User[] => {
    return employees.filter(emp => emp.agencyId === agencyId);
  };

  const getPendingEmployees = (): User[] => {
    return employees.filter(emp => 
      emp.role === 'employe' && 
      emp.isApproved === false && 
      !emp.hasDirectorDashboardAccess
    );
  };

  const refreshData = () => {
    // Force reload by triggering the useEffect
    setIsLoading(true);
  };

  const submitMultipleFormEntries = async (entries: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>[]) => {
    if (!user || user.role !== 'employe' || !user.agencyId) {
      throw new Error('Seuls les employés peuvent soumettre des formulaires');
    }

    try {
      setError(null);
      
      const batch = writeBatch(db);
      
      entries.forEach((entry) => {
        const docRef = doc(collection(db, 'formEntries'));
        const docData = {
          formId: entry.formId,
          userId: user.id,
          agencyId: user.agencyId,
          answers: entry.answers,
          fileAttachments: entry.fileAttachments || [],
          submittedAt: serverTimestamp()
        };
        
        batch.set(docRef, docData);
      });

      await batch.commit();
    } catch (err) {
      console.error('Erreur lors de la soumission multiple:', err);
      setError('Erreur lors de la soumission des formulaires');
      throw err;
    }
  };

  // Dashboard management functions
  const createDashboard = async (dashboardData: Omit<Dashboard, 'id' | 'createdAt'>) => {
    if (!user || !user.agencyId) {
      throw new Error('Données utilisateur manquantes');
    }

    // Vérifier les permissions selon le rôle
    if (user.role === 'employe') {
      // Les employés peuvent créer des tableaux de bord s'ils ont la permission
      if (!PermissionManager.canCreateDashboards(user)) {
        throw new Error('Vous n\'avez pas la permission de créer des tableaux de bord');
      }
    } else if (user.role !== 'directeur') {
      throw new Error('Seuls les directeurs et employés autorisés peuvent créer des tableaux de bord');
    }

    // Vérifier les limites du package (seulement pour les directeurs)
    if (user.role === 'directeur' && !canCreateDashboard(dashboards.length)) {
      throw new Error('Limite de tableaux de bord atteinte pour votre package. Veuillez mettre à niveau votre abonnement.');
    }

    try {
      setError(null);
      
      const docData = {
        name: dashboardData.name.trim(),
        description: dashboardData.description?.trim() || '',
        metrics: dashboardData.metrics.map(metric => ({
          ...metric,
          createdAt: new Date()
        })),
        createdBy: user.id,
        createdByRole: user.role,
        createdByEmployeeId: user.role === 'employe' ? user.id : undefined,
        agencyId: user.agencyId,
        isDefault: dashboardData.isDefault || false,
        createdAt: serverTimestamp()
      };

      console.log('Création du tableau de bord:', docData);
      await addDoc(collection(db, 'dashboards'), docData);
    } catch (err) {
      console.error('Erreur lors de la création du tableau de bord:', err);
      setError('Erreur lors de la création du tableau de bord');
      throw err;
    }
  };

  const updateDashboard = async (dashboardId: string, dashboardData: Partial<Omit<Dashboard, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    if (!user || user.role !== 'directeur' || !user.agencyId) {
      throw new Error('Seuls les directeurs peuvent modifier des tableaux de bord');
    }

    try {
      setError(null);
      
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp()
      };

      if (dashboardData.name !== undefined) updateData.name = dashboardData.name.trim();
      if (dashboardData.description !== undefined) updateData.description = dashboardData.description?.trim() || '';
      if (dashboardData.metrics !== undefined) updateData.metrics = dashboardData.metrics;
      if (dashboardData.isDefault !== undefined) updateData.isDefault = dashboardData.isDefault;

      console.log('Mise à jour du tableau de bord:', { dashboardId, updateData });
      await updateDoc(doc(db, 'dashboards', dashboardId), updateData);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du tableau de bord:', err);
      setError('Erreur lors de la mise à jour du tableau de bord');
      throw err;
    }
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!user || user.role !== 'directeur') {
      throw new Error('Seuls les directeurs peuvent supprimer des tableaux de bord');
    }

    try {
      setError(null);
      await deleteDoc(doc(db, 'dashboards', dashboardId));
    } catch (err) {
      console.error('Erreur lors de la suppression du tableau de bord:', err);
      setError('Erreur lors de la suppression du tableau de bord');
      throw err;
    }
  };

  const getDashboardsForDirector = (directorId: string): Dashboard[] => {
    return dashboards.filter(dashboard => dashboard.createdBy === directorId);
  };

  // Draft management functions
  const getDraftsForForm = (userId: string, formId: string): DraftResponse[] => {
    return DraftService.getDraftsForForm(userId, formId);
  };

  const saveDraft = (draft: DraftResponse): void => {
    DraftService.saveDraft(draft);
  };

  const deleteDraft = (draftId: string): void => {
    DraftService.deleteDraft(draftId);
  };

  const deleteDraftsForForm = (userId: string, formId: string): void => {
    DraftService.deleteDraftsForForm(userId, formId);
  };

  const createDraft = (
    formId: string, 
    userId: string, 
    agencyId: string, 
    answers: Record<string, any> = {}, 
    fileAttachments: any[] = []
  ): DraftResponse => {
    return DraftService.createDraft(formId, userId, agencyId, answers, fileAttachments);
  };

  return (
    <AppContext.Provider value={{
      forms,
      formEntries,
      employees,
      dashboards,
      createForm,
      updateForm,
      submitFormEntry,
      updateFormEntry,
      submitMultipleFormEntries,
      deleteForm,
      getFormsForEmployee,
      getEntriesForForm,
      getEntriesForEmployee,
      getEmployeesForAgency,
      getPendingEmployees,
      refreshData,
      // Dashboard management
      createDashboard,
      updateDashboard,
      deleteDashboard,
      getDashboardsForDirector,
      // Draft management
      getDraftsForForm,
      saveDraft,
      deleteDraft,
      deleteDraftsForForm,
      createDraft,
      isLoading,
      error
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
