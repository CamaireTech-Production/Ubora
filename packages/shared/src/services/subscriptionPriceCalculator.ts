import { PackageType } from '../config/packageFeatures';
import { getPackagePriceNumeric } from '../config/packageFeatures';

export type SubscriptionPeriod = '30days' | '6months' | '1year';

export interface PriceCalculation {
  monthlyAmount: number; // Base monthly amount
  totalAmount: number; // Total amount for the period
  discountApplied: number; // 0 | 0.1 | 0.2
  discountAmount: number; // Amount saved
  period: SubscriptionPeriod;
  totalPeriodDays: number; // 30 | 180 | 360
  maxRenewals: number; // Maximum number of renewals
}

export class SubscriptionPriceCalculator {
  /**
   * Calculate discount percentage based on subscription period
   * @param period - Subscription period
   * @returns Discount percentage (0, 0.1, or 0.2)
   */
  static calculateDiscount(period: SubscriptionPeriod): number {
    switch (period) {
      case '30days':
        return 0; // No discount for 30 days
      case '6months':
        return 0.1; // 10% discount for 6 months
      case '1year':
        return 0.2; // 20% discount for 1 year
      default:
        return 0;
    }
  }

  /**
   * Get total period days based on subscription period
   * @param period - Subscription period
   * @returns Total period days (30, 180, or 360)
   */
  static getTotalPeriodDays(period: SubscriptionPeriod): number {
    switch (period) {
      case '30days':
        return 30;
      case '6months':
        return 180; // 6 months = 180 days
      case '1year':
        return 360; // 1 year = 360 days
      default:
        return 30;
    }
  }

  /**
   * Get maximum number of renewals based on subscription period
   * Renewals happen every 30 days
   * @param period - Subscription period
   * @returns Maximum number of renewals
   */
  static getMaxRenewals(period: SubscriptionPeriod): number {
    const totalDays = this.getTotalPeriodDays(period);
    return Math.floor(totalDays / 30); // Number of 30-day periods
  }

  /**
   * Calculate price for a package and period
   * @param packageType - Package type (free, starter, standard)
   * @param period - Subscription period
   * @returns Price calculation details
   */
  static calculatePrice(
    packageType: PackageType,
    period: SubscriptionPeriod
  ): PriceCalculation {
    // Free package is always 0
    if (packageType === 'free') {
      return {
        monthlyAmount: 0,
        totalAmount: 0,
        discountApplied: 0,
        discountAmount: 0,
        period: '30days',
        totalPeriodDays: 0,
        maxRenewals: 0
      };
    }

    // Get base monthly price
    const monthlyAmount = getPackagePriceNumeric(packageType);
    
    // Get discount and period details
    const discountApplied = this.calculateDiscount(period);
    const totalPeriodDays = this.getTotalPeriodDays(period);
    const maxRenewals = this.getMaxRenewals(period);

    // Calculate number of months
    const numberOfMonths = totalPeriodDays / 30;

    // Calculate total amount before discount
    const totalBeforeDiscount = monthlyAmount * numberOfMonths;

    // Apply discount
    const discountAmount = totalBeforeDiscount * discountApplied;
    const totalAmount = totalBeforeDiscount - discountAmount;

    return {
      monthlyAmount,
      totalAmount: Math.round(totalAmount), // Round to avoid decimal issues
      discountApplied,
      discountAmount: Math.round(discountAmount),
      period,
      totalPeriodDays,
      maxRenewals
    };
  }

  /**
   * Format price for display
   * @param amount - Amount in FCFA
   * @returns Formatted price string
   */
  static formatPrice(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Get period display name
   * @param period - Subscription period
   * @returns Display name
   */
  static getPeriodDisplayName(period: SubscriptionPeriod): string {
    switch (period) {
      case '30days':
        return '30 jours';
      case '6months':
        return '6 mois';
      case '1year':
        return '1 an';
      default:
        return period;
    }
  }
}


