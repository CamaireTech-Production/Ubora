/**
 * Utilitaire pour récupérer un paiement orphelin spécifique
 * À utiliser dans la console du navigateur ou dans une page admin
 * 
 * Exemple d'utilisation:
 * import { recoverOrphanPayment } from './utils/recoverOrphanPayment';
 * await recoverOrphanPayment('ISPuynfvI11dsFp7wxDZ');
 */

import { PaymentRecoveryService } from '../services/paymentRecoveryService';
import { logger } from '@ubora/shared/utils/logger';

/**
 * Récupère un paiement orphelin spécifique
 * @param paymentId - ID du paiement à récupérer
 * @returns Promise<boolean> - true si la récupération a réussi
 */
export async function recoverOrphanPayment(paymentId: string): Promise<boolean> {
  logger.info('Tentative de récupération du paiement', { paymentId }, 'recoverOrphanPayment');
  const success = await PaymentRecoveryService.recoverPayment(paymentId);
  
  if (success) {
    logger.info('Paiement récupéré avec succès', { paymentId }, 'recoverOrphanPayment');
  } else {
    logger.error('Échec de la récupération du paiement', { paymentId }, 'recoverOrphanPayment');
  }
  
  return success;
}

/**
 * Récupère tous les paiements orphelins
 * @returns Promise<{recovered: number, failed: number}>
 */
export async function recoverAllOrphanPayments(): Promise<{ recovered: number; failed: number }> {
  logger.info('Recherche de tous les paiements orphelins', null, 'recoverOrphanPayment');
  const result = await PaymentRecoveryService.recoverAllOrphanPayments();
  logger.info('Récupération terminée', { recovered: result.recovered, failed: result.failed }, 'recoverOrphanPayment');
  return result;
}

/**
 * Liste tous les paiements orphelins sans les récupérer
 * @returns Promise<Payment[]>
 */
export async function listOrphanPayments() {
  const payments = await PaymentRecoveryService.findOrphanPayments();
  logger.debug('Paiements orphelins trouvés', { count: payments.length, payments }, 'recoverOrphanPayment');
  return payments;
}

