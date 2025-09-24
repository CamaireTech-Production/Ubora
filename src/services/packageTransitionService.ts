import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession, User } from '../types';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { PACKAGE_LIMITS, getPackagePrice } from '../config/packageFeatures';

export interface PackageTransitionOptions {
  preserveUnusedPayAsYouGo?: boolean; // Whether to preserve unused pay-as-you-go tokens (default: true)
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
    
    return SubscriptionSessionService.createSession(userId, {
      packageType: calculation.newPackageType,
      sessionType,
      startDate: new Date(),
      endDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days
      amountPaid: Math.abs(calculation.totalAmount),
      durationDays: 30,
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
}
