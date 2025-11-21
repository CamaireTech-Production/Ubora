/**
 * Types pour le système d'authentification
 * Définit les interfaces et types pour signup, login et gestion d'état
 */

import { UserCredential, User as FirebaseUser } from 'firebase/auth';
import { User } from '../../types';

/**
 * Données nécessaires pour l'inscription
 */
export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'directeur' | 'employe';
  agencyId: string;
}

/**
 * Résultat de l'inscription
 */
export interface SignupResult {
  success: boolean;
  error?: string;
  action?: 'login' | 'recover';
  universCreated?: boolean;
  directorInfo?: {
    id: string;
    name: string;
    email: string;
  };
  userId?: string;
}

/**
 * Données nécessaires pour la connexion
 */
export interface LoginData {
  email: string;
  password: string;
}

/**
 * Résultat de la connexion
 */
export interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
  firebaseUser?: FirebaseUser;
}

/**
 * Résultat de la vérification d'email
 */
export interface EmailCheckResult {
  exists: boolean;
  error?: string;
}

/**
 * Résultat de la vérification d'agencyId
 */
export interface AgencyIdCheckResult {
  exists: boolean;
  error?: string;
}

/**
 * Résultat de la vérification des limites d'utilisateurs
 */
export interface UserLimitCheckResult {
  canAddUser: boolean;
  error?: string;
  directorInfo?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Données utilisateur pour la création du document Firestore
 * (sans currentSubscriptionSessionId pour les directeurs)
 */
export interface UserDocumentData {
  name: string;
  email: string;
  role: 'admin' | 'directeur' | 'employe';
  agencyId: string;
  isApproved: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  // Champs spécifiques selon le rôle
  needsPackageSelection?: boolean; // Pour directeurs
  isSuperAdmin?: boolean; // Pour admins
  adminPermissions?: string[]; // Pour admins
  isActive?: boolean; // Pour admins
  approvedBy?: string; // Pour employés
  approvedAt?: any; // Pour employés
  accessLevels?: any[]; // Pour employés
  hasDirectorDashboardAccess?: boolean; // Pour employés
}

/**
 * État de l'authentification
 */
export interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  isRegistering: boolean; // Flag pour éviter les race conditions
}

/**
 * Options pour la création d'un compte Auth
 */
export interface CreateAuthAccountOptions {
  email: string;
  password: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Options pour la création d'un document utilisateur
 */
export interface CreateUserDocumentOptions {
  userId: string;
  userData: UserDocumentData;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Options pour le rollback en cas d'erreur
 */
export interface RollbackOptions {
  authUser?: FirebaseUser;
  userId?: string;
  cleanupUnivers?: boolean;
  universId?: string;
}

/**
 * Erreurs d'authentification typées
 */
export enum AuthErrorCode {
  EMAIL_ALREADY_IN_USE = 'auth/email-already-in-use',
  USER_NOT_FOUND = 'auth/user-not-found',
  WRONG_PASSWORD = 'auth/wrong-password',
  WEAK_PASSWORD = 'auth/weak-password',
  INVALID_EMAIL = 'auth/invalid-email',
  NETWORK_ERROR = 'auth/network-request-failed',
  PERMISSION_DENIED = 'permission-denied',
  FIRESTORE_ERROR = 'firestore-error',
  UNIVERS_CREATION_ERROR = 'univers-creation-error',
  UNKNOWN_ERROR = 'unknown-error'
}

/**
 * Configuration pour la validation des données d'inscription
 */
export interface SignupValidationConfig {
  minPasswordLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

