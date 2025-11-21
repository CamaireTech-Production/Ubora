/**
 * Service d'inscription utilisateur
 * Gère toute la logique d'inscription : validation, création Auth, Firestore, Univers
 */

import { 
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  deleteUser,
  UserCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
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
import { universService } from '../../services/universService';
import { AnalyticsService } from '../../services/analyticsService';
import { withRetry, withFirestoreRetry, withAuthRetry } from '../../utils/retryHandler';
import { sanitizeSensitiveErrorMessage } from '../../utils/errorSanitizer';
import {
  SignupData,
  SignupResult,
  EmailCheckResult,
  AgencyIdCheckResult,
  UserLimitCheckResult,
  UserDocumentData,
  SignupValidationConfig,
  RollbackOptions
} from '../types';

/**
 * Configuration par défaut pour la validation
 */
const DEFAULT_VALIDATION_CONFIG: Required<SignupValidationConfig> = {
  minPasswordLength: 6,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSpecialChars: false
};

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
 * Valide les données d'inscription côté client
 */
export function validateSignupData(
  data: SignupData,
  config: SignupValidationConfig = {}
): { valid: boolean; error?: string } {
  const validationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  
  // Validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    return { valid: false, error: 'Email invalide' };
  }
  
  // Validation mot de passe
  if (!data.password || data.password.length < validationConfig.minPasswordLength) {
    return { 
      valid: false, 
      error: `Le mot de passe doit contenir au moins ${validationConfig.minPasswordLength} caractères` 
    };
  }
  
  if (validationConfig.requireUppercase && !/[A-Z]/.test(data.password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
  }
  
  if (validationConfig.requireLowercase && !/[a-z]/.test(data.password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins une minuscule' };
  }
  
  if (validationConfig.requireNumbers && !/[0-9]/.test(data.password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
  }
  
  if (validationConfig.requireSpecialChars && !/[^A-Za-z0-9]/.test(data.password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins un caractère spécial' };
  }
  
  // Validation nom
  if (!data.name || data.name.trim().length < 2) {
    return { valid: false, error: 'Le nom doit contenir au moins 2 caractères' };
  }
  
  // Validation rôle
  if (!['admin', 'directeur', 'employe'].includes(data.role)) {
    return { valid: false, error: 'Rôle invalide' };
  }
  
  // Validation agencyId (obligatoire pour directeurs)
  if (data.role === 'directeur' && (!data.agencyId || !data.agencyId.trim())) {
    return { valid: false, error: 'L\'ID d\'agence est obligatoire pour les directeurs' };
  }
  
  // Validation agencyId (obligatoire pour employés)
  if (data.role === 'employe' && (!data.agencyId || !data.agencyId.trim())) {
    return { valid: false, error: 'L\'ID d\'agence est obligatoire pour les employés' };
  }
  
  return { valid: true };
}

/**
 * Vérifie si un email est disponible (utilise uniquement Firebase Auth)
 * SUPPRIME la vérification Firestore pour éviter les problèmes de permissions
 */
export async function checkEmailAvailable(email: string): Promise<EmailCheckResult> {
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
}

/**
 * Vérifie si un agencyId existe déjà dans Firestore
 */
export async function checkAgencyIdExists(agencyId: string): Promise<AgencyIdCheckResult> {
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
}

/**
 * Vérifie les limites d'utilisateurs d'une agence
 */
export async function checkAgencyUserLimit(agencyId: string): Promise<UserLimitCheckResult> {
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
    
    if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
      console.error('❌ PERMISSION ERROR: Cannot access director information to check user limits');
      return { 
        canAddUser: false, 
        error: 'Erreur de permissions: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.' 
      };
    }
    
    console.error('❌ UNEXPECTED ERROR: Failed to check user limits');
    return { 
      canAddUser: false, 
      error: 'Erreur technique lors de la vérification des limites. Veuillez réessayer ou contacter le support.' 
    };
  }
}

/**
 * Crée un compte Firebase Auth
 */
export async function createAuthAccount(
  email: string,
  password: string,
  options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<UserCredential> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const userCredential = await withAuthRetry(
      () => createUserWithEmailAndPassword(auth, normalizedEmail, password),
      { 
        maxRetries: options.maxRetries || 3, 
        retryDelay: options.retryDelay || 1000 
      }
    ) as UserCredential;
    
    return userCredential;
  } catch (authError: any) {
    console.error('❌ [SIGNUP] Firebase Auth error:', {
      code: authError.code,
      message: authError.message,
      email: normalizedEmail
    });
    
    throw authError;
  }
}

/**
 * Crée les données utilisateur selon le rôle
 * IMPORTANT: Ne PAS inclure currentSubscriptionSessionId pour les directeurs
 * Ce champ sera ajouté après l'achat du package
 */
export function createUserDocumentData(
  name: string,
  email: string,
  role: 'admin' | 'directeur' | 'employe',
  agencyId: string
): UserDocumentData {
  const baseData: UserDocumentData = {
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
      needsPackageSelection: true
      // PAS de currentSubscriptionSessionId ici - sera ajouté après achat du package
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
}

/**
 * Crée le document utilisateur dans Firestore
 */
export async function createUserDocument(
  userId: string,
  userData: UserDocumentData,
  options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<void> {
  try {
    await withFirestoreRetry(
      () => setDoc(doc(db, 'users', userId), userData),
      { 
        maxRetries: options.maxRetries || 3, 
        retryDelay: options.retryDelay || 1000 
      }
    );
  } catch (firestoreError: any) {
    console.error('❌ [SIGNUP] Firestore creation error:', firestoreError);
    throw firestoreError;
  }
}

/**
 * Configure l'Univers par défaut pour un directeur
 * Crée le Univers, l'active et crée l'instance
 */
export async function setupDefaultUnivers(
  directorId: string,
  agencyId: string
): Promise<{ success: boolean; universId?: string; error?: string }> {
  try {
    if (!agencyId.trim()) {
      return { success: false, error: 'AgencyId est requis pour créer l\'Univers par défaut' };
    }
    
    const universId = await universService.ensureDefaultUnivers(directorId, agencyId);
    console.log('✅ Univers par défaut créé pour le directeur:', directorId);
    
    return { success: true, universId };
  } catch (universError: any) {
    console.error('⚠️ Erreur lors de la création de l\'univers par défaut:', universError);
    return { 
      success: false, 
      error: universError.message || 'Erreur lors de la création de l\'Univers par défaut' 
    };
  }
}

/**
 * Effectue le rollback en cas d'erreur lors de l'inscription
 * Nettoie Auth → Firestore → Univers dans cet ordre
 */
export async function rollbackOnError(options: RollbackOptions): Promise<void> {
  const { authUser, userId, cleanupUnivers, universId } = options;
  
  console.log('🔄 [ROLLBACK] Début du nettoyage...', { userId, cleanupUnivers, universId });
  
  // 1. Supprimer le compte Auth si créé
  if (authUser) {
    try {
      await deleteUser(authUser);
      console.log('✅ [ROLLBACK] Compte Auth supprimé');
    } catch (deleteError) {
      console.error('❌ [ROLLBACK] Échec de la suppression du compte Auth:', deleteError);
    }
  }
  
  // 2. Supprimer le document Firestore si créé
  if (userId) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {}, { merge: false }); // Tentative de suppression
      // Note: Firestore ne permet pas la suppression directe sans permissions
      // On laisse le document être nettoyé manuellement si nécessaire
      console.log('⚠️ [ROLLBACK] Document Firestore marqué pour nettoyage manuel');
    } catch (deleteError) {
      console.error('❌ [ROLLBACK] Échec de la suppression du document Firestore:', deleteError);
    }
  }
  
  // 3. Nettoyer l'Univers si créé (optionnel, généralement non bloquant)
  if (cleanupUnivers && universId) {
    try {
      // L'Univers peut être laissé en place car il ne cause pas de problème
      // et peut être réutilisé si l'utilisateur réessaie
      console.log('⚠️ [ROLLBACK] Univers laissé en place (non bloquant)');
    } catch (universError) {
      console.error('❌ [ROLLBACK] Erreur lors du nettoyage de l\'Univers:', universError);
    }
  }
  
  console.log('✅ [ROLLBACK] Nettoyage terminé');
}

