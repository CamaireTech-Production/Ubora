import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { useApp } from '../contexts/AppContext';
import { Card } from './Card';
import { Button } from './Button';
import { 
  getPackageDisplayName, 
  getPackagePrice
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
  Clock,
  Sparkles,
  TrendingUp,
  Shield,
  Zap
} from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { useToast } from '../hooks/useToast';
import { PayAsYouGoService } from '../services/payAsYouGoService';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { doc, getDoc } from 'firebase/firestore';
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
    packageInfo,
    getLimit, 
    isLimitUnlimited, 
    getMonthlyTokens,
    hasUnlimitedTokens,
    getPayAsYouGoCapacity,
    getTotalLimit
  } = usePackageAccess();
  const { forms, dashboards, employees } = useApp();
  const { showSuccess, showError } = useToast();
  
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
  
  // Calculate token consumption using session data
  const remainingTokens = packageInfo?.tokensRemaining || 0;
  const totalAvailableTokens = packageInfo?.totalTokens || 0;
  const usedTokens = packageInfo?.tokensUsed || 0;
  const tokenUsagePercentage = hasUnlimitedTokens() ? 0 : (totalAvailableTokens > 0 ? (usedTokens / totalAvailableTokens) * 100 : 0);
  
  // Get subscription dates from session data
  const startDate = packageInfo?.subscriptionStartDate || new Date();
  const endDate = packageInfo?.subscriptionEndDate || new Date();
  const daysRemaining = packageInfo?.daysRemaining || 0;
  const isNearRenewal = daysRemaining <= 7 && daysRemaining > 0;
  
  // Check if any limits are reached (only show warnings for actual limits, not pay-as-you-go)
  const formsLimitReached = !isLimitUnlimited('maxForms') && currentForms >= maxForms && payAsYouGoForms === 0;
  const dashboardsLimitReached = !isLimitUnlimited('maxDashboards') && currentDashboards >= maxDashboards && payAsYouGoDashboards === 0;
  const usersLimitReached = !isLimitUnlimited('maxUsers') && currentUsers >= maxUsers && payAsYouGoUsers === 0;
  const tokensLimitReached = !hasUnlimitedTokens() && remainingTokens <= 500; // Only show warning when critically low
  
  // Debug logging for token limits
  // Token limit data available for debugging if needed
  
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
      
      // No need to get user data since we're using SubscriptionSessionService
      
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
        // Handle other resource purchases using SubscriptionSessionService
        let resourceType: 'forms' | 'dashboards' | 'users';
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
        
        // Use SubscriptionSessionService to add pay-as-you-go resources to the active session
        const purchase = {
          itemType: resourceType,
          quantity: quantity,
          amountPaid: option.price,
          purchaseDate: new Date(),
          paymentMethod: 'card'
        };
        
        const success = await SubscriptionSessionService.addPayAsYouGoResources(
          user.id,
          purchase
        );
        
        if (!success) {
          throw new Error('Erreur lors de l\'ajout de la ressource');
        }
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
    <div className={`space-y-6 ${className}`}>
      {/* Main Package Card - Modern Glassmorphism Design */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl"></div>
        
        {/* Glassmorphism Card */}
        <div className="relative backdrop-blur-sm bg-white/80 border border-white/20 rounded-2xl shadow-xl shadow-blue-500/10 p-8">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
            <div className="flex items-center space-x-4 mb-4 lg:mb-0">
              {/* Package Icon with Glow Effect */}
              <div className="relative">
                <div className={`p-4 rounded-2xl ${getPackageColor(packageType)} shadow-lg transform transition-transform hover:scale-105`}>
                  {getPackageIcon(packageType)}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/20 to-purple-400/20 blur-xl"></div>
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Package {displayName}
                  </h3>
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                </div>
                <p className="text-lg font-semibold text-gray-600">{price}</p>
                <div className="flex items-center space-x-1 mt-1">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600 font-medium">Actif</span>
                </div>
              </div>
            </div>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={handleManagePackages}
              className="flex items-center space-x-2 bg-white/50 backdrop-blur-sm border border-white/30 hover:bg-white/70 transition-all duration-200 shadow-lg"
            >
              <Settings className="h-4 w-4" />
              <span>Gérer</span>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Subscription Status - Modern Timeline Design */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h4 className="text-lg font-semibold text-gray-900">Statut de l'abonnement</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Activation Date */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700">Activé le</span>
                </div>
                <p className="text-lg font-bold text-blue-900">
                  {startDate.toLocaleDateString('fr-FR')}
                </p>
              </div>
              
              {/* Days Remaining */}
              <div className={`rounded-xl p-4 border ${isNearRenewal ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/50' : 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-200/50'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${isNearRenewal ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                  <span className={`text-sm font-medium ${isNearRenewal ? 'text-orange-700' : 'text-green-700'}`}>
                    {isNearRenewal ? 'Expire dans' : 'Renouvellement dans'}
                  </span>
                </div>
                <p className={`text-lg font-bold ${isNearRenewal ? 'text-orange-900' : 'text-green-900'}`}>
                  {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
                </p>
              </div>
              
              {/* Next Renewal */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/50">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm font-medium text-purple-700">Prochain renouvellement</span>
                </div>
                <p className="text-lg font-bold text-purple-900">
                  {endDate.toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            
            {isNearRenewal && (
              <div className="mt-4 flex items-center space-x-2 text-sm text-orange-700 bg-orange-50/80 backdrop-blur-sm p-3 rounded-xl border border-orange-200/50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="font-medium">Renouvellement proche - {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Resource Usage - Modern Cards with Progress */}
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <h4 className="text-lg font-semibold text-gray-900">Utilisation des ressources</h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Forms */}
              <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Formulaires</span>
                  </div>
                  {formsLimitReached && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {isLimitUnlimited('maxForms') ? '∞' : currentForms}
                </div>
                <div className="text-sm text-gray-600">
                  {isLimitUnlimited('maxForms') ? 'Illimité' : `sur ${totalForms}`}
                </div>
                {!isLimitUnlimited('maxForms') && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((currentForms / totalForms) * 100, 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Dashboards */}
              <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Tableaux</span>
                  </div>
                  {dashboardsLimitReached && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {isLimitUnlimited('maxDashboards') ? '∞' : currentDashboards}
                </div>
                <div className="text-sm text-gray-600">
                  {isLimitUnlimited('maxDashboards') ? 'Illimité' : `sur ${totalDashboards}`}
                </div>
                {!isLimitUnlimited('maxDashboards') && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-purple-500 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((currentDashboards / totalDashboards) * 100, 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Users */}
              <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Users className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Utilisateurs</span>
                  </div>
                  {usersLimitReached && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {isLimitUnlimited('maxUsers') ? '∞' : currentUsers}
                </div>
                <div className="text-sm text-gray-600">
                  {isLimitUnlimited('maxUsers') ? 'Illimité' : `sur ${totalUsers}`}
                </div>
                {!isLimitUnlimited('maxUsers') && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((currentUsers / totalUsers) * 100, 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Tokens */}
              <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Brain className="h-4 w-4 text-yellow-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Tokens</span>
                  </div>
                  {tokensLimitReached && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {hasUnlimitedTokens() ? '∞' : remainingTokens.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  {hasUnlimitedTokens() ? 'Illimité' : 'restants'}
                </div>
                {!hasUnlimitedTokens() && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min((remainingTokens / totalAvailableTokens) * 100, 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pay-as-you-go Resources Section - Modern Design */}
      {(packageInfo?.payAsYouGoTokens || 0) > 0 || 
       (packageInfo?.payAsYouGoForms || 0) > 0 || 
       (packageInfo?.payAsYouGoDashboards || 0) > 0 || 
       (packageInfo?.payAsYouGoUsers || 0) > 0 ? (
        <div className="relative overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl"></div>
          
          {/* Glassmorphism Card */}
          <div className="relative backdrop-blur-sm bg-white/80 border border-white/20 rounded-2xl shadow-xl shadow-green-500/10 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-green-100 rounded-xl">
                <Plus className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-green-800">Ressources Pay-as-you-go</h4>
                <p className="text-sm text-green-600">Ressources supplémentaires achetées</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Pay-as-you-go Tokens */}
              {(packageInfo?.payAsYouGoTokens || 0) > 0 && (
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 shadow-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <Brain className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-700">Tokens</span>
                  </div>
                  <div className="text-xl font-bold text-green-900">
                    +{packageInfo?.payAsYouGoTokens?.toLocaleString() || '0'}
                  </div>
                </div>
              )}

              {/* Pay-as-you-go Forms */}
              {(packageInfo?.payAsYouGoForms || 0) > 0 && (
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 shadow-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <FileText className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-700">Formulaires</span>
                  </div>
                  <div className="text-xl font-bold text-green-900">
                    +{packageInfo?.payAsYouGoForms || 0}
                  </div>
                </div>
              )}

              {/* Pay-as-you-go Dashboards */}
              {(packageInfo?.payAsYouGoDashboards || 0) > 0 && (
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 shadow-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <BarChart3 className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-700">Tableaux</span>
                  </div>
                  <div className="text-xl font-bold text-green-900">
                    +{packageInfo?.payAsYouGoDashboards || 0}
                  </div>
                </div>
              )}

              {/* Pay-as-you-go Users */}
              {(packageInfo?.payAsYouGoUsers || 0) > 0 && (
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30 shadow-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <Users className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-700">Utilisateurs</span>
                  </div>
                  <div className="text-xl font-bold text-green-900">
                    +{packageInfo?.payAsYouGoUsers || 0}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Upgrade Options - Modern Design */}
      {hasAnyLimitReached && (
        <div className="relative overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl"></div>
          
          {/* Glassmorphism Card */}
          <div className="relative backdrop-blur-sm bg-white/80 border border-white/20 rounded-2xl shadow-xl shadow-orange-500/10 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-orange-800">Options supplémentaires</h4>
                <p className="text-sm text-orange-600">Achetez des ressources supplémentaires</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {formsLimitReached && (
                <Button
                  size="sm"
                  onClick={() => openPaymentModal('forms', maxForms)}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="h-4 w-4" />
                  <span>Formulaires</span>
                </Button>
              )}
              
              {dashboardsLimitReached && (
                <Button
                  size="sm"
                  onClick={() => openPaymentModal('dashboards', maxDashboards)}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tableaux</span>
                </Button>
              )}
              
              {usersLimitReached && (
                <Button
                  size="sm"
                  onClick={() => openPaymentModal('users', maxUsers)}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="h-4 w-4" />
                  <span>Utilisateurs</span>
                </Button>
              )}
              
              {tokensLimitReached && (
                <Button
                  size="sm"
                  onClick={() => openPaymentModal('tokens', 0)}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tokens</span>
                </Button>
              )}
            </div>
          </div>
        </div>
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
