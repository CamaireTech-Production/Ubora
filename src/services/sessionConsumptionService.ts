import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, SubscriptionSession } from '../types';
import { SubscriptionSessionService } from './subscriptionSessionService';

export class SessionConsumptionService {
  /**
   * Track form creation in current session
   */
  static async trackFormCreation(userId: string): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('User not found:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentSession = SubscriptionSessionService.getCurrentSession(userData);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      // Update the current session's consumption
      const updatedSessions = userData.subscriptionSessions?.map(session => {
        if (session.id === currentSession.id) {
          return {
            ...session,
            consumption: {
              formsCreated: (session.consumption?.formsCreated || 0) + 1,
              dashboardsCreated: session.consumption?.dashboardsCreated || 0,
              usersAdded: session.consumption?.usersAdded || 0,
              tokensConsumed: session.consumption?.tokensConsumed || 0,
              lastFormCreated: new Date(),
              lastDashboardCreated: session.consumption?.lastDashboardCreated,
              lastUserAdded: session.consumption?.lastUserAdded,
              lastTokenUsed: session.consumption?.lastTokenUsed,
              ...session.consumption
            },
            updatedAt: new Date()
          };
        }
        return session;
      }) || [];
      
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Form creation tracked for session ${currentSession.id}`);
      return true;
      
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
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('User not found:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentSession = SubscriptionSessionService.getCurrentSession(userData);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      // Update the current session's consumption
      const updatedSessions = userData.subscriptionSessions?.map(session => {
        if (session.id === currentSession.id) {
          return {
            ...session,
            consumption: {
              formsCreated: session.consumption?.formsCreated || 0,
              dashboardsCreated: (session.consumption?.dashboardsCreated || 0) + 1,
              usersAdded: session.consumption?.usersAdded || 0,
              tokensConsumed: session.consumption?.tokensConsumed || 0,
              lastFormCreated: session.consumption?.lastFormCreated,
              lastDashboardCreated: new Date(),
              lastUserAdded: session.consumption?.lastUserAdded,
              lastTokenUsed: session.consumption?.lastTokenUsed,
              ...session.consumption
            },
            updatedAt: new Date()
          };
        }
        return session;
      }) || [];
      
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Dashboard creation tracked for session ${currentSession.id}`);
      return true;
      
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
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('User not found:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentSession = SubscriptionSessionService.getCurrentSession(userData);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      // Update the current session's consumption
      const updatedSessions = userData.subscriptionSessions?.map(session => {
        if (session.id === currentSession.id) {
          return {
            ...session,
            consumption: {
              formsCreated: session.consumption?.formsCreated || 0,
              dashboardsCreated: session.consumption?.dashboardsCreated || 0,
              usersAdded: (session.consumption?.usersAdded || 0) + 1,
              tokensConsumed: session.consumption?.tokensConsumed || 0,
              lastFormCreated: session.consumption?.lastFormCreated,
              lastDashboardCreated: session.consumption?.lastDashboardCreated,
              lastUserAdded: new Date(),
              lastTokenUsed: session.consumption?.lastTokenUsed,
              ...session.consumption
            },
            updatedAt: new Date()
          };
        }
        return session;
      }) || [];
      
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ User addition tracked for session ${currentSession.id}`);
      return true;
      
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
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('User not found:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentSession = SubscriptionSessionService.getCurrentSession(userData);
      
      if (!currentSession) {
        console.error('No active session found for user:', userId);
        return false;
      }
      
      // Update the current session's consumption
      const updatedSessions = userData.subscriptionSessions?.map(session => {
        if (session.id === currentSession.id) {
          return {
            ...session,
            consumption: {
              formsCreated: session.consumption?.formsCreated || 0,
              dashboardsCreated: session.consumption?.dashboardsCreated || 0,
              usersAdded: session.consumption?.usersAdded || 0,
              tokensConsumed: (session.consumption?.tokensConsumed || 0) + tokensConsumed,
              lastFormCreated: session.consumption?.lastFormCreated,
              lastDashboardCreated: session.consumption?.lastDashboardCreated,
              lastUserAdded: session.consumption?.lastUserAdded,
              lastTokenUsed: new Date(),
              ...session.consumption
            },
            updatedAt: new Date()
          };
        }
        return session;
      }) || [];
      
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Token consumption tracked for session ${currentSession.id}: ${tokensConsumed} tokens`);
      return true;
      
    } catch (error) {
      console.error('Error tracking token consumption:', error);
      return false;
    }
  }

  /**
   * Get consumption summary for current session
   */
  static getCurrentSessionConsumption(userData: User): {
    formsCreated: number;
    dashboardsCreated: number;
    usersAdded: number;
    tokensConsumed: number;
    sessionStartDate: Date | null;
    sessionEndDate: Date | null;
    daysRemaining: number;
  } {
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    
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
    
    const consumption = currentSession.consumption || {
      formsCreated: 0,
      dashboardsCreated: 0,
      usersAdded: 0,
      tokensConsumed: 0
    };
    
    const now = new Date();
    const endDate = currentSession.endDate instanceof Date ? currentSession.endDate : new Date(currentSession.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      formsCreated: consumption.formsCreated,
      dashboardsCreated: consumption.dashboardsCreated,
      usersAdded: consumption.usersAdded,
      tokensConsumed: consumption.tokensConsumed,
      sessionStartDate: currentSession.startDate instanceof Date ? currentSession.startDate : new Date(currentSession.startDate),
      sessionEndDate: endDate,
      daysRemaining
    };
  }

  /**
   * Get consumption summary for all sessions
   */
  static getAllSessionsConsumption(userData: User): {
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
      const consumption = session.consumption || {
        formsCreated: 0,
        dashboardsCreated: 0,
        usersAdded: 0,
        tokensConsumed: 0
      };
      
      return {
        totalFormsCreated: acc.totalFormsCreated + consumption.formsCreated,
        totalDashboardsCreated: acc.totalDashboardsCreated + consumption.dashboardsCreated,
        totalUsersAdded: acc.totalUsersAdded + consumption.usersAdded,
        totalTokensConsumed: acc.totalTokensConsumed + consumption.tokensConsumed,
        totalAmountPaid: acc.totalAmountPaid + session.amountPaid,
        sessions: [
          ...acc.sessions,
          {
            id: session.id,
            packageType: session.packageType,
            sessionType: session.sessionType,
            startDate: session.startDate instanceof Date ? session.startDate : new Date(session.startDate),
            endDate: session.endDate instanceof Date ? session.endDate : new Date(session.endDate),
            consumption,
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
    
    return summary;
  }
}
