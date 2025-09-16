import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from '../types';

export class TokenService {
  /**
   * Soustrait des tokens de l'utilisateur
   * @param userId - ID de l'utilisateur
   * @param tokensToSubtract - Nombre de tokens à soustraire
   * @returns Promise<boolean> - true si la soustraction a réussi, false sinon
   */
  static async subtractTokens(userId: string, tokensToSubtract: number): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data() as User;
      const currentTokensUsed = userData.tokensUsedMonthly || 0;
      const newTokensUsed = currentTokensUsed + tokensToSubtract;
      
      // Mettre à jour le document utilisateur
      await updateDoc(userDocRef, {
        tokensUsedMonthly: newTokensUsed,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Tokens soustraits: ${tokensToSubtract}, Total utilisé: ${newTokensUsed}`);
      return true;
      
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
  static canUseTokens(user: User, tokensNeeded: number, monthlyLimit: number): boolean {
    // Si la limite est illimitée (-1), toujours autoriser
    if (monthlyLimit === -1) {
      return true;
    }
    
    const currentTokensUsed = user.tokensUsedMonthly || 0;
    return (currentTokensUsed + tokensNeeded) <= monthlyLimit;
  }
  
  /**
   * Obtient le nombre de tokens restants pour l'utilisateur
   * @param user - Objet utilisateur
   * @param monthlyLimit - Limite mensuelle de tokens
   * @returns number - Nombre de tokens restants (-1 si illimité)
   */
  static getRemainingTokens(user: User, monthlyLimit: number): number {
    // Si la limite est illimitée (-1), retourner -1
    if (monthlyLimit === -1) {
      return -1;
    }
    
    const currentTokensUsed = user.tokensUsedMonthly || 0;
    return Math.max(0, monthlyLimit - currentTokensUsed);
  }
  
  /**
   * Reset les tokens mensuels (à appeler au début de chaque mois)
   * @param userId - ID de l'utilisateur
   * @returns Promise<boolean> - true si le reset a réussi
   */
  static async resetMonthlyTokens(userId: string): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      await updateDoc(userDocRef, {
        tokensUsedMonthly: 0,
        tokensResetDate: nextMonth,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Tokens resetés pour l'utilisateur: ${userId}`);
      return true;
      
    } catch (error) {
      console.error('Erreur lors du reset des tokens:', error);
      return false;
    }
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
    
    const currentTokensUsed = user.tokensUsedMonthly || 0;
    return Math.min(100, (currentTokensUsed / monthlyLimit) * 100);
  }
}
