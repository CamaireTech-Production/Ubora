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
import { Form, FormEntry, User, DraftResponse } from '../types';
import { DraftService } from '../services/draftService';
import { useAuth } from './AuthContext';

interface AppContextType {
  forms: Form[];
  formEntries: FormEntry[];
  employees: User[];
  createForm: (form: Omit<Form, 'id' | 'createdAt'>) => Promise<void>;
  updateForm: (formId: string, form: Partial<Omit<Form, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => Promise<void>;
  submitFormEntry: (entry: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>) => Promise<void>;
  submitMultipleFormEntries: (entries: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>[]) => Promise<void>;
  deleteForm: (formId: string) => Promise<void>;
  getFormsForEmployee: (employeeId: string) => Form[];
  getEntriesForForm: (formId: string) => FormEntry[];
  getEntriesForEmployee: (employeeId: string) => FormEntry[];
  getEmployeesForAgency: (agencyId: string) => User[];
  getPendingEmployees: () => User[];
  refreshData: () => void;
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
  const [forms, setForms] = useState<Form[]>([]);
  const [formEntries, setFormEntries] = useState<FormEntry[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les données depuis Firestore quand l'utilisateur est connecté
  useEffect(() => {
    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      setForms([]);
      setFormEntries([]);
      setEmployees([]);
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
      // Les employés ne voient que les formulaires qui leur sont assignés
      formsQuery = query(
        collection(db, 'forms'),
        where('agencyId', '==', user.agencyId),
        where('assignedTo', 'array-contains', user.id),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeForms = onSnapshot(formsQuery, (snapshot) => {
      const formsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Form[];
      setForms(formsData);
      console.log('Formulaires chargés:', {
        count: formsData.length,
        userRole: user.role,
        userAgencyId: user.agencyId,
        forms: formsData.map(f => ({ 
          id: f.id, 
          title: f.title, 
          assignedTo: f.assignedTo,
          agencyId: f.agencyId 
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

    // Écouter les employés de l'agence (requête avec index composite)
    const employeesQuery = query(
      collection(db, 'users'),
      where('agencyId', '==', user.agencyId),
      where('role', '==', 'employe'),
      orderBy('name', 'asc')
    );

    const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
      const employeesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setEmployees(employeesData);
      setIsLoading(false);
      console.log('Employés chargés:', employeesData.length);
    }, (err) => {
      console.error('Erreur lors du chargement des employés:', err);
      setError('Erreur lors du chargement des employés');
      setIsLoading(false);
    });

    return () => {
      unsubscribeForms();
      unsubscribeEntries();
      unsubscribeEmployees();
    };
  }, [user, firebaseUser]);

  const createForm = async (formData: Omit<Form, 'id' | 'createdAt'>) => {
    if (!user || user.role !== 'directeur' || !user.agencyId) {
      throw new Error('Seuls les directeurs peuvent créer des formulaires');
    }

    try {
      setError(null);
      
      // Garantir que tous les champs requis sont présents
      const docData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        createdBy: user.id,
        assignedTo: formData.assignedTo || [],
        fields: formData.fields || [],
        agencyId: user.agencyId,
        timeRestrictions: formData.timeRestrictions,
        createdAt: serverTimestamp()
      };

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
      if (formData.timeRestrictions !== undefined) updateData.timeRestrictions = formData.timeRestrictions;

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
    return employees.filter(emp => emp.role === 'employe' && emp.isApproved === false);
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
      createForm,
      updateForm,
      submitFormEntry,
      submitMultipleFormEntries,
      deleteForm,
      getFormsForEmployee,
      getEntriesForForm,
      getEntriesForEmployee,
      getEmployeesForAgency,
      getPendingEmployees,
      refreshData,
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