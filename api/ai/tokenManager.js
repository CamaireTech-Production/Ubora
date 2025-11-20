/**
 * Token Manager Module
 * Extracted from ask.js for better code organization
 * 
 * Functions:
 * - calculateUserTokens: Calculates user tokens from actual tokens
 * - getPackageLimit: Gets package limit based on package type
 * - checkSubscriptionAndResetTokens: Checks subscription status (legacy compatibility)
 * - updateTokenUsage: Updates token usage in active session
 */

import { adminDb } from '../lib/firebaseAdmin.js';
import admin from 'firebase-admin';
import { logger } from '../lib/logger.js';

/**
 * Calculate user tokens from actual tokens
 * Formula: (actualTokens * 2.5) / 100
 * @param {number} actualTokens - Actual tokens used
 * @returns {number} - User tokens to charge
 */
function calculateUserTokens(actualTokens) {
  return Math.ceil((actualTokens * 2.5) / 100);
}

/**
 * Get package limit based on package type
 * @param {string} packageType - Package type (starter, standard, premium)
 * @returns {number} - Package limit in tokens
 */
function getPackageLimit(packageType) {
  const limits = {
    starter: 300000,    // Updated to match PACKAGES.md
    standard: 600000,   // Updated to match PACKAGES.md
    premium: 1500000    // Updated to match PACKAGES.md
  };
  return limits[packageType] || 300000;
}

/**
 * Check subscription status - tokens are managed in subscriptionSessions collection only
 * This function is kept for compatibility but doesn't modify user document
 * @param {Object} userData - User data
 * @param {string} uid - User ID
 * @returns {Promise<Object>} - Default values for compatibility
 */
async function checkSubscriptionAndResetTokens(userData, uid) {
  // Tokens are now managed in subscriptionSessions collection
  // This function returns default values for compatibility
  return { 
    tokensUsed: 0, 
    payAsYouGoTokens: 0, 
    subscriptionExpired: false 
  };
}

/**
 * Get active session for user
 * @param {string} uid - User ID
 * @param {Object} userData - User data
 * @returns {Promise<Object|null>} - Active session or null
 */
async function getActiveSession(uid, userData) {
  try {
    if (!userData.currentSubscriptionSessionId) {
      return null;
    }

    const sessionDoc = await adminDb.collection('subscriptionSessions')
      .doc(userData.currentSubscriptionSessionId)
      .get();

    if (!sessionDoc.exists) {
      return null;
    }

    const sessionData = sessionDoc.data();
    if (sessionData.isActive) {
      return { id: sessionDoc.id, ...sessionData };
    }

    return null;
  } catch (error) {
    logger.error('Error fetching session from collection', error, 'tokenManager.js');
    return null;
  }
}

/**
 * Update token usage in active session
 * @param {string} uid - User ID
 * @param {number} tokensToCharge - Tokens to charge
 * @param {Object} currentSession - Current active session
 * @returns {Promise<Object>} - Updated token information
 */
async function updateTokenUsage(uid, tokensToCharge, currentSession) {
  try {
    if (!currentSession || !currentSession.id) {
      throw new Error('No active session provided');
    }

    logger.debug('SESSION TOKEN TRACKING START', {
      packageLimit: currentSession.packageResources?.tokensIncluded || 0,
      tokensToCharge,
      uid
    }, 'tokenManager.js');

    // Get fresh user data to ensure we have the latest session data
    const freshUserDoc = await adminDb.collection('users').doc(uid).get();
    const freshUserData = freshUserDoc.data();

    // Get current active session (using new collection)
    let sessionDocRef = null;
    let activeSession = null;

    // Try to get active session from new collection first
    if (freshUserData.currentSubscriptionSessionId) {
      try {
        sessionDocRef = adminDb.collection('subscriptionSessions')
          .doc(freshUserData.currentSubscriptionSessionId);
        const sessionDoc = await sessionDocRef.get();

        if (sessionDoc.exists) {
          const sessionData = sessionDoc.data();
          if (sessionData.isActive) {
            activeSession = { id: sessionDoc.id, ...sessionData };
          }
        }
      } catch (error) {
        logger.error('Error fetching session from collection', error, 'tokenManager.js');
      }
    }

    if (!activeSession) {
      logger.error('No active session found for user', { uid }, 'tokenManager.js');
      throw new Error('Aucune session active trouvée. Veuillez sélectionner un package.');
    }

    logger.debug('SESSION TOKEN TRACKING - ACTIVE SESSION FOUND', {
      sessionId: activeSession.id,
      packageType: activeSession.packageType,
      currentTokensUsed: activeSession.usage?.tokensUsed || 0,
      isFromCollection: !!sessionDocRef
    }, 'tokenManager.js');

    // Update the current session's token usage
    const currentUsage = activeSession.usage || {
      tokensUsed: 0,
      formsCreated: 0,
      dashboardsCreated: 0,
      usersAdded: 0
    };

    const newTokensUsed = currentUsage.tokensUsed + tokensToCharge;

    // Update session in collection (only subscriptionSessions collection is used)
    if (!sessionDocRef) {
      logger.error('Session found but no sessionDocRef - session should be in subscriptionSessions collection', null, 'tokenManager.js');
      throw new Error('Erreur de session. Veuillez réessayer.');
    }

    await sessionDocRef.update({
      'usage.tokensUsed': newTokensUsed,
      'usage.lastTokenUsed': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Calculate remaining tokens for response
    const sessionPackageLimit = activeSession.packageResources?.tokensIncluded || 0;
    const sessionPayAsYouGoTokens = activeSession.payAsYouGoResources?.tokens || 0;

    logger.debug('SESSION TOKEN TRACKING SUCCESS', {
      tokensToCharge,
      sessionTokensUsed: newTokensUsed,
      sessionPackageLimit,
      sessionPayAsYouGoTokens,
      remainingTokens: sessionPackageLimit === -1 ? -1 : Math.max(0, (sessionPackageLimit + sessionPayAsYouGoTokens) - newTokensUsed)
    }, 'tokenManager.js');

    return {
      updatedTokensUsed: newTokensUsed,
      updatedPayAsYouGoTokens: sessionPayAsYouGoTokens,
      packageLimit: sessionPackageLimit,
      remainingTokens: sessionPackageLimit === -1 ? -1 : Math.max(0, (sessionPackageLimit + sessionPayAsYouGoTokens) - newTokensUsed)
    };
  } catch (error) {
    logger.error('SESSION TOKEN TRACKING ERROR', error, 'tokenManager.js');
    throw error;
  }
}

export {
  calculateUserTokens,
  getPackageLimit,
  checkSubscriptionAndResetTokens,
  getActiveSession,
  updateTokenUsage
};

