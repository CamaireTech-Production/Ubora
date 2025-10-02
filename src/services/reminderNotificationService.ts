import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { notificationService } from './notificationService';
import { Form } from '../types';

class ReminderNotificationService {
  private readonly usersCollection = 'users';
  private intervalId: NodeJS.Timeout | null = null;
  private formsProvider: (() => Form[]) | null = null;
  
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
      console.log('🔔 [ReminderService] ⏭️ Reminder check already running, skipping...');
      return;
    }
    
    this.isRunning = true;
    console.log('🔔 [ReminderService] Starting reminder check...');
    
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
      
      console.log(`🔔 [ReminderService] Current time: ${currentTime}, Day: ${currentDay}`);
      
      // Clean up old localStorage entries (run once per day)
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.cleanupOldReminders();
      }
      
      // Filter forms with time restrictions
      const formsWithRestrictions = this.getFormsWithTimeRestrictions(forms);
      console.log(`🔔 [ReminderService] Found ${formsWithRestrictions.length} forms with time restrictions`);
      
      for (const form of formsWithRestrictions) {
        console.log(`🔔 [ReminderService] Processing form: ${form.title} (ID: ${form.id})`);
        await this.processFormReminders(form, currentTime, currentDay, now, agencyId);
      }
      
      console.log('🔔 [ReminderService] Reminder check completed');
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
    
    console.log(`🔔 [ReminderService] Processing form "${form.title}" with start time ${formStartTime}`);
    
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
  private shouldSendReminder(reminderTime: string, currentTime: string, intervalMinutes: number): boolean {
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
    
    console.log(`🔔 [ReminderService] 📤 Sending ${reminderType} reminders for form "${form.title}"`);
    console.log(`🔔 [ReminderService] 👥 Assigned employees: ${employeeIds.length}`);
    
    // Get employee details
    const employees = await this.getEmployeeDetails(employeeIds);
    console.log(`🔔 [ReminderService] 📋 Employee details retrieved: ${employees.length}`);
    
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
          console.log(`🔔 [ReminderService] ⏭️ Reminder already sent to ${employee.name} for form ${form.id} at ${reminderTime} today`);
          console.log(`🔔 [ReminderService] 🔍 Duplicate check: inMemory=${inMemoryCheck}, localStorage=${!!localStorageCheck}, firestore=${firestoreCheck}`);
          continue;
        }
        
        console.log(`🔔 [ReminderService] ✅ Sending ${reminderType} reminder to ${employee.name} for form "${form.title}" at ${reminderTime}`);
        
        // Send push notification using the same method as form assignments
        await this.sendPushNotification(form, employee, reminderType, agencyId);
        
        // Mark as sent in both in-memory set and localStorage
        this.sentReminders.add(reminderKey);
        localStorage.setItem(reminderKey, 'sent');
        
        console.log(`🔔 [ReminderService] 🎉 Reminder sent successfully to ${employee.name} for form "${form.title}"`);
        
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
    
    console.log(`🔔 [ReminderService] 📱 Sending push notification to ${employee.name}:`);
    console.log(`🔔 [ReminderService] 📱 Title: "${title}"`);
    console.log(`🔔 [ReminderService] 📱 Body: "${body}"`);
    console.log(`🔔 [ReminderService] 📱 Data:`, {
      formId: form.id,
      formTitle: form.title,
      reminderType,
      action: 'form_reminder'
    });
    console.log(`🔔 [ReminderService] 📱 AgencyId: ${agencyId || 'undefined'}`);
    
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
    
    console.log(`🔔 [ReminderService] 📱 Push notification sent successfully to ${employee.name}`);
  }

  /**
   * Get reminder type from interval minutes
   */
  private getReminderType(intervalMinutes: number): '1h' | '30min' | '15min' | '5min' {
    switch (intervalMinutes) {
      case 60: return '1h';
      case 30: return '30min';
      case 15: return '15min';
      case 5: return '5min';
      default: return '5min';
    }
  }

  /**
   * Get human-readable time text for reminder
   */
  private getReminderTimeText(reminderType: string): string {
    switch (reminderType) {
      case '1h': return '1 heure';
      case '30min': return '30 minutes';
      case '15min': return '15 minutes';
      case '5min': return '5 minutes';
      default: return 'quelques minutes';
    }
  }

  /**
   * Start the cronjob (call this from your app initialization)
   */
  startCronjob(formsProvider: () => Form[], agencyId?: string): void {
    console.log('🔔 [ReminderService] Starting reminder cronjob...');
    
    // Store the forms provider function
    this.formsProvider = formsProvider;
    
    // Run immediately on start
    const initialForms = formsProvider();
    this.checkAndSendReminders(initialForms, agencyId);
    
    // Then run every minute for better precision
    this.intervalId = setInterval(() => {
      console.log('🔔 [ReminderService] ⏰ Cronjob triggered - checking for reminders...');
      if (this.formsProvider) {
        const currentForms = this.formsProvider();
        this.checkAndSendReminders(currentForms, agencyId);
      }
    }, 60 * 1000); // 1 minute in milliseconds
    
    console.log('🔔 [ReminderService] ✅ Reminder cronjob started (runs every minute)');
    console.log('🔔 [ReminderService] 📅 Next check will be in 1 minute');
  }

  /**
   * Stop the cronjob
   */
  stopCronjob(): void {
    console.log('🔔 [ReminderService] Stopping reminder cronjob...');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.formsProvider = null;
    this.sentReminders.clear();
    this.isRunning = false;
  }

  /**
   * Clean up old localStorage entries to prevent memory buildup
   */
  private cleanupOldReminders(): void {
    const today = new Date().toDateString();
    const keysToRemove: string[] = [];
    
    // Check all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reminder_')) {
        // Extract date from key (last part after last underscore)
        const keyParts = key.split('_');
        const keyDate = keyParts[keyParts.length - 1];
        
        // Remove if not from today
        if (keyDate !== today) {
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove old keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`🔔 [ReminderService] 🧹 Cleaned up ${keysToRemove.length} old reminder entries`);
    }
  }

  /**
   * Manually trigger reminder check (for testing purposes)
   */
  async triggerReminderCheck(forms: Form[], agencyId?: string): Promise<void> {
    console.log('🔔 [ReminderService] Manual reminder check triggered');
    await this.checkAndSendReminders(forms, agencyId);
  }

  /**
   * Clean up duplicate reminder notifications (for debugging)
   */
  async cleanupDuplicateReminders(): Promise<void> {
    try {
      console.log('🔔 [ReminderService] 🧹 Starting cleanup of duplicate reminder notifications...');
      
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
        const key = `${notification.recipientId}_${notification.data?.formId}_${notification.data?.reminderType}`;
        if (!groupedNotifications.has(key)) {
          groupedNotifications.set(key, []);
        }
        groupedNotifications.get(key)!.push(notification);
      });
      
      // Find and remove duplicates (keep only the first one)
      let duplicatesRemoved = 0;
      for (const [key, notificationGroup] of groupedNotifications) {
        if (notificationGroup.length > 1) {
          console.log(`🔔 [ReminderService] Found ${notificationGroup.length} duplicate notifications for key: ${key}`);
          
          // Keep the first notification, remove the rest
          const toRemove = notificationGroup.slice(1);
          for (const duplicate of toRemove) {
            try {
              await deleteDoc(doc(db, 'notifications', duplicate.id));
              duplicatesRemoved++;
              console.log(`🔔 [ReminderService] Removed duplicate notification: ${duplicate.id}`);
            } catch (error) {
              console.error(`🔔 [ReminderService] Error removing duplicate ${duplicate.id}:`, error);
            }
          }
        }
      }
      
      console.log(`🔔 [ReminderService] 🎉 Cleanup completed. Removed ${duplicatesRemoved} duplicate notifications.`);
    } catch (error) {
      console.error('🔔 [ReminderService] Error during cleanup:', error);
    }
  }
}

export const reminderNotificationService = new ReminderNotificationService();
