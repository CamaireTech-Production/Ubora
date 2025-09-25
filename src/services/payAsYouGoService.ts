import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSessionService } from './subscriptionSessionService';

export interface TokenPackage {
  tokens: number;
  price: number; // in FCFA
  popular: boolean;
  description: string;
}

export class PayAsYouGoService {
  /**
   * Purchase tokens for a user using the new session system
   * @param userId - ID de l'utilisateur
   * @param tokenPackage - Package de tokens à acheter
   * @param paymentMethod - Méthode de paiement
   * @returns Promise<boolean> - true si l'achat a réussi
   */
  static async purchaseTokens(userId: string, tokenPackage: TokenPackage, paymentMethod?: string): Promise<boolean> {
    try {
      // Create a new pay-as-you-go session
      const success = await SubscriptionSessionService.createPayAsYouGoSession(
        userId,
        tokenPackage.tokens,
        tokenPackage.price,
        paymentMethod
      );
      
      if (success) {
        console.log(`✅ Purchase successful: ${tokenPackage.tokens} tokens for ${tokenPackage.price} FCFA`);
      }
      
      return success;
      
    } catch (error) {
      console.error('Erreur lors de l\'achat de tokens:', error);
      return false;
    }
  }

  /**
   * Get available token packages
   */
  static getTokenPackages(): TokenPackage[] {
    return [
      {
        tokens: 80000, // 80k tokens (80 actual OpenAI tokens = ~2-3 requests)
        price: 2500, // 2500 FCFA
        popular: true,
        description: 'Pour conversations et analyses supplémentaires'
      },
      {
        tokens: 120000, // 120k tokens (120 actual OpenAI tokens = ~4 requests)
        price: 5000, // 5000 FCFA
        popular: false,
        description: 'Idéal pour un usage intensif'
      },
      {
        tokens: 240000, // 240k tokens (240 actual OpenAI tokens = ~8 requests)
        price: 8500, // 8500 FCFA
        popular: false,
        description: 'Pour une équipe active'
      }
    ];
  }

  /**
   * Calculate price per token for a package
   */
  static getPricePerToken(tokenPackage: TokenPackage): number {
    return tokenPackage.price / tokenPackage.tokens;
  }

  /**
   * Get the best value package (lowest price per token)
   */
  static getBestValuePackage(): TokenPackage {
    const packages = this.getTokenPackages();
    return packages.reduce((best, current) => {
      const bestPricePerToken = this.getPricePerToken(best);
      const currentPricePerToken = this.getPricePerToken(current);
      return currentPricePerToken < bestPricePerToken ? current : best;
    });
  }

  /**
   * Get recommended package based on user's current usage
   */
  static getRecommendedPackage(currentTokensUsed: number, monthlyLimit: number): TokenPackage {
    const packages = this.getTokenPackages();
    
    // If user has used more than 80% of their monthly limit, recommend a larger package
    if (currentTokensUsed / monthlyLimit > 0.8) {
      return packages.find(pkg => pkg.tokens >= 120000) || packages[1];
    }
    
    // If user has used more than 50% of their monthly limit, recommend a medium package
    if (currentTokensUsed / monthlyLimit > 0.5) {
      return packages.find(pkg => pkg.tokens >= 80000) || packages[0];
    }
    
    // Otherwise, recommend the smallest package
    return packages[0];
  }
}