import React from 'react';
import { 
  Calculator, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  CheckCircle, 
  AlertTriangle,
  DollarSign,
  Users,
  FileText,
  BarChart3,
  Zap
} from 'lucide-react';
import { EnhancedTransitionCalculation, PayAsYouGoItem, FeatureUpgrade, FeatureDowngrade } from '@ubora/shared/services/packageTransitionService';
import { getPackageDisplayName } from '@ubora/shared/config/packageFeatures';
import { SubscriptionPriceCalculator, SubscriptionPeriod } from '@ubora/shared/services/subscriptionPriceCalculator';
import { PackageType } from '@ubora/shared/config/packageFeatures';

interface PackageTransitionPriceExplanationProps {
  calculation: EnhancedTransitionCalculation;
  selectedPackage?: PackageType;
  selectedPeriod?: SubscriptionPeriod;
  className?: string;
}

export const PackageTransitionPriceExplanation: React.FC<PackageTransitionPriceExplanationProps> = ({
  calculation,
  selectedPackage,
  selectedPeriod = '30days',
  className = ''
}) => {
  // Add safety checks for calculation and priceBreakdown
  if (!calculation || !calculation.priceBreakdown) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <p>Calcul en cours...</p>
        </div>
      </div>
    );
  }

  const { priceBreakdown, daysRemaining, payAsYouGoItems, featureUpgrades, featureDowngrades } = calculation;
  
  // Recalculate price based on selected period if package and period are provided
  let priceCalculation = null;
  if (selectedPackage && selectedPackage !== 'free') {
    priceCalculation = SubscriptionPriceCalculator.calculatePrice(selectedPackage, selectedPeriod);
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('fr-FR') + ' FCFA';
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'maxForms': return <FileText className="h-4 w-4" />;
      case 'maxDashboards': return <BarChart3 className="h-4 w-4" />;
      case 'maxUsers': return <Users className="h-4 w-4" />;
      case 'monthlyTokens': return <Zap className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getFeatureName = (feature: string) => {
    switch (feature) {
      case 'maxForms': return 'Formulaires';
      case 'maxDashboards': return 'Tableaux de bord';
      case 'maxUsers': return 'Utilisateurs';
      case 'monthlyTokens': return 'Tokens ARCHA';
      default: return feature;
    }
  };

  const formatLimit = (limit: number | 'unlimited') => {
    return limit === 'unlimited' ? 'Illimité' : limit.toLocaleString();
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Détail du calcul de prix</h3>
      </div>

      {/* Days Remaining Info */}
      {daysRemaining > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Jours restants dans votre abonnement actuel</span>
          </div>
          <p className="text-sm text-blue-700">
            Il vous reste <strong>{daysRemaining} jours</strong> sur votre abonnement {calculation.currentSession?.packageType ? getPackageDisplayName(calculation.currentSession.packageType) : 'actuel'}.
            La valeur restante sera déduite du coût du nouveau package.
          </p>
        </div>
      )}

      {/* Price Breakdown */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Calcul du prix
        </h4>
        
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {/* Current Package Value */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Valeur restante du package actuel</span>
            <span className="text-sm font-medium text-gray-900">
              {formatPrice(priceBreakdown.currentPackageRemainingValue || 0)}
            </span>
          </div>
          
          {/* New Package Price */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Prix du nouveau package</span>
            <div className="flex flex-col items-end">
              {priceCalculation && priceCalculation.discountApplied > 0 ? (
                <>
                  <span className="text-sm text-gray-500 line-through">
                    {formatPrice(priceCalculation.monthlyAmount * (priceCalculation.totalPeriodDays / 30))}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatPrice(priceCalculation.totalAmount)}
                  </span>
                  <span className="text-xs text-green-600 font-semibold">
                    -{priceCalculation.discountApplied * 100}% de réduction
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-900">
                  {formatPrice(priceCalculation?.totalAmount || priceBreakdown.newPackagePrice || 0)}
                </span>
              )}
            </div>
          </div>
          
          
          {/* Divider */}
          <div className="border-t border-gray-200"></div>
          
          {/* Final Amount */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-900">Montant à payer</span>
            <span className="text-lg font-bold text-green-600">
              {(() => {
                if (priceCalculation && selectedPackage && selectedPackage !== 'free') {
                  const creditFromRemainingDays = priceBreakdown.currentPackageRemainingValue || 0;
                  const payable = Math.max(0, priceCalculation.totalAmount - creditFromRemainingDays);
                  return formatPrice(Math.max(payable, 5000)); // Minimum 5000 FCFA
                }
                return formatPrice(priceBreakdown.finalAmount || 0);
              })()}
            </span>
          </div>
          
          {/* Savings from period discount */}
          {priceCalculation && priceCalculation.discountAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600">Économie (réduction période)</span>
              <span className="text-sm font-medium text-green-600">
                -{formatPrice(priceCalculation.discountAmount)}
              </span>
            </div>
          )}
          
          {/* Savings from transition */}
          {(priceBreakdown.savings || 0) > 0 && (!priceCalculation || priceCalculation.discountAmount === 0) && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600">Économie réalisée</span>
              <span className="text-sm font-medium text-green-600">
                -{formatPrice(priceBreakdown.savings || 0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Feature Changes */}
      {(featureUpgrades.length > 0 || featureDowngrades.length > 0) && (
        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-gray-900">Changements de fonctionnalités</h4>
          
          {/* Upgrades */}
          {featureUpgrades.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Améliorations</span>
              </div>
              <div className="space-y-2 ml-6">
                {featureUpgrades.map((upgrade, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {getFeatureIcon(upgrade.feature)}
                    <span className="text-gray-600">{getFeatureName(upgrade.feature)}:</span>
                    <span className="text-gray-900">
                      {formatLimit(upgrade.fromLimit)} → {formatLimit(upgrade.toLimit)}
                    </span>
                    {upgrade.isUnlimited && (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Downgrades */}
          {featureDowngrades.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-orange-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm font-medium">Réductions</span>
              </div>
              <div className="space-y-2 ml-6">
                {featureDowngrades.map((downgrade, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {getFeatureIcon(downgrade.feature)}
                    <span className="text-gray-600">{getFeatureName(downgrade.feature)}:</span>
                    <span className="text-gray-900">
                      {formatLimit(downgrade.fromLimit)} → {formatLimit(downgrade.toLimit)}
                    </span>
                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pay-as-you-go Items */}
      {payAsYouGoItems.length > 0 && (
        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-gray-900">Éléments pay-as-you-go</h4>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-700 mb-3">
              Ces éléments sont nécessaires car le nouveau package ne couvre pas entièrement vos besoins :
            </p>
            <div className="space-y-2">
              {payAsYouGoItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-orange-700">
                    {getFeatureName(item.feature)}: {item.requestedAmount - item.currentLimit} supplémentaires
                  </span>
                  <span className="font-medium text-orange-800">
                    {formatPrice(item.totalCost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
