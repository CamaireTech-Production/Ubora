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
import { AdminForm, AdminFormSubmission, AdminFormActivity } from '../../types';
import { ActivityLogService } from '../../services/activityLogService';

export class AdminFormService {
  private static readonly FORMS_COLLECTION = 'forms';
  private static readonly FORM_SUBMISSIONS_COLLECTION = 'formEntries';
  private static readonly FORM_ACTIVITIES_COLLECTION = 'formActivities';

  /**
   * Get all forms with admin details
   */
  static async getAllForms(): Promise<AdminForm[]> {
    try {
      const snapshot = await getDocs(collection(db, this.FORMS_COLLECTION));
      const forms: AdminForm[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const formId = docSnapshot.id;

        // Get form statistics
        const [submissionsCount, lastSubmission] = await Promise.all([
          this.getFormSubmissionsCount(formId),
          this.getLastFormSubmission(formId)
        ]);

        const form: AdminForm = {
          id: formId,
          title: data.title,
          description: data.description,
          agencyId: data.agencyId,
          agencyName: data.agencyName,
          createdBy: data.createdBy,
          createdByName: data.createdByName || data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          isActive: data.isActive !== false,
          submissionsCount,
          lastSubmissionDate: lastSubmission?.submittedAt ? 
            (lastSubmission.submittedAt.toDate ? lastSubmission.submittedAt.toDate() : new Date(lastSubmission.submittedAt)) : 
            undefined,
          fields: data.fields || [],
          settings: {
            allowMultipleSubmissions: data.settings?.allowMultipleSubmissions || false,
            requireAuthentication: data.settings?.requireAuthentication || true,
            isPublic: data.settings?.isPublic || false,
            expirationDate: data.settings?.expirationDate?.toDate()
          }
        };

        forms.push(form);
      }

      return forms;
    } catch (error) {
      console.error('❌ Error fetching forms:', error);
      return [];
    }
  }

  /**
   * Get form by ID with detailed information
   */
  static async getFormById(formId: string): Promise<AdminForm | null> {
    try {
      const formDoc = await getDoc(doc(db, this.FORMS_COLLECTION, formId));
      
      if (!formDoc.exists()) {
        return null;
      }

      const data = formDoc.data();
      const [submissionsCount, lastSubmission] = await Promise.all([
        this.getFormSubmissionsCount(formId),
        this.getLastFormSubmission(formId)
      ]);

      const form: AdminForm = {
        id: formId,
        title: data.title,
        description: data.description,
        agencyId: data.agencyId,
        agencyName: data.agencyName,
        createdBy: data.createdBy,
        createdByName: data.createdByName || data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        isActive: data.isActive !== false,
        submissionsCount,
        lastSubmissionDate: lastSubmission?.submittedAt ? 
          (lastSubmission.submittedAt.toDate ? lastSubmission.submittedAt.toDate() : new Date(lastSubmission.submittedAt)) : 
          undefined,
        fields: data.fields || [],
        settings: {
          allowMultipleSubmissions: data.settings?.allowMultipleSubmissions || false,
          requireAuthentication: data.settings?.requireAuthentication || true,
          isPublic: data.settings?.isPublic || false,
          expirationDate: data.settings?.expirationDate?.toDate()
        }
      };

      return form;
    } catch (error) {
      console.error('❌ Error fetching form:', error);
      return null;
    }
  }

