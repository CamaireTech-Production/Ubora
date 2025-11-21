/**
 * Service de connexion utilisateur
 * Gère toute la logique de connexion : authentification, chargement du profil, validation
 */

import { 
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  UserCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { User } from '../../types';
import { AnalyticsService } from '../../services/analyticsService';
import { SubscriptionSessionService } from '../../services/subscriptionSessionService';
import { withFirestoreRetry, withAuthRetry } from '../../utils/retryHandler';
import { sanitizeSensitiveErrorMessage } from '../../utils/errorSanitizer';
import {
  LoginData,
  LoginResult,
  UserDocumentData
} from '../types';
import { 
  checkAgencyUserLimit, 
  createUserDocumentData 
} from './signupService';

/**
 * Formate les messages d'erreur d'authentification
 */
function formatAuthErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string } | undefined;
  return getErrorMessage(err?.code, sanitizeSensitiveErrorMessage(err?.message));
}

/**
 * Convertit un code d'erreur en message utilisateur
 */
function getErrorMessage(errorCode?: string, fallbackMessage?: string): string {
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
      return 'Email déjà utilisé. Essayez de vous connecter.';
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
    case 'auth/popup-blocked':
    case 'auth/popup-closed-by-user':
      return 'La popup a été bloquée. Veuillez réessayer.';
    case 'permission-denied':
      return 'Permission refusée. Vérifiez vos droits d\'accès';
    case 'unavailable':
      return 'Service temporairement indisponible. Veuillez réessayer plus tard';
    default:
      if (errorCode && errorCode.startsWith('auth/')) {
        return 'Erreur d\'authentification. Veuillez réessayer ou contacter le support';
      }
      return fallbackMessage || 'Une erreur est survenue. Veuillez réessayer';
  }
}

/**
 * Authentifie un utilisateur avec email et mot de passe
 */
export async function authenticate(
  email: string,
  password: string
): Promise<UserCredential> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const userCredential = await withAuthRetry(
      () => signInWithEmailAndPassword(auth, normalizedEmail, password),
      { maxRetries: 3, retryDelay: 1000 }
    );
    
    return userCredential;
  } catch (authError: any) {
    console.error('❌ [LOGIN] Firebase Auth error:', {
      code: authError.code,
      message: authError.message,
      email: email.trim().toLowerCase()
    });
    
    throw authError;
  }
}

/**
 * Charge le profil utilisateur depuis Firestore
 * Retourne une erreur claire si le document n'existe pas
 */
export async function loadUserProfile(
  userId: string
): Promise<{ user: User; exists: boolean }> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await withFirestoreRetry(
      () => getDoc(userDocRef),
      { maxRetries: 2, retryDelay: 500 }
    ) as DocumentSnapshot;
    
    if (!userDoc.exists()) {
      return {
        user: {} as User,
        exists: false
      };
    }
    
    const userData = userDoc.data() as Omit<User, 'id'>;
    const user: User = {
      id: userId,
      ...userData
    };
    
    // Cache user after successful fetch
    try {
      localStorage.setItem('ubora_cached_user', JSON.stringify(user));
    } catch (cacheError) {
      console.warn('⚠️ Could not cache user data:', cacheError);
    }
    
    return {
      user,
      exists: true
    };
  } catch (error: any) {
    console.error('❌ [LOGIN] Error loading user profile:', error);
    throw error;
  }
}

/**
 * Valide l'état de l'utilisateur après connexion
 * Vérifie isApproved, rôle, etc.
 */
export function validateUserState(user: User): {
  valid: boolean;
  error?: string;
  requiresApproval?: boolean;
} {
  // Vérifier que l'utilisateur a un rôle valide
  if (!user.role || !['admin', 'directeur', 'employe'].includes(user.role)) {
    return {
      valid: false,
      error: 'Rôle utilisateur invalide. Contactez le support.'
    };
  }
  
  // Pour les employés, vérifier l'approbation
  if (user.role === 'employe') {
    if (user.isApproved === false || user.isApproved === undefined) {
      return {
        valid: false,
        error: 'Votre compte est en attente d\'approbation par votre directeur.',
        requiresApproval: true
      };
    }
  }
  
  // Vérifier que l'utilisateur a un agencyId (sauf admin)
  if (user.role !== 'admin' && (!user.agencyId || !user.agencyId.trim())) {
    return {
      valid: false,
      error: 'Votre compte est incomplet. Contactez le support.'
    };
  }
  
  return {
    valid: true
  };
}

/**
 * Fonction helper pour détecter si on est en PWA
 */
function isPWA(): boolean {
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
}

