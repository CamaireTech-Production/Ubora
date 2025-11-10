import { addDoc, collection, doc, getDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Payment, PaymentRequest, CampayPaymentData } from '../types/payment';

const MIN_FEE = 5000; // FCFA

export class PaymentService {
  static generateExternalReference(prefix: string = 'PAY'): string {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${Date.now()}-${rand}`;
  }

  static async createPayment(
    userId: string,
    request: PaymentRequest,
    extraMetadata?: Record<string, any>
  ): Promise<string> {
    // Decide originalAmount based on context
    const md = (request as any)?.metadata || {};
    const candidates = [
      md.originalAmount,
      md.newPackagePrice,
      md.packagePrice,
      md.actualAmount
    ];
    const firstNumber = candidates.find((v: any) => typeof v === 'number' && !isNaN(v));
    const originalAmount = typeof firstNumber === 'number' ? firstNumber : Number(request.amount) || 0;
    // Effective amount: never apply floor for free package transitions
    const requestedAmount = Number(request.amount) || 0;
    const isFreePackage = ((request as any)?.metadata?.packageType === 'free');
    const enforceMin = (request as any)?.metadata?.enforceMinFee === true;
    const effectiveAmount = isFreePackage
      ? 0
      : (enforceMin && requestedAmount === 0 ? MIN_FEE : requestedAmount);

    const now = serverTimestamp();
    const payload: any = {
      userId,
      amount: effectiveAmount,
      originalAmount,
      currency: request.currency,
      description: request.description,
      status: 'pending',
      paymentMethod: 'campay',
      externalReference: request.externalReference,
      createdAt: now,
      updatedAt: now,
      metadata: { ...(request.metadata || {}), ...(extraMetadata || {}) }
    };

    const ref = await addDoc(collection(db, 'payments'), payload);
    return ref.id;
  }

  static async getPayment(paymentId: string): Promise<Payment | null> {
    const snap = await getDoc(doc(db, 'payments', paymentId));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    const toDate = (d: any) => (d instanceof Timestamp ? d.toDate() : d);
    return {
      id: snap.id,
      userId: data.userId,
      amount: Number(data.amount) || 0,
      originalAmount: data.originalAmount,
      currency: data.currency,
      description: data.description,
      status: data.status,
      paymentMethod: data.paymentMethod,
      externalReference: data.externalReference,
      campayReference: data.campayReference,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      completedAt: toDate(data.completedAt),
      failedAt: toDate(data.failedAt),
      metadata: data.metadata
    } as Payment;
  }

  static async updatePaymentStatus(
    paymentId: string,
    campayData: CampayPaymentData,
    status: Payment['status']
  ): Promise<void> {
    const updates: any = {
      status,
      updatedAt: serverTimestamp(),
      campayReference: campayData?.reference || null
    };

    if (status === 'completed') {
      updates.completedAt = serverTimestamp();
    }
    if (status === 'failed') {
      updates.failedAt = serverTimestamp();
    }

    if (campayData?.amount) {
      updates.providerAmount = campayData.amount;
    }
    if (campayData?.currency) {
      updates.providerCurrency = campayData.currency;
    }

    await updateDoc(doc(db, 'payments', paymentId), updates);
  }
}

export default PaymentService;
export type { Payment, PaymentRequest };


