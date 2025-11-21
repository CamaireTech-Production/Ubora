/**
 * Service de gestion de l'état d'authentification
 * Gère onAuthStateChanged et onSnapshot avec flag isRegistering pour éviter les race conditions
 */

import { 
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { User } from '../../types';
import { SubscriptionSessionCollectionService } from '../../services/subscriptionSessionCollectionService';
import { withFirebaseErrorHandling, FirebaseErrorHandler } from '../../services/firebaseErrorHandler';

/**
 * Callbacks pour les changements d'état
 */
export interface AuthStateCallbacks {
  onUserLoaded?: (user: User, firebaseUser: FirebaseUser) => void;
  onUserUpdated?: (user: User) => void;
  onUserSignedOut?: () => void;
  onError?: (error: string) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

/**
 * Options pour l'initialisation du service
 */
export interface AuthStateServiceOptions {
  firestoreReady?: boolean;
  firestoreDisabled?: boolean;
  firestoreCircuitBreaker?: boolean;
  firestoreErrorCount?: number;
  isRegistering?: boolean; // Flag pour éviter les race conditions pendant l'inscription
}

/**
 * Classe pour gérer l'état d'authentification
 */
class AuthStateService {
  private authStateUnsubscribe: (() => void) | null = null;
  private userSnapshotUnsubscribe: (() => void) | null = null;
  private callbacks: AuthStateCallbacks = {};
  private options: AuthStateServiceOptions = {};
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isRegisteringFlag: boolean = false;

  /**
   * Définit le flag isRegistering
   * Quand true, onAuthStateChanged ignore les changements pour éviter les race conditions
   */
  setIsRegistering(isRegistering: boolean): void {
    this.isRegisteringFlag = isRegistering;
    console.log(`🔒 [AuthState] isRegistering flag set to: ${isRegistering}`);
  }

  /**
   * Vérifie si on est en train de s'inscrire
   */
  getIsRegistering(): boolean {
    return this.isRegisteringFlag;
  }

  /**
   * Charge le profil utilisateur depuis Firestore
   */
  private async loadUserProfile(
    firebaseUser: FirebaseUser,
    useCache: boolean = true
  ): Promise<{ user: User | null; error?: string }> {
    try {
      // Vérifier le circuit breaker
      if (this.options.firestoreCircuitBreaker || (this.options.firestoreErrorCount || 0) > 3) {
        if (useCache) {
          const cached = localStorage.getItem('ubora_cached_user');
          if (cached) {
            const cachedUser = JSON.parse(cached);
            return { user: cachedUser };
          }
        }
        return {
          user: null,
          error: 'Mode hors ligne: données locales non disponibles'
        };
      }

      // Attendre un peu pour s'assurer que Firestore est initialisé
      await new Promise(resolve => setTimeout(resolve, 200));

      const userDocRef = doc(db, 'users', firebaseUser.uid);

      // Utiliser le système de gestion d'erreurs
      const userDoc = await withFirebaseErrorHandling(async () => {
        return await Promise.race([
          getDoc(userDocRef),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: Impossible de se connecter à Firestore')), 8000)
          )
        ]) as DocumentSnapshot;
      }, 3);

      if (!userDoc.exists()) {
        return {
          user: null,
          error: 'Profil utilisateur non trouvé. Veuillez vous réinscrire.'
        };
      }

      const userData = userDoc.data() as Omit<User, 'id'>;
      let user: User = {
        id: firebaseUser.uid,
        ...userData
      };

      // Pour les directeurs, vérifier et corriger currentSubscriptionSessionId si nécessaire
      if (user.role === 'directeur') {
        user = await this.fixDirectorSubscriptionSession(user, firebaseUser.uid);
      }

      // Cache user locally
      try {
        localStorage.setItem('ubora_cached_user', JSON.stringify(user));
      } catch (cacheError) {
        console.warn('⚠️ Could not cache user data:', cacheError);
      }

      return { user };
    } catch (err: any) {
      console.error('❌ [AuthState] Error loading user profile:', err);

      // Essayer le cache en fallback
      if (useCache) {
        try {
          const cached = localStorage.getItem('ubora_cached_user');
          if (cached) {
            const cachedUser = JSON.parse(cached);
            return {
              user: cachedUser,
              error: 'Mode hors ligne: données locales affichées'
            };
          }
        } catch {}
      }

      const errorMessage = FirebaseErrorHandler.getUserFriendlyMessage(err);
      return {
        user: null,
        error: errorMessage
      };
    }
  }

  /**
   * Corrige la session d'abonnement pour un directeur
   * Vérifie et met à jour currentSubscriptionSessionId si nécessaire
   */
  private async fixDirectorSubscriptionSession(
    user: User,
    userId: string
  ): Promise<User> {
    try {
      const currentSessionId = user.currentSubscriptionSessionId;
      let needsUpdate = false;
      let newSessionId = currentSessionId;

      // Vérifier si currentSubscriptionSessionId pointe vers une session active valide
      if (currentSessionId) {
        try {
          const sessionDoc = await getDoc(doc(db, 'subscriptionSessions', currentSessionId));
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data();
            if (sessionData.userId === userId && sessionData.isActive) {
              // La session est valide
              return user;
            } else {
              needsUpdate = true;
            }
          } else {
            needsUpdate = true;
          }
        } catch (error) {
          needsUpdate = true;
        }
      } else {
        needsUpdate = true;
      }

      // Si une mise à jour est nécessaire, chercher une session active
      if (needsUpdate) {
        const activeSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
        if (activeSession && activeSession.id !== currentSessionId) {
          newSessionId = activeSession.id;
        } else {
          // Chercher toutes les sessions
          const allSessions = await SubscriptionSessionCollectionService.getUserSessions(userId);
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
            } else {
              // Toutes les sessions sont expirées, créer une session "free" par défaut
              const freeSessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(userId);
              if (freeSessionId) {
                newSessionId = freeSessionId;
              }
            }
          } else {
            // Aucune session trouvée, créer une session "free" par défaut
            const freeSessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(userId);
            if (freeSessionId) {
              newSessionId = freeSessionId;
            }
          }
        }
      }

      // Mettre à jour le document utilisateur si nécessaire
      if (needsUpdate && newSessionId) {
        try {
          const userDocRef = doc(db, 'users', userId);
          await updateDoc(userDocRef, {
            currentSubscriptionSessionId: newSessionId,
            updatedAt: serverTimestamp()
          });
          user.currentSubscriptionSessionId = newSessionId;
          console.log('✅ [AuthState] currentSubscriptionSessionId corrigé pour le directeur:', userId, '→', newSessionId);
        } catch (updateError) {
          console.error('❌ [AuthState] Erreur lors de la mise à jour de currentSubscriptionSessionId:', updateError);
        }
      }

      return user;
    } catch (sessionError) {
      console.error('❌ [AuthState] Erreur lors de la vérification de la session pour le directeur:', userId, sessionError);
      return user;
    }
  }

  /**
   * Gère les changements d'état d'authentification
   */
  private handleAuthStateChange = async (firebaseUser: FirebaseUser | null) => {
    // Clear any pending operations
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Appeler le callback de changement de chargement
    this.callbacks.onLoadingChange?.(true);
    // Note: onError sera appelé seulement en cas d'erreur réelle

    // Utiliser un délai minimal pour éviter les appels concurrents
    this.timeoutId = setTimeout(async () => {
      try {
        // VÉRIFICATION CRITIQUE: Ignorer si on est en train de s'inscrire
        if (this.isRegisteringFlag) {
          console.log('🔒 [AuthState] Ignorant onAuthStateChanged car isRegistering = true');
          this.callbacks.onLoadingChange?.(false);
          return;
        }

        if (firebaseUser) {
          const profileResult = await this.loadUserProfile(firebaseUser);

          if (profileResult.error && !profileResult.user) {
            // Erreur critique - déconnecter
            await signOut(auth);
            this.callbacks.onError?.(profileResult.error);
            this.callbacks.onUserSignedOut?.();
            this.callbacks.onLoadingChange?.(false);
            return;
          }

          if (profileResult.user) {
            // Vérifier l'approbation pour les employés
            if (profileResult.user.role === 'employe' && profileResult.user.isApproved === false) {
              // Ne pas déconnecter, laisser l'utilisateur voir la page d'attente
              this.callbacks.onUserLoaded?.(profileResult.user, firebaseUser);
              if (profileResult.error) {
                this.callbacks.onError?.(profileResult.error);
              }
              this.callbacks.onLoadingChange?.(false);
              return;
            }

            // Utilisateur chargé avec succès
            this.callbacks.onUserLoaded?.(profileResult.user, firebaseUser);
            if (profileResult.error) {
              this.callbacks.onError?.(profileResult.error);
            }
          } else {
            // Document manquant
            await signOut(auth);
            this.callbacks.onError?.('Profil utilisateur non trouvé. Veuillez vous réinscrire.');
            this.callbacks.onUserSignedOut?.();
          }
        } else {
          // Utilisateur déconnecté
          this.callbacks.onUserSignedOut?.();
        }
      } catch (err: any) {
        console.error('❌ [AuthState] Error in handleAuthStateChange:', err);
        const errorMessage = FirebaseErrorHandler.getUserFriendlyMessage(err);
        this.callbacks.onError?.(errorMessage);

        // Essayer le cache en fallback
        try {
          const cached = localStorage.getItem('ubora_cached_user');
          if (cached) {
            const cachedUser = JSON.parse(cached);
            this.callbacks.onUserLoaded?.(cachedUser, firebaseUser!);
            this.callbacks.onError?.('Mode hors ligne: données locales affichées');
          } else {
            await signOut(auth);
            this.callbacks.onUserSignedOut?.();
          }
        } catch {}

        this.callbacks.onLoadingChange?.(false);
        return;
      }

      this.callbacks.onLoadingChange?.(false);
    }, 100); // Small delay to prevent rapid successive calls
  };

  /**
   * Gère les changements du document utilisateur en temps réel
   */
  private handleUserSnapshot = (userDoc: DocumentSnapshot) => {
    // VÉRIFICATION CRITIQUE: Ignorer si on est en train de s'inscrire
    if (this.isRegisteringFlag) {
      console.log('🔒 [AuthState] Ignorant onSnapshot car isRegistering = true');
      return;
    }

    if (userDoc.exists()) {
      const userData = userDoc.data() as Omit<User, 'id'>;
      const user: User = {
        id: userDoc.id,
        ...userData
      };

      this.callbacks.onUserUpdated?.(user);
    }
  };

  /**
   * Initialise le service avec les callbacks et options
   */
  initialize(
    callbacks: AuthStateCallbacks,
    options: AuthStateServiceOptions = {}
  ): void {
    this.callbacks = callbacks;
    this.options = options;
    this.isRegisteringFlag = options.isRegistering || false;

    // Vérifier que Firestore est prêt
    if (!options.firestoreReady) {
      console.warn('⚠️ [AuthState] Firestore not ready, waiting...');
      return;
    }

    // S'abonner aux changements d'état d'authentification
    this.authStateUnsubscribe = onAuthStateChanged(auth, this.handleAuthStateChange);

    console.log('✅ [AuthState] Service initialized');
  }

  /**
   * Force le chargement de l'utilisateur après l'inscription
   * Ignore temporairement le flag isRegistering pour charger l'utilisateur
   */
  async forceLoadUserAfterSignup(firebaseUser: FirebaseUser): Promise<void> {
    if (!firebaseUser) {
      console.warn('⚠️ [AuthState] forceLoadUserAfterSignup: firebaseUser is null');
      return;
    }

    console.log('🔄 [AuthState] Force loading user after signup');
    this.callbacks.onLoadingChange?.(true);

    try {
      // Charger le profil utilisateur (ignore isRegistering pour cette opération)
      const profileResult = await this.loadUserProfile(firebaseUser);

      if (profileResult.error && !profileResult.user) {
        // Erreur critique - déconnecter
        console.error('❌ [AuthState] Error loading user after signup:', profileResult.error);
        await signOut(auth);
        this.callbacks.onError?.(profileResult.error);
        this.callbacks.onUserSignedOut?.();
        this.callbacks.onLoadingChange?.(false);
        return;
      }

      if (profileResult.user) {
        // Utilisateur chargé avec succès
        console.log('✅ [AuthState] User loaded after signup:', profileResult.user.id);
        this.callbacks.onUserLoaded?.(profileResult.user, firebaseUser);
        
        // Démarrer l'écoute des changements
        this.startUserSnapshot(firebaseUser);
        
        if (profileResult.error) {
          this.callbacks.onError?.(profileResult.error);
        }
      } else {
        // Document manquant - ne pas déconnecter immédiatement, attendre un peu
        console.warn('⚠️ [AuthState] User document not found after signup, retrying in 1s...');
        setTimeout(async () => {
          const retryResult = await this.loadUserProfile(firebaseUser);
          if (retryResult.user) {
            this.callbacks.onUserLoaded?.(retryResult.user, firebaseUser);
            this.startUserSnapshot(firebaseUser);
          } else {
            await signOut(auth);
            this.callbacks.onError?.('Profil utilisateur non trouvé. Veuillez vous réinscrire.');
            this.callbacks.onUserSignedOut?.();
          }
          this.callbacks.onLoadingChange?.(false);
        }, 1000);
        return;
      }
    } catch (err: any) {
      console.error('❌ [AuthState] Error in forceLoadUserAfterSignup:', err);
      const errorMessage = FirebaseErrorHandler.getUserFriendlyMessage(err);
      this.callbacks.onError?.(errorMessage);
      this.callbacks.onLoadingChange?.(false);
      return;
    }

    this.callbacks.onLoadingChange?.(false);
  }

  /**
   * Démarre l'écoute des changements du document utilisateur
   * Doit être appelé après qu'un utilisateur soit connecté
   */
  startUserSnapshot(firebaseUser: FirebaseUser): void {
    // Arrêter l'écoute précédente si elle existe
    this.stopUserSnapshot();

    if (this.options.firestoreDisabled || this.options.firestoreCircuitBreaker) {
      return;
    }

    const userDocRef = doc(db, 'users', firebaseUser.uid);

    this.userSnapshotUnsubscribe = onSnapshot(
      userDocRef,
      this.handleUserSnapshot,
      (error: Error) => {
        console.error('❌ [AuthState] Error in user snapshot:', error);
      }
    );

    console.log('✅ [AuthState] User snapshot listener started');
  }

  /**
   * Arrête l'écoute des changements du document utilisateur
   */
  stopUserSnapshot(): void {
    if (this.userSnapshotUnsubscribe) {
      this.userSnapshotUnsubscribe();
      this.userSnapshotUnsubscribe = null;
      console.log('✅ [AuthState] User snapshot listener stopped');
    }
  }

  /**
   * Met à jour les options du service
   */
  updateOptions(options: Partial<AuthStateServiceOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (options.isRegistering !== undefined) {
      this.setIsRegistering(options.isRegistering);
    }
  }

  /**
   * Nettoie toutes les souscriptions
   */
  cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
      this.authStateUnsubscribe = null;
    }

    this.stopUserSnapshot();

    console.log('✅ [AuthState] Service cleaned up');
  }
}

// Instance singleton
export const authStateService = new AuthStateService();

