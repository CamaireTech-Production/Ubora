import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  deleteUser,
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, collection, query, where, getDocs, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';
import { AnalyticsService } from '../services/analyticsService';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { SubscriptionSessionCollectionService } from '../services/subscriptionSessionCollectionService';
import { withFirebaseErrorHandling, FirebaseErrorHandler } from '../services/firebaseErrorHandler';
import { universService } from '../services/universService';
import { withRetry, withFirestoreRetry, withAuthRetry } from '../utils/retryHandler';
import { sanitizeSensitiveErrorMessage } from '../utils/errorSanitizer';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (email: string, password: string, name: string, role: 'admin' | 'directeur' | 'employe', agencyId: string) => Promise<{ success: boolean; error?: string; action?: 'login' | 'recover'; universCreated?: boolean; directorInfo?: { id: string; name: string; email: string } }>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateTokensLocally: (tokensUsed: number) => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [firestoreErrorCount] = useState(0);
  const [firestoreDisabled] = useState(false);
  const [firestoreCircuitBreaker, setFirestoreCircuitBreaker] = useState(false);

  // Fonction pour vérifier si un email existe dans Firebase Auth
  const checkEmailExistsInAuth = async (email: string): Promise<{ exists: boolean; error?: string }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      
      if (signInMethods.length > 0) {
        return { 
          exists: true, 
          error: 'Email déjà utilisé. Essayez de vous connecter.' 
        };
      }
      
      return { exists: false };
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification de l\'email dans Auth:', error);
      // Si l'erreur est "user-not-found", l'email n'existe pas (c'est OK)
      if (error.code === 'auth/user-not-found') {
        return { exists: false };
      }
      // Pour les autres erreurs, on considère que l'email existe pour éviter les doublons
      return { 
        exists: true, 
        error: 'Erreur lors de la vérification de l\'email. Veuillez réessayer.' 
      };
    }
  };

  // Fonction pour vérifier si un email existe dans Firestore
  const checkEmailExistsInFirestore = async (email: string): Promise<{ exists: boolean; error?: string }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const emailQuery = query(
        collection(db, 'users'),
        where('email', '==', normalizedEmail)
      );
      
      const emailSnapshot = await withFirestoreRetry(
        () => getDocs(emailQuery),
        { maxRetries: 2, retryDelay: 500 }
      ) as QuerySnapshot;
      
      if (!emailSnapshot.empty) {
        return { 
          exists: true, 
          error: 'Email déjà utilisé. Essayez de vous connecter.' 
        };
      }
      
      return { exists: false };
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification de l\'email dans Firestore:', error);
      
      if (error.code === 'permission-denied') {
        // Si permission denied, on ne peut pas vérifier, mais on continue (Auth vérifiera)
        return { exists: false };
      }
      
      return { 
        exists: false,
        error: 'Erreur lors de la vérification de l\'email. Veuillez réessayer.' 
      };
    }
  };

  // Fonction pour vérifier si un agencyId existe déjà dans Firestore
  const checkAgencyIdExists = async (agencyId: string): Promise<{ exists: boolean; error?: string }> => {
    try {
      const trimmedAgencyId = agencyId.trim();
      
      if (!trimmedAgencyId) {
        return { 
          exists: false, 
          error: 'L\'ID d\'agence est obligatoire.' 
        };
      }
      
      // Vérifier qu'il existe au moins un directeur avec cet agencyId
      const directorsQuery = query(
        collection(db, 'users'),
        where('agencyId', '==', trimmedAgencyId),
        where('role', '==', 'directeur')
      );
      
      const directorsSnapshot = await withFirestoreRetry(
        () => getDocs(directorsQuery),
        { maxRetries: 2, retryDelay: 500 }
      ) as QuerySnapshot;
      
      if (!directorsSnapshot.empty) {
        return { 
          exists: true, 
          error: 'ID agence existe déjà. Veuillez utiliser un autre ID.' 
        };
      }
      
      return { exists: false };
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification de l\'agence:', error);
      
      if (error.code === 'permission-denied') {
        return { 
          exists: false, 
          error: 'Erreur de permissions: Impossible de vérifier l\'agence. Veuillez contacter le support technique.' 
        };
      }
      
      return { 
        exists: false, 
        error: 'Erreur technique lors de la vérification de l\'agence. Veuillez réessayer ou contacter le support.' 
      };
    }
  };

  // Fonction utilitaire pour créer les données utilisateur selon le rôle
  const createUserData = (
    name: string,
    email: string,
    role: 'admin' | 'directeur' | 'employe',
    agencyId: string
  ): Omit<User, 'id'> => {
    const baseData: Omit<User, 'id'> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      agencyId: agencyId.trim(),
      isApproved: role === 'directeur' || role === 'admin' ? true : false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (role === 'admin') {
      return {
        ...baseData,
        isSuperAdmin: true,
        adminPermissions: [
          'user_management',
          'system_monitoring',
          'analytics_access',
          'settings_management',
          'backup_restore',
          'log_access'
        ],
        isActive: true
      };
    }

    if (role === 'directeur') {
      return {
        ...baseData,
        needsPackageSelection: true,
        currentSubscriptionSessionId: undefined // Will be set after package selection
        // Note: tokensUsedMonthly et tokensResetDate ne sont plus utilisés
        // Les tokens sont gérés dans subscriptionSessions
      };
    }

    // role === 'employe'
    return {
      ...baseData,
      isApproved: false, // Pending director approval
      approvedBy: undefined,
      approvedAt: undefined,
      accessLevels: [],
      hasDirectorDashboardAccess: false
    };
  };

  // Fonction pour vérifier les limites d'utilisateurs d'une agence (optimisée avec currentSubscriptionSessionId)
  const checkAgencyUserLimit = async (agencyId: string): Promise<{ canAddUser: boolean; error?: string; directorInfo?: { id: string; name: string; email: string } }> => {
    try {
      console.log('🔍 Checking agency user limit for agencyId:', agencyId);
      
      // Récupérer le directeur de l'agence
      const directorsQuery = query(
        collection(db, 'users'),
        where('agencyId', '==', agencyId),
        where('role', '==', 'directeur')
      );
      
      const directorsSnapshot = await withFirestoreRetry(
        () => getDocs(directorsQuery),
        { maxRetries: 2, retryDelay: 500 }
      ) as QuerySnapshot;
      
      if (directorsSnapshot.empty) {
        console.error('❌ NO DIRECTOR FOUND: No director exists for agency:', agencyId);
        return { 
          canAddUser: false, 
          error: 'Aucun directeur trouvé pour cette agence. Veuillez vérifier l\'ID d\'agence ou contacter le support.' 
        };
      }
      
      const directorDoc = directorsSnapshot.docs[0];
      const director = directorDoc.data() as User;
      const directorId = directorDoc.id;
      
      // Extraire les informations du directeur pour les messages d'erreur
      const directorInfo = {
        id: directorId,
        name: director.name || 'Directeur',
        email: director.email || ''
      };
      
      console.log('🔍 Director found:', directorInfo);
      
      // OPTIMISATION: Utiliser currentSubscriptionSessionId directement
      if (!director.currentSubscriptionSessionId) {
        console.error('❌ NO ACTIVE SESSION: Director has no active subscription session');
        return { 
          canAddUser: false, 
          error: 'Directeur n\'a pas de package actif. Contactez votre directeur pour activer un package.',
          directorInfo
        };
      }
      
      // Récupérer la session directement via l'ID
      const sessionDocRef = doc(db, 'subscriptionSessions', director.currentSubscriptionSessionId);
      const sessionDoc = await withFirestoreRetry(
        () => getDoc(sessionDocRef),
        { maxRetries: 2, retryDelay: 500 }
      ) as DocumentSnapshot;
      
      if (!sessionDoc.exists()) {
        console.error('❌ SESSION NOT FOUND: Session document does not exist:', director.currentSubscriptionSessionId);
        return { 
          canAddUser: false, 
          error: 'Directeur n\'a pas de package actif. Contactez votre directeur pour activer un package.',
          directorInfo
        };
      }
      
      const sessionData = sessionDoc.data();
      
      // Vérifier que la session est active et appartient au directeur
      if (sessionData.userId !== directorId || !sessionData.isActive) {
        console.error('❌ INVALID SESSION: Session is not active or does not belong to director');
            return { 
              canAddUser: false, 
          error: 'Directeur n\'a pas de package actif. Contactez votre directeur pour activer un package.',
          directorInfo
        };
      }
      
      // Extraire les limites du package
      const packageResources = sessionData.packageResources || {};
      const payAsYouGoResources = sessionData.payAsYouGoResources || {};
      const usage = sessionData.usage || {};
      
      const usersIncluded = packageResources.usersIncluded || 0;
      const payAsYouGoUsers = payAsYouGoResources.users || 0;
      const usersAdded = usage.usersAdded || 0;
      
      // Calculer la limite totale (package + pay-as-you-go)
      const maxUsers = usersIncluded === -1 ? -1 : usersIncluded + payAsYouGoUsers;
      
      console.log('🔍 Session quota check:', {
        sessionId: director.currentSubscriptionSessionId,
        usersIncluded,
        payAsYouGoUsers,
        maxUsers,
        usersAdded,
        remaining: maxUsers === -1 ? 'Unlimited' : maxUsers - usersAdded
      });
      
      // Vérifier si le quota est illimité
      if (maxUsers === -1) {
        console.log('✅ Unlimited users - allowing creation');
        return { canAddUser: true, directorInfo };
      }
      
      // Vérifier si le quota est atteint
      if (usersAdded >= maxUsers) {
        console.error('❌ QUOTA EXCEEDED:', { usersAdded, maxUsers });
        return { 
          canAddUser: false, 
          error: 'Quota atteint. Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.',
          directorInfo
        };
      }
      
      console.log('✅ Quota available - allowing creation');
      return { canAddUser: true, directorInfo };
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification des limites:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        agencyId: agencyId
      });
      
      // Handle specific Firebase permission errors
      if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
        console.error('❌ PERMISSION ERROR: Cannot access director information to check user limits');
        return { 
          canAddUser: false, 
          error: 'Erreur de permissions: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.' 
        };
      }
      
      // For other errors, show a user-friendly message
      console.error('❌ UNEXPECTED ERROR: Failed to check user limits');
      return { 
        canAddUser: false, 
        error: 'Erreur technique lors de la vérification des limites. Veuillez réessayer ou contacter le support.' 
      };
    }
  };


  // Initialize Firestore readiness with more robust testing
  useEffect(() => {
    const initFirestore = async () => {
      try {
        // Wait longer for Firestore to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test Firestore connection with a simple operation
        try {
          const testDoc = doc(db, '_test', 'connection');
          await getDoc(testDoc);
        } catch {
          // Even if test fails, we can still proceed
        }
        
        setFirestoreReady(true);
        // Reset circuit breaker on successful initialization
        setFirestoreCircuitBreaker(false);
      } catch (error) {
        console.error('Firestore initialization failed:', error);
        // Still allow app to continue after a delay
        setTimeout(() => setFirestoreReady(true), 3000);
      }
    };
    
    initFirestore();
  }, []);

  // Global error handler for Firebase errors with graceful degradation
  useEffect(() => {
    const handleFirebaseError = (event: ErrorEvent) => {
      if (event.error && event.error.message && 
          (event.error.message.includes('INTERNAL ASSERTION FAILED') || 
           event.error.message.includes('Firestore') ||
           event.error.message.includes('Firebase'))) {
        
        console.warn('🔥 [AuthContext] Firebase error detected, using graceful degradation');
        
        // Use cached data instead of failing
        const cached = localStorage.getItem('ubora_cached_user');
        if (cached) {
          try {
            const userData = JSON.parse(cached);
            setUser(userData);
            console.info('🔥 [AuthContext] Using cached user data due to Firebase error');
          } catch (e) {
            console.warn('🔥 [AuthContext] Failed to parse cached user data');
          }
        }
        
        // Prevent the error from crashing the app
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleFirebaseError);
    return () => window.removeEventListener('error', handleFirebaseError);
  }, []);

  // Écouter les changements d'authentification Firebase
  useEffect(() => {
    if (!firestoreReady) return; // Wait for Firestore to be ready
    
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      // Clear any pending operations to prevent concurrent calls
      clearTimeout(timeoutId);
      
      // Set loading immediately when auth state changes
      // IMPORTANT: Garder isLoading à true jusqu'à ce que user soit complètement chargé
      setIsLoading(true);
      setError(null);
      
      // Utiliser un délai minimal pour éviter les appels concurrents
      // Mais s'assurer que isLoading reste true pendant tout le processus
      timeoutId = setTimeout(async () => {
        
        if (firebaseUser) {
          try {
            // Check circuit breaker first
            if (firestoreCircuitBreaker || firestoreErrorCount > 3) {
              // Use cached data instead
              const cached = localStorage.getItem('ubora_cached_user');
              if (cached) {
                const cachedUser = JSON.parse(cached);
                setUser(cachedUser);
                setFirebaseUser(firebaseUser);
                setError('Mode hors ligne: données locales affichées');
                setIsLoading(false);
                return;
              }
            }
            
            // Wait a bit to ensure Firestore is fully initialized
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Récupérer ou créer le document utilisateur
            
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            
            // Use the new error handling system
            const userDoc = await withFirebaseErrorHandling(async () => {
              return await Promise.race([
                getDoc(userDocRef),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout: Impossible de se connecter à Firestore')), 8000)
                )
              ]) as DocumentSnapshot;
            }, 3);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as Omit<User, 'id'>;
            
            // Pour les directeurs, vérifier et corriger currentSubscriptionSessionId si nécessaire
            if (userData.role === 'directeur') {
              try {
                const currentSessionId = userData.currentSubscriptionSessionId;
                let needsUpdate = false;
                let newSessionId = currentSessionId;

                // Vérifier si currentSubscriptionSessionId pointe vers une session active valide
                if (currentSessionId) {
                  // Vérifier que la session existe et est active
                  try {
                    const sessionDoc = await getDoc(doc(db, 'subscriptionSessions', currentSessionId));
                    if (sessionDoc.exists()) {
                      const sessionData = sessionDoc.data();
                      if (sessionData.userId === firebaseUser.uid && sessionData.isActive) {
                        // La session est valide, pas besoin de mise à jour
                        newSessionId = currentSessionId;
                      } else {
                        // La session n'est pas active ou n'appartient pas à cet utilisateur
                        needsUpdate = true;
                      }
                    } else {
                      // La session n'existe pas
                      needsUpdate = true;
                    }
                  } catch (error) {
                    // Erreur lors de la vérification, considérer comme invalide
                    needsUpdate = true;
                  }

                  // Si une mise à jour est nécessaire, chercher une session active
                  if (needsUpdate) {
                    const activeSession = await SubscriptionSessionCollectionService.getActiveSession(firebaseUser.uid);
                    if (activeSession && activeSession.id !== currentSessionId) {
                      newSessionId = activeSession.id;
                    } else {
                      // Aucune session active trouvée, vérifier s'il y a des sessions inactives
                      const allSessions = await SubscriptionSessionCollectionService.getUserSessions(firebaseUser.uid);
                      if (allSessions.length > 0) {
                        // Trier par date de création (la plus récente en premier)
                        allSessions.sort((a, b) => {
                          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 
                                       (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?._seconds * 1000 || 0;
                          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 
                                       (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?._seconds * 1000 || 0;
                          return bTime - aTime;
                        });

                        const mostRecentSession = allSessions[0];
                        const now = new Date();
                        const endDate = mostRecentSession.endDate instanceof Date ? mostRecentSession.endDate :
                                       (mostRecentSession.endDate as any)?.toDate?.() || new Date(mostRecentSession.endDate);

                        // Si la session la plus récente n'est pas expirée, la réactiver
                        if (endDate > now) {
                          await SubscriptionSessionCollectionService.updateSession(mostRecentSession.id, {
                            isActive: true
                          });
                          newSessionId = mostRecentSession.id;
                          needsUpdate = true;
                        } else {
                          // Toutes les sessions sont expirées, créer une session "free" par défaut
                          const freeSessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(firebaseUser.uid);
                          if (freeSessionId) {
                            newSessionId = freeSessionId;
                            needsUpdate = true;
                          }
                        }
                      } else {
                        // Aucune session trouvée, créer une session "free" par défaut
                        const freeSessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(firebaseUser.uid);
                        if (freeSessionId) {
                          newSessionId = freeSessionId;
                          needsUpdate = true;
                        }
                      }
                    }
                  }
                } else {
                  // Pas de currentSubscriptionSessionId, chercher une session active
                  const activeSession = await SubscriptionSessionCollectionService.getActiveSession(firebaseUser.uid);
                  if (activeSession) {
                    newSessionId = activeSession.id;
                    needsUpdate = true;
                  } else {
                    // Aucune session active trouvée, créer une session "free" par défaut
                    try {
                      const freeSessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(firebaseUser.uid);
                      if (freeSessionId) {
                        newSessionId = freeSessionId;
                        needsUpdate = true;
                        console.log('✅ Session free créée automatiquement pour le directeur:', firebaseUser.uid);
                      }
                    } catch (freeSessionError) {
                      console.error('❌ Erreur lors de la création de la session free:', freeSessionError);
                      // Continuer même si la création échoue - l'utilisateur sera redirigé vers package selection
                    }
                  }
                }

                // Mettre à jour le document utilisateur si nécessaire
                if (needsUpdate && newSessionId) {
                  try {
                    await updateDoc(userDocRef, {
                      currentSubscriptionSessionId: newSessionId,
                      updatedAt: serverTimestamp()
                    });
                    // Mettre à jour userData avec le nouveau sessionId
                    userData.currentSubscriptionSessionId = newSessionId;
                    console.log('✅ currentSubscriptionSessionId corrigé pour le directeur:', firebaseUser.uid, '→', newSessionId);
                  } catch (updateError) {
                    console.error('❌ Erreur lors de la mise à jour de currentSubscriptionSessionId:', updateError);
                    // Continuer même en cas d'erreur
                  }
                }
              } catch (sessionError) {
                console.error('Erreur lors de la vérification de la session pour le directeur:', firebaseUser.uid, sessionError);
                // Continuer même en cas d'erreur - l'utilisateur sera redirigé vers package selection si needsPackageSelection est true
              }
            }
            
            // Cache user locally for offline usage
            try { localStorage.setItem('ubora_cached_user', JSON.stringify({ id: firebaseUser.uid, ...userData })); } catch {}
            
            // Vérifier l'approbation pour les employés
            if (userData.role === 'employe' && userData.isApproved === false) {
              // Ne pas déconnecter, laisser l'utilisateur voir la page d'attente
              setUser({
                id: firebaseUser.uid,
                ...userData
              });
              setFirebaseUser(firebaseUser);
              setIsLoading(false);
              return;
            }
            
            // NOTE: Les employés avec hasDirectorDashboardAccess héritent de la session du directeur
            // Ils n'ont pas besoin de leur propre session - la vérification se fait via usePackageAccess
            // qui récupère la session du directeur de leur agence
            
            setUser({
              id: firebaseUser.uid,
              ...userData
            });
            setFirebaseUser(firebaseUser);
            
            // Marquer le chargement comme terminé seulement après avoir défini l'utilisateur
            setIsLoading(false);
            
            // Note: L'univers par défaut est maintenant créé de manière synchrone pendant l'inscription
            // Il n'est plus nécessaire de le créer ici lors de la connexion
            // Si l'univers n'existe pas, il sera créé à la demande lors de la première utilisation
          } else {
            // Document utilisateur manquant, déconnecter
            await signOut(auth);
            setError('Profil utilisateur non trouvé. Veuillez vous réinscrire.');
            setIsLoading(false);
          }
        } catch (err) {
          console.error('Erreur lors de la récupération des données utilisateur:', err);
          
          // Always try cached user first as fallback
          try {
            const cached = localStorage.getItem('ubora_cached_user');
            if (cached) {
              const cachedUser = JSON.parse(cached);
              setUser(cachedUser);
              setFirebaseUser(firebaseUser);
              setError('Mode hors ligne: données locales affichées');
              setIsLoading(false);
              return;
            }
          } catch {}
          
          // Use the new error handling system for user-friendly messages
          const errorMessage = FirebaseErrorHandler.getUserFriendlyMessage(err);
          setError(errorMessage);
          
          // Log the technical error for debugging
          console.error('🔥 [AuthContext] User authentication error:', err);
          
          // Only sign out if we have no cached data and it's a critical error
          try {
            const cached = localStorage.getItem('ubora_cached_user');
            if (!cached) {
              await signOut(auth);
            }
          } catch {}
          
          setIsLoading(false);
        }
        } else {
          setUser(null);
          setFirebaseUser(null);
          setIsLoading(false);
        }
      }, 100); // Small delay to prevent rapid successive calls
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [firestoreReady, firestoreCircuitBreaker, firestoreErrorCount]);

  // Écouter les changements du document utilisateur en temps réel
  useEffect(() => {
    if (!firebaseUser || firestoreDisabled || firestoreCircuitBreaker) return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (userDoc: DocumentSnapshot) => {
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<User, 'id'>;
        

        // Vérifier l'approbation pour les employés
        // Si isApproved est false ou undefined, l'employé est en attente
        // Le RoleBasedRedirect gérera la redirection vers /pending-approval
        // Si isApproved est true, l'employé peut accéder au dashboard
        setUser({
          id: firebaseUser.uid,
          ...userData
        });
      }
    }, (error: Error) => {
      console.error('Erreur lors de l\'écoute des changements utilisateur:', error);
    });

    return () => unsubscribe();
  }, [firebaseUser, firestoreDisabled, firestoreCircuitBreaker]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Vérifier que le document utilisateur existe
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await signOut(auth);
        setError('Profil utilisateur non trouvé. Veuillez vous réinscrire.');
        return false;
      }
      // Cache user after successful login fetch
      try { localStorage.setItem('ubora_cached_user', JSON.stringify({ id: userCredential.user.uid, ...userDoc.data() })); } catch {}
      
      // Marquer pour afficher l'écran de bienvenue juste après la connexion
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return true;
    } catch (err: any) {
      console.error('Erreur de connexion:', err);
      setError(formatAuthErrorMessage(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction helper pour détecter si on est en PWA
  const isPWA = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Check for standalone mode (Android/Desktop)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    
    // Check for iOS Safari standalone mode
    if ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) {
      return true;
    }
    
    // Check if running in PWA mode
    if (window.location.search.includes('source=pwa') || 
        document.referrer.includes('android-app://')) {
      return true;
    }
    
    return false;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const provider = new GoogleAuthProvider();
      
      // En PWA, utiliser signInWithRedirect au lieu de signInWithPopup pour meilleure compatibilité
      const isPWAMode = isPWA();
      
      let result;
      if (isPWAMode) {
        // En PWA, utiliser redirect (meilleure compatibilité mobile)
        try {
          // Note: signInWithRedirect nécessite une gestion spéciale du callback
          // Pour l'instant, on essaie quand même avec popup en PWA mais avec fallback
          result = await signInWithPopup(auth, provider);
        } catch (popupError: any) {
          // Si popup échoue en PWA, c'est normal - proposer une alternative
          if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
            setError('POPUP_BLOCKED_PWA');
            return false;
          }
          throw popupError;
        }
      } else {
        // En navigateur normal, utiliser popup avec retry
        result = await withAuthRetry(
          () => signInWithPopup(auth, provider),
          { maxRetries: 2, retryDelay: 1000 }
        );
      }
      
      // Vérifier si l'utilisateur existe dans Firestore
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await withFirestoreRetry(
        () => getDoc(userDocRef),
        { maxRetries: 2, retryDelay: 500 }
      ) as DocumentSnapshot;
      
      if (!userDoc.exists()) {
        // RÉCUPÉRATION AUTOMATIQUE: Si le document Firestore n'existe pas, le créer
        console.log('🔄 Récupération automatique Google: Document Firestore manquant pour utilisateur Auth existant');
        
        // Check if this is an invitation-based registration
        const urlParams = new URLSearchParams(window.location.search);
        const isInvite = urlParams.get('invite') === 'true';
        const inviteAgencyId = urlParams.get('agencyId');
        const inviteRole = urlParams.get('role');
        
        if (isInvite) {
          // Handle invitation-based registration (employees only)
          if (inviteRole !== 'employe' || !inviteAgencyId) {
            await signOut(auth);
            setError('Lien d\'invitation invalide. Contactez votre directeur.');
            return false;
          }
          
          // Verify the agency exists and has a director
          const directorsQuery = query(
            collection(db, 'users'),
            where('agencyId', '==', inviteAgencyId),
            where('role', '==', 'directeur')
          );
          const directorsSnapshot = await withFirestoreRetry(
            () => getDocs(directorsQuery),
            { maxRetries: 2, retryDelay: 500 }
          ) as QuerySnapshot;
          
          if (directorsSnapshot.empty) {
            await signOut(auth);
            setError('Agence invalide. Contactez votre directeur.');
            return false;
          }
          
          // Vérifier les limites AVANT de créer le document
          try {
            const limitCheck = await checkAgencyUserLimit(inviteAgencyId);
            if (!limitCheck.canAddUser) {
              await signOut(auth);
              setError(limitCheck.error || 'Limite d\'utilisateurs atteinte. Contactez votre directeur.');
              return false;
            }
          } catch (limitError) {
            console.error('❌ REGISTRATION ERROR: Failed to check user limits during Google employee registration');
            await signOut(auth);
            setError('Erreur technique: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.');
            return false;
          }
          
          // Create user profile with validated invitation data
          const userData: Omit<User, 'id'> = {
            name: result.user.displayName || '',
            email: result.user.email || '',
            role: 'employe', // Always employee for invitations
            agencyId: inviteAgencyId, // From invitation
            isApproved: false, // Requires director approval
            accessLevels: [],
            hasDirectorDashboardAccess: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          await withFirestoreRetry(
            () => setDoc(userDocRef, userData),
            { maxRetries: 3, retryDelay: 1000 }
          );
          
          // Track user addition in subscription session
          try {
            const director = directorsSnapshot.docs[0];
            await SubscriptionSessionService.updateUsage(director.id, 'users', 1);
          } catch (trackingError) {
            console.warn('⚠️ Could not track user addition (non-blocking):', trackingError);
          }
        } else {
          // Handle director registration (no invitation needed)
          const userData = createUserData(
            result.user.displayName || '',
            result.user.email || '',
            'directeur',
            '' // Will be set during onboarding
          );
          
          await withFirestoreRetry(
            () => setDoc(userDocRef, userData),
            { maxRetries: 3, retryDelay: 1000 }
          );
          
          // Redirect to package selection
          sessionStorage.setItem('needs_package_selection', 'true');
        }
      }
      
      // Marquer pour afficher l'écran de bienvenue juste après la connexion
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return true;
    } catch (err: any) {
      console.error('Erreur de connexion Google:', err);
      setError(formatAuthErrorMessage(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string, 
    password: string, 
    name: string, 
    role: 'admin' | 'directeur' | 'employe',
    agencyId: string
  ): Promise<{ success: boolean; error?: string; action?: 'login' | 'recover'; universCreated?: boolean; directorInfo?: { id: string; name: string; email: string } }> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const normalizedEmail = email.trim().toLowerCase();
      let userCredential: UserCredential | null = null;
      
      // ============================================
      // PRÉ-VALIDATION POUR DIRECTEURS
      // ============================================
      if (role === 'directeur') {
        // 1. Vérifier l'email dans Firebase Auth
        const emailAuthCheck = await checkEmailExistsInAuth(normalizedEmail);
        if (emailAuthCheck.exists) {
          setError(emailAuthCheck.error || 'Email déjà utilisé. Essayez de vous connecter.');
          return { 
            success: false, 
            error: emailAuthCheck.error || 'Email déjà utilisé. Essayez de vous connecter.',
            action: 'login'
          };
        }
        
        // 2. Vérifier l'email dans Firestore
        const emailFirestoreCheck = await checkEmailExistsInFirestore(normalizedEmail);
        if (emailFirestoreCheck.exists) {
          setError(emailFirestoreCheck.error || 'Email déjà utilisé. Essayez de vous connecter.');
          return { 
            success: false, 
            error: emailFirestoreCheck.error || 'Email déjà utilisé. Essayez de vous connecter.',
            action: 'login'
          };
        }
        
        // 3. Vérifier l'agencyId (doit être unique pour les directeurs)
        const agencyIdCheck = await checkAgencyIdExists(agencyId);
        if (agencyIdCheck.exists) {
          setError(agencyIdCheck.error || 'ID agence existe déjà. Veuillez utiliser un autre ID.');
          return { 
            success: false, 
            error: agencyIdCheck.error || 'ID agence existe déjà. Veuillez utiliser un autre ID.'
          };
        }
      }
      
      // ============================================
      // PRÉ-VALIDATION ET VÉRIFICATION DES LIMITES POUR EMPLOYÉS
      // ============================================
          if (role === 'employe') {
        // 1. Vérifier l'email dans Firebase Auth
        const emailAuthCheck = await checkEmailExistsInAuth(normalizedEmail);
        if (emailAuthCheck.exists) {
          setError(emailAuthCheck.error || 'Email déjà utilisé. Essayez de vous connecter.');
          return { 
            success: false, 
            error: emailAuthCheck.error || 'Email déjà utilisé. Essayez de vous connecter.',
            action: 'login'
          };
        }
        
        // 2. Vérifier l'email dans Firestore
        const emailFirestoreCheck = await checkEmailExistsInFirestore(normalizedEmail);
        if (emailFirestoreCheck.exists) {
          setError(emailFirestoreCheck.error || 'Email déjà utilisé. Essayez de vous connecter.');
          return { 
            success: false, 
            error: emailFirestoreCheck.error || 'Email déjà utilisé. Essayez de vous connecter.',
            action: 'login'
          };
        }
        
        // 3. Vérifier les limites d'utilisateurs (avec optimisation currentSubscriptionSessionId)
            try {
              const limitCheck = await withRetry(
                () => checkAgencyUserLimit(agencyId),
                { maxRetries: 2, retryDelay: 500 }
              );
          if (!limitCheck.canAddUser) {
            // Retourner l'erreur avec les infos du directeur pour affichage dans le modal
            setError(limitCheck.error || 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour cette agence.');
            return { 
              success: false, 
              error: limitCheck.error || 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour cette agence.',
              directorInfo: limitCheck.directorInfo
            };
          }
        } catch (error) {
          console.error('❌ REGISTRATION ERROR: Failed to check user limits during employee registration');
          setError('Erreur technique: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.');
          return { 
            success: false, 
            error: 'Erreur technique: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.'
          };
        }
      }
      
      // ============================================
      // CRÉATION DU COMPTE FIREBASE AUTH
      // ============================================
      try {
        userCredential = await withAuthRetry(
          () => createUserWithEmailAndPassword(auth, normalizedEmail, password),
          { maxRetries: 3, retryDelay: 1000 }
        ) as UserCredential;
      } catch (authError: any) {
        console.error('❌ [REGISTER] Firebase Auth error:', {
          code: authError.code,
          message: authError.message,
          email: normalizedEmail
        });
        
        // Gestion des erreurs Auth
        if (authError.code === 'auth/email-already-in-use') {
          setError('Email déjà utilisé. Essayez de vous connecter.');
                return { 
                  success: false, 
            error: 'Email déjà utilisé. Essayez de vous connecter.',
                  action: 'login'
                };
              }
        
        setError(formatAuthErrorMessage(authError));
        return { 
          success: false, 
          error: formatAuthErrorMessage(authError)
        };
      }
      
      if (!userCredential) {
        throw new Error('userCredential is undefined after Auth creation');
      }
      
      // ============================================
      // CRÉATION DU DOCUMENT FIRESTORE
      // ============================================
              const userData = createUserData(name, normalizedEmail, role, agencyId);
              
      try {
        await withFirestoreRetry(
          () => setDoc(doc(db, 'users', userCredential!.user.uid), userData),
          { maxRetries: 3, retryDelay: 1000 }
        );
      } catch (firestoreError: any) {
        console.error('❌ [REGISTER] Firestore creation error:', firestoreError);
        
        // Rollback: Supprimer le compte Auth si la création Firestore échoue
        try {
          if (userCredential?.user) {
            await deleteUser(userCredential.user);
            console.log('✅ Auth user deleted due to Firestore creation failure');
          }
        } catch (deleteError) {
          console.error('❌ Failed to delete Auth user during rollback:', deleteError);
        }
        
        setError('Erreur lors de la création du profil. Veuillez réessayer.');
        return { 
          success: false, 
          error: 'Erreur lors de la création du profil. Veuillez réessayer.'
        };
      }
      
      // ============================================
      // CRÉATION DE L'UNIVERS PAR DÉFAUT (DIRECTEURS UNIQUEMENT)
      // ============================================
      let universCreated = false;
      if (role === 'directeur' && agencyId.trim()) {
        try {
          await universService.ensureDefaultUnivers(userCredential.user.uid, agencyId);
          universCreated = true;
          console.log('✅ Univers par défaut créé pour le directeur:', userCredential.user.uid);
        } catch (universError: any) {
          console.error('⚠️ Erreur lors de la création de l\'univers par défaut (non bloquant):', universError);
          // Ne pas bloquer la registration si l'univers ne peut pas être créé
          // L'utilisateur pourra continuer et l'univers sera créé plus tard si nécessaire
          universCreated = false;
        }
      }
      
      // ============================================
      // TRACKING ET ANALYTICS (NON BLOQUANT)
      // ============================================
      // Track user addition in subscription session (only for employees)
      if (role === 'employe') {
        try {
          const directorsQuery = query(
            collection(db, 'users'),
            where('agencyId', '==', agencyId),
            where('role', '==', 'directeur')
          );
          const directorsSnapshot = await withFirestoreRetry(
            () => getDocs(directorsQuery),
            { maxRetries: 1, retryDelay: 500 }
          ) as QuerySnapshot;
          
          if (!directorsSnapshot.empty) {
            const director = directorsSnapshot.docs[0];
            const directorData = director.data() as User;
            
            // Utiliser currentSubscriptionSessionId pour incrémenter l'usage
            if (directorData.currentSubscriptionSessionId) {
              try {
                const sessionDocRef = doc(db, 'subscriptionSessions', directorData.currentSubscriptionSessionId);
                const sessionDoc = await getDoc(sessionDocRef);
                
                if (sessionDoc.exists()) {
                  const sessionData = sessionDoc.data();
                  const currentUsage = sessionData.usage || {};
                  const newUsersAdded = (currentUsage.usersAdded || 0) + 1;
                  
                  await updateDoc(sessionDocRef, {
                    'usage.usersAdded': newUsersAdded,
                    updatedAt: serverTimestamp()
                  });
                  console.log('✅ User usage incremented in subscription session');
                }
            } catch (updateError: any) {
                console.warn('⚠️ Could not track user addition in session (non-blocking):', updateError);
              }
            }
          }
        } catch (trackingError: any) {
            console.warn('⚠️ Could not track user addition (non-blocking):', trackingError);
        }
      }
      
      // Track registration analytics
      try {
          await AnalyticsService.logUserRegistration(userCredential.user.uid, role, agencyId);
      } catch (analyticsError) {
        console.warn('⚠️ Could not log registration analytics (non-blocking):', analyticsError);
      }
      
      // Marquer pour afficher l'écran de bienvenue juste après l'inscription
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return { 
        success: true, 
        universCreated 
      };
    } catch (err: any) {
      console.error('❌ Erreur d\'inscription:', err);
      
      // Rollback: Supprimer le compte Auth si une erreur inattendue se produit
      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
          console.log('✅ Auth user deleted due to unexpected error');
        }
      } catch (deleteError) {
        console.error('❌ Failed to delete Auth user during rollback:', deleteError);
      }
      
      const errorMessage = formatAuthErrorMessage(err);
      setError(errorMessage);
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err: any) {
      console.error('Erreur de réinitialisation du mot de passe:', err);
      setError(formatAuthErrorMessage(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      try { sessionStorage.removeItem('show_welcome_after_login'); } catch {}
    } catch (err) {
      console.error('Erreur de déconnexion:', err);
    }
  };

  const refreshUserData = async (): Promise<void> => {
    
    if (!firebaseUser) {
      return;
    }

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<User, 'id'>;
        
        // Vérifier l'approbation pour les employés
        if (userData.role === 'employe' && userData.isApproved === false) {
          setUser({
            id: firebaseUser.uid,
            ...userData
          });
          return;
        }
        
        // Only update if there are actual changes to prevent unnecessary rerenders
        const newUser = {
          id: firebaseUser.uid,
          ...userData
        };
        
        // Check if user data has actually changed (excluding tokensUsedMonthly for directors)
        if (user && 
            user.payAsYouGoTokens === userData.payAsYouGoTokens &&
            user.role === userData.role) {
          return;
        }
        
        setUser(newUser);
      } else {
        console.error('❌ AUTH: User document not found');
      }
    } catch (err) {
      console.error('❌ AUTH: Erreur lors du rafraîchissement des données utilisateur:', err);
    }
  };

  const updateTokensLocally = (tokensUsed: number): void => {
    // Note: Cette fonction n'est plus utilisée pour les directeurs
    // Les tokens sont maintenant gérés dans subscriptionSessions
    // Conservée pour compatibilité avec l'ancien système si nécessaire
    if (!user) {
      return;
    }

    // Pour les directeurs, les tokens sont gérés dans subscriptionSessions
    // Cette fonction ne devrait plus être appelée pour les directeurs
    if (user.role === 'directeur') {
      console.warn('⚠️ updateTokensLocally called for director - tokens should be managed in subscriptionSessions');
      return;
    }

    // Pour les autres rôles (si nécessaire), on peut garder la logique
    setUser((prev: User | null) => {
      if (!prev) {
        return null;
      }
      
      return {
        ...prev,
        tokensUsedMonthly: tokensUsed
      };
    });
  };

  const formatAuthErrorMessage = (error: unknown): string => {
    const err = error as { code?: string; message?: string } | undefined
    return getErrorMessage(err?.code, sanitizeSensitiveErrorMessage(err?.message))
  }

  const getErrorMessage = (errorCode?: string, fallbackMessage?: string): string => {
    switch (errorCode) {
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Identifiants incorrects. Vérifiez votre email et votre mot de passe';
      case 'auth/user-not-found':
        return 'Aucun utilisateur trouvé avec cet email';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/user-disabled':
        return 'Compte désactivé. Contactez le support';
      case 'auth/email-already-in-use':
        return 'ACCOUNT_EXISTS'; // Special flag for existing account
      case 'POPUP_BLOCKED_PWA':
        return 'La popup a été bloquée. En mode PWA, veuillez utiliser la connexion par email/mot de passe.';
      case 'ACCOUNT_RECOVERED':
        return 'Votre compte a été récupéré avec succès. Vous êtes maintenant connecté.';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères';
      case 'auth/invalid-email':
        return 'Email invalide';
      case 'auth/operation-not-allowed':
        return 'Méthode de connexion désactivée. Vérifiez la configuration Firebase Auth';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Réessayez plus tard';
      case 'auth/network-request-failed':
        return 'Erreur de connexion réseau';
      case 'auth/invalid-api-key':
        return 'Configuration Firebase invalide (apiKey)';
      case 'auth/unauthorized-domain':
        return 'Domaine non autorisé pour cette application';
      case 'auth/quota-exceeded':
        return 'Quota dépassé. Contactez le support';
      case 'auth/requires-recent-login':
        return 'Cette opération nécessite une connexion récente. Veuillez vous reconnecter';
      case 'permission-denied':
        return 'Permission refusée. Vérifiez vos droits d\'accès';
      case 'unavailable':
        return 'Service temporairement indisponible. Veuillez réessayer plus tard';
      default:
        // Pour les erreurs inconnues, retourner un message générique en français
        if (errorCode && errorCode.startsWith('auth/')) {
          return 'Erreur d\'authentification. Veuillez réessayer ou contacter le support';
        }
        if (fallbackMessage) {
          return fallbackMessage;
        }
        return 'Une erreur est survenue. Veuillez réessayer';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      login,
      loginWithGoogle,
      register,
      resetPassword,
      logout,
      refreshUserData,
      updateTokensLocally,
      isLoading,
      error
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};