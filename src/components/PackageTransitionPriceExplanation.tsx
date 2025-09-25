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
import { EnhancedTransitionCalculation, PayAsYouGoItem, FeatureUpgrade, FeatureDowngrade } from '../services/packageTransitionService';
import { getPackageDisplayName } from '../config/packageFeatures';

interface PackageTransitionPriceExplanationProps {
  calculation: EnhancedTransitionCalculation;
  className?: string;
}

export const PackageTransitionPriceExplanation: React.FC<PackageTransitionPriceExplanationProps> = ({
  calculation,
  className = ''
}) => {
  const { priceBreakdown, daysRemaining, payAsYouGoItems, featureUpgrades, featureDowngrades } = calculation;

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
      case 'monthlyTokens': return 'Tokens IA';
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
            Il vous reste <strong>{daysRemaining} jours</strong> sur votre abonnement {getPackageDisplayName(calculation.currentSession.packageType)}.
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
              {formatPrice(priceBreakdown.currentPackageRemainingValue)}
            </span>
          </div>
          
          {/* New Package Price */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Prix du nouveau package</span>
            <span className="text-sm font-medium text-gray-900">
              {formatPrice(priceBreakdown.newPackagePrice)}
            </span>
          </div>
          
          {/* Pay-as-you-go Cost */}
          {priceBreakdown.payAsYouGoCost > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Coût pay-as-you-go</span>
              <span className="text-sm font-medium text-orange-600">
                +{formatPrice(priceBreakdown.payAsYouGoCost)}
              </span>
            </div>
          )}
          
          {/* Divider */}
          <div className="border-t border-gray-200"></div>
          
          {/* Final Amount */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-900">Montant à payer</span>
            <span className="text-lg font-bold text-green-600">
              {formatPrice(priceBreakdown.finalAmount)}
            </span>
          </div>
          
          {/* Savings */}
          {priceBreakdown.savings > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600">Économie réalisée</span>
              <span className="text-sm font-medium text-green-600">
                -{formatPrice(priceBreakdown.savings)}
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

      {/* Calculation Formula */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Formule de calcul</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Montant à payer =</strong> Prix du nouveau package - Valeur restante du package actuel + Coût pay-as-you-go</p>
          <p><strong>Valeur restante =</strong> (Prix du package actuel × Jours restants) ÷ 30 jours</p>
          {daysRemaining > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Dans votre cas: {formatPrice(priceBreakdown.newPackagePrice)} - {formatPrice(priceBreakdown.currentPackageRemainingValue)}
              {priceBreakdown.payAsYouGoCost > 0 && ` + ${formatPrice(priceBreakdown.payAsYouGoCost)}`}
              {' = '}{formatPrice(priceBreakdown.finalAmount)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
