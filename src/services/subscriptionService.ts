import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export class SubscriptionService {
  /**
   * Renew user subscription
   * @param userId - ID de l'utilisateur
   * @param packageType - Type de package (starter, standard, premium, custom)
   * @param durationMonths - Durée en mois (défaut: 1)
   * @returns Promise<boolean> - true si le renouvellement a réussi
   */
  static async renewSubscription(
    userId: string, 
    packageType: 'starter' | 'standard' | 'premium' | 'custom',
    durationMonths: number = 1
  ): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data();
      const now = new Date();
      
      // Calculate new subscription end date
      const currentSubscriptionEnd = userData.subscriptionEndDate ? userData.subscriptionEndDate.toDate() : now;
      const subscriptionStartDate = Math.max(now.getTime(), currentSubscriptionEnd.getTime());
      const subscriptionEndDate = new Date(subscriptionStartDate + (durationMonths * 30 * 24 * 60 * 60 * 1000));
      
      // Reset monthly tokens when renewing
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      // Update user document
      await updateDoc(userDocRef, {
        package: packageType,
        subscriptionStartDate: now,
        subscriptionEndDate: subscriptionEndDate,
        subscriptionStatus: 'active',
        tokensUsedMonthly: 0, // Reset monthly tokens
        tokensResetDate: nextMonth,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Subscription renewed for user ${userId}: ${packageType} until ${subscriptionEndDate.toISOString()}`);
      return true;
      
    } catch (error) {
      console.error('Erreur lors du renouvellement de l\'abonnement:', error);
      return false;
    }
  }

  /**
   * Check if user's subscription is active
   * @param userData - Données utilisateur
   * @returns boolean - true si l'abonnement est actif
   */
  static isSubscriptionActive(userData: any): boolean {
    if (!userData.subscriptionEndDate) return false;
    
    const now = new Date();
    const subscriptionEnd = userData.subscriptionEndDate.toDate ? userData.subscriptionEndDate.toDate() : new Date(userData.subscriptionEndDate);
    
    return now <= subscriptionEnd;
  }

  /**
   * Get days until subscription expires
   * @param userData - Données utilisateur
   * @returns number - Nombre de jours restants (-1 si pas d'abonnement)
   */
  static getDaysUntilExpiration(userData: any): number {
    if (!userData.subscriptionEndDate) return -1;
    
    const now = new Date();
    const subscriptionEnd = userData.subscriptionEndDate.toDate ? userData.subscriptionEndDate.toDate() : new Date(userData.subscriptionEndDate);
    
    const diffTime = subscriptionEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Get subscription status
   * @param userData - Données utilisateur
   * @returns object - Statut de l'abonnement
   */
  static getSubscriptionStatus(userData: any) {
    const isActive = this.isSubscriptionActive(userData);
    const daysLeft = this.getDaysUntilExpiration(userData);
    
    return {
      isActive,
      daysLeft,
      status: isActive ? 'active' : 'expired',
      subscriptionEndDate: userData.subscriptionEndDate,
      package: userData.package
    };
  }
}
