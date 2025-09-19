import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { useApp } from '../contexts/AppContext';
import { TokenService } from '../services/tokenService';
import { Card } from './Card';
import { Button } from './Button';
import { 
  getPackageDisplayName, 
  getPackagePrice, 
  PACKAGE_LIMITS 
} from '../config/packageFeatures';
import { 
  Crown, 
  Users, 
  FileText, 
  BarChart3, 
  Brain, 
  Calendar,
  AlertTriangle,
  Plus,
  Settings,
  ChevronRight,
  Clock
} from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { useToast } from '../hooks/useToast';
import { PayAsYouGoService } from '../services/payAsYouGoService';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface DirectorPackageOverviewProps {
  className?: string;
}

export const DirectorPackageOverview: React.FC<DirectorPackageOverviewProps> = ({ 
  className = '' 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    packageType, 
    getLimit, 
    isLimitUnlimited, 
    getMonthlyTokens,
    hasUnlimitedTokens,
    getAdditionalUserCost,
    getPayAsYouGoCapacity,
    getTotalLimit
  } = usePackageAccess();
  const { forms, dashboards, employees } = useApp();
  const { toast, showSuccess, showError } = useToast();
  
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    type: 'tokens' | 'forms' | 'dashboards' | 'users';
    currentLimit: number;
  }>({
    isOpen: false,
    type: 'tokens',
    currentLimit: 0
  });

  if (!user || !packageType) {
    return null;
  }

  const displayName = getPackageDisplayName(packageType);
  const price = getPackagePrice(packageType);
  const monthlyTokens = getMonthlyTokens();
  const additionalUserCost = getAdditionalUserCost();
  
  // Calculate consumption levels
  const currentForms = forms.length;
  const currentDashboards = dashboards.length;
  const currentUsers = employees.filter(emp => emp.isApproved !== false).length;
  const maxForms = getLimit('maxForms');
  const maxDashboards = getLimit('maxDashboards');
  const maxUsers = getLimit('maxUsers');
  
  // Get pay-as-you-go capacities
  const payAsYouGoForms = getPayAsYouGoCapacity('maxForms');
  const payAsYouGoDashboards = getPayAsYouGoCapacity('maxDashboards');
  const payAsYouGoUsers = getPayAsYouGoCapacity('maxUsers');
  
  // Get total limits (package + pay-as-you-go)
  const totalForms = getTotalLimit('maxForms');
  const totalDashboards = getTotalLimit('maxDashboards');
  const totalUsers = getTotalLimit('maxUsers');
  
  // Calculate token consumption
  const remainingTokens = TokenService.getRemainingTokensWithPayAsYouGo(user, monthlyTokens);
  const totalAvailableTokens = TokenService.getTotalAvailableTokens(user, monthlyTokens);
  const usedTokens = totalAvailableTokens - remainingTokens;
  const tokenUsagePercentage = hasUnlimitedTokens() ? 0 : (usedTokens / totalAvailableTokens) * 100;
  
  // Calculate subscription days remaining (assuming 30-day cycles)
  const subscriptionStartDate = user.subscriptionStartDate || user.createdAt;
  let startDate: Date;
  
  try {
    startDate = subscriptionStartDate instanceof Date ? subscriptionStartDate : new Date(subscriptionStartDate);
    // Check if the date is valid
    if (isNaN(startDate.getTime())) {
      startDate = new Date(); // Fallback to current date
    }
  } catch (error) {
    startDate = new Date(); // Fallback to current date
  }
  
  // Calculate days since activation and days remaining
  const now = new Date();
  const daysSinceActivation = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate the next renewal date (30 days from activation, then every 30 days)
  const nextRenewalDate = new Date(startDate);
  const cyclesPassed = Math.floor(daysSinceActivation / 30);
  nextRenewalDate.setDate(startDate.getDate() + (cyclesPassed + 1) * 30);
  
  // Calculate days remaining until next renewal
  const daysRemaining = Math.max(1, Math.ceil((nextRenewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isNearRenewal = daysRemaining <= 7;
  
  // Check if any limits are reached
  const formsLimitReached = !isLimitUnlimited('maxForms') && currentForms >= maxForms;
  const dashboardsLimitReached = !isLimitUnlimited('maxDashboards') && currentDashboards >= maxDashboards;
  const usersLimitReached = !isLimitUnlimited('maxUsers') && currentUsers >= maxUsers;
  const tokensLimitReached = !hasUnlimitedTokens() && (remainingTokens <= 0 || tokenUsagePercentage >= 50 || remainingTokens <= 2000);
  
  // Debug logging for token limits
  console.log('🔍 Token limit debug:', {
    hasUnlimitedTokens: hasUnlimitedTokens(),
    remainingTokens,
    tokenUsagePercentage: tokenUsagePercentage.toFixed(1) + '%',
    tokensLimitReached,
    totalAvailableTokens,
    usedTokens,
    monthlyTokens,
    userTokensUsedMonthly: user.tokensUsedMonthly,
    userPayAsYouGoTokens: user.payAsYouGoTokens
  });
  
  const hasAnyLimitReached = formsLimitReached || dashboardsLimitReached || usersLimitReached || tokensLimitReached;

  const getPackageIcon = (packageType: string) => {
    switch (packageType) {
      case 'starter': return <Crown className="h-5 w-5 text-blue-500" />;
      case 'standard': return <Crown className="h-5 w-5 text-green-500" />;
      case 'premium': return <Crown className="h-5 w-5 text-purple-500" />;
      case 'custom': return <Crown className="h-5 w-5 text-orange-500" />;
      default: return <Crown className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPackageColor = (packageType: string) => {
    switch (packageType) {
      case 'starter': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'standard': return 'text-green-600 bg-green-50 border-green-200';
      case 'premium': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'custom': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const openPaymentModal = (type: 'tokens' | 'forms' | 'dashboards' | 'users', currentLimit: number) => {
    setPaymentModal({ isOpen: true, type, currentLimit });
  };

  const handlePurchaseResource = async (option: any) => {
    if (!user) {
      showError('Utilisateur non connecté');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('Utilisateur non trouvé');
      }
      
      const userData = userDoc.data();
      const currentPayAsYouGoResources = userData.payAsYouGoResources || {};
      
      if (option.id.startsWith('tokens-')) {
        // Handle token purchases using PayAsYouGoService
        const tokenPackage = {
          tokens: parseInt(option.id.split('-')[1].replace('k', '000')),
          price: option.price,
          popular: option.popular || false,
          description: option.description
        };
        
        const success = await PayAsYouGoService.purchaseTokens(user.id, tokenPackage);
        if (!success) {
          throw new Error('Erreur lors de l\'achat des tokens');
        }
      } else {
        // Handle other resource purchases
        let resourceType: string;
        let quantity: number;
        
        if (option.id.startsWith('forms-')) {
          resourceType = 'forms';
          if (option.id.includes('unlimited')) {
            quantity = 999; // Large number for unlimited
          } else {
            quantity = parseInt(option.id.split('-')[1]);
          }
        } else if (option.id.startsWith('dashboards-')) {
          resourceType = 'dashboards';
          if (option.id.includes('unlimited')) {
            quantity = 999; // Large number for unlimited
          } else {
            quantity = parseInt(option.id.split('-')[1]);
          }
        } else if (option.id.startsWith('users-')) {
          resourceType = 'users';
          quantity = parseInt(option.id.split('-')[1]);
        } else {
          throw new Error('Type de ressource non reconnu');
        }
        
        // Add the new resource to the user's pay-as-you-go resources
        if (!currentPayAsYouGoResources[resourceType]) {
          currentPayAsYouGoResources[resourceType] = 0;
        }
        currentPayAsYouGoResources[resourceType] += quantity;
        
        // Update the user document in Firebase
        await updateDoc(userRef, {
          payAsYouGoResources: currentPayAsYouGoResources,
          updatedAt: serverTimestamp()
        });
      }
      
      showSuccess(`${option.name} acheté avec succès !`);
      setPaymentModal({ isOpen: false, type: 'tokens', currentLimit: 0 });
      
    } catch (error) {
      console.error('Erreur lors de l\'achat:', error);
      showError('Erreur lors de l\'achat. Veuillez réessayer.');
    }
  };

  const handleManagePackages = () => {
    navigate('/packages/manage');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Package Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getPackageColor(packageType)}`}>
              {getPackageIcon(packageType)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Package {displayName}
              </h3>
              <p className="text-sm text-gray-600">{price}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleManagePackages}
            className="flex items-center space-x-1"
          >
            <Settings className="h-4 w-4" />
            <span>Gérer</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Subscription Status */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Activé le</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {startDate.toLocaleDateString('fr-FR')}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Renouvellement</span>
              </div>
              <div className={`text-sm font-semibold ${isNearRenewal ? 'text-orange-600' : 'text-gray-900'}`}>
                {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Prochain renouvellement</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {nextRenewalDate.toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
          
          {isNearRenewal && (
            <div className="mt-3 flex items-center space-x-1 text-xs text-orange-600 bg-orange-50 p-2 rounded">
              <AlertTriangle className="h-3 w-3" />
              <span>Renouvellement proche - {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Consumption Levels */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Forms */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Formulaires</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {currentForms}/{isLimitUnlimited('maxForms') ? 'Illimité' : totalForms}
                  {payAsYouGoForms > 0 && (
                    <span className="text-xs text-green-600 ml-1">
                      (+{payAsYouGoForms} pay-as-you-go)
                    </span>
                  )}
                </span>
                {formsLimitReached && (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                )}
              </div>
            </div>

            {/* Dashboards */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Tableaux de bord</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {currentDashboards}/{isLimitUnlimited('maxDashboards') ? 'Illimité' : totalDashboards}
                  {payAsYouGoDashboards > 0 && (
                    <span className="text-xs text-green-600 ml-1">
                      (+{payAsYouGoDashboards} pay-as-you-go)
                    </span>
                  )}
                </span>
                {dashboardsLimitReached && (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                )}
              </div>
            </div>

            {/* Users */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Utilisateurs</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {currentUsers}/{isLimitUnlimited('maxUsers') ? 'Illimité' : totalUsers}
                  {payAsYouGoUsers > 0 && (
                    <span className="text-xs text-green-600 ml-1">
                      (+{payAsYouGoUsers} pay-as-you-go)
                    </span>
                  )}
                </span>
                {usersLimitReached && (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                )}
              </div>
            </div>

            {/* Tokens */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Tokens Archa</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {hasUnlimitedTokens() ? 'Illimité' : `${remainingTokens.toLocaleString()}/${totalAvailableTokens.toLocaleString()}`}
                </span>
                {tokensLimitReached && (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Pay-as-you-go Options - Only show when limits are reached */}
      {hasAnyLimitReached && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h4 className="font-semibold text-orange-800">Options supplémentaires</h4>
          </div>
          <p className="text-sm text-orange-700 mb-4">
            Vous avez atteint une limite. Achetez des ressources supplémentaires pour continuer.
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {formsLimitReached && (
              <Button
                size="sm"
                onClick={() => openPaymentModal('forms', maxForms)}
                className="bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center"
              >
                <Plus className="h-3 w-3 mr-1" />
                Formulaires
              </Button>
            )}
            
            {dashboardsLimitReached && (
              <Button
                size="sm"
                onClick={() => openPaymentModal('dashboards', maxDashboards)}
                className="bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center"
              >
                <Plus className="h-3 w-3 mr-1" />
                Tableaux
              </Button>
            )}
            
            {usersLimitReached && (
              <Button
                size="sm"
                onClick={() => openPaymentModal('users', maxUsers)}
                className="bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center"
              >
                <Plus className="h-3 w-3 mr-1" />
                Utilisateurs
              </Button>
            )}
            
            {tokensLimitReached && (
              <Button
                size="sm"
                onClick={() => openPaymentModal('tokens', 0)}
                className="bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center"
              >
                <Plus className="h-3 w-3 mr-1" />
                Tokens
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ isOpen: false, type: 'tokens', currentLimit: 0 })}
        type={paymentModal.type}
        currentLimit={paymentModal.currentLimit}
        onPurchase={handlePurchaseResource}
      />
    </div>
  );
};
