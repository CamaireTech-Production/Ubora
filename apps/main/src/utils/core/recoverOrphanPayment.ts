/**
 * Utilitaire pour récupérer un paiement orphelin spécifique
 * À utiliser dans la console du navigateur ou dans une page admin
 * 
 * Exemple d'utilisation:
 * import { recoverOrphanPayment } from './utils/recoverOrphanPayment';
 * await recoverOrphanPayment('ISPuynfvI11dsFp7wxDZ');
 */

import { PaymentRecoveryService } from '../services/paymentRecoveryService';

/**
 * Récupère un paiement orphelin spécifique
 * @param paymentId - ID du paiement à récupérer
 * @returns Promise<boolean> - true si la récupération a réussi
 */
export async function recoverOrphanPayment(paymentId: string): Promise<boolean> {
  console.log(`[Recovery] Tentative de récupération du paiement ${paymentId}...`);
  const success = await PaymentRecoveryService.recoverPayment(paymentId);
  
  if (success) {
    console.log(`✅ Paiement ${paymentId} récupéré avec succès !`);
  } else {
    console.error(`❌ Échec de la récupération du paiement ${paymentId}`);
  }
  
  return success;
}

/**
 * Récupère tous les paiements orphelins
 * @returns Promise<{recovered: number, failed: number}>
 */
export async function recoverAllOrphanPayments(): Promise<{ recovered: number; failed: number }> {
  console.log('[Recovery] Recherche de tous les paiements orphelins...');
  const result = await PaymentRecoveryService.recoverAllOrphanPayments();
  console.log(`✅ Récupération terminée: ${result.recovered} récupérés, ${result.failed} échoués`);
  return result;
}

/**
 * Liste tous les paiements orphelins sans les récupérer
 * @returns Promise<Payment[]>
 */
export async function listOrphanPayments() {
  const payments = await PaymentRecoveryService.findOrphanPayments();
  console.log(`Trouvé ${payments.length} paiements orphelins:`, payments);
  return payments;
}

