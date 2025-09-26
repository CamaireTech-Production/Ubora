import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { 
  getPackageDisplayName, 
  getPackagePrice, 
  PACKAGE_LIMITS, 
  PACKAGE_FEATURES,
  PackageType 
} from '../config/packageFeatures';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { PackageTransitionService, UserNeeds } from '../services/packageTransitionService';
import { UserSessionService } from '../services/userSessionService';
import { PackageTransitionPriceExplanation } from '../components/PackageTransitionPriceExplanation';
import { 
  Check, 
  X, 
  Star, 
  Crown, 
  Zap, 
  ArrowLeft,
  CreditCard,
  Shield,
  Users,
  BarChart3,
  Brain,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { PaymentModal } from '../components/PaymentModal';
import { PayAsYouGoService } from '../services/payAsYouGoService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const PackageManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { forms, dashboards, employees } = useApp();
  const { packageType } = usePackageAccess();
  const { showSuccess, showError } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTransitionPreview, setShowTransitionPreview] = useState(false);
  const [transitionPreview, setTransitionPreview] = useState<any>(null);
  const [userNeeds, setUserNeeds] = useState<UserNeeds>({});
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    type: 'tokens' | 'forms' | 'dashboards' | 'users';
    currentLimit: number;
  }>({
    isOpen: false,
    type: 'tokens',
    currentLimit: 0
  });

  const packages: PackageType[] = ['starter', 'standard', 'premium', 'custom'];

  const getPackageIcon = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return <Zap className="h-6 w-6" />;
      case 'standard': return <Star className="h-6 w-6" />;
      case 'premium': return <Crown className="h-6 w-6" />;
      case 'custom': return <Shield className="h-6 w-6" />;
    }
  };

  const getPackageColor = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return 'text-blue-600 bg-blue-100';
      case 'standard': return 'text-green-600 bg-green-100';
      case 'premium': return 'text-purple-600 bg-purple-100';
      case 'custom': return 'text-orange-600 bg-orange-100';
    }
  };

  const getFeatureIcon = (feature: boolean) => {
    return feature ? (
      <Check className="h-4 w-4 text-green-500" />
    ) : (
      <X className="h-4 w-4 text-gray-300" />
    );
  };

  const handleUpgrade = async (pkg: PackageType) => {
    if (pkg === packageType) {
      showError('Vous avez déjà ce package !');
      return;
    }

    if (!user) {
      showError('Utilisateur non connecté');
      return;
    }

    setSelectedPackage(pkg);
    
    // Automatically calculate transition based on current usage
    const currentSession = SubscriptionSessionService.getCurrentSession(user);
    const currentUsage = {
      forms: currentSession?.usage?.formsCreated || 0,
      dashboards: currentSession?.usage?.dashboardsCreated || 0,
      users: currentSession?.usage?.usersAdded || 0,
      tokens: currentSession?.usage?.tokensUsed || 0
    };
    
    // Get enhanced transition preview with current usage
    const preview = PackageTransitionService.getEnhancedTransitionPreview(
      user, 
      pkg, 
      currentUsage
    );
    
    if (preview) {
      setTransitionPreview(preview);
      setUserNeeds(currentUsage);
      setShowTransitionPreview(true);
    } else {
      showError('Impossible de calculer la transition. Veuillez réessayer.');
    }
  };


  const confirmTransition = async () => {
    if (!selectedPackage || !user) return;

    setIsProcessing(true);
    setShowTransitionPreview(false);

    try {
      // Simulation de paiement
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Execute transition using the enhanced service
      const success = await PackageTransitionService.executeTransition(
        user.id,
        selectedPackage,
        {
          preserveUnusedPayAsYouGo: true
        },
        'simulation' // Payment method
      );
      
      if (success) {
        showSuccess(`Package ${getPackageDisplayName(selectedPackage)} activé avec succès !`);
        
        // Navigate back to the previous page instead of reloading
        setTimeout(() => {
          navigate(-1); // Go back to the previous page
        }, 1500);
      } else {
        showError('Erreur lors de l\'activation du package. Veuillez réessayer.');
      }
      
    } catch (error) {
      console.error('Erreur lors du changement de package:', error);
      showError('Erreur lors du changement de package. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
      setSelectedPackage(null);
      setTransitionPreview(null);
      setUserNeeds({});
    }
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

  const openPaymentModal = (type: 'tokens' | 'forms' | 'dashboards' | 'users', currentLimit: number) => {
    setPaymentModal({ isOpen: true, type, currentLimit });
  };

  // Get current subscription session information
  // Get package info from active session
  const packageInfo = user ? UserSessionService.getUserPackageInfo(user) : null;
  
  // Get subscription details from package info
  const daysRemaining = packageInfo?.daysRemaining || 0;
  const isNearRenewal = daysRemaining <= 7 && daysRemaining > 0;
  const startDate = packageInfo?.subscriptionStartDate || new Date();
  const nextRenewalDate = packageInfo?.subscriptionEndDate || new Date();

  return (
    <Layout title="Gestion des Packages">
      <div className="max-w-6xl mx-auto space-y-8 px-4">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/directeur/dashboard')}
              className="flex items-center space-x-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion des Packages
              </h1>
              <p className="text-gray-600">
                Gérez votre abonnement et vos ressources supplémentaires
              </p>
            </div>
          </div>
          
        </div>

        {/* Current Package Status */}
        {user && packageInfo && (
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Package Actuel: {getPackageDisplayName(packageInfo.packageType!)}
                </h3>
                <p className="text-gray-600">{getPackagePrice(packageInfo.packageType!)}</p>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${isNearRenewal ? 'text-orange-600' : 'text-gray-900'}`}>
                  {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                </div>
                {isNearRenewal && (
                  <div className="flex items-center space-x-1 text-xs text-orange-600 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Renouvellement proche</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Subscription Details */}
            <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Activé le:</span>
                  <span className="font-medium">{startDate.toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Prochain renouvellement:</span>
                  <span className="font-medium">{nextRenewalDate.toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </div>
            
            {/* Resource Usage Overview */}
            <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <BarChart3 className="h-4 w-4 mr-2" />
                Utilisation des Ressources
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Tokens */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Brain className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      if (sessionInfo.totalTokens === -1) {
                        return 'Illimité';
                      }
                      return sessionInfo.tokensRemaining.toLocaleString();
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      if (sessionInfo.totalTokens === -1) {
                        return `${sessionInfo.tokensUsed.toLocaleString()} utilisés sur Illimité`;
                      }
                      const packageTokens = sessionInfo.packageTokens;
                      const payAsYouGoTokens = sessionInfo.payAsYouGoTokens;
                      if (payAsYouGoTokens > 0) {
                        return `${sessionInfo.tokensUsed.toLocaleString()} utilisés sur ${sessionInfo.totalTokens.toLocaleString()} (${packageTokens.toLocaleString()} + pay-as-you-go ${payAsYouGoTokens.toLocaleString()})`;
                      }
                      return `${sessionInfo.tokensUsed.toLocaleString()} / ${sessionInfo.totalTokens.toLocaleString()}`;
                    })()}
                  </div>
                </div>

                {/* Forms */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <FileText className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      const currentForms = forms.length; // Use actual current data
                      if (sessionInfo.totalForms === -1) {
                        return 'Illimité';
                      }
                      return (sessionInfo.totalForms - currentForms).toString();
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      const currentForms = forms.length; // Use actual current data
                      if (sessionInfo.totalForms === -1) {
                        return `${currentForms} formulaires sur Illimité`;
                      }
                      const packageForms = sessionInfo.packageForms;
                      const payAsYouGoForms = sessionInfo.payAsYouGoForms;
                      if (payAsYouGoForms > 0) {
                        return `${currentForms} formulaires sur ${sessionInfo.totalForms} (${packageForms} + pay-as-you-go ${payAsYouGoForms})`;
                      }
                      return `${currentForms} / ${sessionInfo.totalForms}`;
                    })()}
                  </div>
                </div>

                {/* Dashboards */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      const currentDashboards = dashboards.length; // Use actual current data
                      if (sessionInfo.totalDashboards === -1) {
                        return 'Illimité';
                      }
                      return (sessionInfo.totalDashboards - currentDashboards).toString();
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      const currentDashboards = dashboards.length; // Use actual current data
                      if (sessionInfo.totalDashboards === -1) {
                        return `${currentDashboards} tableaux sur Illimité`;
                      }
                      const packageDashboards = sessionInfo.packageDashboards;
                      const payAsYouGoDashboards = sessionInfo.payAsYouGoDashboards;
                      if (payAsYouGoDashboards > 0) {
                        return `${currentDashboards} tableaux sur ${sessionInfo.totalDashboards} (${packageDashboards} + pay-as-you-go ${payAsYouGoDashboards})`;
                      }
                      return `${currentDashboards} / ${sessionInfo.totalDashboards}`;
                    })()}
                  </div>
                </div>

                {/* Users */}
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Users className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      const currentUsers = employees.filter(emp => emp.isApproved !== false).length; // Use actual current data
                      if (sessionInfo.totalUsers === -1) {
                        return 'Illimité';
                      }
                      return (sessionInfo.totalUsers - currentUsers).toString();
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const sessionInfo = UserSessionService.getUserPackageInfo(user);
                      const currentUsers = employees.filter(emp => emp.isApproved !== false).length; // Use actual current data
                      if (sessionInfo.totalUsers === -1) {
                        return `${currentUsers} utilisateurs sur Illimité`;
                      }
                      const packageUsers = sessionInfo.packageUsers;
                      const payAsYouGoUsers = sessionInfo.payAsYouGoUsers;
                      if (payAsYouGoUsers > 0) {
                        return `${currentUsers} utilisateurs sur ${sessionInfo.totalUsers} (${packageUsers} + pay-as-you-go ${payAsYouGoUsers})`;
                      }
                      return `${currentUsers} / ${sessionInfo.totalUsers}`;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Agence:</span>
                  <span className="font-medium">{user.agencyId || 'N/A'}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-right break-all max-w-[200px] truncate" title={user.email}>
                    {user.email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Rôle:</span>
                  <span className="font-medium capitalize">{user.role}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Current Pay-as-You-Go Resources */}
        {(() => {
          if (!user) return null;
          
          const sessionInfo = UserSessionService.getUserPackageInfo(user);
          const hasPayAsYouGoResources = sessionInfo.payAsYouGoTokens > 0 || 
                                        sessionInfo.payAsYouGoForms > 0 || 
                                        sessionInfo.payAsYouGoDashboards > 0 || 
                                        sessionInfo.payAsYouGoUsers > 0;
          
          if (!hasPayAsYouGoResources) return null;
          
          return (
            <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center">
                  <Zap className="h-6 w-6 mr-2 text-green-600" />
                  Ressources Pay-as-You-Go Actives
                </h2>
                <p className="text-gray-600">
                  Ressources supplémentaires que vous avez achetées en plus de votre package
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Pay-as-You-Go Tokens */}
                {sessionInfo.payAsYouGoTokens > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="inline-flex p-3 rounded-full bg-blue-100 text-blue-600 mb-3">
                      <Brain className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Tokens ARCHA</h3>
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      +{sessionInfo.payAsYouGoTokens.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Tokens supplémentaires
                    </div>
                  </div>
                )}

                {/* Pay-as-You-Go Forms */}
                {sessionInfo.payAsYouGoForms > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="inline-flex p-3 rounded-full bg-green-100 text-green-600 mb-3">
                      <FileText className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Formulaires</h3>
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      +{sessionInfo.payAsYouGoForms}
                    </div>
                    <div className="text-sm text-gray-500">
                      Formulaires supplémentaires
                    </div>
                  </div>
                )}

                {/* Pay-as-You-Go Dashboards */}
                {sessionInfo.payAsYouGoDashboards > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="inline-flex p-3 rounded-full bg-purple-100 text-purple-600 mb-3">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Tableaux de bord</h3>
                    <div className="text-2xl font-bold text-purple-600 mb-2">
                      +{sessionInfo.payAsYouGoDashboards}
                    </div>
                    <div className="text-sm text-gray-500">
                      Tableaux supplémentaires
                    </div>
                  </div>
                )}

                {/* Pay-as-You-Go Users */}
                {sessionInfo.payAsYouGoUsers > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="inline-flex p-3 rounded-full bg-orange-100 text-orange-600 mb-3">
                      <Users className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Utilisateurs</h3>
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                      +{sessionInfo.payAsYouGoUsers}
                    </div>
                    <div className="text-sm text-gray-500">
                      Utilisateurs supplémentaires
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })()}

        {/* Package Comparison Grid */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Choisissez votre nouveau package
            </h2>
            <p className="text-gray-600">
              Comparez les fonctionnalités et changez de package à tout moment
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {packages.map((pkg) => {
              const isCurrentPackage = pkg === packageType;
              const isSelected = selectedPackage === pkg;
              const limits = PACKAGE_LIMITS[pkg];
              const features = PACKAGE_FEATURES[pkg];

              return (
                <Card 
                  key={pkg} 
                  className={`relative p-6 transition-all duration-200 ${
                    isCurrentPackage 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : isSelected 
                      ? 'ring-2 ring-green-500 bg-green-50' 
                      : 'hover:shadow-lg'
                  }`}
                >
                  {/* Badge package actuel */}
                  {isCurrentPackage && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Actuel
                      </span>
                    </div>
                  )}

                  {/* En-tête du package */}
                  <div className="text-center mb-6">
                    <div className={`inline-flex p-3 rounded-full ${getPackageColor(pkg)} mb-4`}>
                      {getPackageIcon(pkg)}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {getPackageDisplayName(pkg)}
                    </h3>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {getPackagePrice(pkg)}
                    </div>
                    <p className="text-sm text-gray-500">par mois</p>
                  </div>

                  {/* Limites principales */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Formulaires
                      </span>
                      <span className="font-medium">{limits.maxForms === -1 ? 'Illimité' : limits.maxForms}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Tableaux de bord
                      </span>
                      <span className="font-medium">{limits.maxDashboards === -1 ? 'Illimité' : limits.maxDashboards}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Utilisateurs
                      </span>
                      <span className="font-medium">{limits.maxUsers === -1 ? 'Illimité' : limits.maxUsers}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <Brain className="h-4 w-4 mr-2" />
                        Tokens Archa
                      </span>
                      <span className="font-medium">{limits.monthlyTokens === -1 ? 'Illimité' : limits.monthlyTokens.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Fonctionnalités principales */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center space-x-2 text-sm">
                      {getFeatureIcon(features.advancedAI)}
                      <span>IA Avancée</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      {getFeatureIcon(features.customBranding)}
                      <span>Branding personnalisé</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      {getFeatureIcon(features.whatsappSupport)}
                      <span>Support WhatsApp</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      {getFeatureIcon(features.customIntegrations)}
                      <span>Intégrations personnalisées</span>
                    </div>
                  </div>

                  {/* Bouton d'action */}
                  <Button
                    onClick={() => handleUpgrade(pkg)}
                    disabled={isCurrentPackage || isProcessing}
                    className={`w-full ${
                      isCurrentPackage 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isProcessing && isSelected ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Traitement...</span>
                      </div>
                    ) : isCurrentPackage ? (
                      'Package actuel'
                    ) : (
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Choisir ce package</span>
                      </div>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Section Ressources Supplémentaires */}
        <div className="max-w-4xl mx-auto">
          <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Ressources Supplémentaires
              </h2>
              <p className="text-gray-600">
                Achetez des ressources supplémentaires pour votre package actuel. 
                Ces ressources sont facturées mensuellement jusqu'à désactivation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tokens Archa */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-blue-100 text-blue-600 mb-3">
                    <Brain className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Tokens Archa</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Achetez des tokens supplémentaires pour continuer à utiliser ARCHA
                  </p>
                  <div className="text-lg font-bold text-blue-600 mb-3">
                    À partir de 2 500 FCFA
                  </div>
                  <Button
                    onClick={() => openPaymentModal('tokens', 0)}
                    className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Activer
                  </Button>
                </div>
              </div>

              {/* Formulaires */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-green-100 text-green-600 mb-3">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Formulaires</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Ajoutez des formulaires supplémentaires à votre package
                  </p>
                  <div className="text-lg font-bold text-green-600 mb-3">
                    À partir de 15 000 FCFA
                  </div>
                  <Button
                    onClick={() => openPaymentModal('forms', 4)}
                    className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-center"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Activer
                  </Button>
                </div>
              </div>

              {/* Tableaux de bord */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-purple-100 text-purple-600 mb-3">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Tableaux de bord</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Créez plus de tableaux de bord pour vos analyses
                  </p>
                  <div className="text-lg font-bold text-purple-600 mb-3">
                    À partir de 20 000 FCFA
                  </div>
                  <Button
                    onClick={() => openPaymentModal('dashboards', 1)}
                    className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Activer
                  </Button>
                </div>
              </div>

              {/* Utilisateurs */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-orange-100 text-orange-600 mb-3">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Utilisateurs</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Ajoutez des utilisateurs à votre équipe
                  </p>
                  <div className="text-lg font-bold text-orange-600 mb-3">
                    À partir de 21 000 FCFA
                  </div>
                  <Button
                    onClick={() => openPaymentModal('users', 3)}
                    className="w-full bg-orange-600 hover:bg-orange-700 flex items-center justify-center"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Activer
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                💳 Paiement sécurisé • 🔄 Ressources ajoutées immédiatement • 📞 Support 24/7
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Les ressources supplémentaires sont facturées mensuellement jusqu'à désactivation
              </p>
            </div>
          </Card>
        </div>

      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ isOpen: false, type: 'tokens', currentLimit: 0 })}
        type={paymentModal.type}
        currentLimit={paymentModal.currentLimit}
        onPurchase={handlePurchaseResource}
      />



      {/* Enhanced Package Transition Modal */}
      {transitionPreview && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${showTransitionPreview ? 'block' : 'hidden'}`}>
          <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Confirmation de transition vers {getPackageDisplayName(selectedPackage!)}
                </h2>
                <button
                  onClick={() => {
                    setShowTransitionPreview(false);
                    setTransitionPreview(null);
                    setSelectedPackage(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <PackageTransitionPriceExplanation
                  calculation={PackageTransitionService.calculateEnhancedTransition(
                    user!,
                    selectedPackage!,
                    userNeeds
                  )!}
                />
                
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé de la transition</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Package actuel</span>
                      <span className="font-medium">{getPackageDisplayName(transitionPreview.currentPackage)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Nouveau package</span>
                      <span className="font-medium text-blue-600">{getPackageDisplayName(transitionPreview.newPackage)}</span>
                    </div>
                    
                    {transitionPreview.daysRemaining > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Jours restants</span>
                        <span className="font-medium">{transitionPreview.daysRemaining} jours</span>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Montant à payer</span>
                        <span className="font-bold text-green-600">
                          {transitionPreview.priceBreakdown.finalAmount.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      
                      {transitionPreview.priceBreakdown.savings > 0 && (
                        <div className="flex justify-between items-center text-sm text-green-600 mt-2">
                          <span>Économie réalisée</span>
                          <span>-{transitionPreview.priceBreakdown.savings.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> {transitionPreview.summary}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button
                    variant="secondary"
                    onClick={() => {
                      setShowTransitionPreview(false);
                      setTransitionPreview(null);
                      setSelectedPackage(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={confirmTransition}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing ? 'Traitement...' : 'Confirmer et payer'}
                  </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
};
