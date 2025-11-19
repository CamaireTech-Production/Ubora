/**
 * Authentication Handler for AI Requests
 * Handles Firebase token and internal token authentication
 */

import { adminAuth, adminDb } from '../lib/firebaseAdmin.js';
import { logger } from '../lib/logger.js';

/**
 * Authenticate request and return user ID
 */
export async function authenticateRequest(req) {
  logger.debug('Starting authentication', null, '/api/ai/authHandler');
  
  const internalToken = req.headers['x-internal-token'];
  if (internalToken && process.env.INTERNAL_API_KEY && internalToken === process.env.INTERNAL_API_KEY) {
    logger.debug('Using internal token authentication', null, '/api/ai/authHandler');
    // Server-to-server call: trust provided userId for execution context
    const uid = req.body.userId;
    if (!uid) {
      throw new Error('MISSING_USER_ID');
    }
    return uid;
  }
  
  logger.debug('Using Firebase token authentication', null, '/api/ai/authHandler');
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.error('Missing authorization header', null, '/api/ai/authHandler');
    throw new Error('MISSING_TOKEN');
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  try {
    logger.debug('Verifying Firebase token', null, '/api/ai/authHandler');
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    logger.debug('Token verified', { uid }, '/api/ai/authHandler');
    return uid;
  } catch (authError) {
    logger.error('Token verification failed', authError, '/api/ai/authHandler');
    throw new Error('INVALID_TOKEN');
  }
}

/**
 * Fetch and validate user profile
 */
export async function fetchUserProfile(uid) {
  logger.debug('Fetching user profile', { uid }, '/api/ai/authHandler');
  
  let userDoc;
  try {
    userDoc = await adminDb.collection('users').doc(uid).get();
    logger.debug('User doc fetched', { exists: userDoc.exists }, '/api/ai/authHandler');
  } catch (firestoreError) {
    logger.error('Firestore error', firestoreError, '/api/ai/authHandler');
    throw new Error('FIRESTORE_ERROR');
  }
  
  if (!userDoc.exists) {
    throw new Error('USER_NOT_FOUND');
  }

  const userData = userDoc.data();
  if (!userData) {
    throw new Error('USER_DATA_MISSING');
  }
  
  // Validate user role
  if (userData.role !== 'directeur') {
    throw new Error('INSUFFICIENT_ROLE');
  }
  
  // Validate agency
  if (!userData.agencyId) {
    throw new Error('MISSING_AGENCY');
  }
  
  return userData;
}

/**
 * Get error response for authentication errors
 */
export function getAuthErrorResponse(error) {
  const errorMessages = {
    'MISSING_TOKEN': { status: 401, error: 'Token d\'authentification manquant', code: 'MISSING_TOKEN' },
    'INVALID_TOKEN': { status: 401, error: 'Token invalide ou expiré', code: 'INVALID_TOKEN' },
    'USER_NOT_FOUND': { status: 404, error: 'Profil utilisateur non trouvé', code: 'USER_NOT_FOUND' },
    'USER_DATA_MISSING': { status: 404, error: 'Données utilisateur non trouvées', code: 'USER_DATA_MISSING' },
    'INSUFFICIENT_ROLE': { status: 403, error: 'Accès réservé aux directeurs', code: 'INSUFFICIENT_ROLE' },
    'MISSING_AGENCY': { status: 403, error: 'Agence non définie pour cet utilisateur', code: 'MISSING_AGENCY' },
    'MISSING_USER_ID': { status: 400, error: 'userId requis pour une exécution interne', code: 'MISSING_USER_ID' },
    'FIRESTORE_ERROR': { status: 500, error: 'Erreur de connexion à la base de données', code: 'FIRESTORE_ERROR' }
  };
  
  return errorMessages[error] || { status: 500, error: 'Erreur d\'authentification', code: 'AUTH_ERROR' };
}

