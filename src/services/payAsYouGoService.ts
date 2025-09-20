import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface TokenPackage {
  tokens: number;
  price: number; // in FCFA
  popular: boolean;
  description: string;
}

export class PayAsYouGoService {
  /**
   * Purchase tokens for a user
   * @param userId - ID de l'utilisateur
   * @param tokenPackage - Package de tokens à acheter
   * @returns Promise<boolean> - true si l'achat a réussi
   */
  static async purchaseTokens(userId: string, tokenPackage: TokenPackage): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }
      
      const userData = userDoc.data();
      const currentPayAsYouGoTokens = userData.payAsYouGoTokens || 0;
      const newPayAsYouGoTokens = currentPayAsYouGoTokens + tokenPackage.tokens;
      
      // Calculate subscription extension based on token package
      // Each token package extends subscription by 30 days
      const now = new Date();
      const currentSubscriptionEnd = userData.subscriptionEndDate ? userData.subscriptionEndDate.toDate() : now;
      const subscriptionExtensionDays = 30; // Extend by 30 days
      const newSubscriptionEnd = new Date(Math.max(now.getTime(), currentSubscriptionEnd.getTime()) + (subscriptionExtensionDays * 24 * 60 * 60 * 1000));
      
      // Mettre à jour le document utilisateur
      await updateDoc(userDocRef, {
        payAsYouGoTokens: newPayAsYouGoTokens,
        subscriptionEndDate: newSubscriptionEnd,
        subscriptionStatus: 'active',
        updatedAt: serverTimestamp()
      });
      
      // Log the purchase (you might want to store this in a separate collection for analytics)
      console.log(`Purchase successful: ${tokenPackage.tokens} tokens for ${tokenPackage.price} FCFA`);
      console.log(`Subscription extended until: ${newSubscriptionEnd.toISOString()}`);
      
      return true;
      
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
        tokens: 5000,
        price: 5000, // 5000 FCFA
        popular: false,
        description: 'Pour quelques questions supplémentaires'
      },
      {
        tokens: 15000,
        price: 12000, // 12000 FCFA (20% discount)
        popular: true,
        description: 'Idéal pour un usage intensif'
      },
      {
        tokens: 30000,
        price: 20000, // 20000 FCFA (33% discount)
        popular: false,
        description: 'Pour une utilisation professionnelle'
      },
      {
        tokens: 50000,
        price: 30000, // 30000 FCFA (40% discount)
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
    const remainingTokens = monthlyLimit - currentTokensUsed;
    
    // If user has used more than 80% of their monthly limit, recommend a larger package
    if (currentTokensUsed / monthlyLimit > 0.8) {
      return packages.find(pkg => pkg.tokens >= 15000) || packages[1];
    }
    
    // If user has used more than 50% of their monthly limit, recommend a medium package
    if (currentTokensUsed / monthlyLimit > 0.5) {
      return packages.find(pkg => pkg.tokens >= 10000) || packages[1];
    }
    
    // Otherwise, recommend the smallest package
    return packages[0];
  }
}