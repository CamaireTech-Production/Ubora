import { logEvent, setUserId, setUserProperties, Analytics } from 'firebase/analytics';
import { analytics } from '../firebaseConfig';

export class AnalyticsService {
  private static analytics: Analytics | null = null;

  static async initialize(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        this.analytics = await analytics;
        if (this.analytics) {
          console.log('✅ Firebase Analytics initialized');
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
}
