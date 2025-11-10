import { User } from '../types';
import { SubscriptionSessionService } from './subscriptionSessionService';
import { SubscriptionSessionCollectionService } from '@ubora/shared/services/subscriptionSessionCollectionService';
import { PACKAGE_LIMITS, PACKAGE_FEATURES, PackageType } from '@ubora/shared/config/packageFeatures';

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
   * Get complete package information from active session (async version - uses new collection)
   * Note: Only directors and employees with director access have subscription sessions
   */
  static async getUserPackageInfo(user: User): Promise<UserPackageInfo> {
    // Only directors and employees with director access have subscription sessions
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return this.getDefaultPackageInfo();
    }

    // Try to get session from new collection service first
    let currentSession = await SubscriptionSessionCollectionService.getActiveSession(user.id);
    
    // Fallback to legacy if no session in collection
    if (!currentSession) {
      currentSession = await SubscriptionSessionService.getCurrentSession(user);
    }
    
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
    
    // Safety check: if package type doesn't exist, return empty array
    if (!features) {
      return [];
    }
    
    const featureList: string[] = [];
    
    Object.entries(features).forEach(([key, value]) => {
      if (value === true) {
        featureList.push(key);
      }
    });
    
    return featureList;
  }


  /**
   * Get director's package information for an employee with director access (async version)
   * This method finds the director of the employee's agency and returns their package info
   */
  static async getDirectorPackageInfoForEmployeeAsync(employee: User): Promise<UserPackageInfo> {
    try {
      // Import Firebase functions dynamically to avoid circular dependencies
      const { db } = await import('../firebaseConfig');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Find the director of the employee's agency
      const directorsQuery = query(
        collection(db, 'users'),
        where('agencyId', '==', employee.agencyId),
        where('role', '==', 'directeur')
      );
      
      const directorsSnapshot = await getDocs(directorsQuery);
      
      if (directorsSnapshot.empty) {
        return this.getDefaultPackageInfo();
      }
      
      const directorData = directorsSnapshot.docs[0].data() as User;
      
      // Get the director's package info
      return this.getUserPackageInfo(directorData);
      
    } catch (error) {
      console.error('Error getting director package info for employee:', error);
      return this.getDefaultPackageInfo();
    }
  }

  /**
   * Get package limits from active session
   * Note: Only directors and employees with director access have subscription sessions
   */
  static getPackageLimits(user: User) {
    // Only directors and employees with director access can have package limits
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return {
        maxForms: 0,
        maxDashboards: 0,
        maxUsers: 0,
        maxTokens: 0
      };
    }


    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    
    if (!currentSession) {
      return {
        maxForms: 0,
        maxDashboards: 0,
        maxUsers: 0,
        maxTokens: 0
      };
    }

    const packageLimits = PACKAGE_LIMITS[currentSession.packageType];
    
    // Safety check: if package type doesn't exist, return default limits
    if (!packageLimits) {
      return {
        maxForms: 0,
        maxDashboards: 0,
        maxUsers: 0,
        maxTokens: 0
      };
    }
    
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
   * Note: Only directors and employees with director access have subscription sessions
   */
  static hasFeature(user: User, feature: string): boolean {
    // Only directors and employees with director access can have package features
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    
    if (!currentSession) {
      return false;
    }

    const packageFeatures = PACKAGE_FEATURES[currentSession.packageType];
    
    // Safety check: if package type doesn't exist, return false
    if (!packageFeatures) {
      return false;
    }
    
    return (packageFeatures as any)[feature] === true;
  }

  /**
   * Check if user has access to programmed instructions
   * Note: Only directors can access programmed instructions
   */
  static hasProgrammedInstructionsAccess(user: User): boolean {
    // Only directors can access programmed instructions
    if (user.role !== 'directeur') {
      return false;
    }

    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    
    if (!currentSession) {
      return false;
    }

    const packageLimits = PACKAGE_LIMITS[currentSession.packageType];
    
    if (!packageLimits) {
      return false;
    }

    return packageLimits.programmedInstructions === true;
  }

  /**
   * Check if user has access to automated push indicators
   * Note: Directors and employees with director access can use push indicators
   */
  static hasPushIndicatorsAccess(user: User): boolean {
    // Directors and employees with director access can use push indicators
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    
    if (!currentSession) {
      return false;
    }

    const packageLimits = PACKAGE_LIMITS[currentSession.packageType];
    
    if (!packageLimits) {
      return false;
    }

    return packageLimits.automatedPushIndicators === true;
  }

  /**
   * Check if user/package can use file uploads in forms (images/PDF)
   * Directors and employees with director access inherit director's package
   */
  static canUseFileUploads(user: User): boolean {
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // For directors, get their own session
    if (user.role === 'directeur') {
      // Use sync version for backward compatibility (this method is synchronous)
      const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
      if (!currentSession) {
        return false;
      }
      const features = PACKAGE_FEATURES[currentSession.packageType];
      return !!features && (features as any).allowFileUploads === true;
    }

    // For employees with director access, check if they have legacy package info
    // This indicates they inherit the director's package permissions
    if (user.role === 'employe' && user.hasDirectorDashboardAccess) {
      // Check legacy package field first (fallback for employees with director access)
      if (user.package && ['starter', 'standard', 'premium'].includes(user.package)) {
        const features = PACKAGE_FEATURES[user.package as PackageType];
        return !!features && (features as any).allowFileUploads === true;
      }

      // If no legacy package info, check if they have their own subscription session
      // Use sync version for backward compatibility (this method is synchronous)
      const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
      if (currentSession) {
        const features = PACKAGE_FEATURES[currentSession.packageType];
        return !!features && (features as any).allowFileUploads === true;
      }

      // If no session found, assume they inherit director's permissions
      // This is a fallback - in practice, employees with director access should have
      // either legacy package info or their own session
      return true; // Allow file uploads as they inherit director's permissions
    }

    return false;
  }

  /**
   * Check if user can perform an action based on limits
   * Note: Only directors and employees with director access have subscription sessions
   */
  static canPerformAction(user: User, action: 'createForm' | 'createDashboard' | 'addUser' | 'useTokens', currentCount: number): boolean {
    // Allow directors and employees with director access
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    
    if (!currentSession) {
      return false;
    }

    const limits = this.getPackageLimits(user);
    
    switch (action) {
      case 'createForm':
        // Handle unlimited case (-1)
        return limits.maxForms === -1 || currentCount < limits.maxForms;
      case 'createDashboard':
        // Handle unlimited case (-1)
        return limits.maxDashboards === -1 || currentCount < limits.maxDashboards;
      case 'addUser':
        // Handle unlimited case (-1)
        return limits.maxUsers === -1 || currentCount < limits.maxUsers;
      case 'useTokens':
        // Handle unlimited case (-1)
        return limits.maxTokens === -1 || currentCount < limits.maxTokens;
      default:
        return false;
    }
  }

  /**
   * Get total pay-as-you-go tokens from active session
   * Note: Only directors and employees with director access have subscription sessions
   */
  static getTotalPayAsYouGoTokens(user: User): number {
    // Only directors and employees with director access have subscription sessions
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return 0;
    }

    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    
    if (!currentSession) {
      return 0;
    }

    return currentSession.payAsYouGoResources?.tokens || 0;
  }

  /**
   * Get total available tokens (package + pay-as-you-go)
   * Note: Only directors and employees with director access have subscription sessions
   */
  static getTotalAvailableTokens(user: User): number {
    // Only directors and employees with director access have subscription sessions
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return 0;
    }

    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
    
    if (!currentSession) {
      return 0;
    }

    const packageTokens = currentSession.packageResources?.tokensIncluded || 0;
    const payAsYouGoTokens = currentSession.payAsYouGoResources?.tokens || 0;
    
    return packageTokens + payAsYouGoTokens;
  }

  /**
   * Get subscription history (async version - uses new collection)
   * Note: Only directors and employees with director access have subscription sessions
   */
  static async getSubscriptionHistory(user: User) {
    // Only directors and employees with director access have subscription sessions
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return {
        currentSession: null,
        allSessions: [],
        totalSessions: 0
      };
    }

    // Try new collection service first
    const sessions = await SubscriptionSessionCollectionService.getUserSessions(user.id);
    
    // If no sessions in collection, fallback to legacy
    const sessionsToUse = sessions.length > 0 ? sessions : (user.subscriptionSessions || []);
    
    const currentSession = sessionsToUse.find(s => s.isActive) || null;
    
    return {
      currentSession,
      allSessions: sessionsToUse,
      totalSessions: sessionsToUse.length
    };
  }

  /**
   * Get subscription history (sync version - for backward compatibility)
   * @deprecated Use getSubscriptionHistory() async version instead
   */
  static getSubscriptionHistorySync(user: User) {
    // Only directors and employees with director access have subscription sessions
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
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
   * Note: Only directors and employees with director access have subscription sessions
   */
  static needsPackageSelection(user: User): boolean {
    // Only directors and employees with director access have subscription sessions
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // Use sync version for backward compatibility (this method is synchronous)
    const currentSession = SubscriptionSessionService.getCurrentSessionSync(user);
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