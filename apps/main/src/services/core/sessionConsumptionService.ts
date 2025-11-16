import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, SubscriptionSession } from '../types';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { SubscriptionSessionCollectionService } from '@ubora/shared/services/subscriptionSessionCollectionService';

export class SessionConsumptionService {
  /**
   * Track form creation in current session
   */
  static async trackFormCreation(userId: string): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      const currentUsage = currentSession.usage || {
        tokensUsed: 0,
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0
      };
      
      // Update session usage in collection
      return await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
        usage: {
          ...currentUsage,
          formsCreated: currentUsage.formsCreated + 1,
          lastFormCreated: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error tracking form creation:', error);
      return false;
    }
  }

  /**
   * Track dashboard creation in current session
   */
  static async trackDashboardCreation(userId: string): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      const currentUsage = currentSession.usage || {
        tokensUsed: 0,
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0
      };
      
      // Update session usage in collection
      return await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
        usage: {
          ...currentUsage,
          dashboardsCreated: currentUsage.dashboardsCreated + 1,
          lastDashboardCreated: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error tracking dashboard creation:', error);
      return false;
    }
  }

  /**
   * Track user addition in current session
   */
  static async trackUserAddition(userId: string): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      const currentUsage = currentSession.usage || {
        tokensUsed: 0,
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0
      };
      
      // Update session usage in collection
      return await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
        usage: {
          ...currentUsage,
          usersAdded: currentUsage.usersAdded + 1,
          lastUserAdded: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error tracking user addition:', error);
      return false;
    }
  }

  /**
   * Track token consumption in current session
   */
  static async trackTokenConsumption(userId: string, tokensConsumed: number): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      const currentUsage = currentSession.usage || {
        tokensUsed: 0,
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0
      };
      
      // Update session usage in collection
      return await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
        usage: {
          ...currentUsage,
          tokensUsed: currentUsage.tokensUsed + tokensConsumed,
          lastTokenUsed: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error tracking token consumption:', error);
      return false;
    }
  }

  /**
   * Get consumption summary for current session (async version - uses new collection)
   * @param userData - Données utilisateur
   * @returns Promise with consumption summary
   */
  static async getCurrentSessionConsumption(userData: User): Promise<{
    formsCreated: number;
    dashboardsCreated: number;
    usersAdded: number;
    tokensConsumed: number;
    sessionStartDate: Date | null;
    sessionEndDate: Date | null;
    daysRemaining: number;
  }> {
    // Try new collection service first
    const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userData.id);
    
    if (!currentSession) {
      // Fallback to legacy system
      const legacySession = SubscriptionSessionService.getCurrentSessionSync(userData);
      if (!legacySession) {
        return {
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0,
          tokensConsumed: 0,
          sessionStartDate: null,
          sessionEndDate: null,
          daysRemaining: 0
        };
      }
      
      const usage = legacySession.usage || {
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0,
        tokensUsed: 0
      };
      
      const now = new Date();
      const endDate = legacySession.endDate instanceof Date ? legacySession.endDate : new Date(legacySession.endDate);
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        formsCreated: usage.formsCreated,
        dashboardsCreated: usage.dashboardsCreated,
        usersAdded: usage.usersAdded,
        tokensConsumed: usage.tokensUsed,
        sessionStartDate: legacySession.startDate instanceof Date ? legacySession.startDate : new Date(legacySession.startDate),
        sessionEndDate: endDate,
        daysRemaining
      };
    }
    
    const usage = currentSession.usage || {
      formsCreated: 0,
      dashboardsCreated: 0,
      usersAdded: 0,
      tokensUsed: 0
    };
    
    const now = new Date();
    const endDate = currentSession.endDate instanceof Date ? currentSession.endDate : new Date(currentSession.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      formsCreated: usage.formsCreated,
      dashboardsCreated: usage.dashboardsCreated,
      usersAdded: usage.usersAdded,
      tokensConsumed: usage.tokensUsed,
      sessionStartDate: currentSession.startDate instanceof Date ? currentSession.startDate : new Date(currentSession.startDate),
      sessionEndDate: endDate,
      daysRemaining
    };
  }

  /**
   * Get consumption summary for current session (sync version - for backward compatibility)
   * @deprecated Use getCurrentSessionConsumption() async version instead
   * @param userData - Données utilisateur
   * @returns Consumption summary
   */
  static getCurrentSessionConsumptionSync(userData: User): {
    formsCreated: number;
    dashboardsCreated: number;
    usersAdded: number;
    tokensConsumed: number;
    sessionStartDate: Date | null;
    sessionEndDate: Date | null;
    daysRemaining: number;
  } {
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(userData);
    
    if (!currentSession) {
      return {
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0,
        tokensConsumed: 0,
        sessionStartDate: null,
        sessionEndDate: null,
        daysRemaining: 0
      };
    }
    
    const usage = currentSession.usage || {
      formsCreated: 0,
      dashboardsCreated: 0,
      usersAdded: 0,
      tokensUsed: 0
    };
    
    const now = new Date();
    const endDate = currentSession.endDate instanceof Date ? currentSession.endDate : new Date(currentSession.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      formsCreated: usage.formsCreated,
      dashboardsCreated: usage.dashboardsCreated,
      usersAdded: usage.usersAdded,
      tokensConsumed: usage.tokensUsed,
      sessionStartDate: currentSession.startDate instanceof Date ? currentSession.startDate : new Date(currentSession.startDate),
      sessionEndDate: endDate,
      daysRemaining
    };
  }

  /**
   * Get consumption summary for all sessions (async version - uses new collection)
   * @param userData - Données utilisateur
   * @returns Promise with consumption summary
   */
  static async getAllSessionsConsumption(userData: User): Promise<{
    totalFormsCreated: number;
    totalDashboardsCreated: number;
    totalUsersAdded: number;
    totalTokensConsumed: number;
    totalAmountPaid: number;
    sessions: Array<{
      id: string;
      packageType: string;
      sessionType: string;
      startDate: Date;
      endDate: Date;
      consumption: any;
      amountPaid: number;
    }>;
  }> {
    // Try new collection service first
    const sessions = await SubscriptionSessionCollectionService.getUserSessions(userData.id);
    
    // If no sessions in collection, fallback to legacy
    const sessionsToUse = sessions.length > 0 ? sessions : (userData.subscriptionSessions || []);
    
    const summary = sessionsToUse.reduce((acc, session) => {
      const usage = session.usage || {
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0,
        tokensUsed: 0
      };
      
      const startDate = session.startDate instanceof Date ? session.startDate : new Date(session.startDate);
      const endDate = session.endDate instanceof Date ? session.endDate : new Date(session.endDate);
      
      return {
        totalFormsCreated: acc.totalFormsCreated + (usage.formsCreated || 0),
        totalDashboardsCreated: acc.totalDashboardsCreated + (usage.dashboardsCreated || 0),
        totalUsersAdded: acc.totalUsersAdded + (usage.usersAdded || 0),
        totalTokensConsumed: acc.totalTokensConsumed + (usage.tokensUsed || 0),
        totalAmountPaid: acc.totalAmountPaid + (session.amountPaid || 0),
        sessions: [
          ...acc.sessions,
          {
            id: session.id,
            packageType: session.packageType,
            sessionType: session.sessionType,
            startDate: startDate,
            endDate: endDate,
            consumption: {
              formsCreated: usage.formsCreated || 0,
              dashboardsCreated: usage.dashboardsCreated || 0,
              usersAdded: usage.usersAdded || 0,
              tokensConsumed: usage.tokensUsed || 0
            },
            amountPaid: session.amountPaid || 0
          }
        ]
      };
    }, {
      totalFormsCreated: 0,
      totalDashboardsCreated: 0,
      totalUsersAdded: 0,
      totalTokensConsumed: 0,
      totalAmountPaid: 0,
      sessions: [] as any[]
    });
    
    // Sort sessions from most recent to least recent
    summary.sessions.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    
    return summary;
  }

  /**
   * Get consumption summary for all sessions (sync version - for backward compatibility)
   * @deprecated Use getAllSessionsConsumption() async version instead
   * @param userData - Données utilisateur
   * @returns Consumption summary
   */
  static getAllSessionsConsumptionSync(userData: User): {
    totalFormsCreated: number;
    totalDashboardsCreated: number;
    totalUsersAdded: number;
    totalTokensConsumed: number;
    totalAmountPaid: number;
    sessions: Array<{
      id: string;
      packageType: string;
      sessionType: string;
      startDate: Date;
      endDate: Date;
      consumption: any;
      amountPaid: number;
    }>;
  } {
    const sessions = userData.subscriptionSessions || [];
    
    const summary = sessions.reduce((acc, session) => {
      const usage = session.usage || {
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0,
        tokensUsed: 0
      };
      
      return {
        totalFormsCreated: acc.totalFormsCreated + usage.formsCreated,
        totalDashboardsCreated: acc.totalDashboardsCreated + usage.dashboardsCreated,
        totalUsersAdded: acc.totalUsersAdded + usage.usersAdded,
        totalTokensConsumed: acc.totalTokensConsumed + usage.tokensUsed,
        totalAmountPaid: acc.totalAmountPaid + session.amountPaid,
        sessions: [
          ...acc.sessions,
          {
            id: session.id,
            packageType: session.packageType,
            sessionType: session.sessionType,
            startDate: session.startDate instanceof Date ? session.startDate : new Date(session.startDate),
            endDate: session.endDate instanceof Date ? session.endDate : new Date(session.endDate),
            consumption: {
              formsCreated: usage.formsCreated,
              dashboardsCreated: usage.dashboardsCreated,
              usersAdded: usage.usersAdded,
              tokensConsumed: usage.tokensUsed
            },
            amountPaid: session.amountPaid
          }
        ]
      };
    }, {
      totalFormsCreated: 0,
      totalDashboardsCreated: 0,
      totalUsersAdded: 0,
      totalTokensConsumed: 0,
      totalAmountPaid: 0,
      sessions: [] as any[]
    });
    
    // Sort sessions from most recent to least recent
    summary.sessions.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    
    return summary;
  }

  /**
   * Track text extraction in current session
   */
  static async trackTextExtraction(userId: string, extractionType: 'pdf' | 'image', tokensConsumed: number): Promise<boolean> {
    try {
      // Get active session from new collection
      const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      const currentUsage = currentSession.usage || {
        tokensUsed: 0,
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0
      };
      
      // Initialize textExtractions if it doesn't exist
      const textExtractions = (currentUsage as any).textExtractions || {
        pdf: 0,
        image: 0,
        tokensUsed: 0
      };
      
      // Update session usage in collection
      return await SubscriptionSessionCollectionService.updateSession(currentSession.id, {
        usage: {
          ...currentUsage,
          tokensUsed: currentUsage.tokensUsed + tokensConsumed,
          textExtractions: {
            ...textExtractions,
            [extractionType]: textExtractions[extractionType] + 1,
            tokensUsed: textExtractions.tokensUsed + tokensConsumed
          },
          lastTokenUsed: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error tracking text extraction:', error);
      return false;
    }
  }
}
