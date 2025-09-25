import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession, User } from '../types';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { PACKAGE_LIMITS, getPackagePrice } from '../config/packageFeatures';

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
  newPackageType: 'starter' | 'standard' | 'premium' | 'custom';
  daysRemaining: number;
  unusedPackageTokens: number;
  unusedPayAsYouGoTokens: number;
  totalAmount: number;
  newPackageTokens: number;
  preservedPayAsYouGoTokens: number;
}

export interface EnhancedTransitionCalculation {
  currentSession: SubscriptionSession;
  newPackageType: 'starter' | 'standard' | 'premium' | 'custom';
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
  static calculateTransition(
    userData: User,
    newPackageType: 'starter' | 'standard' | 'premium' | 'custom',
    options: PackageTransitionOptions = {}
  ): TransitionCalculation | null {
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    if (!currentSession) return null;

    const now = new Date();
    const endDate = this.convertToDate(currentSession.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate unused tokens from current package session (will be lost)
    const unusedPackageTokens = Math.max(0, currentSession.tokensIncluded - currentSession.tokensUsed);
    
    // Get UNUSED pay-as-you-go tokens from all sessions
    const unusedPayAsYouGoTokens = this.getUnusedPayAsYouGoTokens(userData);
    
    // Calculate new package cost (no proration)
    const newPackagePrice = this.getPackagePrice(newPackageType);
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
    newPackageType: 'starter' | 'standard' | 'premium' | 'custom',
    options: PackageTransitionOptions = {},
    paymentMethod?: string
  ): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.error('Utilisateur non trouvé:', userId);
        return false;
      }

      const userData = userDoc.data() as User;
      const calculation = this.calculateTransition(userData, newPackageType, options);
      
      if (!calculation) {
        console.error('Impossible de calculer la transition');
        return false;
      }

      // Create transition session
      const transitionSession = await this.createTransitionSession(
        userId,
        calculation,
        options,
        paymentMethod
      );

      if (!transitionSession) {
        return false;
      }

      // Handle pay-as-you-go token preservation
      await this.handlePayAsYouGoPreservation(userId, calculation, options);

      console.log(`✅ Package transition completed: ${calculation.currentSession.packageType} → ${newPackageType}`);
      console.log(`🔄 New package tokens: ${calculation.newPackageTokens}`);
      console.log(`💰 Preserved unused pay-as-you-go: ${calculation.preservedPayAsYouGoTokens}`);
      console.log(`❌ Lost unused package tokens: ${calculation.unusedPackageTokens}`);
      
