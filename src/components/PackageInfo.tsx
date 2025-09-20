import React from 'react';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { getPackageDisplayName, getPackagePrice } from '../config/packageFeatures';
import { Card } from './Card';

interface PackageInfoProps {
  showLimits?: boolean;
  showUpgrade?: boolean;
  className?: string;
}

export const PackageInfo: React.FC<PackageInfoProps> = ({ 
  showLimits = true, 
  showUpgrade = true,
  className = '' 
}) => {
  const { 
    packageType, 
    getLimit, 
    isLimitUnlimited, 
    getMonthlyTokens,
    hasUnlimitedTokens,
    getAdditionalUserCost 
  } = usePackageAccess();

  if (!packageType) {
    return null;
  }

  const displayName = getPackageDisplayName(packageType);
  const price = getPackagePrice(packageType);
  const monthlyTokens = getMonthlyTokens();
  const additionalUserCost = getAdditionalUserCost();

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Package {displayName}
          </h3>
          <p className="text-sm text-gray-600">{price}</p>
        </div>
        {showUpgrade && packageType !== 'custom' && (
          <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Mettre à niveau
          </button>
        )}
      </div>

      {showLimits && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Formulaires:</span>
            <span className="font-medium">
              {isLimitUnlimited('maxForms') ? 'Illimités' : `${getLimit('maxForms')} max`}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Tableaux de bord:</span>
            <span className="font-medium">
              {isLimitUnlimited('maxDashboards') ? 'Illimités' : `${getLimit('maxDashboards')} max`}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Utilisateurs:</span>
            <span className="font-medium">
              {isLimitUnlimited('maxUsers') ? 'Illimités' : `${getLimit('maxUsers')} inclus`}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Tokens Archa/mois:</span>
            <span className="font-medium">
              {hasUnlimitedTokens() ? 'Illimités' : `${monthlyTokens.toLocaleString()}`}
            </span>
          </div>
          
          {additionalUserCost > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Utilisateur supp.:</span>
              <span className="font-medium">
                +{additionalUserCost.toLocaleString()} FCFA
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// Composant pour afficher un message de limite atteinte
interface LimitReachedProps {
  type: 'forms' | 'dashboards' | 'users';
  current: number;
  limit: number;
  onUpgrade?: () => void;
}

export const LimitReached: React.FC<LimitReachedProps> = ({ 
  type, 
  current, 
  limit, 
  onUpgrade 
}) => {
  const getTypeLabel = () => {
    switch (type) {
      case 'forms': return 'formulaires';
      case 'dashboards': return 'tableaux de bord';
      case 'users': return 'utilisateurs';
      default: return 'éléments';
    }
  };

  const getMessage = () => {
    if (limit === 0) {
      return `Vous avez actuellement ${current} ${getTypeLabel()}, mais votre package actuel ne permet pas de créer de nouveaux ${getTypeLabel()}.`;
    } else {
      return `Vous avez atteint la limite de ${limit} ${getTypeLabel()} pour votre package actuel. Vous avez actuellement ${current} ${getTypeLabel()}.`;
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Limite de package atteinte
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>
              {getMessage()}
            </p>
            <p className="mt-1 font-medium">
              Mettez à niveau votre package pour créer plus de {getTypeLabel()}.
            </p>
          </div>
          {onUpgrade && (
            <div className="mt-3">
              <button
                onClick={onUpgrade}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Voir les packages disponibles
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
