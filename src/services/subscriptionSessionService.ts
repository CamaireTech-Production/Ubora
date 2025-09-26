import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession, User, PayAsYouGoPurchase } from '../types';
import { PACKAGE_LIMITS } from '../config/packageFeatures';

export class SubscriptionSessionService {
  /**
   * Convert Firestore Timestamp to JavaScript Date
   * @param date - Date from Firestore (could be Timestamp or Date)
   * @returns Date object
   */
  private static convertToDate(date: any): Date {
    if (date instanceof Date) {
      return date;
    }
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    if (date && typeof date === 'string') {
      return new Date(date);
    }
    if (date && typeof date === 'number') {
      return new Date(date);
    }
    return new Date();
  }

  /**
   * Create a new subscription session
   * @param userId - ID de l'utilisateur
   * @param sessionData - Données de la session
   * @returns Promise<boolean> - true si la création a réussi
   */
  static async createSession(
    userId: string,
    sessionData: Omit<SubscriptionSession, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const now = new Date();
      
      // Generate unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get package limits for the selected package
      const packageLimits = PACKAGE_LIMITS[sessionData.packageType];
      
      // Create new session with proper structure
      const newSession: SubscriptionSession = {
        ...sessionData,
        id: sessionId,
        createdAt: now,
        updatedAt: now,
        
        // Package resources from the selected package
        packageResources: {
          tokensIncluded: packageLimits.monthlyTokens,
          formsIncluded: packageLimits.maxForms,
          dashboardsIncluded: packageLimits.maxDashboards,
          usersIncluded: packageLimits.maxUsers
        },
        
        // Initialize pay-as-you-go resources (empty by default)
        payAsYouGoResources: {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: []
        },
        
        // Initialize usage tracking
        usage: {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        }
      };
      
      // Deactivate all existing sessions
      const updatedSessions = (userData.subscriptionSessions || []).map(session => ({
        ...session,
        isActive: false,
        updatedAt: now
      }));
      
      // Add new session
      updatedSessions.push(newSession);
      
      // Update user document with new session
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        currentSessionId: sessionId,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ New subscription session created for user ${userId}: ${sessionData.packageType} from ${sessionData.startDate.toISOString()} to ${sessionData.endDate.toISOString()}`);
      return true;
      
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
  static getCurrentSession(userData: User): SubscriptionSession | null {
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
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentSession = this.getCurrentSession(userData);
      
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
      
      // Update current session with new pay-as-you-go resources
      const updatedSessions = userData.subscriptionSessions.map(session => {
        if (session.id === currentSession.id) {
          const currentPayAsYouGo = session.payAsYouGoResources || {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          };
          
          return {
            ...session,
            payAsYouGoResources: {
              tokens: currentPayAsYouGo.tokens + (purchase.itemType === 'tokens' ? purchase.quantity : 0),
              forms: currentPayAsYouGo.forms + (purchase.itemType === 'forms' ? purchase.quantity : 0),
              dashboards: currentPayAsYouGo.dashboards + (purchase.itemType === 'dashboards' ? purchase.quantity : 0),
              users: currentPayAsYouGo.users + (purchase.itemType === 'users' ? purchase.quantity : 0),
              purchases: [...currentPayAsYouGo.purchases, newPurchase]
            },
            updatedAt: now
          };
        }
        return session;
      });
      
      // Update user document
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Pay-as-you-go resources added for user ${userId}: ${purchase.quantity} ${purchase.itemType} for ${purchase.amountPaid} FCFA`);
      return true;
      
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
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentSession = this.getCurrentSession(userData);
      
      if (!currentSession) {
        console.error('Aucune session active trouvée pour l\'utilisateur:', userId);
        return false;
      }
      
      const now = new Date();
      
      // Update current session usage
      const updatedSessions = userData.subscriptionSessions.map(session => {
        if (session.id === currentSession.id) {
          const currentUsage = session.usage || {
            tokensUsed: 0,
            formsCreated: 0,
            dashboardsCreated: 0,
            usersAdded: 0
          };
          
          return {
            ...session,
            usage: {
              ...currentUsage,
              tokensUsed: currentUsage.tokensUsed + (usageType === 'tokens' ? quantity : 0),
              formsCreated: currentUsage.formsCreated + (usageType === 'forms' ? quantity : 0),
              dashboardsCreated: currentUsage.dashboardsCreated + (usageType === 'dashboards' ? quantity : 0),
              usersAdded: currentUsage.usersAdded + (usageType === 'users' ? quantity : 0),
              lastTokenUsed: usageType === 'tokens' ? now : currentUsage.lastTokenUsed,
              lastFormCreated: usageType === 'forms' ? now : currentUsage.lastFormCreated,
              lastDashboardCreated: usageType === 'dashboards' ? now : currentUsage.lastDashboardCreated,
              lastUserAdded: usageType === 'users' ? now : currentUsage.lastUserAdded
            },
            updatedAt: now
          };
        }
        return session;
      });
      
      // Update user document
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Usage updated for user ${userId}: ${quantity} ${usageType}`);
      return true;
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'usage:', error);
      return false;
    }
  }
  
  /**
   * Get all sessions for a user
   * @param userData - Données utilisateur
   * @returns SubscriptionSession[]
   */
  static getAllSessions(userData: User): SubscriptionSession[] {
    return userData.subscriptionSessions || [];
  }
  
  /**
   * Get session by ID
   * @param userData - Données utilisateur
   * @param sessionId - ID de la session
   * @returns SubscriptionSession | null
   */
  static getSessionById(userData: User, sessionId: string): SubscriptionSession | null {
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
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentSession = this.getCurrentSession(userData);
      
      if (!currentSession) {
        console.error('Aucune session active trouvée pour l\'utilisateur:', userId);
        return false;
      }
      
      const now = new Date();
      
      // Deactivate current session
      const updatedSessions = userData.subscriptionSessions.map(session => {
        if (session.id === currentSession.id) {
          return {
            ...session,
            isActive: false,
            updatedAt: now
          };
        }
        return session;
      });
      
      // Update user document
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        currentSessionId: null,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Session deactivated for user ${userId}: ${currentSession.id}`);
      return true;
      
    } catch (error) {
      console.error('Erreur lors de la désactivation de la session:', error);
      return false;
    }
  }
}