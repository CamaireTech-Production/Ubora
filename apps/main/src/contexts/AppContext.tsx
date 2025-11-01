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
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Form, FormEntry, User, DraftResponse, Dashboard } from '../types';
import { DraftService } from '../services/draftService';
import { useAuth } from './AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { PermissionManager } from '../utils/PermissionManager';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { notificationService } from '../services/notificationService';
import { useToast } from '../hooks/useToast';
import { getAIFormatEndpoint, getFilesDownloadEndpoint } from '../config/api';

interface AppContextType {
  forms: Form[];
  formEntries: FormEntry[];
  employees: User[];
  dashboards: Dashboard[];
  createForm: (form: Omit<Form, 'id' | 'createdAt'>) => Promise<void>;
  updateForm: (formId: string, form: Partial<Omit<Form, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => Promise<void>;
  submitFormEntry: (entry: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>) => Promise<string>;
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
  // Access auth context from parent provider (always mounted in App.tsx)
  const { user, firebaseUser } = useAuth();
  const { showSuccess } = useToast();

  // Always initialize package access hooks and state hooks in stable order
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
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);


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
      if (user.role === 'directeur' || user.hasDirectorDashboardAccess) {
        // Directors and employees with director access can see all entries in their agency
        entriesQuery = query(
          collection(db, 'formEntries'),
          where('agencyId', '==', user.agencyId),
          orderBy('submittedAt', 'desc')
        );
      } else {
        // Regular employees can only see their own entries
        entriesQuery = query(
          collection(db, 'formEntries'),
          where('agencyId', '==', user.agencyId),
          where('userId', '==', user.id),
          orderBy('submittedAt', 'desc')
        );
      }
    } catch (orderByError) {
      if (user.role === 'directeur' || user.hasDirectorDashboardAccess) {
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
          // Les employés avec accès directeur voient TOUS les tableaux de bord de l'agence
          if (PermissionManager.hasDirectorDashboardAccess(user)) {
            filteredDashboards = allDashboardsData; // Voir tous les tableaux de bord
          } else {
            // Les employés normaux voient seulement leurs propres tableaux de bord
            filteredDashboards = allDashboardsData.filter(dashboard => 
              dashboard.createdByEmployeeId === user.id ||
              dashboard.createdBy === user.id
            );
          }
        }
        
        setDashboards(filteredDashboards);
        setIsLoading(false);
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

    // Vérifier les limites du package (pour les directeurs et employés avec accès directeur)
    if ((user.role === 'directeur' || (user.role === 'employe' && user.hasDirectorDashboardAccess)) && !canCreateForm(forms.length)) {
      if (user.role === 'employe') {
        throw new Error('Limite de formulaires atteinte. Contactez votre directeur pour cette agence.');
      } else {
        throw new Error('Limite de formulaires atteinte pour votre package. Veuillez mettre à niveau votre abonnement.');
      }
    }

    try {
      setError(null);
      
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

      // Only add createdByEmployeeId if the user is an employee
      if (user.role === 'employe') {
        docData.createdByEmployeeId = user.id;
      }

      // Only add timeRestrictions if it's defined and has content
      if (formData.timeRestrictions && Object.keys(formData.timeRestrictions).length > 0) {
        docData.timeRestrictions = formData.timeRestrictions;
      }

      const formRef = await addDoc(collection(db, 'forms'), docData);
      
      // Track form creation in subscription session (only for directors)
      if (user.role === 'directeur' && firebaseUser) {
        try {
          await SubscriptionSessionService.updateUsage(firebaseUser.uid, 'forms', 1);
        } catch (trackingError) {
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

  const submitFormEntry = async (entryData: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>) => {
    // Guard: Vérifier que l'utilisateur est connecté et a un profil complet
    if (!firebaseUser || !user || !user.agencyId) {
      throw new Error('Utilisateur non connecté ou profil incomplet');
    }

    try {
      setError(null);
      
      console.log('🔄 Starting form submission with file attachments:', entryData.fileAttachments?.length || 0);
      
      // Step 1: Process file attachments (upload to Firebase Storage)
      let updatedFileAttachments = entryData.fileAttachments || [];
      
      if (entryData.fileAttachments && entryData.fileAttachments.length > 0) {
        console.log('📤 Processing file attachments for submission...');
        
        // Import FileUploadService dynamically
        const { FileUploadService } = await import('../services/fileUploadService');
        
        // Process each file attachment
        const uploadPromises = entryData.fileAttachments.map(async (attachment) => {
          try {
            console.log('🔍 Processing attachment:', {
              fileName: attachment.fileName,
              hasDownloadUrl: !!attachment.downloadUrl,
              hasExtractedText: !!attachment.extractedText,
              hasBase64Data: !!attachment.base64Data,
              hasSubmissionId: !!attachment.submissionId,
              submissionId: attachment.submissionId
            });
            
            // If already has download URL, use it
            if (attachment.downloadUrl) {
              console.log(`✅ ${attachment.fileName} already has download URL`);
              return attachment;
            }
            
            // If no base64 data, can't upload the file
            if (!attachment.base64Data) {
              console.log(`⚠️ No base64 data for ${attachment.fileName}, skipping upload`);
              return {
                ...attachment,
                downloadUrl: '',
                storagePath: '',
                uploadError: 'No base64 data available',
                uploadStatus: 'skipped'
              };
            }
            
            // Convert base64 back to File object
            console.log(`🔄 Converting base64 back to file for ${attachment.fileName}...`);
            let file: File;
            
            try {
              file = FileUploadService.base64ToFile(
                attachment.base64Data,
                attachment.fileName,
                attachment.fileType
              );
              console.log(`✅ File reconstructed successfully:`, {
                name: file.name,
                size: file.size,
                type: file.type
              });
            } catch (conversionError) {
              console.error(`❌ Failed to convert base64 to file:`, conversionError);
              throw new Error(`Failed to reconstruct file from base64: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
            }
            
            // Upload to Firebase Storage
            console.log(`🔄 Uploading ${attachment.fileName} to Firebase Storage...`);
            const uploadResult = await FileUploadService.uploadFileToFirebase(
              file,
              attachment.fieldId,
              entryData.formId,
              firebaseUser.uid,
              user.agencyId
            );
            
            console.log(`✅ ${attachment.fileName} uploaded successfully:`, uploadResult.downloadUrl);
            
            // If using Firestore fallback, store the file data in a separate collection
            if (uploadResult.downloadUrl.startsWith('firestore://')) {
              console.log(`🔄 Storing file data in Firestore for ${attachment.fileName}...`);
              
              // Store file data in a separate Firestore collection
              const fileDataRef = await addDoc(collection(db, 'fileData'), {
                fileName: attachment.fileName,
                fileType: attachment.fileType,
                fileSize: attachment.fileSize,
                base64Data: attachment.base64Data,
                formId: entryData.formId,
                userId: firebaseUser.uid,
                agencyId: user.agencyId,
                fieldId: attachment.fieldId,
                uploadedAt: new Date(),
                downloadUrl: uploadResult.downloadUrl,
                storagePath: uploadResult.storagePath
              });
              
              console.log(`✅ File data stored in Firestore with ID: ${fileDataRef.id}`);
            }
            
            return {
              ...attachment,
              downloadUrl: uploadResult.downloadUrl,
              storagePath: uploadResult.storagePath
            };
            
          } catch (uploadError) {
            console.error(`❌ Failed to upload ${attachment.fileName}:`, uploadError);
            
            // Return attachment with upload error status
            return {
              ...attachment,
              downloadUrl: '', // Keep empty
              storagePath: '', // Keep empty
              uploadError: uploadError instanceof Error ? uploadError.message : 'Upload failed',
              uploadStatus: 'failed'
            };
          }
        });
        
        updatedFileAttachments = await Promise.all(uploadPromises);
        console.log('✅ All files processed');
      }
      
      // Step 2: Create FormEntry in Firebase (clean file attachments for Firestore)
      const cleanFileAttachments = updatedFileAttachments.map(attachment => ({
        fieldId: attachment.fieldId,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        fileType: attachment.fileType,
        downloadUrl: attachment.downloadUrl,
        storagePath: attachment.storagePath,
        uploadedAt: attachment.uploadedAt,
        extractedText: attachment.extractedText,
        textExtractionStatus: attachment.textExtractionStatus,
        submissionId: attachment.submissionId
        // Remove base64Data and any other complex objects that can't be stored in Firestore
      }));

      const docData = {
        formId: entryData.formId,
        userId: firebaseUser.uid,
        agencyId: user.agencyId,
        answers: entryData.answers || {},
        fileAttachments: cleanFileAttachments,
        submittedAt: serverTimestamp()
      };

      console.log('💾 Creating FormEntry in Firebase with data:', {
        formId: docData.formId,
        userId: docData.userId,
        agencyId: docData.agencyId,
        fileAttachmentsCount: docData.fileAttachments.length,
        fileAttachments: docData.fileAttachments.map(att => ({
          fieldId: att.fieldId,
          fileName: att.fileName,
          hasDownloadUrl: !!att.downloadUrl,
          hasStoragePath: !!att.storagePath,
          hasExtractedText: !!att.extractedText,
          extractedTextLength: att.extractedText?.length || 0
        }))
      });

      const docRef = await addDoc(collection(db, 'formEntries'), docData);
      console.log('✅ FormEntry created in Firebase with ID:', docRef.id);
      
      // Step 3: Call format endpoint for each PDF file
      if (updatedFileAttachments.length > 0) {
        console.log('🔄 Calling format endpoint for PDF files...');
        
        const formatPromises = updatedFileAttachments
          .filter(att => att.extractedText && att.extractedText.trim().length > 0)
          .map(async (attachment) => {
            try {
              console.log(`🔄 Formatting text for ${attachment.fileName}...`);
              
              
              // Check if submissionId exists before making the request
              if (!attachment.submissionId) {
                console.warn(`⚠️ No submissionId for ${attachment.fileName}, generating one now`);
                // Generate a submissionId if missing
                attachment.submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                console.log(`✅ Generated submissionId: ${attachment.submissionId}`);
              }

              const requestBody = {
                submissionId: attachment.submissionId,
                rawText: attachment.extractedText,
                fileName: attachment.fileName
              };

              console.log(`🔄 Sending format request for ${attachment.fileName}:`, {
                ...requestBody,
                rawTextLength: requestBody.rawText?.length || 0,
                hasSubmissionId: !!requestBody.submissionId,
                hasRawText: !!requestBody.rawText
              });
              
              console.log(`🔍 Full request body:`, JSON.stringify(requestBody, null, 2));

              const response = await fetch(getAIFormatEndpoint(), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
              });
              
              if (response.ok) {
                console.log(`✅ Format request sent for ${attachment.fileName}`);
              } else {
                const errorText = await response.text();
                console.error(`❌ Format request failed for ${attachment.fileName}:`, {
                  status: response.status,
                  statusText: response.statusText,
                  error: errorText,
                  requestBody: requestBody
                });
                
                // Try to parse the error response as JSON
                try {
                  const errorJson = JSON.parse(errorText);
                  console.error(`❌ Parsed error response:`, errorJson);
                } catch (parseError) {
                  console.error(`❌ Could not parse error response as JSON:`, errorText);
                }
              }
            } catch (error) {
              console.error(`❌ Error calling format endpoint for ${attachment.fileName}:`, error);
            }
          });
        
        await Promise.all(formatPromises);
        console.log('✅ All format requests sent');
      }
      
      // Show success message
      showSuccess('Formulaire soumis avec succès!');
      
      return docRef.id;
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

      await updateDoc(doc(db, 'formEntries', entryId), updateData);
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
    if (!user || (user.role !== 'employe' && user.role !== 'directeur') || !user.agencyId) {
      throw new Error('Seuls les employés et directeurs peuvent soumettre des formulaires');
    }

    try {
      setError(null);
      console.log('🔄 Starting multiple form submissions:', entries.length);
      
      // Process each entry individually to handle file uploads and formatting
      const submissionPromises = entries.map(async (entry) => {
        console.log('🔄 Processing entry for form:', entry.formId);
        
        // Step 1: For draft submissions, convert base64 data back to files and upload to Firebase Storage
        let updatedFileAttachments = entry.fileAttachments || [];
        
        if (entry.fileAttachments && entry.fileAttachments.length > 0) {
          console.log('📤 Processing file attachments for draft submission...');
          
          // Import FileUploadService dynamically
          const { FileUploadService } = await import('../services/fileUploadService');
          
          // Process each file attachment
          const uploadPromises = entry.fileAttachments.map(async (attachment) => {
            try {
              console.log('🔍 Processing attachment:', {
                fileName: attachment.fileName,
                hasDownloadUrl: !!attachment.downloadUrl,
                hasExtractedText: !!attachment.extractedText,
                hasBase64Data: !!attachment.base64Data,
                hasSubmissionId: !!attachment.submissionId,
                submissionId: attachment.submissionId
              });
              
              // If already has download URL, use it
              if (attachment.downloadUrl) {
                console.log(`✅ ${attachment.fileName} already has download URL`);
                return attachment;
              }
              
              // If no base64 data, can't upload the file
              if (!attachment.base64Data) {
                console.log(`⚠️ No base64 data for ${attachment.fileName}, skipping upload`);
                return attachment;
              }
              
              // Convert base64 back to File object
              console.log(`🔄 Converting base64 back to file for ${attachment.fileName}...`);
              let file: File;
              
              try {
                file = FileUploadService.base64ToFile(
                  attachment.base64Data,
                  attachment.fileName,
                  attachment.fileType
                );
                console.log(`✅ File reconstructed successfully:`, {
                  name: file.name,
                  size: file.size,
                  type: file.type
                });
              } catch (conversionError) {
                console.error(`❌ Failed to convert base64 to file:`, conversionError);
                throw new Error(`Failed to reconstruct file from base64: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
              }
              
              // Upload to Firebase Storage
              console.log(`🔄 Uploading ${attachment.fileName} to Firebase Storage...`);
              const uploadResult = await FileUploadService.uploadFileToFirebase(
                file,
                attachment.fieldId,
                entry.formId,
                user.id,
                user.agencyId
              );
              
              console.log(`✅ ${attachment.fileName} uploaded successfully:`, uploadResult.downloadUrl);
              
              return {
                ...attachment,
                downloadUrl: uploadResult.downloadUrl,
                storagePath: uploadResult.storagePath
              };
              
            } catch (uploadError) {
              console.error(`❌ Failed to upload ${attachment.fileName}:`, uploadError);
              
              // For Firebase Storage failures, we'll store the file data in Firestore as a fallback
              console.log(`🔄 Using fallback storage for ${attachment.fileName} - storing base64 data in Firestore`);
              
              // Return attachment with fallback storage info
              return {
                ...attachment,
                downloadUrl: '', // Keep empty for failed uploads
                storagePath: '', // Keep empty for failed uploads
                uploadError: uploadError instanceof Error ? uploadError.message : 'Upload failed',
                uploadStatus: 'failed',
                // Keep base64 data as fallback for failed uploads
                fallbackStorage: true,
                fallbackData: attachment.base64Data
              };
            }
          });
          
          updatedFileAttachments = await Promise.all(uploadPromises);
          console.log('✅ All file attachments processed');
        }
        
        // Step 2: Create FormEntry in Firebase (clean file attachments for Firestore)
        const cleanFileAttachments = updatedFileAttachments.map(attachment => ({
          fieldId: attachment.fieldId,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          fileType: attachment.fileType,
          downloadUrl: attachment.downloadUrl,
          storagePath: attachment.storagePath,
          uploadedAt: attachment.uploadedAt,
          extractedText: attachment.extractedText,
          textExtractionStatus: attachment.textExtractionStatus,
          submissionId: attachment.submissionId
          // Remove base64Data and any other complex objects that can't be stored in Firestore
        }));

        const docData = {
          formId: entry.formId,
          userId: user.id,
          agencyId: user.agencyId,
          answers: entry.answers || {},
          fileAttachments: cleanFileAttachments,
          submittedAt: serverTimestamp()
        };
        
        console.log('💾 Creating FormEntry in Firebase with data:', {
          formId: docData.formId,
          userId: docData.userId,
          agencyId: docData.agencyId,
          fileAttachmentsCount: docData.fileAttachments.length,
          fileAttachments: docData.fileAttachments.map(att => ({
            fieldId: att.fieldId,
            fileName: att.fileName,
            hasDownloadUrl: !!att.downloadUrl,
            hasStoragePath: !!att.storagePath,
            hasExtractedText: !!att.extractedText,
            extractedTextLength: att.extractedText?.length || 0
          }))
        });

        const docRef = await addDoc(collection(db, 'formEntries'), docData);
        console.log('✅ FormEntry created in Firebase with ID:', docRef.id);
        
        // Step 3: Call format endpoint for each PDF file
        if (updatedFileAttachments.length > 0) {
          console.log('🔄 Calling format endpoint for PDF files...');
          
          const formatPromises = updatedFileAttachments
            .filter(att => att.extractedText && att.extractedText.trim().length > 0)
            .map(async (attachment) => {
              try {
                console.log(`🔄 Formatting text for ${attachment.fileName}...`);
                
                
                const response = await fetch(getAIFormatEndpoint(), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    submissionId: attachment.submissionId,
                    rawText: attachment.extractedText,
                    fileName: attachment.fileName
                  })
                });
                
                if (response.ok) {
                  console.log(`✅ Format request sent for ${attachment.fileName}`);
                } else {
                  console.error(`❌ Format request failed for ${attachment.fileName}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    endpoint: getAIFormatEndpoint()
                  });
                  
                  // Try alternative endpoint
                  if (response.status === 404) {
                    console.log(`🔄 Trying alternative endpoint...`);
                    const altResponse = await fetch(getAIFormatEndpoint(), {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        submissionId: attachment.submissionId,
                        rawText: attachment.extractedText,
                        fileName: attachment.fileName
                      })
                    });
                    
                    if (altResponse.ok) {
                      console.log(`✅ Format request sent via alternative endpoint for ${attachment.fileName}`);
                    } else {
                      console.error(`❌ Alternative endpoint also failed:`, altResponse.statusText);
                    }
                  }
                }
              } catch (error) {
                console.error(`❌ Error calling format endpoint for ${attachment.fileName}:`, error);
              }
            });
          
          await Promise.all(formatPromises);
          console.log('✅ All format requests sent');
        }
        
        return docRef.id;
      });
      
      await Promise.all(submissionPromises);
      console.log('✅ All form entries submitted successfully');
      
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

    // Vérifier les limites du package (pour les directeurs et employés avec accès directeur)
    if ((user.role === 'directeur' || (user.role === 'employe' && user.hasDirectorDashboardAccess)) && !canCreateDashboard(dashboards.length)) {
      if (user.role === 'employe') {
        throw new Error('Limite de tableaux de bord atteinte. Contactez votre directeur pour cette agence.');
      } else {
        throw new Error('Limite de tableaux de bord atteinte pour votre package. Veuillez mettre à niveau votre abonnement.');
      }
    }

    try {
      setError(null);
      
      const docData: any = {
        name: dashboardData.name.trim(),
        description: dashboardData.description?.trim() || '',
        metrics: dashboardData.metrics.map(metric => ({
          ...metric,
          createdAt: new Date()
        })),
        createdBy: user.id,
        createdByRole: user.role,
        agencyId: user.agencyId,
        isDefault: dashboardData.isDefault || false,
        createdAt: serverTimestamp()
      };

      // Only add createdByEmployeeId if the user is an employee
      if (user.role === 'employe') {
        docData.createdByEmployeeId = user.id;
      }

      await addDoc(collection(db, 'dashboards'), docData);
      
      // Track dashboard creation in subscription session (only for directors)
      if (user.role === 'directeur' && firebaseUser) {
        try {
          await SubscriptionSessionService.updateUsage(firebaseUser.uid, 'dashboards', 1);
        } catch (trackingError) {
        }
      }
    } catch (err) {
      console.error('Erreur lors de la création du tableau de bord:', err);
      setError('Erreur lors de la création du tableau de bord');
      throw err;
    }
  };

  const updateDashboard = async (dashboardId: string, dashboardData: Partial<Omit<Dashboard, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    if (!user || !user.agencyId || !PermissionManager.canUpdateDashboards(user)) {
      throw new Error('Seuls les directeurs et employés avec accès directeur peuvent modifier des tableaux de bord');
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

      await updateDoc(doc(db, 'dashboards', dashboardId), updateData);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du tableau de bord:', err);
      setError('Erreur lors de la mise à jour du tableau de bord');
      throw err;
    }
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!user || !PermissionManager.canDeleteDashboards(user)) {
      throw new Error('Seuls les directeurs et employés avec accès directeur peuvent supprimer des tableaux de bord');
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
    // During initialization, return default values instead of throwing
    return {
      forms: [],
      formEntries: [],
      employees: [],
      dashboards: [],
      createForm: async () => {},
      updateForm: async () => {},
      submitFormEntry: async () => {},
      updateFormEntry: async () => {},
      submitMultipleFormEntries: async () => {},
      deleteForm: async () => {},
      getFormsForEmployee: () => [],
      getEntriesForForm: () => [],
      getEntriesForEmployee: () => [],
      getEmployeesForAgency: () => [],
      getPendingEmployees: () => [],
      refreshData: () => {},
      createDashboard: async () => {},
      updateDashboard: async () => {},
      deleteDashboard: async () => {},
      getDashboardsForDirector: () => [],
      getDraftsForForm: () => [],
      saveDraft: () => {},
      deleteDraft: () => {},
      deleteDraftsForForm: () => {},
      createDraft: () => ({ id: '', formId: '', userId: '', agencyId: '', answers: {}, fileAttachments: [], isDraft: true as const, createdAt: new Date(), updatedAt: new Date() }),
      isLoading: true,
      error: null
    };
  }
  return context;
};
