export interface Payment {
  id: string;
  userId: string;
  amount: number; // amount actually charged (enforced min-fee if applicable)
  originalAmount?: number; // original computed amount before any min-fee adjustments
  currency: string;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: 'campay' | 'mobile_money' | 'bank_transfer';
  externalReference: string;
  campayReference?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  metadata?: {
    packageType?: string;
    sessionType?: string;
    previousPackageType?: string;
    daysRemaining?: number;
    [key: string]: any;
  };
}

export interface CampayPaymentData {
  status: string;
  reference: string;
  amount?: number;
  currency?: string;
  description?: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  externalReference: string;
  metadata?: Record<string, any>;
}
