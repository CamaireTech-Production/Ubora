import { User, SubscriptionSession } from '../types';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { PACKAGE_LIMITS, PACKAGE_FEATURES, PackageType } from '../config/packageFeatures';

export interface UserPackageInfo {
  packageType: PackageType | null;
  packageFeatures: string[];
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  subscriptionStatus: 'active' | 'expired' | 'cancelled';
  daysRemaining: number;
  
  // Package resources
  packageTokens: number;
  packageForms: number;
  packageDashboards: number;
  packageUsers: number;
  
  // Pay-as-you-go resources
  payAsYouGoTokens: number;
  payAsYouGoForms: number;
  payAsYouGoDashboards: number;
  payAsYouGoUsers: number;
  
  // Total available resources
  totalTokens: number;
  totalForms: number;
  totalDashboards: number;
  totalUsers: number;
  
  // Usage
  tokensUsed: number;
  formsCreated: number;
  dashboardsCreated: number;
  usersAdded: number;
  
  // Remaining resources
  tokensRemaining: number;
  formsRemaining: number;
  dashboardsRemaining: number;
  usersRemaining: number;
  
  amountPaid: number;
  paymentMethod?: string;
  sessionType: string;
}

export class UserSessionService {
  /**
   * Get complete package information from active session
   * Note: Only directors have subscription sessions
   */
  static getUserPackageInfo(user: User): UserPackageInfo {
    // Only directors have subscription sessions
    if (user.role !== 'directeur') {
      return this.getDefaultPackageInfo();
    }

    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    
    if (!currentSession) {
      return this.getDefaultPackageInfo();
    }

    const packageFeatures = this.getPackageFeatures(currentSession.packageType);
    
    const startDate = this.convertToDate(currentSession.startDate);
    const endDate = this.convertToDate(currentSession.endDate);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const subscriptionStatus = currentSession.isActive && daysRemaining > 0 ? 'active' : 'expired';
    
    // Package resources (from the selected package)
    const packageTokens = currentSession.packageResources?.tokensIncluded || 0;
    const packageForms = currentSession.packageResources?.formsIncluded || 0;
    const packageDashboards = currentSession.packageResources?.dashboardsIncluded || 0;
    const packageUsers = currentSession.packageResources?.usersIncluded || 0;
    
    // Pay-as-you-go resources (additional purchases)
    const payAsYouGoTokens = currentSession.payAsYouGoResources?.tokens || 0;
    const payAsYouGoForms = currentSession.payAsYouGoResources?.forms || 0;
    const payAsYouGoDashboards = currentSession.payAsYouGoResources?.dashboards || 0;
    const payAsYouGoUsers = currentSession.payAsYouGoResources?.users || 0;
    
    // Total available resources
    const totalTokens = packageTokens + payAsYouGoTokens;
    const totalForms = packageForms + payAsYouGoForms;
    const totalDashboards = packageDashboards + payAsYouGoDashboards;
    const totalUsers = packageUsers + payAsYouGoUsers;
    
    // Usage
    const tokensUsed = currentSession.usage?.tokensUsed || 0;
    const formsCreated = currentSession.usage?.formsCreated || 0;
    const dashboardsCreated = currentSession.usage?.dashboardsCreated || 0;
    const usersAdded = currentSession.usage?.usersAdded || 0;
    
    // Remaining resources
    const tokensRemaining = Math.max(0, totalTokens - tokensUsed);
    const formsRemaining = Math.max(0, totalForms - formsCreated);
    const dashboardsRemaining = Math.max(0, totalDashboards - dashboardsCreated);
    const usersRemaining = Math.max(0, totalUsers - usersAdded);
    
    return {
      packageType: currentSession.packageType,
      packageFeatures,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      subscriptionStatus,
      daysRemaining,
      packageTokens,
      packageForms,
      packageDashboards,
      packageUsers,
      payAsYouGoTokens,
      payAsYouGoForms,
      payAsYouGoDashboards,
      payAsYouGoUsers,
      totalTokens,
      totalForms,
      totalDashboards,
      totalUsers,
      tokensUsed,
      formsCreated,
      dashboardsCreated,
      usersAdded,
      tokensRemaining,
      formsRemaining,
      dashboardsRemaining,
      usersRemaining,
      amountPaid: currentSession.amountPaid || 0,
      paymentMethod: currentSession.paymentMethod,
      sessionType: currentSession.sessionType
    };
  }

  /**
   * Get default package info for non-directors
   */
  private static getDefaultPackageInfo(): UserPackageInfo {
    return {
      packageType: null,
      packageFeatures: [],
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      subscriptionStatus: 'expired',
      daysRemaining: 0,
      packageTokens: 0,
      packageForms: 0,
      packageDashboards: 0,
      packageUsers: 0,
      payAsYouGoTokens: 0,
      payAsYouGoForms: 0,
      payAsYouGoDashboards: 0,
      payAsYouGoUsers: 0,
      totalTokens: 0,
      totalForms: 0,
      totalDashboards: 0,
      totalUsers: 0,
      tokensUsed: 0,
      formsCreated: 0,
      dashboardsCreated: 0,
      usersAdded: 0,
      tokensRemaining: 0,
      formsRemaining: 0,
      dashboardsRemaining: 0,
      usersRemaining: 0,
      amountPaid: 0,
      sessionType: 'none'
    };
  }

