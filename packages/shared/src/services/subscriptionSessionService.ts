import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession, User, PayAsYouGoPurchase } from '../types';
import { PACKAGE_LIMITS } from '../config/packageFeatures';
import { SubscriptionSessionCollectionService } from './subscriptionSessionCollectionService';

export class SubscriptionSessionService {

  /**
   * Create a new subscription session
   * @deprecated Use SubscriptionSessionCollectionService.createSession() instead
   * @param userId - ID de l'utilisateur
   * @param sessionData - Données de la session
   * @returns Promise<boolean> - true si la création a réussi
   */
  static async createSession(
    userId: string,
    sessionData: Omit<SubscriptionSession, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<boolean> {
    try {
      // Use new collection service
      const sessionId = await SubscriptionSessionCollectionService.createSession(userId, sessionData as any);
      return sessionId !== null;
    } catch (error) {
      console.error('Erreur lors de la création de la session:', error);
      return false;
    }
  }
  
  /**
   * Get current active session for a user
   * @param userData - Données utilisateur
   * @returns SubscriptionSession | null
   */
  static async getCurrentSession(userData: User): Promise<SubscriptionSession | null> {
    // Try new collection service first
    if (userData.currentSubscriptionSessionId) {
      const session = await SubscriptionSessionCollectionService.getActiveSession(userData.id);
      if (session) {
        return session;
      }
    }

    // Fallback to legacy array-based system for backward compatibility
    if (!userData.subscriptionSessions || !userData.currentSessionId) {
      return null;
    }
    
    return userData.subscriptionSessions.find(session => 
      session.id === userData.currentSessionId && session.isActive
    ) || null;
  }

  /**
   * Get current active session synchronously (for backward compatibility)
   * @deprecated Use getCurrentSession() instead (async)
   * @param userData - Données utilisateur
   * @returns SubscriptionSession | null
   */
  static getCurrentSessionSync(userData: User): SubscriptionSession | null {
    // Fallback to legacy array-based system
    if (!userData.subscriptionSessions || !userData.currentSessionId) {
      return null;
    }
    
    return userData.subscriptionSessions.find(session => 
      session.id === userData.currentSessionId && session.isActive
    ) || null;
  }
  
  /**
   * Add pay-as-you-go resources to current session
   * @param userId - ID de l'utilisateur
   * @param purchase - Pay-as-you-go purchase details
   * @returns Promise<boolean> - true si l'ajout a réussi
   */
  static async addPayAsYouGoResources(
    userId: string,
    purchase: Omit<PayAsYouGoPurchase, 'id'>
  ): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('Aucune session active trouvée pour l\'utilisateur:', userId);
        return false;
      }
      
      const now = new Date();
      const purchaseId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create purchase record
      const newPurchase: PayAsYouGoPurchase = {
        ...purchase,
        id: purchaseId,
        purchaseDate: now
      };
      
      // Get current pay-as-you-go resources
      const currentPayAsYouGo = currentSession.payAsYouGoResources || {
        tokens: 0,
        forms: 0,
        dashboards: 0,
        users: 0,
        purchases: []
      };
      
      // Update session with new pay-as-you-go resources
      const updatedPayAsYouGo = {
        tokens: currentPayAsYouGo.tokens + (purchase.itemType === 'tokens' ? purchase.quantity : 0),
        forms: currentPayAsYouGo.forms + (purchase.itemType === 'forms' ? purchase.quantity : 0),
        dashboards: currentPayAsYouGo.dashboards + (purchase.itemType === 'dashboards' ? purchase.quantity : 0),
        users: currentPayAsYouGo.users + (purchase.itemType === 'users' ? purchase.quantity : 0),
        purchases: [...(currentPayAsYouGo.purchases || []), newPurchase]
      };
      
