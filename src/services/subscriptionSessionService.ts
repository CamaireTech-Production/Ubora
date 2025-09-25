import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession, User } from '../types';
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
      
      // Create new session with consumption tracking
      const newSession: SubscriptionSession = {
        ...sessionData,
        id: sessionId,
        createdAt: now,
        updatedAt: now,
        consumption: {
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0,
          tokensConsumed: 0
        }
      };
      
      // Deactivate current session if exists
      const currentSessions = userData.subscriptionSessions || [];
      const updatedSessions = currentSessions.map(session => ({
        ...session,
        isActive: false,
        updatedAt: now
      }));
      
      // Add new session
      updatedSessions.push(newSession);
      
      // Update user document
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        currentSessionId: sessionId,
        package: sessionData.packageType,
        subscriptionStartDate: sessionData.startDate,
        subscriptionEndDate: sessionData.endDate,
        subscriptionStatus: 'active',
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
   * Get all sessions for a user
   * @param userData - Données utilisateur
   * @returns SubscriptionSession[]
   */
  static getAllSessions(userData: User): SubscriptionSession[] {
    return userData.subscriptionSessions || [];
  }
  
  /**
   * Get sessions by type
   * @param userData - Données utilisateur
   * @param sessionType - Type de session
   * @returns SubscriptionSession[]
   */
  static getSessionsByType(userData: User, sessionType: SubscriptionSession['sessionType']): SubscriptionSession[] {
    return (userData.subscriptionSessions || []).filter(session => session.sessionType === sessionType);
  }
  
  /**
   * Check if user has active subscription
   * @param userData - Données utilisateur
   * @returns boolean
   */
  static isSubscriptionActive(userData: User): boolean {
    const currentSession = this.getCurrentSession(userData);
    if (!currentSession) return false;
    
    const now = new Date();
    const endDate = this.convertToDate(currentSession.endDate);
    
    return now <= endDate;
  }
  
  /**
   * Get days until subscription expires
   * @param userData - Données utilisateur
   * @returns number - Nombre de jours restants (-1 si pas d'abonnement)
   */
  static getDaysUntilExpiration(userData: User): number {
    const currentSession = this.getCurrentSession(userData);
    if (!currentSession) return -1;
    
    const now = new Date();
    const endDate = this.convertToDate(currentSession.endDate);
    
    const timeDiff = endDate.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Get total tokens available for current session
   * @param userData - Données utilisateur
   * @returns number
   */
  static getAvailableTokens(userData: User): number {
    const currentSession = this.getCurrentSession(userData);
    if (!currentSession) return 0;
    
    return currentSession.tokensIncluded - currentSession.tokensUsed;
  }
  
  /**
   * Consume tokens for current session
   * @param userId - ID de l'utilisateur
   * @param tokensToConsume - Nombre de tokens à consommer
   * @returns Promise<boolean> - true si la consommation a réussi
   */
  static async consumeTokens(userId: string, tokensToConsume: number): Promise<boolean> {
    
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
        console.error('Aucune session active trouvée');
        return false;
      }
      
      if (currentSession.tokensUsed + tokensToConsume > currentSession.tokensIncluded) {
        console.error('Pas assez de tokens disponibles');
        return false;
      }
      
      // Update session tokens used
      const updatedSessions = userData.subscriptionSessions!.map(session => {
        if (session.id === currentSession.id) {
          const newTokensUsed = session.tokensUsed + tokensToConsume;
          
          return {
            ...session,
            tokensUsed: newTokensUsed,
            updatedAt: new Date()
          };
        }
        return session;
      });
      
      await updateDoc(userDocRef, {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ ${tokensToConsume} tokens consumed for user ${userId}`);
      return true;
      
    } catch (error) {
      console.error('Erreur lors de la consommation de tokens:', error);
      return false;
    }
  }
  
  /**
   * Create a subscription session (monthly package)
   * @param userId - ID de l'utilisateur
   * @param packageType - Type de package
   * @param durationMonths - Durée en mois
   * @param amountPaid - Montant payé en FCFA
   * @param paymentMethod - Méthode de paiement
   * @returns Promise<boolean>
   */
  static async createSubscriptionSession(
    userId: string,
    packageType: 'starter' | 'standard' | 'premium' | 'custom',
    durationMonths: number = 1,
    amountPaid: number,
    paymentMethod?: string
  ): Promise<boolean> {
    const now = new Date();
    const endDate = new Date(now.getTime() + (durationMonths * 30 * 24 * 60 * 60 * 1000));
    const tokensIncluded = PACKAGE_LIMITS[packageType].monthlyTokens * durationMonths;
    
    return this.createSession(userId, {
      packageType,
      sessionType: 'subscription',
      startDate: now,
      endDate,
      amountPaid,
      durationDays: durationMonths * 30,
      tokensIncluded,
      tokensUsed: 0,
      isActive: true,
      paymentMethod,
      notes: `Abonnement ${packageType} pour ${durationMonths} mois`
    });
  }
  
  /**
   * Create a pay-as-you-go session (token purchase)
   * @param userId - ID de l'utilisateur
   * @param tokensPurchased - Nombre de tokens achetés
   * @param amountPaid - Montant payé en FCFA
   * @param paymentMethod - Méthode de paiement
   * @returns Promise<boolean>
   */
  static async createPayAsYouGoSession(
    userId: string,
    tokensPurchased: number,
    amountPaid: number,
    paymentMethod?: string
  ): Promise<boolean> {
    const now = new Date();
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days extension
    
    return this.createSession(userId, {
      packageType: 'starter', // Pay-as-you-go uses starter package features
      sessionType: 'pay_as_you_go',
      startDate: now,
      endDate,
      amountPaid,
      durationDays: 30,
      tokensIncluded: tokensPurchased,
      tokensUsed: 0,
      isActive: true,
      paymentMethod,
      notes: `Achat de ${tokensPurchased} tokens pay-as-you-go`
    });
  }
  
  /**
   * Create an upgrade/downgrade session (DEPRECATED - Use PackageTransitionService)
   * @param userId - ID de l'utilisateur
   * @param newPackageType - Nouveau type de package
   * @param amountPaid - Montant payé en FCFA (peut être négatif pour downgrade)
   * @param paymentMethod - Méthode de paiement
   * @returns Promise<boolean>
   * @deprecated Use PackageTransitionService.executeTransition() instead
   */
  static async createUpgradeDowngradeSession(
    userId: string,
    newPackageType: 'starter' | 'standard' | 'premium' | 'custom',
    amountPaid: number,
    paymentMethod?: string
  ): Promise<boolean> {
    console.warn('⚠️ createUpgradeDowngradeSession is deprecated. Use PackageTransitionService.executeTransition() instead.');
    
    const now = new Date();
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    const tokensIncluded = PACKAGE_LIMITS[newPackageType].monthlyTokens;
    
    return this.createSession(userId, {
      packageType: newPackageType,
      sessionType: amountPaid >= 0 ? 'upgrade' : 'downgrade',
      startDate: now,
      endDate,
      amountPaid: Math.abs(amountPaid),
      durationDays: 30,
      tokensIncluded,
      tokensUsed: 0,
      isActive: true,
      paymentMethod,
      notes: `${amountPaid >= 0 ? 'Upgrade' : 'Downgrade'} vers ${newPackageType} (méthode dépréciée)`
    });
  }
  
  /**
   * Get subscription history summary
   * @param userData - Données utilisateur
   * @returns Object with summary statistics
   */
  static getSubscriptionHistorySummary(userData: User) {
    const sessions = this.getAllSessions(userData);
    
    const totalSessions = sessions.length;
    const totalAmountPaid = sessions.reduce((sum, session) => sum + session.amountPaid, 0);
    const totalTokensPurchased = sessions.reduce((sum, session) => sum + session.tokensIncluded, 0);
    const totalTokensUsed = sessions.reduce((sum, session) => sum + session.tokensUsed, 0);
    
    const sessionsByType = sessions.reduce((acc, session) => {
      acc[session.sessionType] = (acc[session.sessionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const sessionsByPackage = sessions.reduce((acc, session) => {
      acc[session.packageType] = (acc[session.packageType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalSessions,
      totalAmountPaid,
      totalTokensPurchased,
      totalTokensUsed,
      sessionsByType,
      sessionsByPackage,
      currentSession: this.getCurrentSession(userData)
    };
  }
}
