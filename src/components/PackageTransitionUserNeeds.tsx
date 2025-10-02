import React, { useState } from 'react';
import { 
  FileText, 
  BarChart3, 
  Users, 
  Zap, 
  Info,
  Plus,
  Minus
} from 'lucide-react';
import { UserNeeds } from '../services/packageTransitionService';
import { PackageType, PACKAGE_LIMITS } from '../config/packageFeatures';

interface PackageTransitionUserNeedsProps {
  currentPackage: PackageType;
  newPackage: PackageType;
  onNeedsChange: (needs: UserNeeds) => void;
  className?: string;
}

export const PackageTransitionUserNeeds: React.FC<PackageTransitionUserNeedsProps> = ({
  currentPackage,
  newPackage,
  onNeedsChange,
  className = ''
}) => {
  const [needs, setNeeds] = useState<UserNeeds>({
    forms: 0,
    dashboards: 0,
    users: 0,
    tokens: 0
  });

  const updateNeed = (feature: keyof UserNeeds, value: number) => {
    const newNeeds = { ...needs, [feature]: Math.max(0, value) };
    setNeeds(newNeeds);
    onNeedsChange(newNeeds);
  };

  const incrementNeed = (feature: keyof UserNeeds) => {
    updateNeed(feature, (needs[feature] || 0) + 1);
  };

  const decrementNeed = (feature: keyof UserNeeds) => {
    updateNeed(feature, Math.max(0, (needs[feature] || 0) - 1));
  };

  const getFeatureInfo = (feature: keyof UserNeeds) => {
    switch (feature) {
      case 'forms':
        return {
          icon: <FileText className="h-4 w-4" />,
          name: 'Formulaires',
          currentLimit: PACKAGE_LIMITS[currentPackage].maxForms,
          newLimit: PACKAGE_LIMITS[newPackage].maxForms,
          description: 'Nombre de formulaires que vous souhaitez créer'
        };
      case 'dashboards':
        return {
          icon: <BarChart3 className="h-4 w-4" />,
          name: 'Tableaux de bord',
          currentLimit: PACKAGE_LIMITS[currentPackage].maxDashboards,
          newLimit: PACKAGE_LIMITS[newPackage].maxDashboards,
          description: 'Nombre de tableaux de bord que vous souhaitez créer'
        };
      case 'users':
        return {
          icon: <Users className="h-4 w-4" />,
          name: 'Utilisateurs',
          currentLimit: PACKAGE_LIMITS[currentPackage].maxUsers,
          newLimit: PACKAGE_LIMITS[newPackage].maxUsers,
          description: 'Nombre total d\'utilisateurs dans votre équipe'
        };
      case 'tokens':
        return {
          icon: <Zap className="h-4 w-4" />,
          name: 'Tokens ARCHA',
          currentLimit: PACKAGE_LIMITS[currentPackage].monthlyTokens,
          newLimit: PACKAGE_LIMITS[newPackage].monthlyTokens,
          description: 'Tokens ARCHA supplémentaires nécessaires'
        };
      default:
        return {
          icon: <Info className="h-4 w-4" />,
          name: 'Fonctionnalité',
          currentLimit: 0,
          newLimit: 0,
          description: 'Description de la fonctionnalité'
        };
    }
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Illimité' : limit.toLocaleString();
  };

  const needsPayAsYouGo = (feature: keyof UserNeeds) => {
    const newLimit = PACKAGE_LIMITS[newPackage][feature];
    const requestedAmount = needs[feature] || 0;
    return newLimit !== -1 && requestedAmount > newLimit;
  };

  const getPayAsYouGoCost = (feature: keyof UserNeeds) => {
    const newLimit = PACKAGE_LIMITS[newPackage][feature];
    const requestedAmount = needs[feature] || 0;
    const extraNeeded = Math.max(0, requestedAmount - newLimit);
    
    const prices: Record<keyof UserNeeds, number> = {
      forms: 5000,
      dashboards: 10000,
      users: 7000,
      tokens: 0.0085
    };
    
    return extraNeeded * prices[feature];
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Info className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Vos besoins spécifiques</h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-6">
        Indiquez vos besoins spécifiques pour calculer le coût exact de votre transition. 
        Si vos besoins dépassent les limites du nouveau package, des frais pay-as-you-go s'appliqueront.
      </p>

      <div className="space-y-6">
        {(['forms', 'dashboards', 'users', 'tokens'] as const).map((feature) => {
          const info = getFeatureInfo(feature);
          const currentValue = needs[feature] || 0;
          const needsPayAsYouGoForFeature = needsPayAsYouGo(feature);
          const payAsYouGoCost = getPayAsYouGoCost(feature);

          return (
            <div key={feature} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                {info.icon}
                <h4 className="font-medium text-gray-900">{info.name}</h4>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">{info.description}</p>
              
              {/* Current vs New Package Limits */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Actuel:</span>
                  <span className="font-medium text-gray-700">
                    {formatLimit(info.currentLimit)}
                  </span>
                </div>
                <div className="text-gray-300">→</div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Nouveau:</span>
                  <span className="font-medium text-blue-600">
                    {formatLimit(info.newLimit)}
                  </span>
                </div>
              </div>

              {/* Input Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => decrementNeed(feature)}
                  className="p-2 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors"
                  disabled={currentValue === 0}
                >
                  <Minus className="h-4 w-4" />
                </button>
                
                <div className="flex-1">
                  <input
                    type="number"
                    value={currentValue}
                    onChange={(e) => updateNeed(feature, parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-center font-medium"
                    min="0"
                  />
                </div>
                
                <button
                  onClick={() => incrementNeed(feature)}
                  className="p-2 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Pay-as-you-go Warning */}
              {needsPayAsYouGoForFeature && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-medium">Pay-as-you-go requis</span>
                  </div>
                  <p className="text-sm text-orange-600 mt-1">
                    Vous demandez {currentValue} {info.name.toLowerCase()}, mais le nouveau package n'en inclut que {formatLimit(info.newLimit)}.
                    Coût supplémentaire: {payAsYouGoCost.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Résumé de vos besoins</h4>
        <div className="space-y-1 text-sm text-blue-700">
          {(['forms', 'dashboards', 'users', 'tokens'] as const).map((feature) => {
            const info = getFeatureInfo(feature);
            const currentValue = needs[feature] || 0;
            const needsPayAsYouGoForFeature = needsPayAsYouGo(feature);
            
            if (currentValue === 0) return null;
            
            return (
              <div key={feature} className="flex justify-between items-center">
                <span>{info.name}: {currentValue}</span>
                {needsPayAsYouGoForFeature && (
                  <span className="text-orange-600 font-medium">
                    +{getPayAsYouGoCost(feature).toLocaleString('fr-FR')} FCFA
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
