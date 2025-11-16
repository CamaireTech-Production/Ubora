import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePackageAccess } from '@ubora/shared/hooks/usePackageAccess';
import { UserSessionService } from '@ubora/shared/services/userSessionService';
import { Brain, Crown, Star, Zap, ChevronRight } from 'lucide-react';
import { PackageInfoSkeleton } from './skeletons/PackageInfoSkeleton';

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
  const { packageInfo, isLoadingUserPackageInfo } = usePackageAccess();
  const navigate = useNavigate();

  // Show skeleton while loading
  if (!user || isLoadingUserPackageInfo) {
    return <PackageInfoSkeleton />;
  }

  if (!packageInfo?.packageType) return null;

  const remainingTokens = packageInfo.tokensRemaining;
  const isUnlimited = packageInfo.totalTokens === -1;

  const getPackageIcon = (packageType: string) => {
    switch (packageType) {
      case 'free': return <Star className="h-4 w-4 text-green-500" />;
      case 'starter': return <Star className="h-4 w-4 text-blue-500" />;
      case 'standard': return <Crown className="h-4 w-4 text-purple-500" />;
      case 'premium': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'custom': return <Brain className="h-4 w-4 text-green-500" />;
      default: return <Star className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPackageName = (packageType: string) => {
    switch (packageType) {
      case 'free': return 'Gratuit';
      case 'starter': return 'Starter';
      case 'standard': return 'Standard';
      case 'premium': return 'Premium';
      case 'custom': return 'Custom';
      default: return 'Inconnu';
    }
  };

  const getPackageColor = (packageType: string) => {
    switch (packageType) {
      case 'free': return 'text-green-600 bg-green-50 border-green-200';
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
      className={`relative flex flex-col items-center space-y-1 ${clickable ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' : ''} ${className}`}
      onClick={handleClick}
    >
      {/* Package info */}
      <div className={`flex items-center space-x-2 px-2 py-1 rounded-md border text-xs font-medium ${getPackageColor(packageInfo.packageType)}`}>
        {getPackageIcon(packageInfo.packageType)}
        <span>{getPackageName(packageInfo.packageType)}</span>
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
                <span className="text-gray-400"> restants</span>
              </span>
            )}
          </span>
          {/* Click indicator moved to tokens */}
          {clickable && (
            <ChevronRight className="h-3 w-3 text-gray-400 ml-1" />
          )}
        </div>
      )}
    </div>
  );
};
