import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';
import { getPackageLimit, PackageType } from '../config/packageFeatures';
import { AnalyticsService } from '../services/analyticsService';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { SubscriptionSessionCollectionService } from '../services/subscriptionSessionCollectionService';
import { UserSessionService } from '../services/userSessionService';
import { withFirebaseErrorHandling, FirebaseErrorHandler } from '../services/firebaseErrorHandler';
import { universService } from '../services/universService';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (email: string, password: string, name: string, role: 'admin' | 'directeur' | 'employe', agencyId: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [firestoreErrorCount, setFirestoreErrorCount] = useState(0);
  const [firestoreDisabled, setFirestoreDisabled] = useState(false);
  const [firestoreCircuitBreaker, setFirestoreCircuitBreaker] = useState(false);

  // Fonction pour vérifier les limites d'utilisateurs d'une agence
  const checkAgencyUserLimit = async (agencyId: string): Promise<{ canAddUser: boolean; error?: string }> => {
    try {
      console.log('🔍 Checking agency user limit for agencyId:', agencyId);
      
      // Récupérer le directeur de l'agence pour connaître son package
      const directorsQuery = query(
        collection(db, 'users'),
        where('agencyId', '==', agencyId),
        where('role', '==', 'directeur')
      );
      
      const directorsSnapshot = await getDocs(directorsQuery);
      
      console.log('🔍 Directors found:', directorsSnapshot.size);
      
      if (directorsSnapshot.empty) {
        console.error('❌ NO DIRECTOR FOUND: No director exists for agency:', agencyId);
        return { canAddUser: false, error: 'Aucun directeur trouvé pour cette agence. Veuillez vérifier l\'ID d\'agence ou contacter le support.' };
      }
      
      const director = directorsSnapshot.docs[0].data() as User;
      const directorId = directorsSnapshot.docs[0].id;
      
      // Check if director has active session in new collection
      let hasActiveSession = false;
      let currentSessionId = null;
      try {
        if (director.currentSubscriptionSessionId) {
          const activeSession = await SubscriptionSessionCollectionService.getActiveSession(directorId);
          hasActiveSession = !!activeSession;
          currentSessionId = director.currentSubscriptionSessionId;
        }
      } catch (error) {
        console.error('Error checking active session:', error);
      }
      
      // Fallback to legacy check
      if (!hasActiveSession) {
        hasActiveSession = !!(director.subscriptionSessions && director.subscriptionSessions.length > 0);
        currentSessionId = director.currentSessionId || null;
      }
      
      console.log('🔍 Director data:', {
        id: directorId,
        name: director.name,
        email: director.email,
        agencyId: director.agencyId,
        role: director.role,
        package: director.package,
        hasSubscriptionSessions: hasActiveSession,
        currentSubscriptionSessionId: director.currentSubscriptionSessionId,
        currentSessionId: currentSessionId
      });
      
      // Use the new subscription session system to get package limits
      const packageLimits = UserSessionService.getPackageLimits(director);
      
      console.log('🔍 Package limits from session:', packageLimits);
      console.log('🔍 Max users allowed:', packageLimits.maxUsers);
      console.log('🔍 Is unlimited users:', packageLimits.maxUsers === -1);
      
      // If no session found, check if director needs to select a package
      if (packageLimits.maxUsers === 0) {
        // Check if director has legacy package field as fallback
        const legacyPackage = director.package as PackageType;
        if (legacyPackage) {
          const legacyLimits = getPackageLimit(legacyPackage, 'maxUsers');
          if (legacyLimits === -1) {
            return { canAddUser: true };
          }
          
          // Check legacy limits
          const employeesQuery = query(
            collection(db, 'users'),
            where('agencyId', '==', agencyId),
            where('role', '==', 'employe'),
            where('isApproved', '!=', false)
          );
          
          const employeesSnapshot = await getDocs(employeesQuery);
          const currentEmployeeCount = employeesSnapshot.size;
          
          console.log('🔍 Legacy package limits:', legacyLimits);
          console.log('🔍 Current employee count (legacy):', currentEmployeeCount);
          console.log('🔍 Employees query result (legacy):', employeesSnapshot.size);
          
          if (currentEmployeeCount >= legacyLimits) {
            return { 
              canAddUser: false, 
              error: 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.' 
            };
          }
          
          return { canAddUser: true };
        } else {
          // Allow employee creation even if director hasn't set up package yet
          // This is a temporary fallback to prevent blocking employee registration
          console.warn('⚠️ Director has no package configured, allowing employee creation as fallback');
          return { canAddUser: true };
        }
      }
      
      // Check if the director has unlimited users
      if (packageLimits.maxUsers === -1) {
        return { canAddUser: true };
      }
      
      // Récupérer le nombre d'employés actuels (approuvés)
      const employeesQuery = query(
        collection(db, 'users'),
        where('agencyId', '==', agencyId),
        where('role', '==', 'employe'),
        where('isApproved', '!=', false) // Inclut les employés approuvés (true) et ceux en attente (undefined)
      );
      
      const employeesSnapshot = await getDocs(employeesQuery);
      const currentEmployeeCount = employeesSnapshot.size;
      
      console.log('🔍 Current employee count:', currentEmployeeCount);
      console.log('🔍 Employees query result:', employeesSnapshot.size);
      console.log('🔍 Can add user:', currentEmployeeCount < packageLimits.maxUsers);
      console.log('🔍 Remaining capacity:', packageLimits.maxUsers === -1 ? 'Unlimited' : packageLimits.maxUsers - currentEmployeeCount);
      
      // Check if current employee count is within limits
      if (currentEmployeeCount >= packageLimits.maxUsers) {
        return { 
          canAddUser: false, 
          error: 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.' 
        };
      }
      
      console.log('🔍 Final decision: Allowing user creation');
      return { canAddUser: true };
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
        } catch (testError) {
          // Even if test fails, we can still proceed
          console.warn('Firestore test failed but continuing:', testError);
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
    
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clear any pending operations to prevent concurrent calls
      clearTimeout(timeoutId);
      
      // Set loading immediately when auth state changes
      setIsLoading(true);
      setError(null);
      
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
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout: Impossible de se connecter à Firestore')), 8000)
                )
              ]) as any;
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
                    const freeSessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(firebaseUser.uid);
                    if (freeSessionId) {
                      newSessionId = freeSessionId;
                      needsUpdate = true;
                    }
                  }
                }

                // Mettre à jour le document utilisateur si nécessaire
                if (needsUpdate && newSessionId) {
                  await updateDoc(userDocRef, {
                    currentSubscriptionSessionId: newSessionId,
                    updatedAt: serverTimestamp()
                  });
                  // Mettre à jour userData avec le nouveau sessionId
                  userData.currentSubscriptionSessionId = newSessionId;
                  console.log('✅ currentSubscriptionSessionId corrigé pour le directeur:', firebaseUser.uid, '→', newSessionId);
                }
              } catch (sessionError) {
                console.error('Erreur lors de la vérification de la session pour le directeur:', firebaseUser.uid, sessionError);
                // Continuer même en cas d'erreur
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
              return;
            }
            
            setUser({
              id: firebaseUser.uid,
              ...userData
            });
            setFirebaseUser(firebaseUser);
            
            // Marquer le chargement comme terminé seulement après avoir défini l'utilisateur
            setIsLoading(false);
            
            // Créer l'univers par défaut pour les directeurs si nécessaire
            // (après que l'utilisateur soit complètement chargé et que les permissions Firestore soient propagées)
            if (userData.role === 'directeur' && userData.agencyId) {
              // Utiliser setTimeout pour permettre à Firestore de propager les permissions
              setTimeout(async () => {
                try {
                  // Créer l'univers par défaut (sans l'activer si cela échoue, ce n'est pas bloquant)
                  await universService.ensureDefaultUnivers(firebaseUser.uid, userData.agencyId);
                  console.log('✅ Univers par défaut créé/vérifié pour le directeur:', firebaseUser.uid);
                } catch (universError) {
                  console.warn('⚠️ Erreur lors de la création/vérification de l\'univers par défaut (non bloquant):', universError);
                  // Ne pas bloquer la connexion si l'univers par défaut ne peut pas être créé
                  // L'utilisateur pourra continuer et l'univers sera créé plus tard si nécessaire
                }
              }, 500); // Attendre 500ms pour que les permissions Firestore soient propagées
            }
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
    
    const unsubscribe = onSnapshot(userDocRef, (userDoc) => {
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
        
        setUser({
          id: firebaseUser.uid,
          ...userData
        });
      }
    }, (error) => {
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
      setError(getErrorMessage(err.code));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Vérifier si l'utilisateur existe dans Firestore
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
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
          const directorsSnapshot = await getDocs(directorsQuery);
          
          if (directorsSnapshot.empty) {
            await signOut(auth);
            setError('Agence invalide. Contactez votre directeur.');
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
          
          await setDoc(userDocRef, userData);
          
          // Track user addition in subscription session
          try {
            const director = directorsSnapshot.docs[0];
            await SubscriptionSessionService.updateUsage(director.id, 'users', 1);
          } catch (trackingError) {
            console.error('Error tracking user addition:', trackingError);
          }
        } else {
          // Handle director registration (no invitation needed)
          const userData: Omit<User, 'id'> = {
            name: result.user.displayName || '',
            email: result.user.email || '',
            role: 'directeur', // Directors can self-register
            agencyId: '', // Will be set during onboarding
            needsPackageSelection: true,
            tokensUsedMonthly: 0,
            tokensResetDate: new Date(),
            isApproved: true, // Directors are auto-approved
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          await setDoc(userDocRef, userData);
          
          // Redirect to package selection
          sessionStorage.setItem('needs_package_selection', 'true');
        }
      }
      
      // Marquer pour afficher l'écran de bienvenue juste après la connexion
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return true;
    } catch (err: any) {
      console.error('Erreur de connexion Google:', err);
      setError(getErrorMessage(err.code));
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
  ): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Vérifier les limites d'utilisateurs pour les employés
      if (role === 'employe') {
        try {
          const limitCheck = await checkAgencyUserLimit(agencyId);
          if (!limitCheck.canAddUser) {
            setError('Limite d\'utilisateurs atteinte. Contactez votre directeur pour cette agence.');
            return false;
          }
        } catch (error) {
          // Si on ne peut pas vérifier les limites (permissions, etc.), on bloque par sécurité
          console.error('❌ REGISTRATION ERROR: Failed to check user limits during employee registration');
          setError('Erreur technique: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.');
          return false;
        }
      }
      
      // Créer le compte Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Créer le document utilisateur dans Firestore avec tous les champs requis
      const userData: Omit<User, 'id'> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        agencyId: agencyId.trim(),
        ...(role === 'admin' && {
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
        }),
        ...(role === 'directeur' && {
          needsPackageSelection: true, // New directors need to select a package
          tokensUsedMonthly: 0,
          tokensResetDate: new Date()
        }),
        ...(role === 'employe' && {
          accessLevels: [],
          hasDirectorDashboardAccess: false
        }),
        isApproved: role === 'directeur' || role === 'admin' ? true : false, // Les directeurs et admins sont automatiquement approuvés
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      // Note: L'univers par défaut sera créé automatiquement dans onAuthStateChanged
      // après que l'utilisateur soit complètement chargé et que les permissions Firestore soient propagées
      
      // Forcer le rechargement immédiat de l'utilisateur après l'inscription
      // Cela déclenchera onAuthStateChanged immédiatement
      // Pas besoin d'attendre, Firebase Auth est déjà mis à jour
      
      // Track user addition in subscription session (only for employees added by directors)
      if (role === 'employe') {
        try {
          // Find the director of this agency to track the user addition
          const directorsQuery = query(
            collection(db, 'users'),
            where('agencyId', '==', agencyId),
            where('role', '==', 'directeur')
          );
          const directorsSnapshot = await getDocs(directorsQuery);
          
          if (!directorsSnapshot.empty) {
            const director = directorsSnapshot.docs[0];
            await SubscriptionSessionService.updateUsage(director.id, 'users', 1);
          }
        } catch (trackingError) {
        }
      }
      
      // Track registration analytics
      try {
        await AnalyticsService.logUserRegistration(userCredential.user.uid, role, agencyId);
      } catch (analyticsError) {
      }
      
      // Marquer pour afficher l'écran de bienvenue juste après l'inscription
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return true;
    } catch (err: any) {
      console.error('Erreur d\'inscription:', err);
      setError(getErrorMessage(err.code));
      return false;
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
      setError(getErrorMessage(err.code));
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
        
        setUser({
          id: firebaseUser.uid,
          ...userData
        });
      } else {
        console.error('❌ AUTH: User document not found');
      }
    } catch (err) {
      console.error('❌ AUTH: Erreur lors du rafraîchissement des données utilisateur:', err);
    }
  };

  const getErrorMessage = (errorCode: string): string => {
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
      default:
        return 'Une erreur est survenue';
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