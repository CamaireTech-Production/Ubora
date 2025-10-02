import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { notificationService } from './notificationService';
import { Form } from '../types';

class ReminderNotificationService {
  private readonly usersCollection = 'users';
  // private intervalId: NodeJS.Timeout | null = null; // Unused for now
  // private formsProvider: (() => Form[]) | null = null; // Unused for now
  
  // Reminder intervals in minutes
  private readonly reminderIntervals = [60, 30, 15, 5]; // 1h, 30min, 15min, 5min
  
  // Track sent reminders to prevent duplicates
  private sentReminders = new Set<string>();
  
  // Prevent multiple instances from running simultaneously
  private isRunning = false;

  /**
   * Main cronjob function that runs every minute
   */
  async checkAndSendReminders(forms: Form[], agencyId?: string): Promise<void> {
    // Prevent multiple instances from running simultaneously
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
      
      
      // Clean up old localStorage entries (run once per day)
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.cleanupOldReminders();
      }
      
      // Filter forms with time restrictions
      const formsWithRestrictions = this.getFormsWithTimeRestrictions(forms);
      
      for (const form of formsWithRestrictions) {
        await this.processFormReminders(form, currentTime, currentDay, now, agencyId);
      }
      
    } catch (error) {
      console.error('🔔 [ReminderService] Error in reminder check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Filter forms that have time restrictions
   */
  private getFormsWithTimeRestrictions(forms: Form[]): Form[] {
    return forms.filter(form => 
      form.timeRestrictions && 
      (form.timeRestrictions.startTime || form.timeRestrictions.endTime) &&
      form.assignedTo && 
      form.assignedTo.length > 0
    );
  }

  /**
   * Process reminders for a specific form
   */
  private async processFormReminders(form: any, currentTime: string, currentDay: number, now: Date, agencyId?: string): Promise<void> {
    const { timeRestrictions, assignedTo } = form;
    
    // Check if current day is allowed
    if (timeRestrictions.allowedDays && 
        timeRestrictions.allowedDays.length > 0 && 
        !timeRestrictions.allowedDays.includes(currentDay)) {
      return; // Skip if current day is not allowed
    }
    
    // Determine the form start time
    const formStartTime = timeRestrictions.startTime;
    if (!formStartTime) {
      return; // No start time defined
    }
    
    
    // Check each reminder interval
    for (const intervalMinutes of this.reminderIntervals) {
      const reminderTime = this.calculateReminderTime(formStartTime, intervalMinutes);
      
      if (this.shouldSendReminder(reminderTime, currentTime, intervalMinutes)) {
        await this.sendReminderNotifications(form, assignedTo, intervalMinutes, now, agencyId);
      }
    }
  }

  /**
   * Calculate the reminder time based on form start time and interval
   */
  private calculateReminderTime(formStartTime: string, intervalMinutes: number): string {
    const [hours, minutes] = formStartTime.split(':').map(Number);
    const formStartMinutes = hours * 60 + minutes;
    const reminderMinutes = formStartMinutes - intervalMinutes;
    
    // Handle negative minutes (previous day)
    if (reminderMinutes < 0) {
      const adjustedMinutes = 24 * 60 + reminderMinutes;
      const reminderHours = Math.floor(adjustedMinutes / 60);
      const reminderMins = adjustedMinutes % 60;
      return `${reminderHours.toString().padStart(2, '0')}:${reminderMins.toString().padStart(2, '0')}`;
    }
    
    const reminderHours = Math.floor(reminderMinutes / 60);
    const reminderMins = reminderMinutes % 60;
    return `${reminderHours.toString().padStart(2, '0')}:${reminderMins.toString().padStart(2, '0')}`;
  }

  /**
   * Check if we should send a reminder now
   */
  private shouldSendReminder(reminderTime: string, currentTime: string, _intervalMinutes: number): boolean {
    // Parse times
    const [reminderHour, reminderMin] = reminderTime.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    
    const reminderTotalMinutes = reminderHour * 60 + reminderMin;
    const currentTotalMinutes = currentHour * 60 + currentMin;
    
    // Check if current time matches the reminder time exactly (within 1 minute)
    const timeDifference = Math.abs(currentTotalMinutes - reminderTotalMinutes);
    return timeDifference <= 1; // Within 1 minute window for more precision
  }

  /**
   * Check if a reminder notification already exists in Firestore
   */
  private async reminderAlreadyExists(employeeId: string, formId: string, reminderType: string, today: string): Promise<boolean> {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('recipientId', '==', employeeId),
        where('type', '==', 'reminder'),
        where('data.formId', '==', formId),
        where('data.reminderType', '==', reminderType),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(notificationsQuery);
      
      if (snapshot.empty) {
        return false;
      }
      
      const notification = snapshot.docs[0].data();
      const notificationDate = notification.createdAt?.toDate?.() || new Date(notification.createdAt);
      const notificationDateString = notificationDate.toDateString();
      
      // Check if the notification was created today
      return notificationDateString === today;
    } catch (error) {
      console.error('🔔 [ReminderService] Error checking existing reminders:', error);
      return false; // If error, allow sending to be safe
    }
  }

  /**
   * Send reminder notifications to assigned employees
   */
  private async sendReminderNotifications(form: any, employeeIds: string[], intervalMinutes: number, now: Date, agencyId?: string): Promise<void> {
    const reminderType = this.getReminderType(intervalMinutes);
    const today = now.toDateString();
    
    
    // Get employee details
    const employees = await this.getEmployeeDetails(employeeIds);
    
    for (const employee of employees) {
      try {
        // Create a more precise reminder key that includes the exact reminder time
        const formStartTime = form.timeRestrictions?.startTime;
        if (!formStartTime) continue;
        
        const reminderTime = this.calculateReminderTime(formStartTime, intervalMinutes);
        const reminderKey = `reminder_${form.id}_${employee.id}_${reminderType}_${reminderTime}_${today}`;
        
        // Triple check for duplicates: in-memory set, localStorage, and Firestore
        const inMemoryCheck = this.sentReminders.has(reminderKey);
        const localStorageCheck = localStorage.getItem(reminderKey);
        const firestoreCheck = await this.reminderAlreadyExists(employee.id, form.id, reminderType, today);
        
        if (inMemoryCheck || localStorageCheck || firestoreCheck) {
          continue;
        }
        
        
        // Send push notification using the same method as form assignments
        await this.sendPushNotification(form, employee, reminderType, agencyId);
        
        // Mark as sent in both in-memory set and localStorage
        this.sentReminders.add(reminderKey);
        localStorage.setItem(reminderKey, 'sent');
        
        
      } catch (error) {
        console.error(`🔔 [ReminderService] ❌ Error sending reminder to ${employee.name}:`, error);
      }
    }
  }

  /**
   * Get employee details from user IDs
   */
  private async getEmployeeDetails(employeeIds: string[]): Promise<Array<{id: string, name: string, email: string}>> {
    try {
      const employees: Array<{id: string, name: string, email: string}> = [];
      
      for (const employeeId of employeeIds) {
        const userDocRef = doc(db, this.usersCollection, employeeId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          employees.push({
            id: employeeId,
            name: userData.name || userData.email,
            email: userData.email
          });
        }
      }
      
      return employees;
    } catch (error) {
      console.error('🔔 [ReminderService] Error fetching employee details:', error);
      return [];
    }
  }


  /**
   * Send push notification using existing notification service
   */
  private async sendPushNotification(form: any, employee: any, reminderType: string, agencyId?: string): Promise<void> {
    const timeText = this.getReminderTimeText(reminderType);
    const title = 'Rappel de formulaire';
    const body = `Le formulaire "${form.title}" sera disponible dans ${timeText}`;
    
    await notificationService.sendToUser(employee.id, {
      title,
      body,
      type: 'reminder',
      data: {
        formId: form.id,
        formTitle: form.title,
        reminderType,
        action: 'form_reminder'
      }
    }, agencyId);
  }

  /**
   * Get reminder time text for display
   */
  private getReminderTimeText(reminderType: string): string {
    const intervals = {
      '60': '1 heure',
      '30': '30 minutes',
      '15': '15 minutes',
      '5': '5 minutes'
    };
    return intervals[reminderType as keyof typeof intervals] || 'quelques minutes';
  }

  /**
   * Get reminder type based on interval
   */
  private getReminderType(intervalMinutes: number): string {
    return intervalMinutes.toString();
  }

  /**
   * Clean up old reminders from localStorage
   */
  private cleanupOldReminders(): void {
    const today = new Date().toDateString();
    const keysToRemove: string[] = [];
    
    // Check localStorage for old reminder keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reminder_') && !key.includes(today)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove old keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  }


  /**
   * Start the cronjob (call this from your app initialization)
   */
  startCronjob(formsProvider: () => Form[], agencyId?: string): void {
    // Store the forms provider function
    // this.formsProvider = formsProvider; // Unused for now
    
    // Run immediately on start
    const initialForms = formsProvider();
    this.checkAndSendReminders(initialForms, agencyId);
    
    // Then run every minute for better precision
    // this.intervalId = setInterval(() => { // Unused for now
    //   if (this.formsProvider) {
    //     const currentForms = this.formsProvider();
    //     this.checkAndSendReminders(currentForms, agencyId);
    //   }
    // }, 60 * 1000); // 1 minute in milliseconds
  }

  /**
   * Stop the cronjob
   */
  stopCronjob(): void {
    // if (this.intervalId) { // Unused for now
    //   clearInterval(this.intervalId);
    //   this.intervalId = null;
    // }
    // this.formsProvider = null; // Unused for now
    this.sentReminders.clear();
    this.isRunning = false;
  }

  /**
   * Manually trigger reminder check (for testing purposes)
   */
  async triggerReminderCheck(forms: Form[], agencyId?: string): Promise<void> {
    await this.checkAndSendReminders(forms, agencyId);
  }

  /**
   * Clean up duplicate reminder notifications (for debugging)
   */
  async cleanupDuplicateReminders(): Promise<void> {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('type', '==', 'reminder'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(notificationsQuery);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Group notifications by user, form, and reminder type
      const groupedNotifications = new Map<string, any[]>();
      
      notifications.forEach(notification => {
        const notificationData = notification as any; // Type assertion for Firestore data
        const key = `${notificationData.recipientId}_${notificationData.data?.formId}_${notificationData.data?.reminderType}`;
        if (!groupedNotifications.has(key)) {
          groupedNotifications.set(key, []);
        }
        groupedNotifications.get(key)!.push(notification);
      });
      
      // Find and remove duplicates (keep only the first one)
      let duplicatesRemoved = 0;
      for (const [, notificationGroup] of groupedNotifications) {
        if (notificationGroup.length > 1) {
          // Keep the first notification, remove the rest
          const toRemove = notificationGroup.slice(1);
          for (const duplicate of toRemove) {
            try {
              await deleteDoc(doc(db, 'notifications', duplicate.id));
              duplicatesRemoved++;
            } catch (error) {
              console.error(`🔔 [ReminderService] Error removing duplicate ${duplicate.id}:`, error);
            }
          }
        }
      }
      
      console.log(`🔔 [ReminderService] Cleaned up ${duplicatesRemoved} duplicate reminders`);
      
    } catch (error) {
      console.error('🔔 [ReminderService] Error during cleanup:', error);
    }
  }
}

export const reminderNotificationService = new ReminderNotificationService();
