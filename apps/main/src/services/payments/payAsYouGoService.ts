// import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
// import { db } from '@ubora/shared/firebaseConfig'; // Unused for now
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
  static async purchaseTokens(userId: string, tokenPackage: TokenPackage, paymentMethod?: string, paymentReference?: string): Promise<boolean> {
    try {
      // Create a new pay-as-you-go session
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30); // 30 days validity
      
      const success = await SubscriptionSessionService.createSession(userId, {
        packageType: 'starter', // Pay-as-you-go uses starter as base
        sessionType: 'subscription',
        startDate: now,
        endDate: endDate,
        amountPaid: tokenPackage.price,
        durationDays: 30,
        packageResources: {
          tokensIncluded: 0, // No package tokens for pay-as-you-go
          formsIncluded: 0,
          dashboardsIncluded: 0,
          usersIncluded: 0
        },
        payAsYouGoResources: {
          tokens: tokenPackage.tokens,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: [{
            id: `paygo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            purchaseDate: now,
            itemType: 'tokens',
            quantity: tokenPackage.tokens,
            amountPaid: tokenPackage.price,
            paymentMethod,
            notes: `Pay-as-you-go: ${tokenPackage.tokens.toLocaleString()} tokens`
          }]
        },
        usage: {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        },
        isActive: true,
        paymentMethod,
        paymentReference,
        notes: `Pay-as-you-go: ${tokenPackage.tokens.toLocaleString()} tokens achetés`
      });
      
      if (success) {
        console.log(`✅ ${tokenPackage.tokens.toLocaleString()} tokens achetés avec succès pour ${tokenPackage.price.toLocaleString()} FCFA`);
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
        tokens: 35000, // 35k tokens for 1,800 FCFA
        price: 1800, // 1800 FCFA
        popular: true,
        description: 'Pack de 35 000 tokens Archa'
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