/**
 * Track l'ajout d'un employé dans la session d'abonnement du directeur
 */
async function trackEmployeeAddition(agencyId: string): Promise<void> {
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

/**
 * Fonction principale d'inscription
 * Orchestre toutes les étapes : validation → Auth → Firestore → Univers
 */
export async function signup(data: SignupData): Promise<SignupResult> {
  const normalizedEmail = data.email.trim().toLowerCase();
  let userCredential: UserCredential | null = null;
  let userId: string | undefined;
  let universId: string | undefined;
  let universCreated = false;
  
  try {
    // ============================================
    // 1. VALIDATION DES DONNÉES
    // ============================================
    const validation = validateSignupData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Données d\'inscription invalides'
      };
    }
    
    // ============================================
    // 2. PRÉ-VALIDATION POUR DIRECTEURS
    // ============================================
    if (data.role === 'directeur') {
      // Vérifier l'email (uniquement Firebase Auth)
      const emailCheck = await checkEmailAvailable(normalizedEmail);
      if (emailCheck.exists) {
        return {
          success: false,
          error: emailCheck.error || 'Email déjà utilisé. Essayez de vous connecter.',
          action: 'login'
        };
      }
      
      // Vérifier l'agencyId (doit être unique)
      const agencyIdCheck = await checkAgencyIdExists(data.agencyId);
      if (agencyIdCheck.exists) {
        return {
          success: false,
          error: agencyIdCheck.error || 'ID agence existe déjà. Veuillez utiliser un autre ID.'
        };
      }
    }
    
    // ============================================
    // 3. PRÉ-VALIDATION POUR EMPLOYÉS
    // ============================================
    if (data.role === 'employe') {
      // Vérifier l'email (uniquement Firebase Auth)
      const emailCheck = await checkEmailAvailable(normalizedEmail);
      if (emailCheck.exists) {
        return {
          success: false,
          error: emailCheck.error || 'Email déjà utilisé. Essayez de vous connecter.',
          action: 'login'
        };
      }
      
      // Vérifier les limites d'utilisateurs
      try {
        const limitCheck = await withRetry(
          () => checkAgencyUserLimit(data.agencyId),
          { maxRetries: 2, retryDelay: 500 }
        );
        
        if (!limitCheck.canAddUser) {
          return {
            success: false,
            error: limitCheck.error || 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour cette agence.',
            directorInfo: limitCheck.directorInfo
          };
        }
      } catch (error) {
        console.error('❌ REGISTRATION ERROR: Failed to check user limits during employee registration');
        return {
          success: false,
          error: 'Erreur technique: Impossible de vérifier les limites d\'utilisateurs. Veuillez contacter le support technique.'
        };
      }
    }
    
    // ============================================
    // 4. CRÉATION DU COMPTE FIREBASE AUTH
    // ============================================
    try {
      userCredential = await createAuthAccount(normalizedEmail, data.password);
      userId = userCredential.user.uid;
    } catch (authError: any) {
      console.error('❌ [SIGNUP] Firebase Auth error:', authError);
      
      if (authError.code === 'auth/email-already-in-use') {
        return {
          success: false,
          error: 'Email déjà utilisé. Essayez de vous connecter.',
          action: 'login'
        };
      }
      
      return {
        success: false,
        error: formatAuthErrorMessage(authError)
      };
    }
    
    if (!userCredential || !userId) {
      throw new Error('userCredential is undefined after Auth creation');
    }
    
    // ============================================
    // 5. CRÉATION DU DOCUMENT FIRESTORE
    // ============================================
    try {
      const userData = createUserDocumentData(data.name, normalizedEmail, data.role, data.agencyId);
      await createUserDocument(userId, userData);
    } catch (firestoreError: any) {
      console.error('❌ [SIGNUP] Firestore creation error:', firestoreError);
      
      // Rollback: Supprimer le compte Auth
      await rollbackOnError({ authUser: userCredential.user });
      
      return {
        success: false,
        error: 'Erreur lors de la création du profil. Veuillez réessayer.'
      };
    }
    
    // ============================================
    // 6. CRÉATION DE L'UNIVERS PAR DÉFAUT (DIRECTEURS UNIQUEMENT)
    // ============================================
    if (data.role === 'directeur' && data.agencyId.trim()) {
      const universResult = await setupDefaultUnivers(userId, data.agencyId);
      if (universResult.success) {
        universCreated = true;
        universId = universResult.universId;
      } else {
        // Non bloquant - l'utilisateur pourra continuer
        console.warn('⚠️ Univers non créé (non bloquant):', universResult.error);
      }
    }
    
    // ============================================
    // 7. TRACKING ET ANALYTICS (NON BLOQUANT)
    // ============================================
    // Track user addition in subscription session (only for employees)
    if (data.role === 'employe') {
      await trackEmployeeAddition(data.agencyId);
    }
    
    // Track registration analytics
    try {
      await AnalyticsService.logUserRegistration(userId, data.role, data.agencyId);
    } catch (analyticsError) {
      console.warn('⚠️ Could not log registration analytics (non-blocking):', analyticsError);
    }
    
    // Marquer pour afficher l'écran de bienvenue
    try {
      sessionStorage.setItem('show_welcome_after_login', 'true');
    } catch {}
    
    return {
      success: true,
      universCreated,
      userId
    };
    
  } catch (err: any) {
    console.error('❌ Erreur d\'inscription inattendue:', err);
    
    // Rollback complet en cas d'erreur inattendue
    await rollbackOnError({
      authUser: userCredential?.user,
      userId,
      cleanupUnivers: universCreated,
      universId
    });
    
    return {
      success: false,
      error: formatAuthErrorMessage(err)
    };
  }
}

