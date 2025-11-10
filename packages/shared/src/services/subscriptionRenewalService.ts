import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubscriptionSession } from '../types';
import { SubscriptionSessionCollectionService } from './subscriptionSessionCollectionService';

export class SubscriptionRenewalService {
  private static readonly COLLECTION_NAME = 'subscriptionSessions';
  private static readonly RENEWAL_INTERVAL_DAYS = 30;

  /**
   * Calculate next renewal date (30 days from now)
   * @param fromDate - Date de départ (par défaut: maintenant)
   * @returns Date de prochain renouvellement
   */
  static calculateNextRenewalDate(fromDate: Date = new Date()): Date {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + this.RENEWAL_INTERVAL_DAYS);
    return nextDate;
  }

  /**
   * Check and renew subscriptions that are due
   * @param now - Date actuelle (par défaut: maintenant)
   * @returns Promise avec statistiques de renouvellement
   */
  static async checkAndRenewSubscriptions(now: Date = new Date()): Promise<{
    processed: number;
    renewed: number;
    errors: number;
  }> {
    const stats = {
      processed: 0,
      renewed: 0,
      errors: 0
    };

    try {
      // Query active sessions with nextRenewalDate <= now
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('isActive', '==', true),
        where('autoRenew', '==', true)
      );

      const querySnapshot = await getDocs(q);
      stats.processed = querySnapshot.size;

      console.log(`🔄 [Renewal] Found ${stats.processed} active sessions to check`);

      for (const docSnapshot of querySnapshot.docs) {
        try {
          const sessionData = docSnapshot.data();
          const sessionId = docSnapshot.id;

          // Convert Firestore Timestamp to Date
          const nextRenewalDate = sessionData.nextRenewalDate?.toDate() || new Date();
          const endDate = sessionData.endDate?.toDate() || new Date();
          const renewalCount = sessionData.renewalCount || 0;
          const maxRenewals = sessionData.maxRenewals || 0;

          // Check if renewal is due
          if (nextRenewalDate > now) {
            continue; // Not due yet
          }

          // Check if max renewals reached
          if (renewalCount >= maxRenewals) {
            console.log(`⏭️ [Renewal] Session ${sessionId} has reached max renewals (${renewalCount}/${maxRenewals})`);
            continue;
          }

          // Check if total period has ended
          if (endDate <= now) {
            console.log(`⏭️ [Renewal] Session ${sessionId} has reached end date`);
            continue;
          }

          // Perform renewal
          const renewed = await this.renewSession(sessionId, sessionData, now);
          
          if (renewed) {
            stats.renewed++;
            console.log(`✅ [Renewal] Session ${sessionId} renewed successfully (${renewalCount + 1}/${maxRenewals})`);
          } else {
            stats.errors++;
            console.error(`❌ [Renewal] Failed to renew session ${sessionId}`);
          }

        } catch (error) {
          stats.errors++;
          console.error(`❌ [Renewal] Error processing session ${docSnapshot.id}:`, error);
        }
      }

      console.log(`✅ [Renewal] Completed: ${stats.renewed} renewed, ${stats.errors} errors`);
      return stats;

    } catch (error) {
      console.error('❌ [Renewal] Error checking renewals:', error);
      return stats;
    }
  }

  /**
   * Renew a specific session
   * @param oldSessionId - ID de l'ancienne session
   * @param oldSessionData - Données de l'ancienne session
   * @param now - Date actuelle
   * @returns Promise<boolean>
   */
  private static async renewSession(
    oldSessionId: string,
    oldSessionData: any,
    now: Date
  ): Promise<boolean> {
    try {
      const userId = oldSessionData.userId;
      const renewalCount = (oldSessionData.renewalCount || 0) + 1;
      const nextRenewalDate = this.calculateNextRenewalDate(now);

      // Deactivate old session
      await SubscriptionSessionCollectionService.deactivateSession(oldSessionId);

      // Create new renewal session
      const newSessionId = await SubscriptionSessionCollectionService.createSession(userId, {
        packageType: oldSessionData.packageType,
        subscriptionPeriod: oldSessionData.subscriptionPeriod,
        totalPeriodDays: oldSessionData.totalPeriodDays,
        sessionType: 'renewal',
        startDate: now,
        endDate: oldSessionData.endDate?.toDate() || new Date(),
        nextRenewalDate: nextRenewalDate,
        amountPaid: oldSessionData.amountPaid, // Keep original amount paid
        monthlyAmount: oldSessionData.monthlyAmount,
        discountApplied: oldSessionData.discountApplied,
        paymentId: oldSessionData.paymentId, // Keep original payment reference
        durationDays: oldSessionData.durationDays,
        isActive: true,
        autoRenew: oldSessionData.autoRenew ?? true,
        renewalCount: renewalCount,
        maxRenewals: oldSessionData.maxRenewals,
        packageResources: oldSessionData.packageResources,
        // Transfer pay-as-you-go resources
        payAsYouGoResources: oldSessionData.payAsYouGoResources || {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: []
        },
        // Reset usage for new renewal period
        usage: {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        }
      });

      return newSessionId !== null;

    } catch (error) {
      console.error('❌ [Renewal] Error renewing session:', error);
      return false;
    }
  }

  /**
   * Handle expired subscriptions (create free default session)
   * @param now - Date actuelle (par défaut: maintenant)
   * @returns Promise avec statistiques d'expiration
   */
  static async handleExpiredSubscriptions(now: Date = new Date()): Promise<{
    processed: number;
    expired: number;
    errors: number;
  }> {
    const stats = {
      processed: 0,
      expired: 0,
      errors: 0
    };

    try {
      // Query active sessions that have expired
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);
      stats.processed = querySnapshot.size;

      console.log(`⏰ [Expiration] Checking ${stats.processed} active sessions for expiration`);

      for (const docSnapshot of querySnapshot.docs) {
        try {
          const sessionData = docSnapshot.data();
          const sessionId = docSnapshot.id;
          const userId = sessionData.userId;

          const endDate = sessionData.endDate?.toDate() || new Date();
          const renewalCount = sessionData.renewalCount || 0;
          const maxRenewals = sessionData.maxRenewals || 0;
          const packageType = sessionData.packageType;

          // Skip free packages
          if (packageType === 'free') {
            continue;
          }

          // Check if subscription has expired
          // Expired if: endDate passed OR maxRenewals reached
          const isExpired = endDate <= now || renewalCount >= maxRenewals;

          if (!isExpired) {
            continue; // Not expired yet
          }

          // Deactivate expired session
          await SubscriptionSessionCollectionService.deactivateSession(sessionId);

          // Create free default session
          const freeSessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(userId);

          if (freeSessionId) {
            stats.expired++;
            console.log(`✅ [Expiration] Session ${sessionId} expired, free session created: ${freeSessionId}`);
          } else {
            stats.errors++;
            console.error(`❌ [Expiration] Failed to create free session for user ${userId}`);
          }

        } catch (error) {
          stats.errors++;
          console.error(`❌ [Expiration] Error processing session ${docSnapshot.id}:`, error);
        }
      }

      console.log(`✅ [Expiration] Completed: ${stats.expired} expired, ${stats.errors} errors`);
      return stats;

    } catch (error) {
      console.error('❌ [Expiration] Error handling expired subscriptions:', error);
      return stats;
    }
  }
}


