/**
 * Helper utilities to resolve the active Univers metadata for a director.
 * Prefers the fields stored on the user document and falls back to the legacy
 * activeUnivers/<directorId> collection only when necessary.
 */

import { adminDb } from './firebaseAdmin.js';
import { logger } from './logger.js';

const USERS_COLLECTION = 'users';
const ACTIVE_UNIVERS_COLLECTION = 'activeUnivers';

const safeToDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number' || typeof value === 'string') return new Date(value);
  return null;
};

/**
 * Get active Univers metadata for a director.
 * @param {string} directorId
 * @returns {Promise<{ activeUniversId: string|null, activeInstanceId: string|null, agencyId: string|null, source: 'user'|'activeUniversDoc', updatedAt: Date|null }|null>}
 */
export async function getDirectorActiveUniversMeta(directorId) {
  if (!directorId) {
    return null;
  }

  if (!adminDb) {
    logger.warn('Firebase Admin is not initialized; unable to resolve active Univers metadata', { directorId }, 'activeUniversHelper.js');
    return null;
  }

  try {
    const userDoc = await adminDb.collection(USERS_COLLECTION).doc(directorId).get();
    if (userDoc.exists) {
      const userData = userDoc.data() || {};
      if (userData.activeUniversId) {
        return {
          activeUniversId: userData.activeUniversId,
          activeInstanceId: userData.activeInstanceId || null,
          agencyId: userData.agencyId || null,
          updatedAt: safeToDate(userData.updatedAt),
          source: 'user'
        };
      }
    }

    const activeDoc = await adminDb.collection(ACTIVE_UNIVERS_COLLECTION).doc(directorId).get();
    if (activeDoc.exists) {
      const activeData = activeDoc.data() || {};
      return {
        activeUniversId: activeData.activeUniversId || null,
        activeInstanceId: activeData.activeInstanceId || null,
        agencyId: activeData.agencyId || null,
        updatedAt: safeToDate(activeData.updatedAt),
        source: 'activeUniversDoc'
      };
    }

    return null;
  } catch (error) {
    logger.error('Error resolving active Univers metadata', error, 'activeUniversHelper.js');
    return null;
  }
}


