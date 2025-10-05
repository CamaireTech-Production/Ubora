import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  enableNetwork
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Payment, PaymentRequest, CampayPaymentData } from '../types/payment';

export class PaymentService {
  private static readonly COLLECTION_NAME = 'payments';

  /**
   * Ensure Firestore connection is active
   */
  private static async ensureConnection(): Promise<void> {
    try {
      // Try to enable network connection
      await enableNetwork(db);
      console.log('Firestore connection enabled');
    } catch (error) {
      console.warn('Could not enable Firestore network:', error);
    }
  }

  /**
   * Create a new payment record in Firebase
   */
  static async createPayment(
    userId: string,
    paymentRequest: PaymentRequest,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Ensure Firestore connection is active
      await this.ensureConnection();

      if (!paymentRequest || paymentRequest.amount === undefined || paymentRequest.amount === null) {
        throw new Error('Invalid payment request: missing amount');
      }

      // Clean metadata to ensure it's serializable (remove any React components or symbols)
      const cleanMetadata = JSON.parse(JSON.stringify({
        ...paymentRequest.metadata,
        ...metadata
      }));

      console.log('Cleaned metadata for Firestore:', cleanMetadata);

      // Create a more robust payment data object
      const paymentData = {
        userId: String(userId), // Ensure userId is a string
        amount: Number(paymentRequest.amount), // Ensure amount is a number
        currency: String(paymentRequest.currency || 'XAF'), // Ensure currency is a string
        description: String(paymentRequest.description || ''), // Ensure description is a string
        status: 'pending' as const,
        paymentMethod: 'campay' as const,
        externalReference: String(paymentRequest.externalReference || ''), // Ensure externalReference is a string
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metadata: cleanMetadata
      };

      // Add retry logic for Firestore operations
      let retries = 3;
      let lastError: any;

      while (retries > 0) {
        try {
          console.log('Attempting to create payment document...', { retries });
          
          // Try the standard approach first
          const docRef = await addDoc(collection(db, this.COLLECTION_NAME), paymentData);
          console.log('Payment document created successfully:', docRef.id);
          return docRef.id;
        } catch (firestoreError) {
          lastError = firestoreError;
          console.error(`Firestore error (attempt ${4 - retries}):`, firestoreError);
          
          // If it's the internal assertion error, try a different approach
          if (firestoreError instanceof Error && firestoreError.message && firestoreError.message.includes('INTERNAL ASSERTION FAILED')) {
            console.log('Detected Firestore internal assertion error, trying alternative approach...');
            
            try {
              // Try with a simpler data structure
              const simplePaymentData = {
                userId: String(userId),
                amount: Number(paymentRequest.amount),
                currency: 'XAF',
                description: String(paymentRequest.description || ''),
                status: 'pending',
                paymentMethod: 'campay',
                externalReference: String(paymentRequest.externalReference || ''),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: JSON.stringify(cleanMetadata) // Store as string instead of object
              };
              
              const docRef = await addDoc(collection(db, this.COLLECTION_NAME), simplePaymentData);
              console.log('Payment document created successfully with alternative approach:', docRef.id);
              return docRef.id;
            } catch (altError) {
              console.error('Alternative approach also failed:', altError);
              lastError = altError;
            }
          }
          
          if (retries > 1) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
          }
          retries--;
        }
      }

      // If all retries failed, throw the last error
      throw lastError;

    } catch (error) {
      console.error('Error creating payment:', error);
      throw new Error(`Failed to create payment record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update payment status after Campay callback
   */
  static async updatePaymentStatus(
    paymentId: string,
    campayData: CampayPaymentData,
    status: 'completed' | 'failed' | 'cancelled'
  ): Promise<boolean> {
    try {
      const paymentRef = doc(db, this.COLLECTION_NAME, paymentId);
      const updateData: any = {
        status,
        updatedAt: serverTimestamp(),
        campayReference: campayData.reference
      };

      if (status === 'completed') {
        updateData.completedAt = serverTimestamp();
      } else if (status === 'failed') {
        updateData.failedAt = serverTimestamp();
      }

      await updateDoc(paymentRef, updateData);
      return true;
    } catch (error) {
      console.error('Error updating payment status:', error);
      return false;
    }
  }

  /**
   * Get payment by ID
   */
  static async getPayment(paymentId: string): Promise<Payment | null> {
    try {
      const paymentRef = doc(db, this.COLLECTION_NAME, paymentId);
      const paymentSnap = await getDoc(paymentRef);
      
      if (paymentSnap.exists()) {
        const data = paymentSnap.data();
        return {
          id: paymentSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          completedAt: data.completedAt?.toDate(),
          failedAt: data.failedAt?.toDate()
        } as Payment;
      }
      return null;
    } catch (error) {
      console.error('Error getting payment:', error);
      return null;
    }
  }

  /**
   * Get payment by external reference
   */
  static async getPaymentByReference(externalReference: string): Promise<Payment | null> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('externalReference', '==', externalReference),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          completedAt: data.completedAt?.toDate(),
          failedAt: data.failedAt?.toDate()
        } as Payment;
      }
      return null;
    } catch (error) {
      console.error('Error getting payment by reference:', error);
      return null;
    }
  }

  /**
   * Get user's payment history
   */
  static async getUserPayments(
    userId: string, 
    limitCount: number = 50
  ): Promise<Payment[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      const payments: Payment[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        payments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          completedAt: data.completedAt?.toDate(),
          failedAt: data.failedAt?.toDate()
        } as Payment);
      });
      
      return payments;
    } catch (error) {
      console.error('Error getting user payments:', error);
      return [];
    }
  }

  /**
   * Generate unique external reference for payment
   */
  static generateExternalReference(prefix: string = 'PAY'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Process Campay payment callback
   */
  static async processCampayCallback(
    externalReference: string,
    campayData: CampayPaymentData
  ): Promise<{ success: boolean; paymentId?: string }> {
    try {
      // Find payment by external reference
      const payment = await this.getPaymentByReference(externalReference);
      
      if (!payment) {
        console.error('Payment not found for reference:', externalReference);
        return { success: false };
      }

      // Determine status based on Campay response
      let status: 'completed' | 'failed' | 'cancelled' = 'failed';
      if (campayData.status === 'SUCCESS' || campayData.status === 'COMPLETED') {
        status = 'completed';
      } else if (campayData.status === 'CANCELLED' || campayData.status === 'CANCELED') {
        status = 'cancelled';
      }

      // Update payment status
      const updated = await this.updatePaymentStatus(payment.id, campayData, status);
      
      return { 
        success: updated, 
        paymentId: payment.id 
      };
    } catch (error) {
      console.error('Error processing Campay callback:', error);
      return { success: false };
    }
  }
}
