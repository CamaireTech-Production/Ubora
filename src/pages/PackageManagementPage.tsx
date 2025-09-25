import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { TokenService } from '../services/tokenService';
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
import { SubscriptionHistoryModal } from '../components/SubscriptionHistoryModal';
import { PackageTransitionModal } from '../components/PackageTransitionModal';
import { PackageTransitionPriceExplanation } from '../components/PackageTransitionPriceExplanation';
import { PackageTransitionUserNeeds } from '../components/PackageTransitionUserNeeds';
import { SessionConsumptionDisplay } from '../components/SessionConsumptionDisplay';
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
  Plus,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { PaymentModal } from '../components/PaymentModal';
import { PayAsYouGoService } from '../services/payAsYouGoService';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const PackageManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { packageType, getMonthlyTokens, hasUnlimitedTokens } = usePackageAccess();
  const { toast, showSuccess, showError } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTransitionPreview, setShowTransitionPreview] = useState(false);
  const [transitionPreview, setTransitionPreview] = useState<any>(null);
  const [userNeeds, setUserNeeds] = useState<UserNeeds>({});
  const [showUserNeedsInput, setShowUserNeedsInput] = useState(false);
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
    setUserNeeds({});
    setShowUserNeedsInput(true);
  };

  const handleUserNeedsComplete = (needs: UserNeeds) => {
    if (!user || !selectedPackage) return;

    // Get enhanced transition preview with user needs
    const preview = PackageTransitionService.getEnhancedTransitionPreview(
      user, 
      selectedPackage, 
      needs
    );
    
    if (preview) {
      setTransitionPreview(preview);
      setUserNeeds(needs);
      setShowUserNeedsInput(false);
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

  const handleBackToUserNeeds = () => {
    setShowTransitionPreview(false);
    setShowUserNeedsInput(true);
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

  const openPaymentModal = (type: 'tokens' | 'forms' | 'dashboards' | 'users', currentLimit: number) => {
    setPaymentModal({ isOpen: true, type, currentLimit });
  };

  // Get current subscription session information
  const currentSession = user ? SubscriptionSessionService.getCurrentSession(user) : null;
  const subscriptionHistory = user ? SubscriptionSessionService.getSubscriptionHistorySummary(user) : null;
  
  // Calculate subscription days remaining using new session system
  const daysRemaining = currentSession ? SubscriptionSessionService.getDaysUntilExpiration(user!) : -1;
  const isNearRenewal = daysRemaining <= 7 && daysRemaining > 0;
  
  // Get subscription start date from current session or fallback to legacy
  const subscriptionStartDate = currentSession?.startDate || user?.subscriptionStartDate || user?.createdAt;
  let startDate: Date;
  
  try {
    if (subscriptionStartDate) {
      startDate = subscriptionStartDate instanceof Date ? subscriptionStartDate : new Date(subscriptionStartDate);
      if (isNaN(startDate.getTime())) {
        startDate = new Date();
      }
    } else {
      startDate = new Date();
    }
  } catch (error) {
    startDate = new Date();
  }
  
  const now = new Date();
  
  // Calculate next renewal date
  let nextRenewalDate: Date;
  if (currentSession) {
    // Convert Firestore Timestamp to Date if needed
    const endDate = currentSession.endDate as any;
    if (endDate instanceof Date) {
      nextRenewalDate = endDate;
    } else if (endDate && typeof endDate.toDate === 'function') {
      nextRenewalDate = endDate.toDate();
    } else {
      nextRenewalDate = new Date(endDate);
    }
  } else {
    // Default 30 days from now if no current session
    nextRenewalDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  }

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
          
          {/* Subscription History Button */}
          {user && subscriptionHistory && subscriptionHistory.totalSessions > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center space-x-2"
            >
              <Calendar className="h-4 w-4" />
              <span>Historique</span>
            </Button>
          )}
        </div>

        {/* Current Package Status */}
        {user && packageType && (
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Package Actuel: {getPackageDisplayName(packageType)}
                </h3>
                <p className="text-gray-600">{getPackagePrice(packageType)}</p>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tokens restants:</span>
                  <span className="font-medium">
                    {(() => {
                      const monthlyLimit = getMonthlyTokens();
                      const isUnlimited = hasUnlimitedTokens();
                      const remainingTokens = TokenService.getRemainingTokensWithPayAsYouGo(user, monthlyLimit);
                      return isUnlimited ? 'Illimités' : remainingTokens.toLocaleString();
                    })()}
                  </span>
                </div>
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

        {/* Session Consumption Display */}
        {user && (
          <SessionConsumptionDisplay 
            user={user} 
            showAllSessions={false}
            className="mb-8"
          />
        )}

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
                    Achetez des tokens supplémentaires pour continuer à utiliser l'IA
                  </p>
                  <div className="text-lg font-bold text-blue-600 mb-3">
                    À partir de 2 500 FCFA
                  </div>
                  <Button
                    onClick={() => openPaymentModal('tokens', 0)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
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
                    2 000 FCFA/mois
                  </div>
                  <Button
                    onClick={() => openPaymentModal('forms', 4)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
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
                    3 000 FCFA/mois
                  </div>
                  <Button
                    onClick={() => openPaymentModal('dashboards', 1)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
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
                    {packageType === 'starter' ? '10 000' : '7 000'} FCFA/mois
                  </div>
                  <Button
                    onClick={() => openPaymentModal('users', 3)}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
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

      {/* Subscription History Modal */}
      {user && (
        <SubscriptionHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          sessions={subscriptionHistory?.totalSessions ? SubscriptionSessionService.getAllSessions(user) : []}
          currentSession={currentSession}
        />
      )}

      {/* User Needs Input Modal */}
      {selectedPackage && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${showUserNeedsInput ? 'block' : 'hidden'}`}>
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Configuration de votre transition vers {getPackageDisplayName(selectedPackage)}
                </h2>
                <button
                  onClick={() => {
                    setShowUserNeedsInput(false);
                    setSelectedPackage(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <PackageTransitionUserNeeds
                currentPackage={packageType}
                newPackage={selectedPackage}
                onNeedsChange={setUserNeeds}
                className="mb-6"
              />
              
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUserNeedsInput(false);
                    setSelectedPackage(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => handleUserNeedsComplete(userNeeds)}
                  disabled={!userNeeds}
                >
                  Continuer vers le calcul
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              
              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={handleBackToUserNeeds}
                >
                  Modifier les besoins
                </Button>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
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
        </div>
      )}

      <Toast {...toast} />
    </Layout>
  );
};
