import { User } from '../types';
import { UserSessionService } from './userSessionService';
import { SessionConsumptionService } from './sessionConsumptionService';

export class TokenService {
  /**
   * Soustrait des tokens de l'utilisateur
   * @param userId - ID de l'utilisateur
   * @param tokensToSubtract - Nombre de tokens à soustraire
   * @returns Promise<boolean> - true si la soustraction a réussi, false sinon
   */
  static async subtractTokens(userId: string, tokensToSubtract: number): Promise<boolean> {
    if (!userId || tokensToSubtract <= 0) {
      return false;
    }
    try {
      const tracked = await SessionConsumptionService.trackTokenConsumption(userId, tokensToSubtract);
      if (!tracked) {
        console.warn('⚠️ Impossible de suivre la consommation des tokens pour la session active', { userId });
      }
      return tracked;
    } catch (error) {
      console.error('Erreur lors de la soustraction des tokens:', error);
      return false;
    }
  }
  
  /**
   * Vérifie si l'utilisateur peut utiliser des tokens
   * @param user - Objet utilisateur
   * @param tokensNeeded - Nombre de tokens nécessaires
   * @param monthlyLimit - Limite mensuelle de tokens
   * @returns boolean - true si l'utilisateur peut utiliser les tokens
   */
  static async canUseTokens(user: User, tokensNeeded: number, monthlyLimit: number): Promise<boolean> {
    if (monthlyLimit === -1) {
      return true;
    }
    
    const sessionInfo = UserSessionService.getUserPackageInfo(user);
    const currentTokensUsed = sessionInfo.tokensUsed || 0;
    const limit = monthlyLimit || sessionInfo.totalTokens || 0;
    if (limit === -1) {
      return true;
    }
    return (currentTokensUsed + tokensNeeded) <= limit;
  }
  
  /**
   * Obtient le nombre de tokens restants pour l'utilisateur
   * @param user - Objet utilisateur
   * @param monthlyLimit - Limite mensuelle de tokens
   * @returns number - Nombre de tokens restants (-1 si illimité)
   */
  static async getRemainingTokens(user: User, monthlyLimit: number): Promise<number> {
    if (monthlyLimit === -1) {
      return -1;
    }
    
    const sessionInfo = UserSessionService.getUserPackageInfo(user);
    const limit = monthlyLimit || sessionInfo.totalTokens || 0;
    if (limit === -1) {
      return -1;
    }
    const currentTokensUsed = sessionInfo.tokensUsed || 0;
    return Math.max(0, limit - currentTokensUsed);
  }
  
  /**
   * Obtient le pourcentage d'utilisation des tokens
   * @param user - Objet utilisateur
   * @param monthlyLimit - Limite mensuelle de tokens
   * @returns number - Pourcentage d'utilisation (0-100)
   */
  static getTokenUsagePercentage(user: User, monthlyLimit: number): number {
    if (monthlyLimit === -1) {
      return 0; // Illimité = 0% d'utilisation
    }
    
    // Use UserSessionService to get current session data
    const sessionInfo = UserSessionService.getUserPackageInfo(user);
    const currentTokensUsed = sessionInfo.tokensUsed;
    const totalAvailableTokens = sessionInfo.totalTokens;
    
    return Math.min(100, (currentTokensUsed / totalAvailableTokens) * 100);
  }

  /**
   * Ajoute des tokens pay-as-you-go à l'utilisateur
   * @param userId - ID de l'utilisateur
   * @param tokensToAdd - Nombre de tokens à ajouter
   * @returns Promise<boolean> - true si l'ajout a réussi
   */
  static async addPayAsYouGoTokens(userId: string, tokensToAdd: number): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentPayAsYouGoTokens = userData.payAsYouGoTokens || 0;
      const newPayAsYouGoTokens = currentPayAsYouGoTokens + tokensToAdd;
      
      // Mettre à jour le document utilisateur
      await updateDoc(userDocRef, {
        payAsYouGoTokens: newPayAsYouGoTokens,
        updatedAt: serverTimestamp()
      });
      
      return true;
      
    } catch (error) {
      console.error('Erreur lors de l\'ajout des tokens pay-as-you-go:', error);
      return false;
    }
  }

  /**
   * Obtient le nombre total de tokens disponibles (package + pay-as-you-go)
   * @param user - Objet utilisateur
   * @param monthlyLimit - Limite mensuelle de tokens du package
   * @returns number - Nombre total de tokens disponibles
   */
  static getTotalAvailableTokens(user: User, monthlyLimit: number): number {
    if (monthlyLimit === -1) {
      return -1; // Illimité
    }
    
    // Use UserSessionService to get current session data
    const sessionInfo = await UserSessionService.getUserPackageInfo(user);
    return sessionInfo.totalTokens;
  }

  /**
   * Vérifie si l'utilisateur peut utiliser des tokens (incluant pay-as-you-go)
   * @param user - Objet utilisateur
   * @param tokensNeeded - Nombre de tokens nécessaires
   * @param monthlyLimit - Limite mensuelle de tokens
   * @returns boolean - true si l'utilisateur peut utiliser les tokens
   */
  static canUseTokensWithPayAsYouGo(user: User, tokensNeeded: number, monthlyLimit: number): boolean {
    // Si la limite est illimitée (-1), toujours autoriser
    if (monthlyLimit === -1) {
      return true;
    }
    
    // Use UserSessionService to get current session data
    const sessionInfo = await UserSessionService.getUserPackageInfo(user);
    const currentTokensUsed = sessionInfo.tokensUsed;
    const totalAvailableTokens = sessionInfo.totalTokens;
    
    return (currentTokensUsed + tokensNeeded) <= totalAvailableTokens;
  }

  /**
   * Obtient le nombre de tokens restants (incluant pay-as-you-go)
   * @param user - Objet utilisateur
   * @param monthlyLimit - Limite mensuelle de tokens
   * @returns number - Nombre de tokens restants (-1 si illimité)
   */
  static getRemainingTokensWithPayAsYouGo(user: User, monthlyLimit: number): number {
    // Si la limite est illimitée (-1), retourner -1
    if (monthlyLimit === -1) {
      return -1;
    }
    
    // Use UserSessionService to get current session data
    const sessionInfo = UserSessionService.getUserPackageInfo(user);
    return sessionInfo.tokensRemaining;
  }
}
