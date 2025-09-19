import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { TokenService } from '../services/tokenService';
import { Brain, Crown, Star, Zap, ChevronRight } from 'lucide-react';

interface UserPackageInfoProps {
  className?: string;
  showTokens?: boolean;
  clickable?: boolean;
}

export const UserPackageInfo: React.FC<UserPackageInfoProps> = ({ 
  className = '', 
  showTokens = true,
  clickable = true 
}) => {
  const { user } = useAuth();
  const { getMonthlyTokens, hasUnlimitedTokens } = usePackageAccess();
  const navigate = useNavigate();

  if (!user || !user.package) return null;

  const monthlyLimit = getMonthlyTokens();
  const isUnlimited = hasUnlimitedTokens();
  const remainingTokens = TokenService.getRemainingTokensWithPayAsYouGo(user, monthlyLimit);
  const usagePercentage = TokenService.getTokenUsagePercentage(user, monthlyLimit);

  const getPackageIcon = (packageType: string) => {
    switch (packageType) {
      case 'starter': return <Star className="h-4 w-4 text-blue-500" />;
      case 'standard': return <Crown className="h-4 w-4 text-purple-500" />;
      case 'premium': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'custom': return <Brain className="h-4 w-4 text-green-500" />;
      default: return <Star className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPackageName = (packageType: string) => {
    switch (packageType) {
      case 'starter': return 'Starter';
      case 'standard': return 'Standard';
      case 'premium': return 'Premium';
      case 'custom': return 'Custom';
      default: return 'Inconnu';
    }
  };

  const getPackageColor = (packageType: string) => {
    switch (packageType) {
      case 'starter': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'standard': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'premium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'custom': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleClick = () => {
    if (clickable) {
      navigate('/packages/manage');
    }
  };

  return (
    <div 
      className={`flex items-center space-x-2 ${clickable ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' : ''} ${className}`}
      onClick={handleClick}
    >
      {/* Package info */}
      <div className={`flex items-center space-x-2 px-2 py-1 rounded-md border text-xs font-medium ${getPackageColor(user.package)}`}>
        {getPackageIcon(user.package)}
        <span>{getPackageName(user.package)}</span>
      </div>

      {/* Tokens info */}
      {showTokens && (
        <div className="flex items-center space-x-1 text-xs text-gray-600">
          <Brain className="h-3 w-3" />
          <span>
            {isUnlimited ? (
              <span className="text-green-600 font-medium">∞</span>
            ) : (
              <span>
                <span className="font-medium">{remainingTokens.toLocaleString()}</span>
                <span className="text-gray-400">/{monthlyLimit.toLocaleString()}</span>
              </span>
            )}
          </span>
        </div>
      )}

      {/* Click indicator */}
      {clickable && (
        <ChevronRight className="h-3 w-3 text-gray-400" />
      )}
    </div>
  );
};
