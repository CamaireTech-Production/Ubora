import { collection, addDoc, doc, getDocs, query, where, orderBy, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Dashboard, DashboardMetric, FormEntry, MetricReminder } from '../types';
import { unifiedNotificationService } from './unifiedNotificationService';
import { MetricCalculator } from '../utils/MetricCalculator';

type MetricReminderCreate = Omit<MetricReminder, 'id' | 'status' | 'createdAt' | 'dedupKey' | 'sentAt' | 'lastEvaluatedAt'>;

class MetricReminderService {
  private readonly collectionName = 'metricReminders';
  private isRunning = false;
  private sentKeys = new Set<string>();

  /**
   * Get FCM token from user profile
   */
  private async getUserFCMToken(userId: string): Promise<string | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.fcmToken || null;
      }
      return null;
    } catch (error) {
      console.error(`📊 [MetricReminder] Error getting FCM token for ${userId}:`, error);
      return null;
    }
  }

  async create(reminder: MetricReminderCreate): Promise<string> {
    // Calculate the next scheduled time based on frequency and time
    const nextScheduledAt = this.calculateNextScheduledTime(reminder.frequency, reminder.time);
    const dedupKey = this.buildDedupKey(reminder.metricId, nextScheduledAt);

    const docRef = await addDoc(collection(db, this.collectionName), {
      ...reminder,
      scheduledAt: nextScheduledAt,
      status: 'pending',
      dedupKey,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async listForDirector(directorId: string, agencyId: string): Promise<MetricReminder[]> {
    const q = query(
      collection(db, this.collectionName),
      where('agencyId', '==', agencyId),
      where('directorId', '==', directorId),
      orderBy('scheduledAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      const reminder = {
        id: d.id,
        ...data,
        // Convert Firestore Timestamps to JavaScript Dates
        scheduledAt: data.scheduledAt?.toDate ? data.scheduledAt.toDate() : data.scheduledAt,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        lastEvaluatedAt: data.lastEvaluatedAt?.toDate ? data.lastEvaluatedAt.toDate() : data.lastEvaluatedAt,
        sentAt: data.sentAt?.toDate ? data.sentAt.toDate() : data.sentAt,
      } as MetricReminder;
      
      return reminder;
    });
  }

  async cancel(reminderId: string): Promise<void> {
    try {
      console.log('Attempting to cancel reminder:', reminderId);
      
      // Validate reminderId
      if (!reminderId || typeof reminderId !== 'string' || reminderId.trim() === '') {
        throw new Error('Invalid reminder ID: reminderId is empty or invalid');
      }
      
      // Validate that reminderId doesn't contain invalid characters for Firestore
      if (reminderId.includes('/') || reminderId.includes('\\')) {
        throw new Error('Invalid reminder ID: contains invalid characters');
      }
      
      console.log('Using collection:', this.collectionName, 'and document ID:', reminderId);
      await updateDoc(doc(db, this.collectionName, reminderId), { status: 'cancelled' });
      console.log('Reminder cancelled successfully:', reminderId);
    } catch (error) {
      console.error('Error cancelling reminder:', error);
      console.error('ReminderId that caused error:', reminderId);
      console.error('Collection name:', this.collectionName);
      throw error;
    }
  }

  private buildDedupKey(metricId: string, date: Date): string {
    const minute = new Date(date).toISOString().slice(0, 16); // up to minutes
    return `${metricId}:${minute}`;
  }

  private calculateNextScheduledTime(frequency: 'daily' | 'weekly' | 'monthly', time: string): Date {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create today's scheduled time
    const today = new Date(now);
    today.setHours(hours, minutes, 0, 0);
    
    // If today's time has passed, schedule for next occurrence
    if (today <= now) {
      switch (frequency) {
        case 'daily':
          today.setDate(today.getDate() + 1);
          break;
        case 'weekly':
          today.setDate(today.getDate() + 7);
          break;
        case 'monthly':
          today.setMonth(today.getMonth() + 1);
          break;
      }
    }
    
    return today;
  }

  async runTick(params: {
    directorId: string;
    agencyId: string;
    dashboards: Dashboard[];
    formEntries: FormEntry[];
  }): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      // Fetch all pending for this director/agency (client-side filter to current minute)
      const q = query(
        collection(db, this.collectionName),
        where('agencyId', '==', params.agencyId),
        where('directorId', '==', params.directorId),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      const due = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            // Convert Firestore Timestamps to JavaScript Dates
            scheduledAt: data.scheduledAt?.toDate ? data.scheduledAt.toDate() : data.scheduledAt,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            lastEvaluatedAt: data.lastEvaluatedAt?.toDate ? data.lastEvaluatedAt.toDate() : data.lastEvaluatedAt,
            sentAt: data.sentAt?.toDate ? data.sentAt.toDate() : data.sentAt,
          } as MetricReminder;
        })
        .filter((r: MetricReminder) => {
          if (!r.scheduledAt) return false;
          return Math.abs(now.getTime() - r.scheduledAt.getTime()) < 60 * 1000; // within 1 minute
        });

      for (const reminder of due) {
        const dash = params.dashboards.find(d => d.id === reminder.dashboardId);
        const metric = dash?.metrics.find(m => m.id === reminder.metricId);
        if (!dash || !metric) {
          await updateDoc(doc(db, this.collectionName, reminder.id), {
            status: 'failed',
            lastEvaluatedAt: serverTimestamp(),
          });
          continue;
        }

        const key = reminder.dedupKey || this.buildDedupKey(reminder.metricId, reminder.scheduledAt);
        if (this.sentKeys.has(key)) continue;

        // Calculate metric value for the appropriate period
        const periodEnd = new Date(now);
        const periodStart = this.calculatePeriodStart(periodEnd, reminder.frequency);
        
        // Filter form entries for the period
        const periodFormEntries = params.formEntries.filter(entry => {
          let entryDate: Date;
          if (entry.submittedAt && typeof entry.submittedAt === 'object' && 'toDate' in entry.submittedAt) {
            // Firestore Timestamp
            entryDate = (entry.submittedAt as any).toDate();
          } else if (entry.submittedAt) {
            // Regular Date or string
            entryDate = new Date(entry.submittedAt);
          } else {
            return false; // Skip entries without submittedAt
          }
          return entryDate >= periodStart && entryDate <= periodEnd;
        });

        const result = MetricCalculator.calculateMetric(metric as DashboardMetric, periodFormEntries, dash);
        const numeric = typeof (result as any).rawValue === 'number' ? (result as any).rawValue : Number((result as any).rawValue);
        
        // For frequency-based reminders, we always send the notification with the metric value
        // (no threshold comparison needed - it's a periodic report)
        const periodLabel = this.getPeriodLabel(reminder.frequency);
        
        // Get FCM token for the director
        const fcmToken = await this.getUserFCMToken(reminder.directorId);
        
        await unifiedNotificationService.createMetricReminderNotification(
          dash.id,
          metric.name,
          numeric,
          reminder.directorId,
          reminder.agencyId,
          reminder.frequency,
          periodStart,
          periodEnd,
          fcmToken || undefined
        );

        this.sentKeys.add(key);
        
        // Schedule next occurrence
        const nextScheduledAt = this.calculateNextScheduledTime(reminder.frequency, reminder.time);
        const nextDedupKey = this.buildDedupKey(reminder.metricId, nextScheduledAt);
        
        await updateDoc(doc(db, this.collectionName, reminder.id), {
          scheduledAt: nextScheduledAt,
          dedupKey: nextDedupKey,
          sentAt: serverTimestamp(),
          lastEvaluatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      // ignore
    } finally {
      this.isRunning = false;
    }
  }

  private calculatePeriodStart(periodEnd: Date, frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const start = new Date(periodEnd);
    
    switch (frequency) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    
    return start;
  }

  private getPeriodLabel(frequency: 'daily' | 'weekly' | 'monthly'): string {
    switch (frequency) {
      case 'daily': return 'Quotidien';
      case 'weekly': return 'Hebdomadaire';
      case 'monthly': return 'Mensuel';
    }
  }
}

export const metricReminderService = new MetricReminderService();


