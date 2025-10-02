import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { 
  AdminUser, 
  UserDetail, 
  PushNotificationLog, 
  AppUsageSession, 
  ActivityLog,
  SubscriptionSession,
  PurchaseHistory
} from '../../types';
import { ActivityLogService } from '../../services/activityLogService';

export class EnhancedAdminService {
  private static readonly USERS_COLLECTION = 'users';
  private static readonly ACTIVITY_LOGS_COLLECTION = 'activityLogs';
  private static readonly PUSH_NOTIFICATIONS_COLLECTION = 'pushNotifications';
  private static readonly APP_USAGE_SESSIONS_COLLECTION = 'appUsageSessions';
  private static readonly SUBSCRIPTION_SESSIONS_COLLECTION = 'subscriptionSessions';
  private static readonly PURCHASE_HISTORY_COLLECTION = 'purchaseHistory';

  /**
   * Get all users with enhanced information
   */
  static async getAllUsersWithDetails(): Promise<AdminUser[]> {
    try {
      const snapshot = await getDocs(collection(db, this.USERS_COLLECTION));
      const users: AdminUser[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const userId = docSnapshot.id;

        // Get additional data for each user
        const [activityStats, pushStats, usageStats] = await Promise.all([
          this.getUserActivityStats(userId),
          this.getUserPushNotificationStats(userId),
          this.getUserAppUsageStats(userId)
        ]);

        const user: AdminUser = {
          id: userId,
          name: data.name,
          email: data.email,
          role: data.role,
          agencyId: data.agencyId,
          agencyName: data.agencyName,
          isActive: data.isActive !== false,
          lastLogin: data.lastLogin?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          package: data.package,
          subscriptionStatus: data.subscriptionStatus,
          tokensUsed: data.tokensUsedMonthly || 0,
          totalSubmissions: data.totalSubmissions || 0,
          // Enhanced subscription info
          subscriptionStartDate: data.subscriptionStartDate?.toDate(),
          subscriptionEndDate: data.subscriptionEndDate?.toDate(),
          nextPaymentDate: this.calculateNextPaymentDate(data.subscriptionEndDate?.toDate()),
          packageFeatures: data.packageFeatures || [],
          // Activity tracking
          totalLoginCount: activityStats.totalLogins,
          lastActivityDate: activityStats.lastActivity,
          // App usage
          totalAppUsageTime: usageStats.totalUsageTime,
          averageSessionDuration: usageStats.averageSessionDuration,
          // Push notifications
          pushNotificationsSent: pushStats.totalSent,
          pushNotificationsClicked: pushStats.totalClicked
        };

        users.push(user);
      }

      return users;
    } catch (error) {
      console.error('❌ Error fetching users with details:', error);
      return [];
    }
  }

