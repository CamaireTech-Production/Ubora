import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { AdminDashboard, AdminDashboardActivity } from '../../types';
import { ActivityLogService } from '../../services/activityLogService';

export class AdminDashboardService {
  private static readonly DASHBOARDS_COLLECTION = 'dashboards';
  private static readonly DASHBOARD_ACTIVITIES_COLLECTION = 'dashboardActivities';

  /**
   * Get all dashboards with admin details
   */
  static async getAllDashboards(): Promise<AdminDashboard[]> {
    try {
      const snapshot = await getDocs(collection(db, this.DASHBOARDS_COLLECTION));
      const dashboards: AdminDashboard[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const dashboardId = docSnapshot.id;

        const dashboard: AdminDashboard = {
          id: dashboardId,
          title: data.title,
          description: data.description,
          agencyId: data.agencyId,
          agencyName: data.agencyName,
          createdBy: data.createdBy,
          createdByName: data.createdByName || data.createdBy,
          createdAt: data.createdAt ? 
            (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : 
            new Date(),
          updatedAt: data.updatedAt ? 
            (data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)) : 
            new Date(),
          isActive: data.isActive !== false,
          isPublic: data.isPublic || false,
          widgets: data.widgets || [],
          settings: {
            layout: data.settings?.layout || 'grid',
            refreshInterval: data.settings?.refreshInterval,
            allowExport: data.settings?.allowExport || false
          }
        };

        dashboards.push(dashboard);
      }

      return dashboards;
    } catch (error) {
      console.error('❌ Error fetching dashboards:', error);
      return [];
    }
  }

  /**
   * Get dashboard by ID with detailed information
   */
  static async getDashboardById(dashboardId: string): Promise<AdminDashboard | null> {
    try {
      const dashboardDoc = await getDoc(doc(db, this.DASHBOARDS_COLLECTION, dashboardId));
      
      if (!dashboardDoc.exists()) {
        return null;
      }

      const data = dashboardDoc.data();

      const dashboard: AdminDashboard = {
        id: dashboardId,
        title: data.title,
        description: data.description,
        agencyId: data.agencyId,
        agencyName: data.agencyName,
        createdBy: data.createdBy,
        createdByName: data.createdByName || data.createdBy,
        createdAt: data.createdAt ? 
          (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : 
          new Date(),
        updatedAt: data.updatedAt ? 
          (data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)) : 
          new Date(),
        isActive: data.isActive !== false,
        isPublic: data.isPublic || false,
        widgets: data.widgets || [],
        settings: {
          layout: data.settings?.layout || 'grid',
          refreshInterval: data.settings?.refreshInterval,
          allowExport: data.settings?.allowExport || false
        }
      };

      return dashboard;
    } catch (error) {
      console.error('❌ Error fetching dashboard:', error);
      return null;
    }
  }

  /**
   * Get dashboard activities
   */
  static async getDashboardActivities(dashboardId: string, limitCount: number = 50): Promise<AdminDashboardActivity[]> {
    try {
      const q = query(
        collection(db, this.DASHBOARD_ACTIVITIES_COLLECTION),
        where('dashboardId', '==', dashboardId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        dashboardId: doc.data().dashboardId,
        dashboardTitle: doc.data().dashboardTitle,
        userId: doc.data().userId,
        userName: doc.data().userName,
        userEmail: doc.data().userEmail,
        agencyId: doc.data().agencyId,
        type: doc.data().type,
        description: doc.data().description,
        timestamp: doc.data().timestamp ? 
          (doc.data().timestamp.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)) : 
          new Date(),
        metadata: doc.data().metadata
      } as AdminDashboardActivity));
    } catch (error) {
      console.error('❌ Error fetching dashboard activities:', error);
      return [];
    }
  }

  /**
   * Create a new dashboard
   */
  static async createDashboard(adminId: string, adminEmail: string, adminName: string, dashboardData: Partial<AdminDashboard>): Promise<boolean> {
    try {
      const dashboardRef = await addDoc(collection(db, this.DASHBOARDS_COLLECTION), {
        ...dashboardData,
        createdBy: adminId,
        createdByName: adminName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        widgets: dashboardData.widgets || [],
        settings: {
          layout: 'grid',
          allowExport: false,
          ...dashboardData.settings
        }
      });

      // Log the activity
      await ActivityLogService.logActivity({
        type: 'dashboard_creation',
        userId: adminId,
        userEmail: adminEmail,
        userName: adminName,
        userRole: 'admin',
        description: `Admin created dashboard: ${dashboardData.title}`,
        severity: 'medium',
        category: 'dashboard',
        metadata: {
          dashboardId: dashboardRef.id,
          dashboardTitle: dashboardData.title,
          agencyId: dashboardData.agencyId
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Error creating dashboard:', error);
      return false;
    }
  }

  /**
   * Update a dashboard
   */
  static async updateDashboard(adminId: string, adminEmail: string, adminName: string, dashboardId: string, updates: Partial<AdminDashboard>): Promise<boolean> {
    try {
      await updateDoc(doc(db, this.DASHBOARDS_COLLECTION, dashboardId), {
        ...updates,
        updatedAt: serverTimestamp()
      });

      // Log the activity
      await ActivityLogService.logActivity({
        type: 'dashboard_update',
        userId: adminId,
        userEmail: adminEmail,
        userName: adminName,
        userRole: 'admin',
        description: `Admin updated dashboard: ${updates.title}`,
        severity: 'medium',
        category: 'dashboard',
        metadata: {
          dashboardId,
          dashboardTitle: updates.title
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Error updating dashboard:', error);
      return false;
    }
  }

  /**
   * Delete a dashboard
   */
  static async deleteDashboard(adminId: string, adminEmail: string, adminName: string, dashboardId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, this.DASHBOARDS_COLLECTION, dashboardId));

      // Log the activity
      await ActivityLogService.logActivity({
        type: 'dashboard_deletion',
        userId: adminId,
        userEmail: adminEmail,
        userName: adminName,
        userRole: 'admin',
        description: `Admin deleted dashboard: ${dashboardId}`,
        severity: 'high',
        category: 'dashboard',
        metadata: {
          dashboardId
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Error deleting dashboard:', error);
      return false;
    }
  }

  /**
   * Get dashboards statistics
   */
  static async getDashboardsStats(): Promise<{
    totalDashboards: number;
    activeDashboards: number;
    publicDashboards: number;
    byAgency: Record<string, number>;
  }> {
    try {
      const dashboards = await this.getAllDashboards();

      const totalDashboards = dashboards.length;
      const activeDashboards = dashboards.filter(d => d.isActive).length;
      const publicDashboards = dashboards.filter(d => d.isPublic).length;

      const byAgency: Record<string, number> = {};
      dashboards.forEach(dashboard => {
        byAgency[dashboard.agencyId] = (byAgency[dashboard.agencyId] || 0) + 1;
      });

      return {
        totalDashboards,
        activeDashboards,
        publicDashboards,
        byAgency
      };
    } catch (error) {
      console.error('❌ Error fetching dashboards stats:', error);
      return {
        totalDashboards: 0,
        activeDashboards: 0,
        publicDashboards: 0,
        byAgency: {}
      };
    }
  }
}
