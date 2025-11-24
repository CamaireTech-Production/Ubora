import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  getDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { FormEntry } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';
import { getAIFormatEndpoint, getVectorSyncEndpoint } from '../config/api';

interface EntriesContextType {
  formEntries: FormEntry[];
  submitFormEntry: (entry: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>) => Promise<string>;
  updateFormEntry: (entryId: string, entry: Partial<Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>>) => Promise<void>;
  deleteFormEntry: (entryId: string) => Promise<void>;
  submitMultipleFormEntries: (entries: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>[]) => Promise<void>;
  getEntriesForForm: (formId: string) => FormEntry[];
  getEntriesForEmployee: (employeeId: string) => FormEntry[];
  isLoading: boolean;
  error: string | null;
}

const EntriesContext = createContext<EntriesContextType | undefined>(undefined);

export const EntriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  const { showSuccess } = useToast();
  
  const [formEntries, setFormEntries] = useState<FormEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les entrées de formulaires depuis Firestore
  useEffect(() => {
    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      setFormEntries([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

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
      setIsLoading(false);
    }, (err) => {
      console.error('Erreur lors du chargement des entrées:', err);
      setError('Erreur lors du chargement des entrées');
      setIsLoading(false);
    });

    return () => {
      unsubscribeEntries();
    };
  }, [user, firebaseUser]);

  const submitFormEntry = async (entryData: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>) => {
    // Guard: Vérifier que l'utilisateur est connecté et a un profil complet
    if (!firebaseUser || !user || !user.agencyId) {
      throw new Error('Utilisateur non connecté ou profil incomplet');
    }

    try {
      setError(null);
      
      // Step 1: Process file attachments (upload to Firebase Storage)
      let updatedFileAttachments = entryData.fileAttachments || [];
      
      if (entryData.fileAttachments && entryData.fileAttachments.length > 0) {
        // Import FileUploadService dynamically
        const { FileUploadService } = await import('../services/fileUploadService');
        
        // Process each file attachment
        const uploadPromises = entryData.fileAttachments.map(async (attachment) => {
          try {
            // If already has download URL, use it
            if (attachment.downloadUrl) {
              return attachment;
            }
            
            // If no base64 data, can't upload the file
            if (!attachment.base64Data) {
              return {
                ...attachment,
                downloadUrl: '',
                storagePath: '',
                uploadError: 'No base64 data available',
                uploadStatus: 'skipped'
              };
            }
            
            // Convert base64 back to File object
            let file: File;
            try {
              file = FileUploadService.base64ToFile(
                attachment.base64Data,
                attachment.fileName,
                attachment.fileType
              );
            } catch (conversionError) {
              throw new Error(`Failed to reconstruct file from base64: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
            }
            
            // Upload to Firebase Storage
            const uploadResult = await FileUploadService.uploadFileToFirebase(
              file,
              attachment.fieldId,
              entryData.formId,
              firebaseUser.uid,
              user.agencyId
            );
            
            // If using Firestore fallback, store the file data in a separate collection
            if (uploadResult.downloadUrl.startsWith('firestore://')) {
              await addDoc(collection(db, 'fileData'), {
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
            }
            
            return {
              ...attachment,
              downloadUrl: uploadResult.downloadUrl,
              storagePath: uploadResult.storagePath
            };
            
          } catch (uploadError) {
            return {
              ...attachment,
              downloadUrl: '',
              storagePath: '',
              uploadError: uploadError instanceof Error ? uploadError.message : 'Upload failed',
              uploadStatus: 'failed'
            };
          }
        });
        
        updatedFileAttachments = await Promise.all(uploadPromises);
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
      }));

      // Determine initial statuses based on whether files need formatting
      const hasFilesWithExtractionForSubmit = cleanFileAttachments.some(
        att => att.extractedText && att.extractedText.trim().length > 0
      );

      const docData = {
        formId: entryData.formId,
        userId: firebaseUser.uid,
        agencyId: user.agencyId,
        answers: entryData.answers || {},
        fileAttachments: cleanFileAttachments,
        submittedAt: serverTimestamp(),
        formattingStatus: hasFilesWithExtractionForSubmit ? 'pending' : null,
        formattingRetryCount: 0,
        vectorSyncStatus: hasFilesWithExtractionForSubmit ? 'pending' : 'pending',
        vectorSyncRetryCount: 0,
      };

      const docRef = await addDoc(collection(db, 'formEntries'), docData);

      // Step 2.5: Trigger vector sync conditionally
      if (!hasFilesWithExtractionForSubmit) {
        const vectorSyncUrl = getVectorSyncEndpoint();
        fetch(vectorSyncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formEntryId: docRef.id,
            operation: 'create'
          })
        })
        .then(response => {
          if (response.ok) {
            return response.json();
          } else {
            return response.json().catch(() => ({ error: 'Unknown error' }));
          }
        })
        .catch(error => {
          console.error('❌ [VectorSync] Vector sync request failed (non-blocking):', error);
        });
      }
      
      // Step 3: Call format endpoint for each PDF file
      if (updatedFileAttachments.length > 0) {
        const formatPromises = updatedFileAttachments
          .filter(att => att.extractedText && att.extractedText.trim().length > 0)
          .map(async (attachment) => {
            try {
              // Check if submissionId exists before making the request
              if (!attachment.submissionId) {
                attachment.submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              }

              const requestBody = {
                submissionId: attachment.submissionId,
                rawText: attachment.extractedText,
                fileName: attachment.fileName
              };

              const response = await fetch(getAIFormatEndpoint(), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Format request failed for ${attachment.fileName}:`, {
                  status: response.status,
                  statusText: response.statusText,
                  error: errorText
                });
              }
            } catch (error) {
              console.error(`❌ Error calling format endpoint for ${attachment.fileName}:`, error);
            }
          });
        
        await Promise.all(formatPromises);
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
      
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp()
      };

      if (entryData.formId !== undefined) updateData.formId = entryData.formId;
      if (entryData.answers !== undefined) updateData.answers = entryData.answers;
      if (entryData.fileAttachments !== undefined) updateData.fileAttachments = entryData.fileAttachments;

      await updateDoc(doc(db, 'formEntries', entryId), updateData);

      // Trigger vector sync in background (async, non-blocking)
      const vectorSyncUrl = getVectorSyncEndpoint();
      fetch(vectorSyncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formEntryId: entryId,
          operation: 'update'
        })
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          return response.json().catch(() => ({ error: 'Unknown error' }));
        }
      })
      .catch(error => {
        console.error('❌ [VectorSync] Vector sync request failed (non-blocking):', error);
      });
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

  const submitMultipleFormEntries = async (entries: Omit<FormEntry, 'id' | 'submittedAt' | 'userId' | 'agencyId'>[]) => {
    if (!user || (user.role !== 'employe' && user.role !== 'directeur') || !user.agencyId) {
      throw new Error('Seuls les employés et directeurs peuvent soumettre des formulaires');
    }

    try {
      setError(null);
      
      // Process each entry individually to handle file uploads and formatting
      const submissionPromises = entries.map(async (entry) => {
        // Step 1: For draft submissions, convert base64 data back to files and upload to Firebase Storage
        let updatedFileAttachments = entry.fileAttachments || [];
        
        if (entry.fileAttachments && entry.fileAttachments.length > 0) {
          // Import FileUploadService dynamically
          const { FileUploadService } = await import('../services/fileUploadService');
          
          // Process each file attachment
          const uploadPromises = entry.fileAttachments.map(async (attachment) => {
            try {
              // If already has download URL, use it
              if (attachment.downloadUrl) {
                return attachment;
              }
              
              // If no base64 data, can't upload the file
              if (!attachment.base64Data) {
                return attachment;
              }
              
              // Convert base64 back to File object
              let file: File;
              try {
                file = FileUploadService.base64ToFile(
                  attachment.base64Data,
                  attachment.fileName,
                  attachment.fileType
                );
              } catch (conversionError) {
                throw new Error(`Failed to reconstruct file from base64: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
              }
              
              // Upload to Firebase Storage
              const uploadResult = await FileUploadService.uploadFileToFirebase(
                file,
                attachment.fieldId,
                entry.formId,
                user.id,
                user.agencyId
              );
              
              return {
                ...attachment,
                downloadUrl: uploadResult.downloadUrl,
                storagePath: uploadResult.storagePath
              };
              
            } catch (uploadError) {
              return {
                ...attachment,
                downloadUrl: '',
                storagePath: '',
                uploadError: uploadError instanceof Error ? uploadError.message : 'Upload failed',
                uploadStatus: 'failed',
                fallbackStorage: true,
                fallbackData: attachment.base64Data
              };
            }
          });
          
          updatedFileAttachments = await Promise.all(uploadPromises);
        }
        
        // Step 2: Create FormEntry in Firebase
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
        }));

        const hasFilesWithExtraction = cleanFileAttachments.some(
          att => att.extractedText && att.extractedText.trim().length > 0
        );

        const docData = {
          formId: entry.formId,
          userId: user.id,
          agencyId: user.agencyId,
          answers: entry.answers || {},
          fileAttachments: cleanFileAttachments,
          submittedAt: serverTimestamp(),
          formattingStatus: hasFilesWithExtraction ? 'pending' : null,
          formattingRetryCount: 0,
          vectorSyncStatus: hasFilesWithExtraction ? 'pending' : 'pending',
          vectorSyncRetryCount: 0,
        };

        const docRef = await addDoc(collection(db, 'formEntries'), docData);

        // Step 2.5: Trigger vector sync conditionally
        if (!hasFilesWithExtraction) {
          const vectorSyncUrl = getVectorSyncEndpoint();
          fetch(vectorSyncUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              formEntryId: docRef.id,
              operation: 'create'
            })
          })
          .then(response => {
            if (response.ok) {
              return response.json();
            } else {
              return response.json().catch(() => ({ error: 'Unknown error' }));
            }
          })
          .catch(error => {
            console.error('❌ [VectorSync] Vector sync request failed (non-blocking):', error);
          });
        }
        
        // Step 3: Call format endpoint for each PDF file
        if (updatedFileAttachments.length > 0) {
          const formatPromises = updatedFileAttachments
            .filter(att => att.extractedText && att.extractedText.trim().length > 0)
            .map(async (attachment) => {
              try {
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
                
                if (!response.ok) {
                  console.error(`❌ Format request failed for ${attachment.fileName}:`, {
                    status: response.status,
                    statusText: response.statusText
                  });
                }
              } catch (error) {
                console.error(`❌ Error calling format endpoint for ${attachment.fileName}:`, error);
              }
            });
          
          await Promise.all(formatPromises);
        }
        
        return docRef.id;
      });
      
      await Promise.all(submissionPromises);
      
    } catch (err) {
      console.error('Erreur lors de la soumission multiple:', err);
      setError('Erreur lors de la soumission des formulaires');
      throw err;
    }
  };

  const getEntriesForForm = (formId: string): FormEntry[] => {
    return formEntries.filter(entry => entry.formId === formId);
  };

  const deleteFormEntry = async (entryId: string) => {
    // Guard: Vérifier que l'utilisateur est connecté et a un profil complet
    if (!firebaseUser || !user || !user.agencyId) {
      throw new Error('Utilisateur non connecté ou profil incomplet');
    }

    // Seuls les directeurs peuvent supprimer des réponses
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      throw new Error('Seuls les directeurs peuvent supprimer des réponses');
    }

    try {
      setError(null);
      
      // Vérifier que la réponse appartient à la même agence
      const entryRef = doc(db, 'formEntries', entryId);
      const entryDoc = await getDoc(entryRef);
      
      if (!entryDoc.exists()) {
        throw new Error('Réponse non trouvée');
      }

      const entryData = entryDoc.data();
      if (entryData.agencyId !== user.agencyId) {
        throw new Error('Vous n\'avez pas l\'autorisation de supprimer cette réponse');
      }

      // Supprimer la réponse
      await deleteDoc(entryRef);
      
      // Show success message
      showSuccess('Réponse supprimée avec succès');
    } catch (err) {
      console.error('Erreur lors de la suppression de la réponse:', err);
      if (err instanceof Error) {
        if (err.message.includes('Missing or insufficient permissions')) {
          setError('Permissions insuffisantes pour supprimer cette réponse.');
        } else {
          setError(`Erreur lors de la suppression: ${err.message}`);
        }
      } else {
        setError('Erreur lors de la suppression de la réponse');
      }
      throw err;
    }
  };

  const getEntriesForEmployee = (employeeId: string): FormEntry[] => {
    return formEntries.filter(entry => entry.userId === employeeId);
  };

  return (
    <EntriesContext.Provider value={{
      formEntries,
      submitFormEntry,
      updateFormEntry,
      deleteFormEntry,
      submitMultipleFormEntries,
      getEntriesForForm,
      getEntriesForEmployee,
      isLoading,
      error
    }}>
      {children}
    </EntriesContext.Provider>
  );
};

export const useEntries = () => {
  const context = useContext(EntriesContext);
  if (context === undefined) {
    // During initialization, return default values instead of throwing
    return {
      formEntries: [],
      submitFormEntry: async () => '',
      updateFormEntry: async () => {},
      deleteFormEntry: async () => {},
      submitMultipleFormEntries: async () => {},
      getEntriesForForm: () => [],
      getEntriesForEmployee: () => [],
      isLoading: true,
      error: null
    };
  }
  return context;
};

