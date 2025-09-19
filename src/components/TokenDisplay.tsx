import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { TokenService } from '../services/tokenService';
import { Brain, Zap } from 'lucide-react';

interface TokenDisplayProps {
  className?: string;
  showProgressBar?: boolean;
  compact?: boolean;
}

export const TokenDisplay: React.FC<TokenDisplayProps> = ({ 
  className = '', 
  showProgressBar = true,
  compact = false 
}) => {
  const { user } = useAuth();
  const { getMonthlyTokens, hasUnlimitedTokens } = usePackageAccess();

  if (!user || !user.package) return null;

  const monthlyLimit = getMonthlyTokens();
  const isUnlimited = hasUnlimitedTokens();
  const remainingTokens = TokenService.getRemainingTokensWithPayAsYouGo(user, monthlyLimit);
  const usagePercentage = TokenService.getTokenUsagePercentage(user, monthlyLimit);
  const tokensUsed = user.tokensUsedMonthly || 0;

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 text-sm ${className}`}>
        <Brain className="h-4 w-4 text-blue-500" />
        <span className="text-gray-600">
          {isUnlimited ? (
            <span className="text-green-600 font-medium">Tokens illimités</span>
          ) : (
            <span>
              <span className="font-medium text-gray-900">{tokensUsed.toLocaleString()}</span>
              <span className="text-gray-500">/{TokenService.getTotalAvailableTokens(user, monthlyLimit).toLocaleString()}</span>
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-medium text-gray-900">
            Tokens Archa disponibles
          </h3>
        </div>
        {isUnlimited && (
          <div className="flex items-center space-x-1 text-green-600">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium">Illimité</span>
          </div>
        )}
      </div>

      {!isUnlimited && (
        <>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">
              {remainingTokens.toLocaleString()} tokens restants
            </span>
            <span className="text-gray-500">
              {tokensUsed.toLocaleString()}/{TokenService.getTotalAvailableTokens(user, monthlyLimit).toLocaleString()} utilisés
            </span>
          </div>
          
          {showProgressBar && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  usagePercentage >= 90 
                    ? 'bg-red-500' 
                    : usagePercentage >= 75 
                    ? 'bg-yellow-500' 
                    : 'bg-blue-500'
                }`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            {usagePercentage >= 90 && (
              <span className="text-red-600 font-medium">
                ⚠️ Limite presque atteinte
              </span>
            )}
            {usagePercentage >= 75 && usagePercentage < 90 && (
              <span className="text-yellow-600 font-medium">
                ⚡ Utilisation élevée
              </span>
            )}
            {usagePercentage < 75 && (
              <span className="text-green-600">
                ✅ Utilisation normale
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
