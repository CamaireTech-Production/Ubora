import { collection, addDoc, query, orderBy, limit, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ActivityLog, ActivityType } from '../types';

export class ActivityLogService {
  private static readonly COLLECTION_NAME = 'activityLogs';

  /**
   * Log an activity to Firestore
   */
  static async logActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<boolean> {
    try {
      const activityData: Omit<ActivityLog, 'id'> = {
        ...activity,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, this.COLLECTION_NAME), activityData);
      
      console.log(`✅ Activity logged: ${activity.type} - ${activity.description}`);
      return true;
    } catch (error) {
      console.error('❌ Error logging activity:', error);
      return false;
    }
  }

  /**
   * Get recent activities with pagination
   */
  static async getRecentActivities(
    limitCount: number = 50,
    startAfter?: any
  ): Promise<ActivityLog[]> {
    try {
      let q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      if (startAfter) {
        q = query(
          collection(db, this.COLLECTION_NAME),
          orderBy('timestamp', 'desc'),
          startAfter(startAfter),
          limit(limitCount)
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
    } catch (error) {
      console.error('❌ Error fetching activities:', error);
      return [];
    }
  }

  /**
   * Get activities by type
   */
  static async getActivitiesByType(
    type: ActivityType,
    limitCount: number = 50
  ): Promise<ActivityLog[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('type', '==', type),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
    } catch (error) {
      console.error('❌ Error fetching activities by type:', error);
      return [];
    }
  }

  /**
   * Get activities by user
   */
  static async getActivitiesByUser(
    userId: string,
    limitCount: number = 50
  ): Promise<ActivityLog[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
    } catch (error) {
      console.error('❌ Error fetching user activities:', error);
      return [];
    }
  }

  /**
   * Get activities by agency
   */
  static async getActivitiesByAgency(
    agencyId: string,
    limitCount: number = 50
  ): Promise<ActivityLog[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('agencyId', '==', agencyId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
    } catch (error) {
      console.error('❌ Error fetching agency activities:', error);
      return [];
    }
  }

  /**
   * Get activities by severity
   */
  static async getActivitiesBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical',
    limitCount: number = 50
  ): Promise<ActivityLog[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('severity', '==', severity),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
    } catch (error) {
      console.error('❌ Error fetching activities by severity:', error);
      return [];
    }
  }

  /**
   * Get system statistics
   */
  static async getSystemStats(): Promise<{
    totalActivities: number;
    activitiesByType: Record<ActivityType, number>;
    activitiesBySeverity: Record<string, number>;
    activitiesByCategory: Record<string, number>;
    recentActivityCount: number;
  }> {
    try {
      // This would typically use aggregation queries in a real implementation
      // For now, we'll get recent activities and calculate basic stats
      const recentActivities = await this.getRecentActivities(1000);
      
      const stats = {
        totalActivities: recentActivities.length,
        activitiesByType: {} as Record<ActivityType, number>,
        activitiesBySeverity: {} as Record<string, number>,
        activitiesByCategory: {} as Record<string, number>,
        recentActivityCount: recentActivities.length
      };

      recentActivities.forEach(activity => {
        // Count by type
        stats.activitiesByType[activity.type] = (stats.activitiesByType[activity.type] || 0) + 1;
        
        // Count by severity
        stats.activitiesBySeverity[activity.severity] = (stats.activitiesBySeverity[activity.severity] || 0) + 1;
        
        // Count by category
        stats.activitiesByCategory[activity.category] = (stats.activitiesByCategory[activity.category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('❌ Error fetching system stats:', error);
      return {
        totalActivities: 0,
        activitiesByType: {} as Record<ActivityType, number>,
        activitiesBySeverity: {} as Record<string, number>,
        activitiesByCategory: {} as Record<string, number>,
        recentActivityCount: 0
      };
    }
  }
}

// Helper functions for common activity logging
export const ActivityLogger = {
  // User activities
  logUserRegistration: (userId: string, userEmail: string, userName: string, userRole: string, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'user_registration',
      userId,
      userEmail,
      userName,
      userRole: userRole as any,
      agencyId,
      description: `User ${userName} (${userEmail}) registered as ${userRole}`,
      severity: 'medium',
      category: 'user_management'
    }),

  logUserLogin: (userId: string, userEmail: string, userName: string, userRole: string, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'user_login',
      userId,
      userEmail,
      userName,
      userRole: userRole as any,
      agencyId,
      description: `User ${userName} (${userEmail}) logged in`,
      severity: 'low',
      category: 'authentication'
    }),

  logUserLogout: (userId: string, userEmail: string, userName: string, userRole: string, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'user_logout',
      userId,
      userEmail,
      userName,
      userRole: userRole as any,
      agencyId,
      description: `User ${userName} (${userEmail}) logged out`,
      severity: 'low',
      category: 'authentication'
    }),

  // Form activities
  logFormCreation: (userId: string, userEmail: string, userName: string, userRole: string, formId: string, formTitle: string, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'form_creation',
      userId,
      userEmail,
      userName,
      userRole: userRole as any,
      agencyId,
      description: `Form "${formTitle}" created`,
      severity: 'medium',
      category: 'form_management',
      metadata: { formId, formTitle }
    }),

  logFormSubmission: (userId: string, userEmail: string, userName: string, userRole: string, formId: string, formTitle: string, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'form_submission',
      userId,
      userEmail,
      userName,
      userRole: userRole as any,
      agencyId,
      description: `Form "${formTitle}" submitted`,
      severity: 'low',
      category: 'form_management',
      metadata: { formId, formTitle }
    }),

  // Chat activities
  logChatActivity: (userId: string, userEmail: string, userName: string, userRole: string, tokensUsed: number, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'chat_activity',
      userId,
      userEmail,
      userName,
      userRole: userRole as any,
      agencyId,
      description: `Chat interaction - ${tokensUsed} tokens used`,
      severity: 'low',
      category: 'chat',
      metadata: { tokensUsed }
    }),

  // Package activities
  logPackageSelection: (userId: string, userEmail: string, userName: string, userRole: string, packageType: string, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'package_selection',
      userId,
      userEmail,
      userName,
      userRole: userRole as any,
      agencyId,
      description: `Package "${packageType}" selected`,
      severity: 'high',
      category: 'package',
      metadata: { packageType }
    }),

  // Admin activities
  logAdminLogin: (userId: string, userEmail: string, userName: string) =>
    ActivityLogService.logActivity({
      type: 'admin_login',
      userId,
      userEmail,
      userName,
      userRole: 'admin',
      description: `Admin ${userName} (${userEmail}) logged in`,
      severity: 'high',
      category: 'admin'
    }),

  logAdminUserCreation: (adminUserId: string, adminEmail: string, adminName: string, targetUserId: string, targetEmail: string, targetName: string, targetRole: string) =>
    ActivityLogService.logActivity({
      type: 'admin_user_creation',
      userId: adminUserId,
      userEmail: adminEmail,
      userName: adminName,
      userRole: 'admin',
      description: `Admin created user ${targetName} (${targetEmail}) as ${targetRole}`,
      severity: 'high',
      category: 'admin',
      metadata: { targetUserId, targetEmail, targetName, targetRole }
    }),

  // System activities
  logSystemError: (errorMessage: string, userId?: string, userEmail?: string, userName?: string, userRole?: string, agencyId?: string) =>
    ActivityLogService.logActivity({
      type: 'system_error',
      userId: userId || 'system',
      userEmail: userEmail || 'system@system.com',
      userName: userName || 'System',
      userRole: (userRole as any) || 'system',
      agencyId,
      description: `System error: ${errorMessage}`,
      severity: 'critical',
      category: 'system',
      metadata: { errorMessage }
    })
};
