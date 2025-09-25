import { 
  logEvent, 
  setUserId, 
  setUserProperties, 
  Analytics
} from 'firebase/analytics';
import { analytics } from '../firebaseConfig';

// Firebase Analytics Reporting API types
interface AnalyticsData {
  users: number;
  sessions: number;
  pageViews: number;
  events: number;
  averageSessionDuration: number;
  bounceRate: number;
  newUsers: number;
  returningUsers: number;
  userEngagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
  };
  topEvents: Array<{
    eventName: string;
    count: number;
    uniqueUsers: number;
  }>;
  topPages: Array<{
    page: string;
    views: number;
    uniqueViews: number;
    averageTime: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    users: number;
    percentage: number;
  }>;
  browserBreakdown: Array<{
    browser: string;
    users: number;
    percentage: number;
  }>;
  geographicData: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
  conversionRates: {
    registrationToLogin: number;
    loginToFormCreation: number;
    formCreationToSubmission: number;
  };
}

export class FirebaseAnalyticsService {
  private static analytics: Analytics | null = null;
  private static isInitialized = false;

  static async initialize(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && !this.isInitialized) {
        this.analytics = await analytics;
        if (this.analytics) {
          console.log('✅ Firebase Analytics initialized');
          this.isInitialized = true;
        }
      }
    } catch (error) {
      console.error('❌ Error initializing Firebase Analytics:', error);
    }
  }

  static async logCustomEvent(
    eventName: string,
    parameters?: {
      [key: string]: any;
    }
  ): Promise<void> {
    try {
      await this.initialize();
      if (this.analytics) {
        await logEvent(this.analytics, eventName, parameters);
        console.log(`📊 Analytics event logged: ${eventName}`, parameters);
      }
    } catch (error) {
      console.error('❌ Error logging analytics event:', error);
    }
  }

  static async setUser(userId: string, properties?: { [key: string]: any }): Promise<void> {
    try {
      await this.initialize();
      if (this.analytics) {
        await setUserId(this.analytics, userId);
        if (properties) {
          await setUserProperties(this.analytics, properties);
        }
        console.log(`👤 Analytics user set: ${userId}`, properties);
      }
    } catch (error) {
      console.error('❌ Error setting analytics user:', error);
    }
  }

  // Predefined event logging methods
  static async logUserRegistration(userId: string, userRole: string, agencyId?: string): Promise<void> {
    await this.logCustomEvent('user_registration', {
      user_id: userId,
      user_role: userRole,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  static async logUserLogin(userId: string, userRole: string, agencyId?: string): Promise<void> {
    await this.logCustomEvent('user_login', {
      user_id: userId,
      user_role: userRole,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  static async logFormCreation(userId: string, formId: string, formTitle: string, agencyId?: string): Promise<void> {
    await this.logCustomEvent('form_creation', {
      user_id: userId,
      form_id: formId,
      form_title: formTitle,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  static async logFormSubmission(userId: string, formId: string, formTitle: string, agencyId?: string): Promise<void> {
    await this.logCustomEvent('form_submission', {
      user_id: userId,
      form_id: formId,
      form_title: formTitle,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  static async logChatActivity(userId: string, tokensUsed: number, agencyId?: string): Promise<void> {
    await this.logCustomEvent('chat_activity', {
      user_id: userId,
      tokens_used: tokensUsed,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  static async logPackageSelection(userId: string, packageType: string, agencyId?: string): Promise<void> {
    await this.logCustomEvent('package_selection', {
      user_id: userId,
      package_type: packageType,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  static async logTokenPurchase(userId: string, tokensPurchased: number, amount: number, agencyId?: string): Promise<void> {
    await this.logCustomEvent('token_purchase', {
      user_id: userId,
      tokens_purchased: tokensPurchased,
      amount: amount,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  static async logAdminActivity(adminId: string, action: string, targetId?: string, agencyId?: string): Promise<void> {
    await this.logCustomEvent('admin_activity', {
      admin_id: adminId,
      action: action,
      target_id: targetId,
      agency_id: agencyId,
      timestamp: Date.now()
    });
  }

  // Real Analytics Data Fetching Methods
  static async getRealAnalyticsData(timeRange: 'day' | 'week' | 'month' | 'year' = 'week'): Promise<AnalyticsData> {
    try {
      // Import your existing services for real data
      const { EnhancedAdminService } = await import('../admin/services/enhancedAdminService');
      const { ActivityLogService } = await import('./activityLogService');
      
      // Get real data from your existing services
      const [usersData, usageStats, activitiesData] = await Promise.all([
        EnhancedAdminService.getAllUsersWithDetails().catch(() => []),
        EnhancedAdminService.getAppUsageStats().catch(() => ({ totalSessions: 0, averageSessionDuration: 0 })),
        ActivityLogService.getRecentActivities(1000).catch(() => [])
      ]);

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      // Filter activities by time range
      const filteredActivities = activitiesData.filter(activity => 
        new Date(activity.timestamp) > startDate
      );

      // Calculate real metrics
      const totalUsers = usersData.length;
      const totalSessions = usageStats.totalSessions;
      const totalEvents = filteredActivities.length;
      const averageSessionDuration = usageStats.averageSessionDuration;

      // Calculate user engagement from real data
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyActiveUsers = filteredActivities
        .filter(activity => activity.userId && new Date(activity.timestamp) > oneDayAgo)
        .reduce((unique, activity) => {
          if (activity.userId && !unique.includes(activity.userId)) unique.push(activity.userId);
          return unique;
        }, [] as string[]).length;

      const weeklyActiveUsers = filteredActivities
        .filter(activity => activity.userId && new Date(activity.timestamp) > oneWeekAgo)
        .reduce((unique, activity) => {
          if (activity.userId && !unique.includes(activity.userId)) unique.push(activity.userId);
          return unique;
        }, [] as string[]).length;

      const monthlyActiveUsers = filteredActivities
        .filter(activity => activity.userId && new Date(activity.timestamp) > oneMonthAgo)
        .reduce((unique, activity) => {
          if (activity.userId && !unique.includes(activity.userId)) unique.push(activity.userId);
          return unique;
        }, [] as string[]).length;

      // Calculate new vs returning users from real data
      const recentUsers = usersData.filter(user => 
        user.createdAt && new Date(user.createdAt) > startDate
      );
      const newUsers = recentUsers.length;
      const returningUsers = totalUsers - newUsers;

      // Analyze top events from real activity logs
      const eventCounts: Record<string, { count: number; users: Set<string> }> = {};
      filteredActivities.forEach(activity => {
        if (activity.type && activity.userId) {
          if (!eventCounts[activity.type]) {
            eventCounts[activity.type] = { count: 0, users: new Set() };
          }
          eventCounts[activity.type].count++;
          eventCounts[activity.type].users.add(activity.userId);
        }
      });

      const topEvents = Object.entries(eventCounts)
        .map(([eventName, data]) => ({ 
          eventName, 
          count: data.count, 
          uniqueUsers: data.users.size 
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate conversion rates from real data
      const registrationEvents = filteredActivities.filter(a => a.type === 'user_registration').length;
      const loginEvents = filteredActivities.filter(a => a.type === 'user_login').length;
      const formCreationEvents = filteredActivities.filter(a => a.type === 'form_creation').length;
      const formSubmissionEvents = filteredActivities.filter(a => a.type === 'form_submission').length;

      const conversionRates = {
        registrationToLogin: registrationEvents > 0 ? loginEvents / registrationEvents : 0,
        loginToFormCreation: loginEvents > 0 ? formCreationEvents / loginEvents : 0,
        formCreationToSubmission: formCreationEvents > 0 ? formSubmissionEvents / formCreationEvents : 0
      };

      // Get real page views from activity logs (simplified)
      const pageViews: Record<string, { views: number; users: Set<string>; totalTime: number }> = {};
      filteredActivities.forEach(activity => {
        const page = activity.metadata?.page || '/unknown';
        if (!pageViews[page]) {
          pageViews[page] = { views: 0, users: new Set(), totalTime: 0 };
        }
        pageViews[page].views++;
        pageViews[page].users.add(activity.userId);
        // Estimate time based on activity type
        pageViews[page].totalTime += activity.type === 'form_submission' ? 300 : 60; // seconds
      });

      const topPages = Object.entries(pageViews)
        .map(([page, data]) => ({
          page,
          views: data.views,
          uniqueViews: data.users.size,
          averageTime: data.views > 0 ? Math.round(data.totalTime / data.views) : 0
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Calculate bounce rate (simplified - users with only one activity)
      const userActivityCounts: Record<string, number> = {};
      filteredActivities.forEach(activity => {
        userActivityCounts[activity.userId] = (userActivityCounts[activity.userId] || 0) + 1;
      });
      const bouncedUsers = Object.values(userActivityCounts).filter(count => count === 1).length;
      const bounceRate = totalUsers > 0 ? bouncedUsers / totalUsers : 0;

      // Get device/browser data from user agents (if available in activity logs)
      const deviceBreakdown = this.calculateDeviceBreakdown(filteredActivities);
      const browserBreakdown = this.calculateBrowserBreakdown(filteredActivities);
      const geographicData = this.calculateGeographicData(usersData);

      return {
        users: totalUsers,
        sessions: totalSessions,
        pageViews: Object.values(pageViews).reduce((sum, data) => sum + data.views, 0),
        events: totalEvents,
        averageSessionDuration,
        bounceRate,
        newUsers,
        returningUsers,
        userEngagement: {
          dailyActiveUsers,
          weeklyActiveUsers,
          monthlyActiveUsers
        },
        topEvents,
        topPages,
        deviceBreakdown,
        browserBreakdown,
        geographicData,
        conversionRates
      };
    } catch (error) {
      console.error('❌ Error fetching real analytics data:', error);
      // Return empty data structure on error
      return {
        users: 0,
        sessions: 0,
        pageViews: 0,
        events: 0,
        averageSessionDuration: 0,
        bounceRate: 0,
        newUsers: 0,
        returningUsers: 0,
        userEngagement: {
          dailyActiveUsers: 0,
          weeklyActiveUsers: 0,
          monthlyActiveUsers: 0
        },
        topEvents: [],
        topPages: [],
        deviceBreakdown: [],
        browserBreakdown: [],
        geographicData: [],
        conversionRates: {
          registrationToLogin: 0,
          loginToFormCreation: 0,
          formCreationToSubmission: 0
        }
      };
    }
  }

  // Helper methods to calculate device/browser/geographic data from real data
  private static calculateDeviceBreakdown(_activities: any[]): Array<{ device: string; users: number; percentage: number }> {
    // This would need user agent data from your activity logs
    // For now, return empty array - you can enhance this based on your data structure
    return [];
  }

  private static calculateBrowserBreakdown(_activities: any[]): Array<{ browser: string; users: number; percentage: number }> {
    // This would need user agent data from your activity logs
    // For now, return empty array - you can enhance this based on your data structure
    return [];
  }

  private static calculateGeographicData(_usersData: any[]): Array<{ country: string; users: number; percentage: number }> {
    // This would need geographic data from your user records
    // For now, return empty array - you can enhance this based on your data structure
    return [];
  }

  // Get analytics trends over time
  static async getAnalyticsTrends(timeRange: 'day' | 'week' | 'month' | 'year' = 'week'): Promise<Array<{
    date: string;
    users: number;
    sessions: number;
    events: number;
  }>> {
    try {
      const { ActivityLogService } = await import('./activityLogService');
      
      const now = new Date();
      let startDate: Date;
      let days: number;
      
      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          days = 1;
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          days = 7;
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          days = 30;
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          days = 365;
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          days = 7;
      }

      const activities = await ActivityLogService.getRecentActivities(1000);
      const filteredActivities = activities.filter(activity => 
        new Date(activity.timestamp) > startDate
      );

      const trends: Array<{ date: string; users: number; sessions: number; events: number }> = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        
        const dayActivities = filteredActivities.filter(activity => {
          const activityDate = new Date(activity.timestamp);
          return activityDate >= dayStart && activityDate < dayEnd;
        });
        
        const uniqueUsers = new Set(dayActivities.map(a => a.userId));
        
        trends.push({
          date: dayStart.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
          users: uniqueUsers.size,
          sessions: Math.ceil(dayActivities.length / 3), // Estimate sessions from activities
          events: dayActivities.length
        });
      }

      return trends;
    } catch (error) {
      console.error('❌ Error fetching analytics trends:', error);
      return [];
    }
  }
}