/**
 * Authentifie un utilisateur avec Google
 */
export async function authenticateWithGoogle(): Promise<{
  success: boolean;
  error?: string;
  userCredential?: UserCredential;
  requiresProfileCreation?: boolean;
  inviteData?: {
    agencyId: string;
    role: 'employe';
  };
}> {
  try {
    const provider = new GoogleAuthProvider();
    const isPWAMode = isPWA();
    
    let result: UserCredential;
    
    if (isPWAMode) {
      // En PWA, utiliser popup avec gestion d'erreur spéciale
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError: any) {
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          return {
            success: false,
            error: 'POPUP_BLOCKED_PWA'
          };
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
      // Vérifier si c'est une invitation
      const urlParams = new URLSearchParams(window.location.search);
      const isInvite = urlParams.get('invite') === 'true';
      const inviteAgencyId = urlParams.get('agencyId');
      const inviteRole = urlParams.get('role');
      
      if (isInvite && inviteRole === 'employe' && inviteAgencyId) {
        // Vérifier l'agence et les limites
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
          return {
            success: false,
            error: 'Agence invalide. Contactez votre directeur.'
          };
        }
        
        // Vérifier les limites
        try {
          const limitCheck = await checkAgencyUserLimit(inviteAgencyId);
          if (!limitCheck.canAddUser) {
            await signOut(auth);
            return {
              success: false,
              error: limitCheck.error || 'Limite d\'utilisateurs atteinte. Contactez votre directeur.'
            };
          }
        } catch (limitError) {
          console.error('❌ REGISTRATION ERROR: Failed to check user limits during Google employee registration');
          await signOut(auth);
          return {
            success: false,
            error: 'Erreur technique: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.'
          };
        }
        
        return {
          success: true,
          userCredential: result,
          requiresProfileCreation: true,
          inviteData: {
            agencyId: inviteAgencyId,
            role: 'employe'
          }
        };
      } else {
        // Directeur sans invitation
        return {
          success: true,
          userCredential: result,
          requiresProfileCreation: true
        };
      }
    }
    
    return {
      success: true,
      userCredential: result
    };
  } catch (err: any) {
    console.error('❌ [LOGIN] Google authentication error:', err);
    return {
      success: false,
      error: formatAuthErrorMessage(err)
    };
  }
}

/**
 * Crée le profil utilisateur pour une connexion Google
 */
