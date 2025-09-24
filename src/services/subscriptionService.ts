import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { getPackagePrice } from '../config/packageFeatures';

export class SubscriptionService {
  /**
   * Renew user subscription using the new session system
   * @param userId - ID de l'utilisateur
   * @param packageType - Type de package (starter, standard, premium, custom)
   * @param durationMonths - Durée en mois (défaut: 1)
   * @param paymentMethod - Méthode de paiement
   * @returns Promise<boolean> - true si le renouvellement a réussi
   */
  static async renewSubscription(
    userId: string, 
    packageType: 'starter' | 'standard' | 'premium' | 'custom',
    durationMonths: number = 1,
    paymentMethod?: string
  ): Promise<boolean> {
    try {
      // Calculate amount based on package price
      const packagePriceStr = getPackagePrice(packageType);
      const monthlyPrice = parseInt(packagePriceStr.replace(/[^\d]/g, '')) || 0;
      const totalAmount = monthlyPrice * durationMonths;
      
      // Create new subscription session
      const success = await SubscriptionSessionService.createSubscriptionSession(
        userId,
        packageType,
        durationMonths,
        totalAmount,
        paymentMethod
      );
      
      if (success) {
        console.log(`✅ Subscription renewed for user ${userId}: ${packageType} for ${durationMonths} months`);
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
    return SubscriptionSessionService.isSubscriptionActive(userData);
  }

  /**
   * Get days until subscription expires (using new session system)
   * @param userData - Données utilisateur
   * @returns number - Nombre de jours restants (-1 si pas d'abonnement)
   */
  static getDaysUntilExpiration(userData: any): number {
    return SubscriptionSessionService.getDaysUntilExpiration(userData);
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
    return SubscriptionSessionService.getSubscriptionHistorySummary(userData);
  }
}