  /**
   * Get detailed information for a specific user
   */
  static async getUserDetail(userId: string): Promise<UserDetail | null> {
    try {
      const userDoc = await getDoc(doc(db, this.USERS_COLLECTION, userId));
      
      if (!userDoc.exists()) {
        return null;
      }

      const data = userDoc.data();

      // Get comprehensive data for the user
      const [activityStats, pushStats, usageStats, recentActivities, subscriptionSessions, purchaseHistory, appUsageSessions, pushNotifications] = await Promise.all([
        this.getUserActivityStats(userId),
        this.getUserPushNotificationStats(userId),
        this.getUserAppUsageStats(userId),
        ActivityLogService.getActivitiesByUser(userId, 20),
        this.getUserSubscriptionSessions(userId),
        this.getUserPurchaseHistory(userId),
        this.getUserAppUsageSessions(userId),
        this.getUserPushNotifications(userId)
      ]);

      const userDetail: UserDetail = {
        id: userId,
        name: data.name,
        email: data.email,
        role: data.role,
        agencyId: data.agencyId,
        agencyName: data.agencyName,
        isActive: data.isActive !== false,
        lastLogin: data.lastLogin?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        // Subscription details
        package: data.package,
        subscriptionStatus: data.subscriptionStatus,
        subscriptionStartDate: data.subscriptionStartDate?.toDate(),
        subscriptionEndDate: data.subscriptionEndDate?.toDate(),
        nextPaymentDate: this.calculateNextPaymentDate(data.subscriptionEndDate?.toDate()),
        packageFeatures: data.packageFeatures || [],
        tokensUsedMonthly: data.tokensUsedMonthly || 0,
        tokensResetDate: data.tokensResetDate?.toDate(),
        // Activity summary
        totalLoginCount: activityStats.totalLogins,
        lastActivityDate: activityStats.lastActivity,
        totalFormSubmissions: activityStats.totalFormSubmissions,
        totalChatInteractions: activityStats.totalChatInteractions,
        // App usage
        totalAppUsageTime: usageStats.totalUsageTime,
        averageSessionDuration: usageStats.averageSessionDuration,
        longestSession: usageStats.longestSession,
        // Push notifications
        pushNotificationsSent: pushStats.totalSent,
        pushNotificationsClicked: pushStats.totalClicked,
        pushNotificationClickRate: pushStats.clickRate,
        // Recent activities
        recentActivities: recentActivities,
        // Subscription sessions
        subscriptionSessions: subscriptionSessions,
        // Purchase history
        purchaseHistory: purchaseHistory,
        // App usage sessions
        appUsageSessions: appUsageSessions,
        // Push notifications
        pushNotifications: pushNotifications
      };

      return userDetail;
    } catch (error) {
      console.error('❌ Error fetching user detail:', error);
      return null;
    }
  }

  /**
   * Get user activity statistics
   */
  private static async getUserActivityStats(userId: string): Promise<{
    totalLogins: number;
    lastActivity: Date | null;
    totalFormSubmissions: number;
    totalChatInteractions: number;
  }> {
    try {
      const activities = await ActivityLogService.getActivitiesByUser(userId, 1000);
      
      const stats = {
        totalLogins: activities.filter(a => a.type === 'user_login').length,
        lastActivity: activities.length > 0 ? activities[0].timestamp?.toDate() || null : null,
        totalFormSubmissions: activities.filter(a => a.type === 'form_submission').length,
        totalChatInteractions: activities.filter(a => a.type === 'chat_activity').length
      };

      return stats;
    } catch (error) {
      console.error('❌ Error fetching user activity stats:', error);
      // Return default values if there's an error (e.g., no data yet)
      return {
        totalLogins: 0,
        lastActivity: null,
        totalFormSubmissions: 0,
        totalChatInteractions: 0
      };
    }
  }