      return true;

    } catch (error) {
      console.error('Erreur lors de la transition de package:', error);
      return false;
    }
  }

  /**
   * Get UNUSED pay-as-you-go tokens from all sessions
   */
  private static getUnusedPayAsYouGoTokens(userData: User): number {
    const sessions = userData.subscriptionSessions || [];
    return sessions
      .filter(session => session.sessionType === 'pay_as_you_go' && session.isActive)
      .reduce((total, session) => total + (session.tokensIncluded - session.tokensUsed), 0);
  }


  /**
   * Get package price
   */
  private static getPackagePrice(packageType: 'starter' | 'standard' | 'premium' | 'custom'): number {
    const priceStr = getPackagePrice(packageType);
    return parseInt(priceStr.replace(/[^\d]/g, '')) || 0;
  }

  /**
   * Create transition session
   */
  private static async createTransitionSession(
    userId: string,
    calculation: TransitionCalculation,
    options: PackageTransitionOptions,
    paymentMethod?: string
  ): Promise<boolean> {
    const sessionType = calculation.totalAmount >= 0 ? 'upgrade' : 'downgrade';
    
    // Preserve the original session dates instead of resetting to today
    const originalStartDate = this.convertToDate(calculation.currentSession.startDate);
    const originalEndDate = this.convertToDate(calculation.currentSession.endDate);
    
    return SubscriptionSessionService.createSession(userId, {
      packageType: calculation.newPackageType,
      sessionType,
      startDate: originalStartDate, // Keep original start date
      endDate: originalEndDate, // Keep original end date
      amountPaid: Math.abs(calculation.totalAmount),
      durationDays: calculation.daysRemaining + Math.ceil((originalEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      tokensIncluded: calculation.newPackageTokens, // Always reset to new package limit
      tokensUsed: 0, // Start fresh with new package
      isActive: true,
      paymentMethod,
      notes: this.generateTransitionNotes(calculation, options)
    });
  }

  /**
   * Handle pay-as-you-go token preservation
   */
  private static async handlePayAsYouGoPreservation(
    userId: string,
    calculation: TransitionCalculation,
    options: PackageTransitionOptions
  ): Promise<void> {
    if (!options.preserveUnusedPayAsYouGo || calculation.preservedPayAsYouGoTokens === 0) {
      return;
    }

    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data() as User;
    
    if (!userData.subscriptionSessions) return;

    // Mark current session as inactive
    const updatedSessions = userData.subscriptionSessions.map(session => {
      if (session.id === calculation.currentSession.id) {
        return { ...session, isActive: false, updatedAt: new Date() };
      }
      return session;
    });

    await updateDoc(userDocRef, {
      subscriptionSessions: updatedSessions,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Generate transition notes
   */
  private static generateTransitionNotes(
    calculation: TransitionCalculation,
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
    newPackageType: 'starter' | 'standard' | 'premium' | 'custom',
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
    options: PackageTransitionOptions
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
   * Get total available tokens (new package + preserved pay-as-you-go)
   */
  static getTotalAvailableTokens(userData: User, newPackageType: 'starter' | 'standard' | 'premium' | 'custom'): number {
    const newPackageTokens = PACKAGE_LIMITS[newPackageType].monthlyTokens;
    const preservedPayAsYouGoTokens = this.getUnusedPayAsYouGoTokens(userData);
    
    return newPackageTokens + preservedPayAsYouGoTokens;
  }

  /**
   * Get current total available tokens (current package + unused pay-as-you-go)
   */
  static getCurrentTotalAvailableTokens(userData: User): number {
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    const unusedPayAsYouGoTokens = this.getUnusedPayAsYouGoTokens(userData);
    
    if (!currentSession) return unusedPayAsYouGoTokens;
    
    const currentPackageTokens = currentSession.tokensIncluded - currentSession.tokensUsed;
    return currentPackageTokens + unusedPayAsYouGoTokens;
  }

  /**
   * Calculate cost reduction based on days remaining in current package
   */
  private static calculateCostReduction(
    currentPackagePrice: number,
    daysRemaining: number
  ): number {
    const totalDaysInCycle = 30;
    const remainingValue = (currentPackagePrice * daysRemaining) / totalDaysInCycle;
    return Math.round(remainingValue);
  }

  /**
   * Get pay-as-you-go pricing for different features
   */
  private static getPayAsYouGoPrice(feature: string): number {
    const prices: Record<string, number> = {
      forms: 5000, // 5,000 FCFA per form
      dashboards: 10000, // 10,000 FCFA per dashboard
      users: 7000, // 7,000 FCFA per user
      tokens: 0.0085 // 8.5 FCFA per 1000 tokens
    };
    return prices[feature] || 0;
  }

  /**
   * Analyze pay-as-you-go requirements
   */
  private static analyzePayAsYouGo(
    currentPackage: 'starter' | 'standard' | 'premium' | 'custom',
    newPackage: 'starter' | 'standard' | 'premium' | 'custom',
    userNeeds: UserNeeds = {}
  ): PayAsYouGoItem[] {
    const payAsYouGoItems: PayAsYouGoItem[] = [];
    
    // Check each feature that might need pay-as-you-go
    const featuresToCheck = ['forms', 'dashboards', 'users'] as const;
    
    featuresToCheck.forEach(feature => {
      const newPackageLimit = PACKAGE_LIMITS[newPackage][feature];
      const userRequestedAmount = userNeeds[feature] || 0;
      
      // Only apply pay-as-you-go if new package doesn't have unlimited access
      if (newPackageLimit !== -1 && userRequestedAmount > newPackageLimit) {
        const extraNeeded = userRequestedAmount - newPackageLimit;
        const costPerUnit = this.getPayAsYouGoPrice(feature);
        
        payAsYouGoItems.push({
          feature,
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
    currentPackage: 'starter' | 'standard' | 'premium' | 'custom',
    newPackage: 'starter' | 'standard' | 'premium' | 'custom'
  ): FeatureUpgrade[] {
    const upgrades: FeatureUpgrade[] = [];
    const features = ['maxForms', 'maxDashboards', 'maxUsers', 'monthlyTokens'] as const;
    
    features.forEach(feature => {
      const currentLimit = PACKAGE_LIMITS[currentPackage][feature];
      const newLimit = PACKAGE_LIMITS[newPackage][feature];
      
      if (newLimit > currentLimit || (currentLimit !== -1 && newLimit === -1)) {
        upgrades.push({
          feature,
          fromLimit: currentLimit === -1 ? 'unlimited' : currentLimit,
          toLimit: newLimit === -1 ? 'unlimited' : newLimit,
          isUnlimited: newLimit === -1
        });
      }
    });
    
    return upgrades;
  }

  /**
   * Analyze feature downgrades
   */
  private static analyzeFeatureDowngrades(
    currentPackage: 'starter' | 'standard' | 'premium' | 'custom',
    newPackage: 'starter' | 'standard' | 'premium' | 'custom'
  ): FeatureDowngrade[] {
    const downgrades: FeatureDowngrade[] = [];
    const features = ['maxForms', 'maxDashboards', 'maxUsers', 'monthlyTokens'] as const;
    
    features.forEach(feature => {
      const currentLimit = PACKAGE_LIMITS[currentPackage][feature];
      const newLimit = PACKAGE_LIMITS[newPackage][feature];
      
      if (newLimit < currentLimit || (currentLimit === -1 && newLimit !== -1)) {
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
   * Enhanced transition calculation with cost reduction and pay-as-you-go logic
   */
  static calculateEnhancedTransition(
    userData: User,
    newPackageType: 'starter' | 'standard' | 'premium' | 'custom',
    userNeeds: UserNeeds = {},
    options: PackageTransitionOptions = {}
  ): EnhancedTransitionCalculation | null {
    const currentSession = SubscriptionSessionService.getCurrentSession(userData);
    if (!currentSession) return null;

    const now = new Date();
    const endDate = this.convertToDate(currentSession.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Get package prices
    const currentPackagePrice = this.getPackagePrice(currentSession.packageType);
    const newPackagePrice = this.getPackagePrice(newPackageType);
    
    // Calculate cost reduction based on days remaining
    const currentPackageRemainingValue = this.calculateCostReduction(currentPackagePrice, daysRemaining);
    
    // Analyze pay-as-you-go requirements
    const payAsYouGoItems = this.analyzePayAsYouGo(currentSession.packageType, newPackageType, userNeeds);
    const payAsYouGoTotalCost = payAsYouGoItems.reduce((sum, item) => sum + item.totalCost, 0);
    
    // Calculate final amount to pay
    const finalAmountToPay = Math.max(0, newPackagePrice - currentPackageRemainingValue + payAsYouGoTotalCost);
    
    // Token handling (existing logic)
    const unusedPackageTokens = Math.max(0, currentSession.tokensIncluded - currentSession.tokensUsed);
    const unusedPayAsYouGoTokens = this.getUnusedPayAsYouGoTokens(userData);
    const newPackageTokens = PACKAGE_LIMITS[newPackageType].monthlyTokens;
    const preservedPayAsYouGoTokens = (options.preserveUnusedPayAsYouGo !== false) ? unusedPayAsYouGoTokens : 0;
    
    // Feature analysis
    const featureUpgrades = this.analyzeFeatureUpgrades(currentSession.packageType, newPackageType);
    const featureDowngrades = this.analyzeFeatureDowngrades(currentSession.packageType, newPackageType);
    
    // Calculate savings
    const savings = Math.max(0, currentPackageRemainingValue - payAsYouGoTotalCost);
    
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
  static getEnhancedTransitionPreview(
    userData: User,
    newPackageType: 'starter' | 'standard' | 'premium' | 'custom',
    userNeeds: UserNeeds = {},
    options: PackageTransitionOptions = {}
  ) {
    const calculation = this.calculateEnhancedTransition(userData, newPackageType, userNeeds, options);
    
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
    options: PackageTransitionOptions
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