  /**
   * Get package features for a package type
   */
  private static getPackageFeatures(packageType: PackageType): string[] {
    const features = PACKAGE_FEATURES[packageType];
    const featureList: string[] = [];
    
    Object.entries(features).forEach(([key, value]) => {
      if (value === true) {
        featureList.push(key);
      }
    });
    
    return featureList;
  }

  /**
   * Get package limits from active session
   * Note: Only directors have subscription sessions
   */
  static getPackageLimits(user: User) {
    if (user.role !== 'directeur') {
      return {
        maxForms: 0,
        maxDashboards: 0,
        maxUsers: 0,
        maxTokens: 0
      };
    }

    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    
    if (!currentSession) {
      return {
        maxForms: 0,
        maxDashboards: 0,
        maxUsers: 0,
        maxTokens: 0
      };
    }

    const packageLimits = PACKAGE_LIMITS[currentSession.packageType];
    
    // Add pay-as-you-go resources to limits
    const payAsYouGoTokens = currentSession.payAsYouGoResources?.tokens || 0;
    const payAsYouGoForms = currentSession.payAsYouGoResources?.forms || 0;
    const payAsYouGoDashboards = currentSession.payAsYouGoResources?.dashboards || 0;
    const payAsYouGoUsers = currentSession.payAsYouGoResources?.users || 0;

    return {
      maxForms: packageLimits.maxForms === -1 ? -1 : packageLimits.maxForms + payAsYouGoForms,
      maxDashboards: packageLimits.maxDashboards === -1 ? -1 : packageLimits.maxDashboards + payAsYouGoDashboards,
      maxUsers: packageLimits.maxUsers === -1 ? -1 : packageLimits.maxUsers + payAsYouGoUsers,
      maxTokens: packageLimits.monthlyTokens === -1 ? -1 : packageLimits.monthlyTokens + payAsYouGoTokens
    };
  }

  /**
   * Check if user has a specific feature
   * Note: Only directors have subscription sessions
   */
  static hasFeature(user: User, feature: string): boolean {
    if (user.role !== 'directeur') {
      return false;
    }

    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    
    if (!currentSession) {
      return false;
    }

    const packageFeatures = PACKAGE_FEATURES[currentSession.packageType];
    return packageFeatures[feature] === true;
  }

  /**
   * Check if user can perform an action based on limits
   * Note: Only directors have subscription sessions
   */
  static canPerformAction(user: User, action: 'createForm' | 'createDashboard' | 'addUser' | 'useTokens', currentCount: number): boolean {
    if (user.role !== 'directeur') {
      return false;
    }

    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    
    if (!currentSession) {
      return false;
    }

    const limits = this.getPackageLimits(user);
    
    switch (action) {
      case 'createForm':
        return currentCount < limits.maxForms;
      case 'createDashboard':
        return currentCount < limits.maxDashboards;
      case 'addUser':
        return currentCount < limits.maxUsers;
      case 'useTokens':
        return currentCount < limits.maxTokens;
      default:
        return false;
    }
  }

  /**
   * Get total pay-as-you-go tokens from active session
   * Note: Only directors have subscription sessions
   */
  static getTotalPayAsYouGoTokens(user: User): number {
    if (user.role !== 'directeur') {
      return 0;
    }

    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    
    if (!currentSession) {
      return 0;
    }

    return currentSession.payAsYouGoResources?.tokens || 0;
  }

  /**
   * Get total available tokens (package + pay-as-you-go)
   * Note: Only directors have subscription sessions
   */
  static getTotalAvailableTokens(user: User): number {
    if (user.role !== 'directeur') {
      return 0;
    }

    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    
    if (!currentSession) {
      return 0;
    }

    const packageTokens = currentSession.packageResources?.tokensIncluded || 0;
    const payAsYouGoTokens = currentSession.payAsYouGoResources?.tokens || 0;
    
    return packageTokens + payAsYouGoTokens;
  }

  /**
   * Get subscription history
   * Note: Only directors have subscription sessions
   */
  static getSubscriptionHistory(user: User) {
    if (user.role !== 'directeur') {
      return {
        currentSession: null,
        allSessions: [],
        totalSessions: 0
      };
    }

    const sessions = user.subscriptionSessions || [];
    const currentSession = sessions.find(s => s.isActive) || null;
    
    return {
      currentSession,
      allSessions: sessions,
      totalSessions: sessions.length
    };
  }

  /**
   * Check if user needs to select a package
   * Note: Only directors have subscription sessions
   */
  static needsPackageSelection(user: User): boolean {
    if (user.role !== 'directeur') {
      return false;
    }

    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    return !currentSession;
  }

  /**
   * Convert Firestore timestamp to Date
   */
  private static convertToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's a Firestore timestamp object with _seconds
    if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
      return new Date(timestamp._seconds * 1000);
    }
    
    // If it's a string or number
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Default to current date
    return new Date();
  }
}