export async function createGoogleUserProfile(
  userId: string,
  displayName: string | null,
  email: string | null,
  inviteData?: {
    agencyId: string;
    role: 'employe';
  }
): Promise<void> {
  try {
    if (inviteData) {
      // Créer un profil employé avec invitation
      const userData: Omit<User, 'id'> = {
        name: displayName || '',
        email: email || '',
        role: 'employe',
        agencyId: inviteData.agencyId,
        isApproved: false, // Requires director approval
        accessLevels: [],
        hasDirectorDashboardAccess: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await withFirestoreRetry(
        () => setDoc(doc(db, 'users', userId), userData),
        { maxRetries: 3, retryDelay: 1000 }
      );
      
      // Track user addition in subscription session
      try {
        const directorsQuery = query(
          collection(db, 'users'),
          where('agencyId', '==', inviteData.agencyId),
          where('role', '==', 'directeur')
        );
        const directorsSnapshot = await withFirestoreRetry(
          () => getDocs(directorsQuery),
          { maxRetries: 1, retryDelay: 500 }
        ) as QuerySnapshot;
        
        if (!directorsSnapshot.empty) {
          const director = directorsSnapshot.docs[0];
          await SubscriptionSessionService.updateUsage(director.id, 'users', 1);
        }
      } catch (trackingError) {
        console.warn('⚠️ Could not track user addition (non-blocking):', trackingError);
      }
    } else {
      // Créer un profil directeur (sans agencyId pour l'instant)
      const userData = createUserDocumentData(
        displayName || '',
        email || '',
        'directeur',
        '' // Will be set during onboarding
      );
      
      await withFirestoreRetry(
        () => setDoc(doc(db, 'users', userId), userData),
        { maxRetries: 3, retryDelay: 1000 }
      );
      
      // Marquer pour la sélection de package
      try {
        sessionStorage.setItem('needs_package_selection', 'true');
      } catch {}
    }
  } catch (error: any) {
    console.error('❌ [LOGIN] Error creating Google user profile:', error);
    throw error;
  }
}

/**
 * Fonction principale de connexion avec email/mot de passe
 * Orchestre toutes les étapes : authentification → chargement profil → validation
 */
export async function login(data: LoginData): Promise<LoginResult> {
  try {
    const normalizedEmail = data.email.trim().toLowerCase();
    
    // ============================================
    // 1. AUTHENTIFICATION FIREBASE AUTH
    // ============================================
    let userCredential: UserCredential;
    try {
      userCredential = await authenticate(normalizedEmail, data.password);
    } catch (authError: any) {
      console.error('❌ [LOGIN] Authentication failed:', authError);
      return {
        success: false,
        error: formatAuthErrorMessage(authError)
      };
    }
    
    // ============================================
    // 2. CHARGEMENT DU PROFIL FIRESTORE
    // ============================================
    const profileResult = await loadUserProfile(userCredential.user.uid);
    
    if (!profileResult.exists) {
      // Document Firestore manquant - déconnexion et erreur claire
      await signOut(auth);
      return {
        success: false,
        error: 'Profil utilisateur non trouvé. Veuillez vous réinscrire ou contacter le support si vous avez déjà un compte.'
      };
    }
    
    // ============================================
    // 3. VALIDATION DE L'ÉTAT UTILISATEUR
    // ============================================
    const validation = validateUserState(profileResult.user);
    
    if (!validation.valid) {
      // Ne pas déconnecter si c'est juste une attente d'approbation
      if (validation.requiresApproval) {
        return {
          success: false,
          error: validation.error,
          user: profileResult.user,
          firebaseUser: userCredential.user
        };
      }
      
      // Pour les autres erreurs, déconnecter
      await signOut(auth);
      return {
        success: false,
        error: validation.error || 'État utilisateur invalide'
      };
    }
    
    // ============================================
    // 4. SUCCÈS - MARQUER POUR L'ÉCRAN DE BIENVENUE
    // ============================================
    try {
      sessionStorage.setItem('show_welcome_after_login', 'true');
    } catch {}
    
    return {
      success: true,
      user: profileResult.user,
      firebaseUser: userCredential.user
    };
    
  } catch (err: any) {
    console.error('❌ [LOGIN] Unexpected error:', err);
    return {
      success: false,
      error: formatAuthErrorMessage(err)
    };
  }
}

/**
 * Fonction principale de connexion avec Google
 * Gère l'authentification Google et la création de profil si nécessaire
 */
export async function loginWithGoogle(): Promise<LoginResult> {
  try {
    // ============================================
    // 1. AUTHENTIFICATION GOOGLE
    // ============================================
    const authResult = await authenticateWithGoogle();
    
    if (!authResult.success || !authResult.userCredential) {
      return {
        success: false,
        error: authResult.error || 'Échec de l\'authentification Google'
      };
    }
    
    const userCredential = authResult.userCredential;
    const userId = userCredential.user.uid;
    
    // ============================================
    // 2. CRÉATION DU PROFIL SI NÉCESSAIRE
    // ============================================
    if (authResult.requiresProfileCreation) {
      try {
        await createGoogleUserProfile(
          userId,
          userCredential.user.displayName,
          userCredential.user.email,
          authResult.inviteData
        );
      } catch (profileError: any) {
        console.error('❌ [LOGIN] Error creating Google profile:', profileError);
        await signOut(auth);
        return {
          success: false,
          error: 'Erreur lors de la création du profil. Veuillez réessayer.'
        };
      }
    }
    
    // ============================================
    // 3. CHARGEMENT DU PROFIL
    // ============================================
    const profileResult = await loadUserProfile(userId);
    
    if (!profileResult.exists) {
      await signOut(auth);
      return {
        success: false,
        error: 'Erreur lors du chargement du profil. Veuillez réessayer.'
      };
    }
    
    // ============================================
    // 4. VALIDATION DE L'ÉTAT UTILISATEUR
    // ============================================
    const validation = validateUserState(profileResult.user);
    
    if (!validation.valid) {
      if (validation.requiresApproval) {
        return {
          success: false,
          error: validation.error,
          user: profileResult.user,
          firebaseUser: userCredential.user
        };
      }
      
      await signOut(auth);
      return {
        success: false,
        error: validation.error || 'État utilisateur invalide'
      };
    }
    
    // ============================================
    // 5. SUCCÈS - MARQUER POUR L'ÉCRAN DE BIENVENUE
    // ============================================
    try {
      sessionStorage.setItem('show_welcome_after_login', 'true');
    } catch {}
    
    return {
      success: true,
      user: profileResult.user,
      firebaseUser: userCredential.user
    };
    
  } catch (err: any) {
    console.error('❌ [LOGIN] Google login unexpected error:', err);
    return {
      success: false,
      error: formatAuthErrorMessage(err)
    };
  }
}