      // Update session in collection
      return await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
        payAsYouGoResources: updatedPayAsYouGo
      });
      
    } catch (error) {
      console.error('Erreur lors de l\'ajout des ressources pay-as-you-go:', error);
      return false;
    }
  }
  
  /**
   * Update usage in current session
   * @param userId - ID de l'utilisateur
   * @param usageType - Type d'usage ('tokens' | 'forms' | 'dashboards' | 'users')
   * @param quantity - Quantité utilisée
   * @returns Promise<boolean> - true si la mise à jour a réussi
   */
  static async updateUsage(
    userId: string,
    usageType: 'tokens' | 'forms' | 'dashboards' | 'users',
    quantity: number = 1
  ): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('Aucune session active trouvée pour l\'utilisateur:', userId);
        return false;
      }
      
      const now = new Date();
      const currentUsage = currentSession.usage || {
        tokensUsed: 0,
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0
      };
      
      // Ensure all usage fields have proper default values
      const safeUsage = {
        tokensUsed: currentUsage.tokensUsed || 0,
        formsCreated: currentUsage.formsCreated || 0,
        dashboardsCreated: currentUsage.dashboardsCreated || 0,
        usersAdded: currentUsage.usersAdded || 0,
        lastTokenUsed: (currentUsage as any).lastTokenUsed || null,
        lastFormCreated: (currentUsage as any).lastFormCreated || null,
        lastDashboardCreated: (currentUsage as any).lastDashboardCreated || null,
        lastUserAdded: (currentUsage as any).lastUserAdded || null
      };
      
      // Update usage
      const updatedUsage = {
        ...safeUsage,
        tokensUsed: safeUsage.tokensUsed + (usageType === 'tokens' ? quantity : 0),
        formsCreated: safeUsage.formsCreated + (usageType === 'forms' ? quantity : 0),
        dashboardsCreated: safeUsage.dashboardsCreated + (usageType === 'dashboards' ? quantity : 0),
        usersAdded: safeUsage.usersAdded + (usageType === 'users' ? quantity : 0),
        lastTokenUsed: usageType === 'tokens' ? now : safeUsage.lastTokenUsed,
        lastFormCreated: usageType === 'forms' ? now : safeUsage.lastFormCreated,
        lastDashboardCreated: usageType === 'dashboards' ? now : safeUsage.lastDashboardCreated,
        lastUserAdded: usageType === 'users' ? now : safeUsage.lastUserAdded
      };
      
      // Update session in collection
      return await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
        usage: updatedUsage
      });
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'usage:', error);
      return false;
    }
  }
  
  /**
   * Get all sessions for a user (async version - uses new collection)
   * @param userData - Données utilisateur
   * @returns Promise<SubscriptionSession[]>
   */
  static async getAllSessions(userData: User): Promise<SubscriptionSession[]> {
    // Try new collection service first
    const sessions = await SubscriptionSessionCollectionService.getUserSessions(userData.id);
    if (sessions.length > 0) {
      return sessions;
    }
    
    // Fallback to legacy array-based system
    return userData.subscriptionSessions || [];
  }

  /**
   * Get all sessions for a user (sync version - for backward compatibility)
   * @deprecated Use getAllSessions() async version instead
   * @param userData - Données utilisateur
   * @returns SubscriptionSession[]
   */
  static getAllSessionsSync(userData: User): SubscriptionSession[] {
    return userData.subscriptionSessions || [];
  }
  
  /**
   * Get session by ID (async version - uses new collection)
   * @param userData - Données utilisateur
   * @param sessionId - ID de la session
   * @returns Promise<SubscriptionSession | null>
   */
  static async getSessionById(userData: User, sessionId: string): Promise<SubscriptionSession | null> {
    // Try new collection service first
    if (userData.currentSubscriptionSessionId === sessionId) {
      const session = await SubscriptionSessionCollectionService.getActiveSession(userData.id);
      if (session && session.id === sessionId) {
        return session;
      }
    }
    
    // Get all sessions and find by ID
    const sessions = await SubscriptionSessionCollectionService.getUserSessions(userData.id);
    const foundSession = sessions.find(s => s.id === sessionId);
    if (foundSession) {
      return foundSession;
    }
    
    // Fallback to legacy array-based system
    const legacySessions = userData.subscriptionSessions || [];
    return legacySessions.find(session => session.id === sessionId) || null;
  }

  /**
   * Get session by ID (sync version - for backward compatibility)
   * @deprecated Use getSessionById() async version instead
   * @param userData - Données utilisateur
   * @param sessionId - ID de la session
   * @returns SubscriptionSession | null
   */
  static getSessionByIdSync(userData: User, sessionId: string): SubscriptionSession | null {
    const sessions = userData.subscriptionSessions || [];
    return sessions.find(session => session.id === sessionId) || null;
  }
  
  /**
   * Deactivate current session
   * @param userId - ID de l'utilisateur
   * @returns Promise<boolean> - true si la désactivation a réussi
   */
  static async deactivateCurrentSession(userId: string): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('Aucune session active trouvée pour l\'utilisateur:', userId);
        return false;
      }
      
      // Deactivate session in collection
      const deactivated = await SubscriptionSessionCollectionService.deactivateSession(currentSession.id);
      
      if (deactivated) {
        // Update user document to remove reference
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
          currentSubscriptionSessionId: null,
          updatedAt: serverTimestamp()
        });
      }
      
      return deactivated;
      
    } catch (error) {
      console.error('Erreur lors de la désactivation de la session:', error);
      return false;
    }
  }
}