// import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
// import { db } from '../firebaseConfig'; // Unused for now
import { SubscriptionSessionService } from './subscriptionSessionService';
import { getPackagePrice } from '@ubora/shared/config/packageFeatures';

export class SubscriptionService {
  /**
   * Renew user subscription using the new session system
   * @param userId - ID de l'utilisateur
   * @param packageType - Type de package (starter, standard, premium)
   * @param durationMonths - Durée en mois (défaut: 1)
   * @param paymentMethod - Méthode de paiement
   * @returns Promise<boolean> - true si le renouvellement a réussi
   */
  static async renewSubscription(
    userId: string, 
    packageType: 'starter' | 'standard' | 'premium',
    durationMonths: number = 1,
    paymentMethod?: string
  ): Promise<boolean> {
    try {
      // Calculate amount based on package price
      const packagePriceStr = getPackagePrice(packageType);
      const monthlyPrice = parseInt(packagePriceStr.replace(/[^\d]/g, '')) || 0;
      const totalAmount = monthlyPrice * durationMonths;
      
      // Create new subscription session
      // Create new subscription session using the existing createSession method
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + durationMonths);
      
      const success = await SubscriptionSessionService.createSession(userId, {
        packageType,
        sessionType: 'renewal',
        startDate: now,
        endDate: endDate,
        amountPaid: totalAmount,
        durationDays: durationMonths * 30,
        packageResources: {
          tokensIncluded: 0, // Will be set based on package type
          formsIncluded: 0,
          dashboardsIncluded: 0,
          usersIncluded: 0
        },
        usage: {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        },
        isActive: true,
        paymentMethod,
        notes: `Renouvellement: ${packageType} pour ${durationMonths} mois`
      });
      
      if (success) {
        console.log(`✅ Abonnement renouvelé avec succès: ${packageType} pour ${durationMonths} mois`);
      }
      
      return success;
      
    } catch (error) {
      console.error('Erreur lors du renouvellement de l\'abonnement:', error);
      return false;
    }
  }

  /**
   * Check if user's subscription is active (using new session system)
   * @param userData - Données utilisateur
   * @returns boolean - true si l'abonnement est actif
   */
  static isSubscriptionActive(userData: any): boolean {
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    if (!currentSession) return false;
    
    const now = new Date();
    const endDate = new Date(currentSession.endDate);
    return currentSession.isActive && endDate > now;
  }

  /**
   * Get days until subscription expires (using new session system)
   * @param userData - Données utilisateur
   * @returns number - Nombre de jours restants (-1 si pas d'abonnement)
   */
  static getDaysUntilExpiration(userData: any): number {
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    if (!currentSession) return -1;
    
    const now = new Date();
    const endDate = new Date(currentSession.endDate);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Get subscription status (using new session system)
   * @param userData - Données utilisateur
   * @returns object - Statut de l'abonnement
   */
  static getSubscriptionStatus(userData: any) {
    const isActive = this.isSubscriptionActive(userData);
    const daysLeft = this.getDaysUntilExpiration(userData);
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    
    return {
      isActive,
      daysLeft,
      status: isActive ? 'active' : 'expired',
      subscriptionEndDate: currentSession?.endDate || userData.subscriptionEndDate,
      package: currentSession?.packageType || userData.package,
      currentSession
    };
  }

  /**
   * Get current subscription session
   * @param userData - Données utilisateur
   * @returns SubscriptionSession | null
   */
  static getCurrentSession(userData: any) {
    return SubscriptionSessionService.getCurrentSession(userData);
  }

  /**
   * Get subscription history summary
   * @param userData - Données utilisateur
   * @returns Object with summary statistics
   */
  static getSubscriptionHistorySummary(userData: any) {
    const allSessions = SubscriptionSessionService.getAllSessions(userData);
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    
    const totalSessions = allSessions.length;
    const activeSessions = allSessions.filter(session => session.isActive).length;
    const totalAmountPaid = allSessions.reduce((sum, session) => sum + session.amountPaid, 0);
    
    return {
      totalSessions,
      activeSessions,
      totalAmountPaid,
      currentSession,
      allSessions: allSessions.slice(0, 10) // Last 10 sessions
    };
  }
}
