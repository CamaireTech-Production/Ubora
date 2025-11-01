import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { auth } from '../firebaseConfig';

export interface TokenCheckResult {
  canExecute: boolean;
  reason?: string;
  estimatedTokens: number;
  availableTokens: number;
  requiredTokens: number;
  packageLimit: number;
  payAsYouGoTokens: number;
  currentTokensUsed: number;
}

/**
 * Service to check if a user has enough tokens before executing a scheduled question
 */
export class ScheduledQuestionTokenChecker {
  
  /**
   * Check if user has enough tokens for a scheduled question execution
   */
  static async checkTokensForExecution(
    userId: string, 
    estimatedTokens: number = 1000
  ): Promise<TokenCheckResult> {
    try {
      console.log(`🔍 [ScheduledQuestionTokenChecker] Vérification des tokens pour l'utilisateur: ${userId}`);
      console.log(`📊 [ScheduledQuestionTokenChecker] Tokens estimés nécessaires: ${estimatedTokens}`);

      // Get user document
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        return {
          canExecute: false,
          reason: 'Utilisateur non trouvé',
          estimatedTokens,
          availableTokens: 0,
          requiredTokens: estimatedTokens,
          packageLimit: 0,
          payAsYouGoTokens: 0,
          currentTokensUsed: 0
        };
      }

      const userData = userDoc.data();
      
      // Get package limits
      const packageLimit = this.getPackageLimit(userData.package);
      const currentTokensUsed = userData.tokensUsedMonthly || 0;
      const payAsYouGoTokens = userData.payAsYouGoTokens || 0;
      
      // Check subscription status
      const subscriptionExpired = this.isSubscriptionExpired(userData);
      if (subscriptionExpired) {
        return {
          canExecute: false,
          reason: 'Abonnement expiré',
          estimatedTokens,
          availableTokens: 0,
          requiredTokens: estimatedTokens,
          packageLimit,
          payAsYouGoTokens,
          currentTokensUsed
        };
      }

      // Calculate available tokens
      const totalAvailableTokens = packageLimit === -1 ? -1 : packageLimit + payAsYouGoTokens;
      const availableTokens = totalAvailableTokens === -1 ? -1 : totalAvailableTokens - currentTokensUsed;
      
      // Check if user has enough tokens
      const canExecute = packageLimit === -1 || (availableTokens >= estimatedTokens);
      
      console.log(`📊 [ScheduledQuestionTokenChecker] Résultat de la vérification:`, {
        canExecute,
        estimatedTokens,
        availableTokens,
        packageLimit,
        payAsYouGoTokens,
        currentTokensUsed,
        reason: canExecute ? 'Tokens suffisants' : 'Tokens insuffisants'
      });

      return {
        canExecute,
        reason: canExecute ? undefined : 'Tokens insuffisants',
        estimatedTokens,
        availableTokens,
        requiredTokens: estimatedTokens,
        packageLimit,
        payAsYouGoTokens,
        currentTokensUsed
      };

    } catch (error) {
      console.error('❌ [ScheduledQuestionTokenChecker] Erreur lors de la vérification des tokens:', error);
      return {
        canExecute: false,
        reason: 'Erreur lors de la vérification des tokens',
        estimatedTokens,
        availableTokens: 0,
        requiredTokens: estimatedTokens,
        packageLimit: 0,
        payAsYouGoTokens: 0,
        currentTokensUsed: 0
      };
    }
  }

  /**
   * Get package limit based on package type
   */
  private static getPackageLimit(packageType: string): number {
    const limits = {
      starter: 300000,
      standard: 600000,
      premium: 1500000,
      unlimited: -1
    };
    return limits[packageType] || 300000;
  }

  /**
   * Check if subscription has expired
   */
  private static isSubscriptionExpired(userData: any): boolean {
    if (!userData.subscriptionEndDate) {
      return false;
    }
    
    const now = new Date();
    const subscriptionEndDate = new Date(userData.subscriptionEndDate);
    return now > subscriptionEndDate;
  }

  /**
   * Estimate tokens needed for a scheduled question
   */
  static estimateTokensForQuestion(question: string, hasData: boolean = true): number {
    // Base estimation for question processing
    let baseTokens = 500;
    
    // Add tokens for data processing if data is available
    if (hasData) {
      baseTokens += 800; // Additional tokens for data analysis
    }
    
    // Add tokens based on question length
    const questionLength = question.length;
    if (questionLength > 100) {
      baseTokens += Math.ceil(questionLength / 10); // 1 token per 10 characters
    }
    
    // Add buffer for response generation
    baseTokens += 300;
    
    return baseTokens;
  }

  /**
   * Check tokens for multiple questions (batch processing)
   */
  static async checkTokensForBatchExecution(
    userId: string,
    questions: Array<{ question: string; hasData: boolean }>
  ): Promise<{ canExecute: boolean; totalTokens: number; reason?: string }> {
    try {
      const totalTokens = questions.reduce((sum, q) => {
        return sum + this.estimateTokensForQuestion(q.question, q.hasData);
      }, 0);

      const result = await this.checkTokensForExecution(userId, totalTokens);
      
      return {
        canExecute: result.canExecute,
        totalTokens,
        reason: result.reason
      };
    } catch (error) {
      console.error('❌ [ScheduledQuestionTokenChecker] Erreur lors de la vérification batch:', error);
      return {
        canExecute: false,
        totalTokens: 0,
        reason: 'Erreur lors de la vérification batch'
      };
    }
  }
}