  /**
   * Get form submissions
   */
  static async getFormSubmissions(formId: string, limitCount: number = 50): Promise<AdminFormSubmission[]> {
    try {
      const q = query(
        collection(db, this.FORM_SUBMISSIONS_COLLECTION),
        where('formId', '==', formId),
        orderBy('submittedAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        formId: doc.data().formId,
        formTitle: doc.data().formTitle,
        userId: doc.data().userId,
        userName: doc.data().userName,
        userEmail: doc.data().userEmail,
        agencyId: doc.data().agencyId,
        submittedAt: doc.data().submittedAt ? 
          (doc.data().submittedAt.toDate ? doc.data().submittedAt.toDate() : new Date(doc.data().submittedAt)) : 
          new Date(),
        data: doc.data().data || {},
        status: doc.data().status || 'pending',
        reviewedBy: doc.data().reviewedBy,
        reviewedAt: doc.data().reviewedAt?.toDate(),
        reviewNotes: doc.data().reviewNotes
      } as AdminFormSubmission));
    } catch (error) {
      console.error('❌ Error fetching form submissions:', error);
      return [];
    }
  }

  /**
   * Get form activities
   */
  static async getFormActivities(formId: string, limitCount: number = 50): Promise<AdminFormActivity[]> {
    try {
      const q = query(
        collection(db, this.FORM_ACTIVITIES_COLLECTION),
        where('formId', '==', formId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        formId: doc.data().formId,
        formTitle: doc.data().formTitle,
        userId: doc.data().userId,
        userName: doc.data().userName,
        userEmail: doc.data().userEmail,
        agencyId: doc.data().agencyId,
        type: doc.data().type,
        description: doc.data().description,
        timestamp: doc.data().timestamp?.toDate() || new Date(),
        metadata: doc.data().metadata
      } as AdminFormActivity));
    } catch (error) {
      console.error('❌ Error fetching form activities:', error);
      return [];
    }
  }

  /**
   * Create a new form
   */
  static async createForm(adminId: string, adminEmail: string, adminName: string, formData: Partial<AdminForm>): Promise<boolean> {
    try {
      const formRef = await addDoc(collection(db, this.FORMS_COLLECTION), {
        ...formData,
        createdBy: adminId,
        createdByName: adminName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
      });

      // Log the activity
      await ActivityLogService.logActivity({
        type: 'form_creation',
        userId: adminId,
        userEmail: adminEmail,
        userName: adminName,
        userRole: 'admin',
        description: `Admin created form: ${formData.title}`,
        severity: 'medium',
        category: 'form',
        metadata: {
          formId: formRef.id,
          formTitle: formData.title,
          agencyId: formData.agencyId
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Error creating form:', error);
      return false;
    }
  }

  /**
   * Update a form
   */
  static async updateForm(adminId: string, adminEmail: string, adminName: string, formId: string, updates: Partial<AdminForm>): Promise<boolean> {
    try {
      await updateDoc(doc(db, this.FORMS_COLLECTION, formId), {
        ...updates,
        updatedAt: serverTimestamp()
      });

      // Log the activity
      await ActivityLogService.logActivity({
        type: 'form_update',
        userId: adminId,
        userEmail: adminEmail,
        userName: adminName,
        userRole: 'admin',
        description: `Admin updated form: ${updates.title}`,
        severity: 'medium',
        category: 'form',
        metadata: {
          formId,
          formTitle: updates.title
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Error updating form:', error);
      return false;
    }
  }

  /**
   * Delete a form
   */
  static async deleteForm(adminId: string, adminEmail: string, adminName: string, formId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, this.FORMS_COLLECTION, formId));

      // Log the activity
      await ActivityLogService.logActivity({
        type: 'form_deletion',
        userId: adminId,
        userEmail: adminEmail,
        userName: adminName,
        userRole: 'admin',
        description: `Admin deleted form: ${formId}`,
        severity: 'high',
        category: 'form',
        metadata: {
          formId
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Error deleting form:', error);
      return false;
    }
  }

  /**
   * Get form submissions count
   */
  private static async getFormSubmissionsCount(formId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.FORM_SUBMISSIONS_COLLECTION),
        where('formId', '==', formId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Error fetching form submissions count:', error);
      return 0;
    }
  }

  /**
   * Get last form submission
   */
  private static async getLastFormSubmission(formId: string): Promise<AdminFormSubmission | null> {
    try {
      const q = query(
        collection(db, this.FORM_SUBMISSIONS_COLLECTION),
        where('formId', '==', formId),
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        formId: doc.data().formId,
        formTitle: doc.data().formTitle,
        userId: doc.data().userId,
        userName: doc.data().userName,
        userEmail: doc.data().userEmail,
        agencyId: doc.data().agencyId,
        submittedAt: doc.data().submittedAt ? 
          (doc.data().submittedAt.toDate ? doc.data().submittedAt.toDate() : new Date(doc.data().submittedAt)) : 
          new Date(),
        data: doc.data().data || {},
        status: doc.data().status || 'pending',
        reviewedBy: doc.data().reviewedBy,
        reviewedAt: doc.data().reviewedAt?.toDate(),
        reviewNotes: doc.data().reviewNotes
      } as AdminFormSubmission;
    } catch (error) {
      console.error('❌ Error fetching last form submission:', error);
      return null;
    }
  }

  /**
   * Get forms statistics
   */
  static async getFormsStats(): Promise<{
    totalForms: number;
    activeForms: number;
    totalSubmissions: number;
    pendingSubmissions: number;
    byAgency: Record<string, number>;
  }> {
    try {
      const [forms, submissions] = await Promise.all([
        this.getAllForms(),
        this.getAllSubmissions()
      ]);

      const totalForms = forms.length;
      const activeForms = forms.filter(f => f.isActive).length;
      const totalSubmissions = submissions.length;
      const pendingSubmissions = submissions.filter(s => s.status === 'pending').length;

      const byAgency: Record<string, number> = {};
      forms.forEach(form => {
        byAgency[form.agencyId] = (byAgency[form.agencyId] || 0) + 1;
      });

      return {
        totalForms,
        activeForms,
        totalSubmissions,
        pendingSubmissions,
        byAgency
      };
    } catch (error) {
      console.error('❌ Error fetching forms stats:', error);
      return {
        totalForms: 0,
        activeForms: 0,
        totalSubmissions: 0,
        pendingSubmissions: 0,
        byAgency: {}
      };
    }
  }

  /**
   * Get all submissions
   */
  private static async getAllSubmissions(): Promise<AdminFormSubmission[]> {
    try {
      const q = query(
        collection(db, this.FORM_SUBMISSIONS_COLLECTION),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        formId: doc.data().formId,
        formTitle: doc.data().formTitle,
        userId: doc.data().userId,
        userName: doc.data().userName,
        userEmail: doc.data().userEmail,
        agencyId: doc.data().agencyId,
        submittedAt: doc.data().submittedAt ? 
          (doc.data().submittedAt.toDate ? doc.data().submittedAt.toDate() : new Date(doc.data().submittedAt)) : 
          new Date(),
        data: doc.data().data || {},
        status: doc.data().status || 'pending',
        reviewedBy: doc.data().reviewedBy,
        reviewedAt: doc.data().reviewedAt?.toDate(),
        reviewNotes: doc.data().reviewNotes
      } as AdminFormSubmission));
    } catch (error) {
      console.error('❌ Error fetching all submissions:', error);
      return [];
    }
  }
}
