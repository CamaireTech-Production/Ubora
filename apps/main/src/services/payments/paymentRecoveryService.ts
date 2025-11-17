import { collection, query, where, getDocs, getDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { Payment } from '../../types';
import { PackageTransitionService } from './packageTransitionService';
import { SubscriptionSessionCollectionService } from '@ubora/shared/services/subscriptionSessionCollectionService';

/**
 * Service de récupération pour les paiements orphelins
 * Récupère les paiements réussis mais sans session d'abonnement créée
 */
export class PaymentRecoveryService {
  /**
   * Trouve tous les paiements orphelins (completed mais sans session)
   */
  static async findOrphanPayments(): Promise<Payment[]> {
    try {
      // Find payments that are completed but have sessionCreationFailed flag
      const q = query(
        collection(db, 'payments'),
        where('status', '==', 'completed'),
        where('sessionCreationFailed', '==', true)
      );

      const querySnapshot = await getDocs(q);
      const orphanPayments: Payment[] = [];

      for (const paymentDoc of querySnapshot.docs) {
        const payment = { id: paymentDoc.id, ...paymentDoc.data() } as Payment;
        
        // Verify that no session exists for this payment
        if (payment.userId && payment.id) {
          const sessions = await SubscriptionSessionCollectionService.getUserSessions(payment.userId);
          const existingSession = sessions.find(session => 
            session.paymentId === payment.id || 
            session.paymentReference === payment.id
          );

          // Only add if no session exists
          if (!existingSession) {
            orphanPayments.push(payment);
          }
        }
      }

      console.log(`[PaymentRecovery] Trouvé ${orphanPayments.length} paiements orphelins`);
      return orphanPayments;
    } catch (error) {
      console.error('[PaymentRecovery] Erreur lors de la recherche de paiements orphelins:', error);
      return [];
    }
  }

  /**
   * Récupère un paiement orphelin spécifique en créant la session manquante
   */
  static async recoverPayment(paymentId: string): Promise<boolean> {
    try {
      console.log(`[PaymentRecovery] Tentative de récupération du paiement ${paymentId}`);

      const paymentDocRef = doc(db, 'payments', paymentId);
      const paymentDoc = await getDoc(paymentDocRef);
      
      if (!paymentDoc.exists()) {
        console.error(`[PaymentRecovery] Paiement ${paymentId} non trouvé`);
        return false;
      }

      const payment = { id: paymentDoc.id, ...paymentDoc.data() } as Payment;

      // Verify payment is completed
      if (payment.status !== 'completed') {
        console.warn(`[PaymentRecovery] Paiement ${paymentId} n'est pas completed (status: ${payment.status})`);
        return false;
      }

      // Verify no session exists
      if (payment.userId) {
        const sessions = await SubscriptionSessionCollectionService.getUserSessions(payment.userId);
        const existingSession = sessions.find(session => 
          session.paymentId === payment.id || 
          session.paymentReference === payment.id
        );

        if (existingSession) {
          console.log(`[PaymentRecovery] Session déjà existante pour le paiement ${paymentId}, marquage comme récupéré`);
          await this.markPaymentAsRecovered(paymentId);
          return true;
        }
      }

      // Extract package type from payment metadata
      const packageType = this.extractPackageTypeFromPayment(payment);
      if (!packageType) {
        console.error(`[PaymentRecovery] Impossible d'extraire le type de package du paiement ${paymentId}`);
        return false;
      }

      // Execute transition to create session
      if (!payment.userId) {
        console.error(`[PaymentRecovery] Paiement ${paymentId} n'a pas de userId`);
        return false;
      }

      const success = await PackageTransitionService.executeTransition(
        payment.userId,
        packageType,
        {
          preserveUnusedPayAsYouGo: false // As per user requirement
        },
        payment.paymentMethod || 'campay',
        payment.id
      );

      if (success) {
        await this.markPaymentAsRecovered(paymentId);
        console.log(`[PaymentRecovery] Paiement ${paymentId} récupéré avec succès`);
        return true;
      } else {
        console.error(`[PaymentRecovery] Échec de la récupération du paiement ${paymentId}`);
        return false;
      }
    } catch (error) {
      console.error(`[PaymentRecovery] Erreur lors de la récupération du paiement ${paymentId}:`, error);
      return false;
    }
  }

  /**
   * Récupère tous les paiements orphelins
   */
  static async recoverAllOrphanPayments(): Promise<{ recovered: number; failed: number }> {
    const orphanPayments = await this.findOrphanPayments();
    let recovered = 0;
    let failed = 0;

    for (const payment of orphanPayments) {
      const success = await this.recoverPayment(payment.id);
      if (success) {
        recovered++;
      } else {
        failed++;
      }
    }

    console.log(`[PaymentRecovery] Récupération terminée: ${recovered} récupérés, ${failed} échoués`);
    return { recovered, failed };
  }

  /**
   * Extrait le type de package depuis les métadonnées du paiement
   */
  private static extractPackageTypeFromPayment(payment: Payment): 'free' | 'starter' | 'standard' | null {
    // Try to extract from metadata
    if (payment.metadata?.packageType) {
      const packageType = payment.metadata.packageType as string;
      if (['free', 'starter', 'standard'].includes(packageType)) {
        return packageType as 'free' | 'starter' | 'standard';
      }
    }

    // Try to extract from description
    if (payment.description) {
      const desc = payment.description.toLowerCase();
      if (desc.includes('starter')) return 'starter';
      if (desc.includes('standard')) return 'standard';
      if (desc.includes('free')) return 'free';
    }

    // Default to starter if amount suggests it
    if (payment.amount) {
      // You may need to adjust these thresholds based on your pricing
      if (payment.amount >= 25000) return 'standard';
      if (payment.amount >= 12000) return 'starter';
    }

    return null;
  }

  /**
   * Marque un paiement comme récupéré
   */
  private static async markPaymentAsRecovered(paymentId: string): Promise<void> {
    try {
      const paymentDocRef = doc(db, 'payments', paymentId);
      await updateDoc(paymentDocRef, {
        sessionCreationFailed: false,
        sessionRecovered: true,
        sessionRecoveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`[PaymentRecovery] Erreur lors du marquage du paiement ${paymentId} comme récupéré:`, error);
    }
  }
}

