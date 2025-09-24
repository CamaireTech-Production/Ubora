import { AdminFormService } from './adminFormService';
import { AdminDashboardService } from './adminDashboardService';
import { EnhancedAdminService } from './enhancedAdminService';
import { AdminService as BaseAdminService } from '../../services/adminService';
import { AdminStats } from '../../types';

export class AdminService {
  /**
   * Get comprehensive admin statistics
   */
  static async getAdminStats(): Promise<AdminStats> {
    try {
      const [dashboardStats, formsStats, usersStats, systemHealth] = await Promise.all([
        BaseAdminService.getDashboardStats(),
        AdminFormService.getFormsStats(),
        EnhancedAdminService.getAllUsersWithDetails(),
        BaseAdminService.getSystemHealth()
      ]);

      return {
        totalUsers: usersStats.length,
        totalForms: formsStats.totalForms,
        totalSubmissions: formsStats.totalSubmissions,
        totalDashboards: formsStats.totalForms, // This should be from dashboard service
        activeUsers: usersStats.filter(u => u.isActive).length,
        activeForms: formsStats.activeForms,
        pendingSubmissions: formsStats.pendingSubmissions,
        systemHealth: systemHealth.status,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Error fetching admin stats:', error);
      return {
        totalUsers: 0,
        totalForms: 0,
        totalSubmissions: 0,
        totalDashboards: 0,
        activeUsers: 0,
        activeForms: 0,
        pendingSubmissions: 0,
        systemHealth: 'critical',
        lastUpdated: new Date()
      };
    }
  }

  // User management methods
  static async getAllUsersWithDetails() {
    return EnhancedAdminService.getAllUsersWithDetails();
  }

  static async getUserDetail(userId: string) {
    return EnhancedAdminService.getUserDetail(userId);
  }

  static async createAdminUser(adminId: string, adminEmail: string, adminName: string, userData: any) {
    return EnhancedAdminService.createAdminUser(adminId, adminEmail, adminName, userData);
  }

  static async updateUserStatus(userId: string, isActive: boolean) {
    return EnhancedAdminService.updateUserStatus(userId, isActive);
  }

  static async getActivitySummary() {
    return EnhancedAdminService.getActivitySummary();
  }

  static async getSystemHealth() {
    return EnhancedAdminService.getSystemHealth();
  }

  static async getAllPushNotifications() {
    return EnhancedAdminService.getAllPushNotifications();
  }

  static async getPushNotificationStats() {
    return EnhancedAdminService.getPushNotificationStats();
  }

  static async getAppUsageStats() {
    return EnhancedAdminService.getAppUsageStats();
  }

  // Form management methods
  static async getAllForms() {
    return AdminFormService.getAllForms();
  }

  static async getFormById(formId: string) {
    return AdminFormService.getFormById(formId);
  }

  static async getFormSubmissions(formId: string, limitCount?: number) {
    return AdminFormService.getFormSubmissions(formId, limitCount);
  }

  static async getFormActivities(formId: string, limitCount?: number) {
    return AdminFormService.getFormActivities(formId, limitCount);
  }

  static async createForm(adminId: string, adminEmail: string, adminName: string, formData: any) {
    return AdminFormService.createForm(adminId, adminEmail, adminName, formData);
  }

  static async updateForm(adminId: string, adminEmail: string, adminName: string, formId: string, updates: any) {
    return AdminFormService.updateForm(adminId, adminEmail, adminName, formId, updates);
  }

  static async deleteForm(adminId: string, adminEmail: string, adminName: string, formId: string) {
    return AdminFormService.deleteForm(adminId, adminEmail, adminName, formId);
  }

  static async getFormsStats() {
    return AdminFormService.getFormsStats();
  }

  // Dashboard management methods
  static async getAllDashboards() {
    return AdminDashboardService.getAllDashboards();
  }

  static async getDashboardById(dashboardId: string) {
    return AdminDashboardService.getDashboardById(dashboardId);
  }

  static async getDashboardActivities(dashboardId: string, limitCount?: number) {
    return AdminDashboardService.getDashboardActivities(dashboardId, limitCount);
  }

  static async createDashboard(adminId: string, adminEmail: string, adminName: string, dashboardData: any) {
    return AdminDashboardService.createDashboard(adminId, adminEmail, adminName, dashboardData);
  }

  static async updateDashboard(adminId: string, adminEmail: string, adminName: string, dashboardId: string, updates: any) {
    return AdminDashboardService.updateDashboard(adminId, adminEmail, adminName, dashboardId, updates);
  }

  static async deleteDashboard(adminId: string, adminEmail: string, adminName: string, dashboardId: string) {
    return AdminDashboardService.deleteDashboard(adminId, adminEmail, adminName, dashboardId);
  }

  static async getDashboardsStats() {
    return AdminDashboardService.getDashboardsStats();
  }
}
