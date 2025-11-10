import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession, User } from '../types';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { SubscriptionSessionCollectionService } from '@ubora/shared/services/subscriptionSessionCollectionService';
import { PACKAGE_LIMITS, getPackagePrice, PackageLimits } from '@ubora/shared/config/packageFeatures';
import { PaymentService } from './paymentService';

export interface PackageTransitionOptions {
  preserveUnusedPayAsYouGo?: boolean; // Whether to preserve unused pay-as-you-go tokens (default: true)
}

export interface UserNeeds {
  forms?: number;
  dashboards?: number;
  users?: number;
  tokens?: number;
}

export interface PayAsYouGoItem {
  feature: string;
  currentLimit: number;
  requestedAmount: number;
  costPerUnit: number;
  totalCost: number;
}

export interface FeatureUpgrade {
  feature: string;
  fromLimit: number | 'unlimited';
  toLimit: number | 'unlimited';
  isUnlimited: boolean;
}

export interface FeatureDowngrade {
  feature: string;
  fromLimit: number | 'unlimited';
  toLimit: number | 'unlimited';
  isUnlimited: boolean;
}

export interface TransitionCalculation {
  currentSession: SubscriptionSession;
  newPackageType: 'free' | 'starter' | 'standard';
  daysRemaining: number;
  unusedPackageTokens: number;
  unusedPayAsYouGoTokens: number;
  totalAmount: number;
  newPackageTokens: number;
  preservedPayAsYouGoTokens: number;
}

export interface EnhancedTransitionCalculation {
  currentSession: SubscriptionSession;
  newPackageType: 'free' | 'starter' | 'standard';
  daysRemaining: number;
  
  // Cost calculations
  currentPackageRemainingValue: number;
  newPackageFullCost: number;
  finalAmountToPay: number;
  
  // Token handling
  unusedPackageTokens: number;
  unusedPayAsYouGoTokens: number;
  newPackageTokens: number;
  preservedPayAsYouGoTokens: number;
  
  // Pay-as-you-go analysis
  payAsYouGoRequired: boolean;
  payAsYouGoItems: PayAsYouGoItem[];
  payAsYouGoTotalCost: number;
  
  // Feature analysis
  featureUpgrades: FeatureUpgrade[];
  featureDowngrades: FeatureDowngrade[];
  
  // Price breakdown for UI
  priceBreakdown: {
    currentPackagePrice: number;
    currentPackageRemainingValue: number;
    newPackagePrice: number;
    payAsYouGoCost: number;
    finalAmount: number;
    savings: number;
  };
}

export class PackageTransitionService {
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
   * Calculate package transition costs and token handling
   * Business Rules:
   * - Package tokens: Reset to new package limit (no transfer of unused package tokens)
   * - Pay-as-you-go tokens: Preserve only UNUSED pay-as-you-go tokens
   * - Unlimited usage: No charge, just reset to new package limit
   * - Session tracking: Always maintained
   * - No proration: User pays full price for new package
   */
  static async calculateTransition(
    userData: User,
    newPackageType: 'free' | 'starter' | 'standard',
    options: PackageTransitionOptions = {}
  ): Promise<TransitionCalculation | null> {
    const currentSession = await SubscriptionSessionService.getCurrentSession(userData);
    if (!currentSession) return null;

    const now = new Date();
    const endDate = this.convertToDate(currentSession.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate unused tokens from current package session (will be lost)
    const unusedPackageTokens = Math.max(0, (currentSession.packageResources?.tokensIncluded || 0) - (currentSession.usage?.tokensUsed || 0));
    
    // Get UNUSED pay-as-you-go tokens from all sessions
    const unusedPayAsYouGoTokens = await this.getUnusedPayAsYouGoTokens(userData);
    
    // Calculate new package cost (no proration)
    const newPackagePrice = this.getPackagePriceNumeric(newPackageType);
    const totalAmount = newPackagePrice;
    
    // New package tokens (always reset to package limit)
    const newPackageTokens = PACKAGE_LIMITS[newPackageType].monthlyTokens;
    
    // Preserve only unused pay-as-you-go tokens (default: true)
    const preservedPayAsYouGoTokens = (options.preserveUnusedPayAsYouGo !== false) ? unusedPayAsYouGoTokens : 0;

    return {
      currentSession,
      newPackageType,
      daysRemaining,
      unusedPackageTokens,
      unusedPayAsYouGoTokens,
      totalAmount,
      newPackageTokens,
      preservedPayAsYouGoTokens
    };
  }

  /**
   * Execute package transition with your business rules
   */
  static async executeTransition(
    userId: string,
    newPackageType: 'free' | 'starter' | 'standard',
    options: PackageTransitionOptions = {},
    paymentMethod?: string,
    paymentReference?: string
  ): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }

