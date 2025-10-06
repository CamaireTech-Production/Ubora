import { PaymentService, PaymentRequest } from './paymentService';
import { User } from '../types';
import { CampayPaymentData } from '../types/payment';

export interface PayAsYouGoPaymentRequest {
  userId: string;
  type: 'forms' | 'dashboards' | 'users' | 'tokens';
  quantity: number;
  price: number;
  description: string;
  metadata?: {
    displayAmount?: number;
    itemType?: string;
    packageInfo?: {
      popular?: boolean;
      [key: string]: unknown;
    };
  };
}

export interface PayAsYouGoPaymentResult {
  success: boolean;
  paymentId?: string;
  paymentRequest?: PaymentRequest;
  error?: string;
}

export class PayAsYouGoPaymentService {
  /**
   * Create a payment request for pay-as-you-go items
   */
  static async createPaymentRequest(
    request: PayAsYouGoPaymentRequest
  ): Promise<PayAsYouGoPaymentResult> {
    try {
      const { userId, type, quantity, price, description, metadata } = request;

      // Generate external reference for this payment
      const externalReference = PaymentService.generateExternalReference('PAYGO');

      // Sanitize metadata to ensure no undefined values
      const sanitizedMetadata = {
        type: 'pay_as_you_go',
        itemType: type,
        quantity,
        ...metadata
      };

      // Ensure packageInfo.popular is a boolean if it exists
      if (sanitizedMetadata.packageInfo && sanitizedMetadata.packageInfo.popular === undefined) {
        sanitizedMetadata.packageInfo.popular = false;
      }

      // Create payment request
      const paymentRequest: PaymentRequest = {
        amount: price,
        currency: 'XAF',
        description,
        externalReference,
        metadata: sanitizedMetadata
      };

      // Create payment record in Firebase
      const paymentId = await PaymentService.createPayment(userId, paymentRequest);

      if (!paymentId) {
        return {
          success: false,
          error: 'Failed to create payment record'
        };
      }

      return {
        success: true,
        paymentId,
        paymentRequest
      };

    } catch (error) {
      console.error('Error creating pay-as-you-go payment request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process successful payment and update user resources
   */
  static async processPaymentSuccess(
    paymentId: string,
    campayData: CampayPaymentData,
    user: User
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get payment details
      const payment = await PaymentService.getPayment(paymentId);
      if (!payment) {
        return { success: false, error: 'Payment not found' };
      }

      const type = payment.metadata?.itemType as string;
      const quantity = payment.metadata?.quantity as number;
      
      console.log('PayAsYouGoPaymentService: Processing payment success', {
        paymentId,
        type,
        quantity,
        amount: payment.amount
      });

      // Update payment status
      await PaymentService.updatePaymentStatus(paymentId, campayData, 'completed');

      // Add resources to user's active session based on type
      let sessionUpdateResult = false;
      switch (type) {
        case 'tokens':
          console.log('PayAsYouGoPaymentService: Adding tokens to session...');
          sessionUpdateResult = await this.addTokensToSession(user.id, quantity, paymentId, payment.amount);
          break;
        case 'forms':
          console.log('PayAsYouGoPaymentService: Adding forms to session...');
          sessionUpdateResult = await this.addFormsToSession(user.id, quantity, paymentId, payment.amount);
          break;
        case 'dashboards':
          console.log('PayAsYouGoPaymentService: Adding dashboards to session...');
          sessionUpdateResult = await this.addDashboardsToSession(user.id, quantity, paymentId, payment.amount);
          break;
        case 'users':
          console.log('PayAsYouGoPaymentService: Adding users to session...');
          sessionUpdateResult = await this.addUsersToSession(user.id, quantity, paymentId, payment.amount);
          break;
        default:
          return { success: false, error: 'Invalid item type' };
      }
      
      if (!sessionUpdateResult) {
        return { success: false, error: 'Failed to update user session' };
      }
      
      console.log('PayAsYouGoPaymentService: Session updated successfully');

      // Refresh user data to update UI
      await this.refreshUserData(user.id);

      return { success: true };

    } catch (error) {
      console.error('Error processing pay-as-you-go payment success:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process failed payment
   */
  static async processPaymentFailure(
    paymentId: string,
    campayData: CampayPaymentData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await PaymentService.updatePaymentStatus(paymentId, campayData, 'failed');
      return { success: true };
    } catch (error) {
      console.error('Error processing pay-as-you-go payment failure:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add tokens to user's active session
   */
  private static async addTokensToSession(
    userId: string,
    quantity: number,
    paymentId: string,
    amount: number
  ): Promise<boolean> {
    try {
      console.log('addTokensToSession: Starting...', { userId, quantity, paymentId, amount });
      
      // Get current user data to find active session
      const userDoc = await import('../firebaseConfig').then(({ db }) => 
        import('firebase/firestore').then(({ doc, getDoc }) => 
          getDoc(doc(db, 'users', userId))
        )
      );
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as User;
      const activeSession = userData.subscriptionSessions?.find(s => s.isActive);

      if (!activeSession) {
        throw new Error('No active session found');
      }
      
      console.log('addTokensToSession: Found active session', { 
        sessionId: activeSession.id, 
        currentTokens: activeSession.payAsYouGoResources?.tokens || 0 
      });

      // Update the active session with additional tokens
      const updatedSessions = (userData.subscriptionSessions || []).map(session => {
        if (session.id === activeSession.id) {
          const currentPayAsYouGo = session.payAsYouGoResources || {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          };

          return {
            ...session,
            payAsYouGoResources: {
              ...currentPayAsYouGo,
              tokens: currentPayAsYouGo.tokens + quantity,
              purchases: [
                ...currentPayAsYouGo.purchases,
                {
                  id: `paygo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  purchaseDate: new Date(),
                  itemType: 'tokens',
                  quantity,
                  amountPaid: amount, // Get amount from payment record
                  paymentMethod: 'campay',
                  paymentReference: paymentId,
                  notes: `Pay-as-you-go: ${quantity.toLocaleString()} tokens`
                }
              ]
            },
            updatedAt: new Date()
          };
        }
        return session;
      });

      // Update user document
      const { db } = await import('../firebaseConfig');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      console.log('addTokensToSession: Updating user document...');
      await updateDoc(doc(db, 'users', userId), {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });

      console.log('addTokensToSession: Successfully updated user session with tokens');
      return true;
    } catch (error) {
      console.error('Error adding tokens to session:', error);
      return false;
    }
  }

  /**
   * Add forms to user's active session
   */
  private static async addFormsToSession(
    userId: string,
    quantity: number,
    paymentId: string,
    amount: number
  ): Promise<boolean> {
    try {
      // Get current user data to find active session
      const userDoc = await import('../firebaseConfig').then(({ db }) => 
        import('firebase/firestore').then(({ doc, getDoc }) => 
          getDoc(doc(db, 'users', userId))
        )
      );
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as User;
      const activeSession = userData.subscriptionSessions?.find(s => s.isActive);

      if (!activeSession) {
        throw new Error('No active session found');
      }

      // Update the active session with additional forms
      const updatedSessions = (userData.subscriptionSessions || []).map(session => {
        if (session.id === activeSession.id) {
          const currentPayAsYouGo = session.payAsYouGoResources || {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          };

          return {
            ...session,
            payAsYouGoResources: {
              ...currentPayAsYouGo,
              forms: currentPayAsYouGo.forms + quantity,
              purchases: [
                ...currentPayAsYouGo.purchases,
                {
                  id: `paygo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  purchaseDate: new Date(),
                  itemType: 'forms',
                  quantity,
                  amountPaid: amount, // Get amount from payment record
                  paymentMethod: 'campay',
                  paymentReference: paymentId,
                  notes: `Pay-as-you-go: ${quantity} formulaires`
                }
              ]
            },
            updatedAt: new Date()
          };
        }
        return session;
      });

      // Update user document
      const { db } = await import('../firebaseConfig');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      await updateDoc(doc(db, 'users', userId), {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error adding forms to session:', error);
      return false;
    }
  }

  /**
   * Add dashboards to user's active session
   */
  private static async addDashboardsToSession(
    userId: string,
    quantity: number,
    paymentId: string,
    amount: number
  ): Promise<boolean> {
    try {
      // Get current user data to find active session
      const userDoc = await import('../firebaseConfig').then(({ db }) => 
        import('firebase/firestore').then(({ doc, getDoc }) => 
          getDoc(doc(db, 'users', userId))
        )
      );
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as User;
      const activeSession = userData.subscriptionSessions?.find(s => s.isActive);

      if (!activeSession) {
        throw new Error('No active session found');
      }

      // Update the active session with additional dashboards
      const updatedSessions = (userData.subscriptionSessions || []).map(session => {
        if (session.id === activeSession.id) {
          const currentPayAsYouGo = session.payAsYouGoResources || {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          };

          return {
            ...session,
            payAsYouGoResources: {
              ...currentPayAsYouGo,
              dashboards: currentPayAsYouGo.dashboards + quantity,
              purchases: [
                ...currentPayAsYouGo.purchases,
                {
                  id: `paygo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  purchaseDate: new Date(),
                  itemType: 'dashboards',
                  quantity,
                  amountPaid: amount, // Get amount from payment record
                  paymentMethod: 'campay',
                  paymentReference: paymentId,
                  notes: `Pay-as-you-go: ${quantity} tableaux de bord`
                }
              ]
            },
            updatedAt: new Date()
          };
        }
        return session;
      });

      // Update user document
      const { db } = await import('../firebaseConfig');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      await updateDoc(doc(db, 'users', userId), {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error adding dashboards to session:', error);
      return false;
    }
  }

  /**
   * Add users to user's active session
   */
  private static async addUsersToSession(
    userId: string,
    quantity: number,
    paymentId: string,
    amount: number
  ): Promise<boolean> {
    try {
      // Get current user data to find active session
      const userDoc = await import('../firebaseConfig').then(({ db }) => 
        import('firebase/firestore').then(({ doc, getDoc }) => 
          getDoc(doc(db, 'users', userId))
        )
      );
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as User;
      const activeSession = userData.subscriptionSessions?.find(s => s.isActive);

      if (!activeSession) {
        throw new Error('No active session found');
      }

      // Update the active session with additional users
      const updatedSessions = (userData.subscriptionSessions || []).map(session => {
        if (session.id === activeSession.id) {
          const currentPayAsYouGo = session.payAsYouGoResources || {
            tokens: 0,
            forms: 0,
            dashboards: 0,
            users: 0,
            purchases: []
          };

          return {
            ...session,
            payAsYouGoResources: {
              ...currentPayAsYouGo,
              users: currentPayAsYouGo.users + quantity,
              purchases: [
                ...currentPayAsYouGo.purchases,
                {
                  id: `paygo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  purchaseDate: new Date(),
                  itemType: 'users',
                  quantity,
                  amountPaid: amount, // Get amount from payment record
                  paymentMethod: 'campay',
                  paymentReference: paymentId,
                  notes: `Pay-as-you-go: ${quantity} utilisateurs`
                }
              ]
            },
            updatedAt: new Date()
          };
        }
        return session;
      });

      // Update user document
      const { db } = await import('../firebaseConfig');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      await updateDoc(doc(db, 'users', userId), {
        subscriptionSessions: updatedSessions,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error adding users to session:', error);
      return false;
    }
  }

  /**
   * Refresh user data after successful payment
   */
  static async refreshUserData(userId: string): Promise<void> {
    try {
      // This function can be called to trigger a user data refresh
      // The actual implementation depends on how your auth context handles data refresh
      console.log('User data refresh requested for:', userId);
      
      // You can emit a custom event or call a callback here
      // For now, we'll just log it
      window.dispatchEvent(new CustomEvent('userDataRefresh', { 
        detail: { userId } 
      }));
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }

  /**
   * Get pricing for different pay-as-you-go options
   */
  static getPricing(type: 'forms' | 'dashboards' | 'users' | 'tokens') {
    switch (type) {
      case 'forms':
        return [
          { quantity: 1, price: 2000 },
          { quantity: 3, price: 5000 },
          { quantity: 5, price: 8000 }
        ];
      case 'dashboards':
        return [
          { quantity: 1, price: 30000 },
          { quantity: 2, price: 55000 },
          { quantity: 3, price: 80000 }
        ];
      case 'users':
        return [
          { quantity: 1, price: 7000 },
          { quantity: 2, price: 13000 },
          { quantity: 3, price: 20000 }
        ];
      case 'tokens':
        return [
          { quantity: 80000, price: 2500 },
          { quantity: 120000, price: 5000 },
          { quantity: 240000, price: 8500 }
        ];
      default:
        return [];
    }
  }

  /**
   * Get description for pay-as-you-go items
   */
  static getDescription(type: 'forms' | 'dashboards' | 'users' | 'tokens', quantity: number): string {
    switch (type) {
      case 'forms':
        return `${quantity} formulaire${quantity > 1 ? 's' : ''} supplémentaire${quantity > 1 ? 's' : ''}`;
      case 'dashboards':
        return `${quantity} tableau${quantity > 1 ? 'x' : ''} de bord supplémentaire${quantity > 1 ? 's' : ''}`;
      case 'users':
        return `${quantity} utilisateur${quantity > 1 ? 's' : ''} supplémentaire${quantity > 1 ? 's' : ''}`;
      case 'tokens':
        return `${quantity.toLocaleString()} tokens supplémentaires`;
      default:
        return 'Ressources supplémentaires';
    }
  }
}