  /**
   * Get user push notification statistics
   */
  private static async getUserPushNotificationStats(userId: string): Promise<{
    totalSent: number;
    totalClicked: number;
    clickRate: number;
  }> {
    try {
      const q = query(
        collection(db, this.PUSH_NOTIFICATIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('sentAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PushNotificationLog));

      const totalSent = notifications.length;
      const totalClicked = notifications.filter(n => n.isClicked).length;
      const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

      return {
        totalSent,
        totalClicked,
        clickRate: Math.round(clickRate * 100) / 100
      };
    } catch (error) {
      console.error('❌ Error fetching push notification stats:', error);
      // Return default values if there's an error (e.g., no data yet)
      return {
        totalSent: 0,
        totalClicked: 0,
        clickRate: 0
      };
    }
  }

  /**
   * Get user app usage statistics
   */
  private static async getUserAppUsageStats(userId: string): Promise<{
    totalUsageTime: number;
    averageSessionDuration: number;
    longestSession: number;
  }> {
    try {
      const q = query(
        collection(db, this.APP_USAGE_SESSIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('sessionStart', 'desc')
      );

      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AppUsageSession));

      const totalUsageTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      const averageSessionDuration = sessions.length > 0 ? totalUsageTime / sessions.length : 0;
      const longestSession = sessions.length > 0 ? Math.max(...sessions.map(s => s.duration || 0)) : 0;

      return {
        totalUsageTime,
        averageSessionDuration: Math.round(averageSessionDuration * 100) / 100,
        longestSession
      };
    } catch (error) {
      console.error('❌ Error fetching app usage stats:', error);
      // Return default values if there's an error (e.g., no data yet)
      return {
        totalUsageTime: 0,
        averageSessionDuration: 0,
        longestSession: 0
      };
    }
  }

  /**
   * Get user subscription sessions
   */
  private static async getUserSubscriptionSessions(userId: string): Promise<SubscriptionSession[]> {
    try {
      const q = query(
        collection(db, this.SUBSCRIPTION_SESSIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('startDate', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SubscriptionSession));
    } catch (error) {
      console.error('❌ Error fetching subscription sessions:', error);
      return [];
    }
  }

  /**
   * Get user purchase history
   */
  private static async getUserPurchaseHistory(userId: string): Promise<PurchaseHistory[]> {
    try {
      const q = query(
        collection(db, this.PURCHASE_HISTORY_COLLECTION),
        where('userId', '==', userId),
        orderBy('purchaseDate', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PurchaseHistory));
    } catch (error) {
      console.error('❌ Error fetching purchase history:', error);
      return [];
    }
  }

  /**
   * Get user app usage sessions
   */
  private static async getUserAppUsageSessions(userId: string): Promise<AppUsageSession[]> {
    try {
      const q = query(
        collection(db, this.APP_USAGE_SESSIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('sessionStart', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AppUsageSession));
    } catch (error) {
      console.error('❌ Error fetching app usage sessions:', error);
      return [];
    }
  }

  /**
   * Get user push notifications
   */
  private static async getUserPushNotifications(userId: string): Promise<PushNotificationLog[]> {
    try {
      const q = query(
        collection(db, this.PUSH_NOTIFICATIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('sentAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PushNotificationLog));
    } catch (error) {
      console.error('❌ Error fetching push notifications:', error);
      return [];
    }
  }

  /**
   * Get all push notifications with statistics
   */
  static async getAllPushNotifications(): Promise<PushNotificationLog[]> {
    try {
      const q = query(
        collection(db, this.PUSH_NOTIFICATIONS_COLLECTION),
        orderBy('sentAt', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PushNotificationLog));
    } catch (error) {
      console.error('❌ Error fetching push notifications:', error);
      return [];
    }
  }

  /**
   * Get push notification statistics
   */
  static async getPushNotificationStats(): Promise<{
    totalSent: number;
    totalClicked: number;
    overallClickRate: number;
    byType: Record<string, { sent: number; clicked: number; rate: number }>;
  }> {
    try {
      const notifications = await this.getAllPushNotifications();
      
      const totalSent = notifications.length;
      const totalClicked = notifications.filter(n => n.isClicked).length;
      const overallClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

      // Group by type
      const byType: Record<string, { sent: number; clicked: number; rate: number }> = {};
      notifications.forEach(notification => {
        if (!byType[notification.type]) {
          byType[notification.type] = { sent: 0, clicked: 0, rate: 0 };
        }
        byType[notification.type].sent++;
        if (notification.isClicked) {
          byType[notification.type].clicked++;
        }
      });

      // Calculate rates
      Object.keys(byType).forEach(type => {
        const stats = byType[type];
        stats.rate = stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0;
        stats.rate = Math.round(stats.rate * 100) / 100;
      });

      return {
        totalSent,
        totalClicked,
        overallClickRate: Math.round(overallClickRate * 100) / 100,
        byType
      };
    } catch (error) {
      console.error('❌ Error fetching push notification stats:', error);
      return {
        totalSent: 0,
        totalClicked: 0,
        overallClickRate: 0,
        byType: {}
      };
    }
  }

  /**
   * Get app usage statistics
   */
  static async getAppUsageStats(): Promise<{
    totalSessions: number;
    totalUsageTime: number;
    averageSessionDuration: number;
    activeUsers: number;
    byUser: Array<{
      userId: string;
      userName: string;
      totalTime: number;
      sessionCount: number;
    }>;
  }> {
    try {
      const q = query(
        collection(db, this.APP_USAGE_SESSIONS_COLLECTION),
        orderBy('sessionStart', 'desc')
      );

      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AppUsageSession));

      const totalSessions = sessions.length;
      const totalUsageTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      const averageSessionDuration = totalSessions > 0 ? totalUsageTime / totalSessions : 0;
      const activeUsers = new Set(sessions.map(s => s.userId)).size;

      // Group by user
      const userStats: Record<string, { userName: string; totalTime: number; sessionCount: number }> = {};
      sessions.forEach(session => {
        if (!userStats[session.userId]) {
          userStats[session.userId] = {
            userName: session.userName,
            totalTime: 0,
            sessionCount: 0
          };
        }
        userStats[session.userId].totalTime += session.duration || 0;
        userStats[session.userId].sessionCount++;
      });

      const byUser = Object.entries(userStats).map(([userId, stats]) => ({
        userId,
        ...stats
      })).sort((a, b) => b.totalTime - a.totalTime);

      return {
        totalSessions,
        totalUsageTime,
        averageSessionDuration: Math.round(averageSessionDuration * 100) / 100,
        activeUsers,
        byUser
      };
    } catch (error) {
      console.error('❌ Error fetching app usage stats:', error);
      return {
        totalSessions: 0,
        totalUsageTime: 0,
        averageSessionDuration: 0,
        activeUsers: 0,
        byUser: []
      };
    }
  }

  /**
   * Calculate next payment date
   */
  private static calculateNextPaymentDate(subscriptionEndDate?: Date): Date | undefined {
    if (!subscriptionEndDate) return undefined;
    
    // Add 30 days to subscription end date for next payment
    const nextPayment = new Date(subscriptionEndDate);
    nextPayment.setDate(nextPayment.getDate() + 30);
    return nextPayment;
  }

  /**
   * Format time duration in minutes to human readable format
   */
  static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else if (minutes < 1440) { // Less than 24 hours
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      return `${hours}h ${remainingMinutes}min`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      return `${days}j ${remainingHours}h`;
    }
  }

  /**
   * Get subscription status color
   */
  static getSubscriptionStatusColor(status?: string): string {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'expired':
        return 'text-red-600 bg-red-50';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
    }
  }

  /**
   * Get days until payment due
   */
  static getDaysUntilPayment(nextPaymentDate?: Date): number | null {
    if (!nextPaymentDate) return null;
    
    const now = new Date();
    const diffTime = nextPaymentDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Get activity summary (placeholder - should be implemented based on your needs)
   */
  static async getActivitySummary(): Promise<any[]> {
    try {
      // This is a placeholder implementation
      // You should implement this based on your specific needs
      return [];
    } catch (error) {
      console.error('❌ Error fetching activity summary:', error);
      return [];
    }
  }

  /**
   * Get system health (placeholder - should be implemented based on your needs)
   */
  static async getSystemHealth(): Promise<any> {
    try {
      // This is a placeholder implementation
      // You should implement this based on your specific needs
      return {
        status: 'healthy',
        services: {
          database: 'up',
          authentication: 'up',
          storage: 'up',
          analytics: 'up'
        },
        metrics: {
          responseTime: 100,
          uptime: 99.9,
          errorRate: 0.1,
          activeConnections: 0
        },
        lastChecked: new Date()
      };
    } catch (error) {
      console.error('❌ Error fetching system health:', error);
      return {
        status: 'critical',
        services: {
          database: 'down',
          authentication: 'down',
          storage: 'down',
          analytics: 'down'
        },
        metrics: {
          responseTime: 0,
          uptime: 0,
          errorRate: 100,
          activeConnections: 0
        },
        lastChecked: new Date()
      };
    }
  }
}
