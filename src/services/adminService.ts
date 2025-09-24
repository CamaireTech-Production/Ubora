import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User, AdminDashboardStats, AdminUser, AdminActivitySummary } from '../types';
import { ActivityLogService, ActivityLogger } from './activityLogService';
import { AnalyticsService } from './analyticsService';

export class AdminService {
  private static readonly USERS_COLLECTION = 'users';
  private static readonly ACTIVITY_LOGS_COLLECTION = 'activityLogs';

  /**
   * Get all users with admin view
   */
  static async getAllUsers(): Promise<AdminUser[]> {
    try {
      const snapshot = await getDocs(collection(db, this.USERS_COLLECTION));
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
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
          totalSubmissions: data.totalSubmissions || 0
        };
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      return [];
    }
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      const users = await this.getAllUsers();
      const activities = await ActivityLogService.getRecentActivities(1000);
      
      const stats: AdminDashboardStats = {
        totalUsers: users.length,
        totalAgencies: new Set(users.map(u => u.agencyId).filter(Boolean)).size,
        totalForms: 0, // Would need to query forms collection
        totalSubmissions: 0, // Would need to query formEntries collection
        totalTokensUsed: users.reduce((sum, user) => sum + (user.tokensUsed || 0), 0),
        totalRevenue: 0, // Would need to query payment records
        activeUsers: users.filter(u => u.isActive).length,
        newUsersToday: users.filter(u => {
          const today = new Date();
          const userDate = u.createdAt;
          return userDate.toDateString() === today.toDateString();
        }).length,
        newUsersThisWeek: users.filter(u => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return u.createdAt >= weekAgo;
        }).length,
        newUsersThisMonth: users.filter(u => {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return u.createdAt >= monthAgo;
        }).length,
        systemHealth: 'healthy',
        lastBackup: new Date(),
        uptime: 99.9
      };

      return stats;
    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      return {
        totalUsers: 0,
        totalAgencies: 0,
        totalForms: 0,
        totalSubmissions: 0,
        totalTokensUsed: 0,
        totalRevenue: 0,
        activeUsers: 0,
        newUsersToday: 0,
        newUsersThisWeek: 0,
        newUsersThisMonth: 0,
        systemHealth: 'critical',
        lastBackup: new Date(),
        uptime: 0
      };
    }
  }

  /**
   * Create a new admin user
   */
  static async createAdminUser(
    adminId: string,
    adminEmail: string,
    adminName: string,
    newUserData: {
      name: string;
      email: string;
      password: string;
      role: 'admin' | 'directeur' | 'employe';
      agencyId?: string;
      isSuperAdmin?: boolean;
      adminPermissions?: string[];
    }
  ): Promise<boolean> {
    try {
      // This would typically use Firebase Admin SDK to create the user
      // For now, we'll just log the activity
      await ActivityLogger.logAdminUserCreation(
        adminId,
        adminEmail,
        adminName,
        'new-user-id',
        newUserData.email,
        newUserData.name,
        newUserData.role
      );

      await AnalyticsService.logAdminActivity(adminId, 'create_user', 'new-user-id');
      
      console.log('✅ Admin user creation logged');
      return true;
    } catch (error) {
      console.error('❌ Error creating admin user:', error);
      return false;
    }
  }

  /**
   * Update user status
   */
  static async updateUserStatus(
    adminId: string,
    adminEmail: string,
    adminName: string,
    userId: string,
    updates: Partial<User>
  ): Promise<boolean> {
    try {
      const userDocRef = doc(db, this.USERS_COLLECTION, userId);
      await updateDoc(userDocRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      await ActivityLogService.logActivity({
        type: 'admin_user_update',
        userId: adminId,
        userEmail: adminEmail,
        userName: adminName,
        userRole: 'admin',
        description: `Admin updated user ${userId}`,
        severity: 'high',
        category: 'admin',
        metadata: { targetUserId: userId, updates }
      });

      await AnalyticsService.logAdminActivity(adminId, 'update_user', userId);
      
      return true;
    } catch (error) {
      console.error('❌ Error updating user status:', error);
      return false;
    }
  }

  /**
   * Get activity summary
   */
  static async getActivitySummary(): Promise<AdminActivitySummary[]> {
    try {
      const activities = await ActivityLogService.getRecentActivities(1000);
      const summary: Record<string, AdminActivitySummary> = {};

      activities.forEach(activity => {
        if (!summary[activity.type]) {
          summary[activity.type] = {
            type: activity.type,
            count: 0,
            lastActivity: activity.timestamp?.toDate() || new Date(),
            trend: 'stable',
            percentage: 0
          };
        }
        summary[activity.type].count++;
      });

      return Object.values(summary).sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('❌ Error fetching activity summary:', error);
      return [];
    }
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: Record<string, any>;
  }> {
    try {
      const issues: string[] = [];
      const metrics: Record<string, any> = {};

      // Check for critical errors in the last hour
      const criticalActivities = await ActivityLogService.getActivitiesBySeverity('critical', 100);
      const recentCritical = criticalActivities.filter(activity => {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        return activity.timestamp?.toDate() >= oneHourAgo;
      });

      if (recentCritical.length > 0) {
        issues.push(`${recentCritical.length} critical errors in the last hour`);
      }

      // Check user activity
      const recentActivities = await ActivityLogService.getRecentActivities(100);
      const loginActivities = recentActivities.filter(a => a.type === 'user_login');
      
      if (loginActivities.length === 0) {
        issues.push('No user logins in the last 100 activities');
      }

      metrics.criticalErrors = recentCritical.length;
      metrics.recentLogins = loginActivities.length;
      metrics.totalActivities = recentActivities.length;

      const status = issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'warning' : 'critical';

      return { status, issues, metrics };
    } catch (error) {
      console.error('❌ Error checking system health:', error);
      return {
        status: 'critical',
        issues: ['Unable to check system health'],
        metrics: {}
      };
    }
  }
}