      const userData = userDoc.data() as User;
      // Ensure newPackageType is valid
      if (!['free', 'starter', 'standard'].includes(newPackageType)) {
        console.error('Invalid package type:', newPackageType);
        return false;
      }
      
      const calculation = await this.calculateTransition(userData, newPackageType, options);
      
      if (!calculation) {
        console.error('Impossible de calculer la transition');
        return false;
      }

      // Create transition session
      const transitionSession = await this.createTransitionSession(
        userId,
        calculation as any,
        options,
        paymentMethod,
        paymentReference
      );

      if (!transitionSession) {
        return false;
      }

      // Handle pay-as-you-go token preservation
      await this.handlePayAsYouGoPreservation(userId, calculation as any, options);

      
      return true;

    } catch (error) {
      console.error('Erreur lors de la transition de package:', error);
      return false;
    }
  }

  /**
   * Get unused pay-as-you-go tokens from all sessions (async version - uses new collection)
   */
  private static async getUnusedPayAsYouGoTokens(userData: User): Promise<number> {
    // Try new collection service first
    const sessions = await SubscriptionSessionCollectionService.getUserSessions(userData.id);
    
    // Filter active sessions and calculate unused pay-as-you-go tokens
    const activeSessions = sessions.filter(session => session.isActive);
    
    // Calculate unused pay-as-you-go tokens (not package tokens)
    // Pay-as-you-go tokens are stored in payAsYouGoResources.tokens
    const unusedPayAsYouGoTokens = activeSessions.reduce((total, session) => {
      const payAsYouGoTokens = session.payAsYouGoResources?.tokens || 0;
      // Note: We don't track usage of pay-as-you-go tokens separately
      // So we consider all pay-as-you-go tokens as "unused" for preservation
      return total + payAsYouGoTokens;
    }, 0);
    
    // If no sessions in collection, fallback to legacy
    if (sessions.length === 0 && userData.subscriptionSessions) {
      const legacySessions = userData.subscriptionSessions.filter(session => session.isActive);
      return legacySessions.reduce((total, session) => {
        const payAsYouGoTokens = session.payAsYouGoResources?.tokens || 0;
        return total + payAsYouGoTokens;
      }, 0);
    }
    
    return unusedPayAsYouGoTokens;
  }

  /**
   * Get unused pay-as-you-go tokens from all sessions (sync version - for backward compatibility)
   * @deprecated Use getUnusedPayAsYouGoTokens() async version instead
   */
  private static getUnusedPayAsYouGoTokensSync(userData: User): number {
    const sessions = userData.subscriptionSessions || [];
    const activeSessions = sessions.filter(session => session.isActive);
    return activeSessions.reduce((total, session) => {
      const payAsYouGoTokens = session.payAsYouGoResources?.tokens || 0;
      return total + payAsYouGoTokens;
    }, 0);
  }


  /**
   * Get package price numeric
   */
  private static getPackagePriceNumeric(packageType: 'free' | 'starter' | 'standard'): number {
    try {
      const priceStr = getPackagePrice(packageType);
      const parsedPrice = parseInt(priceStr.replace(/[^\d]/g, '')) || 0;
      
      // Defensive programming: ensure we don't return NaN
      if (isNaN(parsedPrice)) {
        console.warn('Failed to parse package price for', packageType, 'price string:', priceStr);
        return 0;
      }
      
      return parsedPrice;
    } catch (error) {
      console.error('Error parsing package price for', packageType, error);
      return 0;
    }
  }

  /**
   * Create transition session
   */
  private static async createTransitionSession(
    userId: string,
    calculation: EnhancedTransitionCalculation,
    options: PackageTransitionOptions,
    paymentMethod?: string,
    paymentReference?: string
  ): Promise<boolean> {
    const sessionType = calculation.finalAmountToPay >= 0 ? 'upgrade' : 'downgrade';
    
    // Create new session dates starting from today (transition date)
    const transitionDate = new Date();
    const newEndDate = new Date(transitionDate);
    newEndDate.setDate(newEndDate.getDate() + 30); // 30 days from transition date
    
    const newPackageLimits = PACKAGE_LIMITS[calculation.newPackageType];
    
    // Get the actual payment amount from the payment document
    let amountPaid = Math.abs(calculation.finalAmountToPay) || 0;
    if (paymentReference) {
      try {
        const payment = await PaymentService.getPayment(paymentReference);
        if (payment) {
          amountPaid = payment.amount; // Use the actual charged amount from payment
          console.log('PackageTransitionService: Using payment amount for session:', {
            paymentId: paymentReference,
            paymentAmount: payment.amount,
            originalAmount: payment.originalAmount,
            calculatedAmount: Math.abs(calculation.finalAmountToPay)
          });
        }
      } catch (error) {
        console.error('PackageTransitionService: Failed to get payment amount, using calculated amount:', error);
      }
    }
    
    return SubscriptionSessionService.createSession(userId, {
      packageType: calculation.newPackageType as 'starter' | 'standard',
      sessionType,
      startDate: transitionDate, // Start from transition date
      endDate: newEndDate, // End 30 days from transition date
      amountPaid: amountPaid, // Use actual payment amount
      durationDays: 30, // Always 30 days for new session
      packageResources: {
        tokensIncluded: calculation.newPackageTokens,
        formsIncluded: newPackageLimits.maxForms,
        dashboardsIncluded: newPackageLimits.maxDashboards,
        usersIncluded: newPackageLimits.maxUsers
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
      notes: this.generateEnhancedTransitionNotes(calculation as any, options)
    });
  }

  /**
   * Handle pay-as-you-go token preservation
   */
  private static async handlePayAsYouGoPreservation(
    userId: string,
    calculation: EnhancedTransitionCalculation,
    options: PackageTransitionOptions
  ): Promise<void> {
    if (!options.preserveUnusedPayAsYouGo || calculation.preservedPayAsYouGoTokens === 0) {
      return;
    }

    // Get active session from new collection
    const currentSession = await SubscriptionSessionCollectionService.getActiveSession(userId);
    
    if (!currentSession) {
      return;
    }

    // Preserve pay-as-you-go tokens in the new session
    // This is handled when creating the new transition session
    // The new session will include the preserved pay-as-you-go tokens
    // No need to manually update here as the new session creation handles it
  }

  /**
   * Generate transition notes
   */
  private static generateEnhancedTransitionNotes(
    calculation: EnhancedTransitionCalculation,
    options: PackageTransitionOptions
  ): string {
    const notes = [];
    
    // Package transition info
    notes.push(`${calculation.currentSession.packageType} → ${calculation.newPackageType}`);
    
    // Token reset info
    notes.push(`Tokens réinitialisés: ${calculation.newPackageTokens.toLocaleString()}`);
    
    // Pay-as-you-go preservation
    if (options.preserveUnusedPayAsYouGo && calculation.preservedPayAsYouGoTokens > 0) {
      notes.push(`Pay-as-you-go préservé: ${calculation.preservedPayAsYouGoTokens.toLocaleString()} tokens`);
    }
    
    // Unused package tokens info (for tracking)
    if (calculation.unusedPackageTokens > 0) {
      notes.push(`Tokens package perdus: ${calculation.unusedPackageTokens.toLocaleString()}`);
    }
    
    return notes.join(' | ');
  }

  /**
   * Get transition preview for UI
   */
  static getTransitionPreview(
    userData: User,
    newPackageType: 'free' | 'starter' | 'standard',
    options: PackageTransitionOptions = {}
  ) {
    const calculation = this.calculateTransition(userData, newPackageType, options);
    
    if (!calculation) return null;

    return {
      currentPackage: calculation.currentSession.packageType,
      newPackage: newPackageType,
      daysRemaining: calculation.daysRemaining,
      unusedPackageTokens: calculation.unusedPackageTokens,
      unusedPayAsYouGoTokens: calculation.unusedPayAsYouGoTokens,
      totalAmount: calculation.totalAmount,
      newPackageTokens: calculation.newPackageTokens,
      preservedPayAsYouGoTokens: calculation.preservedPayAsYouGoTokens,
      summary: this.generateTransitionSummary(calculation, options)
    };
  }

  /**
   * Generate human-readable transition summary
   */
  private static generateTransitionSummary(
    calculation: TransitionCalculation,
    _options: PackageTransitionOptions
  ): string {
    const parts = [];
    
    // Cost info (always positive now, no proration)
    parts.push(`Coût: ${calculation.totalAmount.toLocaleString()} FCFA`);
    
    // Token info
    parts.push(`Nouveaux tokens: ${calculation.newPackageTokens.toLocaleString()}`);
    
    // Pay-as-you-go preservation
    if (calculation.preservedPayAsYouGoTokens > 0) {
      parts.push(`Pay-as-you-go préservé: ${calculation.preservedPayAsYouGoTokens.toLocaleString()} tokens`);
    }
    
    // Unused package tokens warning
    if (calculation.unusedPackageTokens > 0) {
      parts.push(`⚠️ ${calculation.unusedPackageTokens.toLocaleString()} tokens package seront perdus`);
    }
    
    return parts.join(' • ');
  }

  /**
   * Get total available tokens (new package + preserved pay-as-you-go) (async version)
   */
  static async getTotalAvailableTokens(userData: User, newPackageType: 'free' | 'starter' | 'standard'): Promise<number> {
    const newPackageTokens = PACKAGE_LIMITS[newPackageType].monthlyTokens;
    const preservedPayAsYouGoTokens = await this.getUnusedPayAsYouGoTokens(userData);
    
    return newPackageTokens + preservedPayAsYouGoTokens;
  }

  /**
   * Get total available tokens (new package + preserved pay-as-you-go) (sync version - for backward compatibility)
   * @deprecated Use getTotalAvailableTokens() async version instead
   */
  static getTotalAvailableTokensSync(userData: User, newPackageType: 'free' | 'starter' | 'standard'): number {
    const newPackageTokens = PACKAGE_LIMITS[newPackageType].monthlyTokens;
    const preservedPayAsYouGoTokens = this.getUnusedPayAsYouGoTokensSync(userData);
    
    return newPackageTokens + preservedPayAsYouGoTokens;
  }

  /**
   * Get current total available tokens (current package + unused pay-as-you-go) (async version)
   */
  static async getCurrentTotalAvailableTokens(userData: User): Promise<number> {
    const currentSession = await SubscriptionSessionService.getCurrentSession(userData);
    const unusedPayAsYouGoTokens = await this.getUnusedPayAsYouGoTokens(userData);
    
    if (!currentSession) return unusedPayAsYouGoTokens;
    
    const currentPackageTokens = (currentSession.packageResources?.tokensIncluded || 0) - (currentSession.usage?.tokensUsed || 0);
    return currentPackageTokens + unusedPayAsYouGoTokens;
  }

  /**
   * Get current total available tokens (current package + unused pay-as-you-go) (sync version - for backward compatibility)
   * @deprecated Use getCurrentTotalAvailableTokens() async version instead
   */
  static getCurrentTotalAvailableTokensSync(userData: User): number {
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(userData);
    const unusedPayAsYouGoTokens = this.getUnusedPayAsYouGoTokensSync(userData);
    
    if (!currentSession) return unusedPayAsYouGoTokens;
    
    const currentPackageTokens = (currentSession.packageResources?.tokensIncluded || 0) - (currentSession.usage?.tokensUsed || 0);
    return currentPackageTokens + unusedPayAsYouGoTokens;
  }

  /**
   * Calculate cost reduction based on days remaining in current package
   */
  private static calculateCostReduction(
    currentPackagePrice: number,
    daysRemaining: number
  ): number {
    // Defensive programming: ensure we have valid numbers
    if (isNaN(currentPackagePrice) || isNaN(daysRemaining) || currentPackagePrice < 0 || daysRemaining < 0) {
      console.warn('Invalid values in calculateCostReduction:', { currentPackagePrice, daysRemaining });
      return 0;
    }
    
    const totalDaysInCycle = 30;
    const remainingValue = (currentPackagePrice * daysRemaining) / totalDaysInCycle;
    const result = Math.round(remainingValue);
    
    // Ensure result is not NaN
    return isNaN(result) ? 0 : result;
  }

  /**
   * Get pay-as-you-go pricing for different features
   */
  private static getPayAsYouGoPrice(feature: string): number {
    const prices: Record<string, number> = {
      forms: 2000, // 2,000 FCFA per form
      dashboards: 30000, // 30,000 FCFA per dashboard
      users: 7000, // 7,000 FCFA per user
      tokens: 0.0085 // 8.5 FCFA per 1000 tokens
    };
    return prices[feature] || 0;
  }

  /**
   * Analyze pay-as-you-go requirements
   */
  private static analyzePayAsYouGo(
    _currentPackage: 'free' | 'starter' | 'standard',
    newPackage: 'free' | 'starter' | 'standard',
    userNeeds: UserNeeds = {}
  ): PayAsYouGoItem[] {
    const payAsYouGoItems: PayAsYouGoItem[] = [];
    
    // Check each feature that might need pay-as-you-go
    const featuresToCheck = [
      { key: 'forms' as keyof UserNeeds, limitKey: 'maxForms' as keyof PackageLimits },
      { key: 'dashboards' as keyof UserNeeds, limitKey: 'maxDashboards' as keyof PackageLimits },
      { key: 'users' as keyof UserNeeds, limitKey: 'maxUsers' as keyof PackageLimits }
    ];
    
    featuresToCheck.forEach(({ key, limitKey }) => {
      const newPackageLimit = PACKAGE_LIMITS[newPackage as keyof typeof PACKAGE_LIMITS][limitKey];
      const userRequestedAmount = userNeeds[key] || 0;
      
      // Only apply pay-as-you-go if new package doesn't have unlimited access
      if (newPackageLimit !== -1 && userRequestedAmount > newPackageLimit) {
        const extraNeeded = userRequestedAmount - newPackageLimit;
        const costPerUnit = this.getPayAsYouGoPrice(key);
        
        payAsYouGoItems.push({
          feature: key,
          currentLimit: newPackageLimit,
          requestedAmount: userRequestedAmount,
          costPerUnit,
          totalCost: extraNeeded * costPerUnit
        });
      }
    });
    
    return payAsYouGoItems;
  }

  /**
   * Analyze feature upgrades
   */
  private static analyzeFeatureUpgrades(
    currentPackage: 'free' | 'starter' | 'standard',
    newPackage: 'free' | 'starter' | 'standard'
  ): FeatureUpgrade[] {
    const upgrades: FeatureUpgrade[] = [];
    const features = ['maxForms', 'maxDashboards', 'maxUsers', 'monthlyTokens'] as const;
    
    features.forEach(feature => {
      const currentLimit = PACKAGE_LIMITS[currentPackage][feature];
      const newLimit = PACKAGE_LIMITS[newPackage][feature];
      
      // Only add to upgrades if it's actually an improvement
      // -1 means unlimited, so going from limited to unlimited is an upgrade
      // Going from unlimited to limited is NOT an upgrade (it's a downgrade)
      // Going from unlimited to unlimited is not a change
      if (currentLimit !== -1 && newLimit === -1) {
        // Going from limited to unlimited is an upgrade
        upgrades.push({
          feature,
          fromLimit: currentLimit,
          toLimit: 'unlimited',
          isUnlimited: true
        });
      } else if (currentLimit !== -1 && newLimit !== -1 && newLimit > currentLimit) {
        // Going from limited to higher limited is an upgrade
        upgrades.push({
          feature,
          fromLimit: currentLimit,
          toLimit: newLimit,
          isUnlimited: false
        });
      }
      // Note: Going from unlimited to limited is handled in downgrades
    });
    
    return upgrades;
  }

  /**
   * Analyze feature downgrades
   */
  private static analyzeFeatureDowngrades(
    currentPackage: 'free' | 'starter' | 'standard',
    newPackage: 'free' | 'starter' | 'standard'
  ): FeatureDowngrade[] {
    const downgrades: FeatureDowngrade[] = [];
    const features = ['maxForms', 'maxDashboards', 'maxUsers', 'monthlyTokens'] as const;
    
    features.forEach(feature => {
      const currentLimit = PACKAGE_LIMITS[currentPackage][feature];
      const newLimit = PACKAGE_LIMITS[newPackage][feature];
      
      // Only add to downgrades if it's actually a reduction
      // -1 means unlimited, so going from unlimited to limited is a downgrade
      // Going from limited to limited with lower value is a downgrade
      // Going from unlimited to unlimited is not a change
      if ((currentLimit === -1 && newLimit !== -1) || (currentLimit !== -1 && newLimit !== -1 && newLimit < currentLimit)) {
        downgrades.push({
          feature,
          fromLimit: currentLimit === -1 ? 'unlimited' : currentLimit,
          toLimit: newLimit === -1 ? 'unlimited' : newLimit,
          isUnlimited: newLimit === -1
        });
      }
    });
    
    return downgrades;
  }

  /**
   * Enhanced transition calculation with cost reduction and pay-as-you-go logic (async version)
   */
  static async calculateEnhancedTransition(
    userData: User,
    newPackageType: 'free' | 'starter' | 'standard',
    userNeeds: UserNeeds = {},
    options: PackageTransitionOptions = {}
  ): Promise<EnhancedTransitionCalculation | null> {
    const currentSession = await SubscriptionSessionService.getCurrentSession(userData);
    if (!currentSession) return null;

    const now = new Date();
    const endDate = this.convertToDate(currentSession.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Get package prices
    const currentPackagePrice = this.getPackagePriceNumeric(currentSession.packageType as 'free' | 'starter' | 'standard');
    const newPackagePrice = this.getPackagePriceNumeric(newPackageType);
    
    // Calculate cost reduction based on days remaining
    const currentPackageRemainingValue = this.calculateCostReduction(currentPackagePrice, daysRemaining);
    
    // Analyze pay-as-you-go requirements
    const payAsYouGoItems = this.analyzePayAsYouGo(currentSession.packageType as 'free' | 'starter' | 'standard', newPackageType, userNeeds);
    const payAsYouGoTotalCost = payAsYouGoItems.reduce((sum, item) => sum + item.totalCost, 0);
    
    // Calculate final amount to pay based on transition type
    let finalAmountToPay: number;
    
    if (newPackagePrice > currentPackagePrice) {
      // UPGRADE: Pay the difference, get immediate access
      finalAmountToPay = Math.max(0, newPackagePrice - currentPackageRemainingValue);
    } else {
      // DOWNGRADE: Industry best practice - no immediate refund, takes effect at next billing cycle
      // For now, we'll allow immediate downgrade but with no immediate payment
      finalAmountToPay = 0; // No immediate payment for downgrades
    }
    
    // Defensive programming: ensure finalAmountToPay is not NaN
    if (isNaN(finalAmountToPay)) {
      console.warn('finalAmountToPay is NaN, setting to 0. Values:', {
        newPackagePrice,
        currentPackagePrice,
        currentPackageRemainingValue,
        daysRemaining
      });
      finalAmountToPay = 0;
    }
    
    // Token handling (existing logic)
    const unusedPackageTokens = Math.max(0, (currentSession.packageResources?.tokensIncluded || 0) - (currentSession.usage?.tokensUsed || 0));
    const unusedPayAsYouGoTokens = await this.getUnusedPayAsYouGoTokens(userData);
    const newPackageTokens = PACKAGE_LIMITS[newPackageType].monthlyTokens;
    const preservedPayAsYouGoTokens = (options.preserveUnusedPayAsYouGo !== false) ? unusedPayAsYouGoTokens : 0;
    
    // Feature analysis
    const featureUpgrades = this.analyzeFeatureUpgrades(currentSession.packageType as 'free' | 'starter' | 'standard', newPackageType);
    const featureDowngrades = this.analyzeFeatureDowngrades(currentSession.packageType as 'free' | 'starter' | 'standard', newPackageType);
    
    // Calculate savings based on transition type
    let savings: number;
    
    if (newPackagePrice > currentPackagePrice) {
      // UPGRADE: Show remaining value as savings
      savings = Math.max(0, currentPackageRemainingValue);
    } else {
      // DOWNGRADE: Show remaining value as "lost value" (negative savings)
      savings = -currentPackageRemainingValue;
    }
    
    return {
      currentSession,
      newPackageType,
      daysRemaining,
      currentPackageRemainingValue,
      newPackageFullCost: newPackagePrice,
      finalAmountToPay,
      unusedPackageTokens,
      unusedPayAsYouGoTokens,
      newPackageTokens,
      preservedPayAsYouGoTokens,
      payAsYouGoRequired: payAsYouGoItems.length > 0,
      payAsYouGoItems,
      payAsYouGoTotalCost,
      featureUpgrades,
      featureDowngrades,
      priceBreakdown: {
        currentPackagePrice,
        currentPackageRemainingValue,
        newPackagePrice,
        payAsYouGoCost: payAsYouGoTotalCost,
        finalAmount: finalAmountToPay,
        savings
      }
    };
  }

  /**
   * Get enhanced transition preview for UI
   */
  static async getEnhancedTransitionPreview(
    userData: User,
    newPackageType: 'free' | 'starter' | 'standard',
    userNeeds: UserNeeds = {},
    options: PackageTransitionOptions = {}
  ) {
    const calculation = await this.calculateEnhancedTransition(userData, newPackageType, userNeeds, options);
    
    if (!calculation) return null;

    return {
      currentPackage: calculation.currentSession.packageType,
      newPackage: newPackageType,
      daysRemaining: calculation.daysRemaining,
      priceBreakdown: calculation.priceBreakdown,
      payAsYouGoItems: calculation.payAsYouGoItems,
      featureUpgrades: calculation.featureUpgrades,
      featureDowngrades: calculation.featureDowngrades,
      tokenInfo: {
        unusedPackageTokens: calculation.unusedPackageTokens,
        unusedPayAsYouGoTokens: calculation.unusedPayAsYouGoTokens,
        newPackageTokens: calculation.newPackageTokens,
        preservedPayAsYouGoTokens: calculation.preservedPayAsYouGoTokens
      },
      summary: this.generateEnhancedTransitionSummary(calculation, options)
    };
  }

  /**
   * Generate enhanced human-readable transition summary
   */
  private static generateEnhancedTransitionSummary(
    calculation: EnhancedTransitionCalculation,
    _options: PackageTransitionOptions
  ): string {
    const parts = [];
    
    // Cost info with breakdown
    if (calculation.daysRemaining > 0) {
      parts.push(`Économie: ${calculation.priceBreakdown.savings.toLocaleString()} FCFA (${calculation.daysRemaining} jours restants)`);
    }
    parts.push(`Montant final: ${calculation.finalAmountToPay.toLocaleString()} FCFA`);
    
    // Pay-as-you-go info
    if (calculation.payAsYouGoRequired) {
      parts.push(`Pay-as-you-go: ${calculation.payAsYouGoTotalCost.toLocaleString()} FCFA`);
    }
    
    // Token info
    parts.push(`Nouveaux tokens: ${calculation.newPackageTokens.toLocaleString()}`);
    
    // Pay-as-you-go preservation
    if (calculation.preservedPayAsYouGoTokens > 0) {
      parts.push(`Pay-as-you-go préservé: ${calculation.preservedPayAsYouGoTokens.toLocaleString()} tokens`);
    }
    
    // Unused package tokens warning
    if (calculation.unusedPackageTokens > 0) {
      parts.push(`⚠️ ${calculation.unusedPackageTokens.toLocaleString()} tokens package seront perdus`);
    }
    
    return parts.join(' • ');
  }
}
