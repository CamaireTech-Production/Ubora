import { User } from '../types';
import { SubscriptionSessionCollectionService } from './subscriptionSessionCollectionService';
import { PACKAGE_FEATURES, PackageType } from '../config/packageFeatures';
import { FeatureAccessService } from './featureAccessService';

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

    const currentSession = await SubscriptionSessionCollectionService.getActiveSession(user.id);
    
    if (!currentSession) {
      return this.getDefaultPackageInfo();
    }

    const sessionPackageType = this.normalizePackageType(currentSession.packageType);
    const packageFeatures = sessionPackageType ? this.getPackageFeatures(sessionPackageType) : [];
    
    const startDate = this.convertToDate(currentSession.startDate);
    const endDate = this.convertToDate(currentSession.endDate);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const subscriptionStatus: 'active' | 'expired' | 'cancelled' =
      currentSession.isActive && daysRemaining > 0 ? 'active' : 'expired';
    
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
    const packageInfo = {
      packageType: sessionPackageType,
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
    return packageInfo;
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
      
      // Get the director's package info (async)
      return await this.getUserPackageInfo(directorData);
      
    } catch (error) {
      console.error('Error getting director package info for employee:', error);
      return this.getDefaultPackageInfo();
    }
  }

  /**
   * Get package limits from active session
   * Note: Only directors and employees with director access have subscription sessions
   * This method uses getUserPackageInfo() to ensure consistency with session document structure
   */
  static async getPackageLimits(user: User) {
    console.log('🟣 [GET PACKAGE LIMITS] ========================================');
    console.log('🟣 [GET PACKAGE LIMITS] Getting package limits for user:', {
      id: user.id,
      role: user.role,
      hasDirectorDashboardAccess: user.hasDirectorDashboardAccess
    });
    
    // Only directors and employees with director access can have package limits
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      console.log('🟣 [GET PACKAGE LIMITS] ❌ User role does not allow package limits');
      return {
        maxForms: 0,
        maxDashboards: 0,
        maxUsers: 0,
        maxTokens: 0
      };
    }

    // Use getUserPackageInfo() to get limits from session document structure
    // This ensures we use packageResources + payAsYouGoResources from the session
    const packageInfo = await this.getUserPackageInfo(user);
    
    if (!packageInfo || packageInfo.packageType === null) {
      console.log('🟣 [GET PACKAGE LIMITS] ❌ No package info found - returning zero limits');
      return {
        maxForms: 0,
        maxDashboards: 0,
        maxUsers: 0,
        maxTokens: 0
      };
    }
    
    console.log('🟣 [GET PACKAGE LIMITS] Package info found:', {
      packageType: packageInfo.packageType,
      totalForms: packageInfo.totalForms,
      totalDashboards: packageInfo.totalDashboards,
      totalUsers: packageInfo.totalUsers,
      totalTokens: packageInfo.totalTokens
    });

    // Extract limits from package info
    // totalForms, totalDashboards, totalUsers, totalTokens already include packageResources + payAsYouGoResources
    const finalLimits = {
      maxForms: packageInfo.totalForms === -1 ? -1 : packageInfo.totalForms,
      maxDashboards: packageInfo.totalDashboards === -1 ? -1 : packageInfo.totalDashboards,
      maxUsers: packageInfo.totalUsers === -1 ? -1 : packageInfo.totalUsers,
      maxTokens: packageInfo.totalTokens === -1 ? -1 : packageInfo.totalTokens
    };
    
    console.log('🟣 [GET PACKAGE LIMITS] Final calculated limits (from session document):', finalLimits);
    console.log('🟣 [GET PACKAGE LIMITS] ========================================');
    
    return finalLimits;
  }

  /**
   * Check if user has a specific feature
   * Note: Only directors and employees with director access have subscription sessions
   * This is a synchronous method that uses package info if available, otherwise returns false
   * For accurate results, use getUserPackageInfo() async method
   */
  static hasFeature(user: User, _feature: string): boolean {
    // Only directors and employees with director access can have package features
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // Since this is called synchronously, we can't fetch from collection
    // Return false - callers should use getUserPackageInfo() for accurate results
    // This is a temporary workaround until all callers are updated
    return false;
  }

  /**
   * Check if user has access to programmed instructions
   * Note: Only directors can access programmed instructions
   * This is a synchronous method - for accurate results, use getUserPackageInfo() async method
   */
  static hasProgrammedInstructionsAccess(user: User): boolean {
    // Only directors can access programmed instructions
    if (user.role !== 'directeur') {
      return false;
    }

    // Since this is called synchronously, we can't fetch from collection
    // Return false - callers should use getUserPackageInfo() for accurate results
    // This is a temporary workaround until all callers are updated
    return false;
  }

  /**
   * Check if user has access to automated push indicators
   * Note: Directors and employees with director access can use push indicators
   * This is a synchronous method - for accurate results, use getUserPackageInfo() async method
   */
  static hasPushIndicatorsAccess(user: User): boolean {
    // Directors and employees with director access can use push indicators
    if (user.role !== 'directeur' && !(user.role === 'employe' && user.hasDirectorDashboardAccess)) {
      return false;
    }

    // Since this is called synchronously, we can't fetch from collection
    // Return false - callers should use getUserPackageInfo() for accurate results
    // This is a temporary workaround until all callers are updated
    return false;
  }

  /**
   * Check if user/package can use file uploads in forms (images/PDF)
   * Directors and employees with director access inherit director's package
   * 
   * NOTE: Cette méthode est synchrone pour compatibilité. Pour avoir les détails
   * (read/write), utilisez FeatureAccessService.canUseFileUploadsAsync()
   */
  static canUseFileUploads(user: User): boolean {
    // Utiliser le nouveau service pour la vérification de base
    return FeatureAccessService.canUseFileUploads(user);
  }

  /**
   * Check file upload access with detailed information (async)
   * Returns FeatureAccess with canRead/canWrite flags
   */
  static async canUseFileUploadsAsync(
    user: User,
    activeUniversId?: string | null
  ): Promise<{ canRead: boolean; canWrite: boolean; source: string }> {
    const access = await FeatureAccessService.canUseFileUploadsAsync(user, activeUniversId);
    return {
      canRead: access.canRead,
      canWrite: access.canWrite,
      source: access.source
    };
  }

  /**
   * Check if user can perform an action based on limits
   * Note: Only directors and employees with director access have subscription sessions
   */
  // Deprecated synchronous helper methods have been removed in favor of async package info lookups.

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
    return !user.currentSubscriptionSessionId;
  }

  private static normalizePackageType(packageType?: string | null): PackageType | null {
    if (!packageType) {
      return null;
    }
    if (packageType === 'free' || packageType === 'starter' || packageType === 'standard') {
      return packageType;
    }
    if (packageType === 'premium') {
      // Legacy premium maps to standard limits/features
      return 'standard';
    }
    return null;
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