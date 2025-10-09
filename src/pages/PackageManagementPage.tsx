import React, { useState, useEffect, useCallback } from 'react';
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
  Users,
  BarChart3,
  Brain,
  FileText,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Shield,
  Calendar,
  Plus
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { PaymentModal } from '../components/PaymentModal';
import { CampayPayment } from '../components/CampayPayment';
import { PaymentService } from '../services/paymentService.ts';
import { PaymentRequest, CampayPaymentData } from '../types/payment';

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
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Debug payment request changes
  useEffect(() => {
    if (paymentRequest) {
      console.log('PackageManagementPage: Payment request set:', paymentRequest);
    }
  }, [paymentRequest]);

  const packages: PackageType[] = ['starter', 'standard', 'premium' /* , 'custom' */];

  const getPackageIcon = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return <Zap className="h-6 w-6" />;
      case 'standard': return <Star className="h-6 w-6" />;
      case 'premium': return <Crown className="h-6 w-6" />;
      /* case 'custom': return <Shield className="h-6 w-6" />; */
    }
  };

  const getPackageColor = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return 'text-blue-600 bg-blue-100';
      case 'standard': return 'text-green-600 bg-green-100';
      case 'premium': return 'text-purple-600 bg-purple-100';
      /* case 'custom': return 'text-orange-600 bg-orange-100'; */
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
    if (!selectedPackage || !user || !transitionPreview) return;

    setIsCreatingPayment(true);
    try {
      console.log('Starting package transition for:', selectedPackage);
      console.log('Transition preview:', transitionPreview);
      
      // Create payment request
      const externalReference = PaymentService.generateExternalReference('PKG');
      // UI may display min 5k, but the requested amount is the computed payable
      const displayAmount = Math.max(transitionPreview.priceBreakdown.finalAmount, 5000);
      const paymentAmount = transitionPreview.priceBreakdown.finalAmount;
      
      const paymentReq: PaymentRequest = {
        amount: paymentAmount,
        currency: 'XAF',
        description: `TAKWID GROUP (USSD) — Transition vers package ${getPackageDisplayName(selectedPackage)}`,
        externalReference,
        metadata: {
          packageType: selectedPackage,
          sessionType: 'package_transition',
          previousPackageType: transitionPreview.currentPackage,
          daysRemaining: transitionPreview.daysRemaining,
          userId: user.id,
          displayAmount: displayAmount,
          // for PaymentService to record originalAmount accurately
          originalAmount: transitionPreview.priceBreakdown.newPackagePrice,
          newPackagePrice: transitionPreview.priceBreakdown.newPackagePrice,
          payableAmount: transitionPreview.priceBreakdown.finalAmount
        }
      };

      console.log('Payment request created:', paymentReq);

      // Create payment record in Firebase
      console.log('Creating payment record in Firebase...');
      const paymentId = await PaymentService.createPayment(user.id, paymentReq, {
        packageType: selectedPackage,
        sessionType: 'package_transition',
        previousPackageType: transitionPreview.currentPackage,
        daysRemaining: transitionPreview.daysRemaining
      });

      console.log('Payment created with ID:', paymentId);
      
      // Verify payment was created
      const createdPayment = await PaymentService.getPayment(paymentId);
      if (createdPayment) {
        console.log('Payment verification successful:', createdPayment);
      } else {
        console.error('Payment verification failed - payment not found in Firebase');
        showError('Erreur lors de la création du paiement. Veuillez réessayer.');
        return;
      }

      setCurrentPaymentId(paymentId);
      setPaymentRequest(paymentReq);
      
      // Auto-open payment modal after a short delay
      setTimeout(() => {
        setAutoOpenPayment(true);
      }, 1000);
      
      if (displayAmount > paymentAmount) {
        showSuccess(`Paiement initialisé (montant: ${displayAmount.toLocaleString('fr-FR')} FCFA, démo: 10 FCFA). Ouverture du modal de paiement...`);
      } else {
        showSuccess(`Paiement initialisé (montant: ${paymentAmount.toLocaleString('fr-FR')} FCFA, démo: 10 FCFA). Ouverture du modal de paiement...`);
      }
      
    } catch (error) {
      console.error('Erreur lors de la création du paiement:', error);
      showError('Erreur lors de l\'initialisation du paiement. Veuillez réessayer.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handlePaymentSuccess = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId || !selectedPackage || !user) return;

    try {
      // Update payment status in Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'completed');
      
      // Execute package transition
      const success = await PackageTransitionService.executeTransition(
        user.id,
        selectedPackage,
        {
          preserveUnusedPayAsYouGo: true
        },
        'campay', // Payment method
        currentPaymentId // Payment reference
      );
      
      if (success) {
        showSuccess(`Package ${getPackageDisplayName(selectedPackage)} activé avec succès !`);
        
        // Navigate back to the previous page
        setTimeout(() => {
          navigate(-1);
        }, 1500);
      } else {
        showError('Erreur lors de l\'activation du package. Veuillez contacter le support.');
      }
      
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      showError('Erreur lors du traitement du paiement. Veuillez contacter le support.');
    } finally {
      // Reset states
      setIsProcessing(false);
      setSelectedPackage(null);
      setTransitionPreview(null);
      setUserNeeds({});
      setPaymentRequest(null);
      setCurrentPaymentId(null);
      setIsCreatingPayment(false);
      setAutoOpenPayment(false);
      setIsPaymentModalOpen(false);
      setShowTransitionPreview(false);
    }
  }, [currentPaymentId, selectedPackage, user, showSuccess, showError, navigate]);

  const handlePaymentFail = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId) return;

    try {
      // Update payment status in Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'failed');
      showError('Paiement échoué. Veuillez réessayer.');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut de paiement:', error);
    } finally {
      // Reset states
      setIsProcessing(false);
      setPaymentRequest(null);
      setCurrentPaymentId(null);
      setIsCreatingPayment(false);
      setAutoOpenPayment(false);
      setIsPaymentModalOpen(false);
    }
  }, [currentPaymentId, showError]);

  const handlePaymentModalClose = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId) return;

    try {
      // Update payment status in Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'cancelled');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut de paiement:', error);
    } finally {
      // Reset states
      setIsProcessing(false);
      setPaymentRequest(null);
      setCurrentPaymentId(null);
      setIsCreatingPayment(false);
      setAutoOpenPayment(false);
      setIsPaymentModalOpen(false);
    }
  }, [currentPaymentId]);

  const handlePaymentModalOpen = useCallback(() => {
    console.log('Payment modal opened');
    setIsPaymentModalOpen(true);
  }, []);

  const handlePaymentModalClosed = useCallback(() => {
    console.log('Payment modal closed');
    setIsPaymentModalOpen(false);
  }, []);

  const handlePurchaseResource = async (option: any) => {
    // This function is now handled by the PaymentModal with Campay integration
    // The modal will create the payment and handle the success/failure
    // This callback is kept for backward compatibility but won't be used
    // since the PaymentModal now handles the payment flow directly
    console.log('Resource purchase requested:', option);
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
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 px-3 sm:px-4 lg:px-6">
        {/* Header with back button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/directeur/dashboard')}
              className="flex items-center space-x-1 self-start"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </Button>
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                Gestion des Packages
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Gérez votre abonnement et vos ressources supplémentaires
              </p>
            </div>
          </div>
        </div>

        {/* Current Package Status - Modern Design */}
        {user && packageInfo && (
          <div className="relative overflow-hidden mx-2 sm:mx-0">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl"></div>
            
            {/* Glassmorphism Card */}
            <div className="relative backdrop-blur-sm bg-white/80 border border-white/20 rounded-2xl shadow-xl shadow-blue-500/10 p-4 sm:p-6 lg:p-8">
              {/* Header Section */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4 lg:mb-0">
                  {/* Package Icon with Glow Effect */}
                  <div className="relative self-center sm:self-auto">
                    <div className={`p-3 sm:p-4 rounded-2xl ${getPackageColor(packageInfo.packageType!)} shadow-lg transform transition-transform hover:scale-105`}>
                      {getPackageIcon(packageInfo.packageType!)}
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/20 to-purple-400/20 blur-xl"></div>
                  </div>
                  
                  <div className="text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start space-x-2 mb-1">
                      <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                        Package {getPackageDisplayName(packageInfo.packageType!)}
                      </h3>
                      <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                    </div>
                    <p className="text-base sm:text-lg font-semibold text-gray-600">{getPackagePrice(packageInfo.packageType!)}</p>
                    <div className="flex items-center justify-center sm:justify-start space-x-1 mt-1">
                      <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                      <span className="text-xs sm:text-sm text-green-600 font-medium">Actif</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-center sm:text-right">
                  <div className={`text-base sm:text-lg font-bold ${isNearRenewal ? 'text-orange-600' : 'text-gray-900'}`}>
                    {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                  </div>
                  {isNearRenewal && (
                    <div className="flex items-center justify-center sm:justify-end space-x-1 text-xs sm:text-sm text-orange-600 mt-1">
                      <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Renouvellement proche</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subscription Status - Modern Timeline Design */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Statut de l'abonnement</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Activation Date */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 sm:p-4 border border-blue-200/50">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-xs sm:text-sm font-medium text-blue-700">Activé le</span>
                    </div>
                    <p className="text-base sm:text-lg font-bold text-blue-900">
                      {startDate.toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  
                  {/* Next Renewal */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-3 sm:p-4 border border-purple-200/50">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-xs sm:text-sm font-medium text-purple-700">Prochain renouvellement</span>
                    </div>
                    <p className="text-base sm:text-lg font-bold text-purple-900">
                      {nextRenewalDate.toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resource Usage - Modern Cards with Progress */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 mb-4 sm:mb-6">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Utilisation des ressources</h4>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Tokens */}
                  <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                      <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                        <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        if (sessionInfo.totalTokens === -1) {
                          return 'Illimité';
                        }
                        return sessionInfo.tokensRemaining.toLocaleString();
                      })()}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        if (sessionInfo.totalTokens === -1) {
                          return 'Illimité';
                        }
                        return `${sessionInfo.tokensUsed.toLocaleString()} / ${sessionInfo.totalTokens.toLocaleString()}`;
                      })()}
                    </div>
                  </div>

                  {/* Forms */}
                  <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                      <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentForms = forms.length;
                        if (sessionInfo.totalForms === -1) {
                          return 'Illimité';
                        }
                        return currentForms.toString();
                      })()}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentForms = forms.length;
                        if (sessionInfo.totalForms === -1) {
                          return `${currentForms} sur Illimité`;
                        }
                        return `${currentForms} / ${sessionInfo.totalForms}`;
                      })()}
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-1">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentForms = forms.length;
                        if (sessionInfo.totalForms === -1) {
                          return '';
                        }
                        return currentForms > sessionInfo.totalForms ? '0 disponible' : `${Math.max(0, sessionInfo.totalForms - currentForms)} disponible`;
                      })()}
                    </div>
                  </div>

                  {/* Dashboards */}
                  <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                      <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentDashboards = dashboards.length;
                        if (sessionInfo.totalDashboards === -1) {
                          return 'Illimité';
                        }
                        return currentDashboards.toString();
                      })()}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentDashboards = dashboards.length;
                        if (sessionInfo.totalDashboards === -1) {
                          return `${currentDashboards} sur Illimité`;
                        }
                        return `${currentDashboards} / ${sessionInfo.totalDashboards}`;
                      })()}
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-1">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentDashboards = dashboards.length;
                        if (sessionInfo.totalDashboards === -1) {
                          return '';
                        }
                        return currentDashboards > sessionInfo.totalDashboards ? '0 disponible' : `${Math.max(0, sessionInfo.totalDashboards - currentDashboards)} disponible`;
                      })()}
                    </div>
                  </div>

                  {/* Users */}
                  <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl">
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                      <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentUsers = employees.filter(emp => emp.isApproved !== false).length;
                        if (sessionInfo.totalUsers === -1) {
                          return 'Illimité';
                        }
                        return currentUsers.toString();
                      })()}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 text-center">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentUsers = employees.filter(emp => emp.isApproved !== false).length;
                        if (sessionInfo.totalUsers === -1) {
                          return `${currentUsers} sur Illimité`;
                        }
                        return `${currentUsers} / ${sessionInfo.totalUsers}`;
                      })()}
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-1">
                      {(() => {
                        const sessionInfo = UserSessionService.getUserPackageInfo(user);
                        const currentUsers = employees.filter(emp => emp.isApproved !== false).length;
                        if (sessionInfo.totalUsers === -1) {
                          return '';
                        }
                        return currentUsers > sessionInfo.totalUsers ? '0 disponible' : `${Math.max(0, sessionInfo.totalUsers - currentUsers)} disponible`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Information */}
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/30">
                <h4 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4 flex items-center">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500" />
                  Informations du compte
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  {/* Agence */}
                  <div className="flex items-center justify-between p-2.5 sm:p-3 bg-white/40 rounded-lg border border-white/50">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm sm:text-base text-gray-600 font-medium">Agence:</span>
                    </div>
                    <span className="text-sm sm:text-base font-semibold text-gray-900">{user.agencyId || 'N/A'}</span>
                  </div>
                  
                  {/* Email */}
                  <div className="flex items-center justify-between p-2.5 sm:p-3 bg-white/40 rounded-lg border border-white/50">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm sm:text-base text-gray-600 font-medium">Email:</span>
                    </div>
                    <span className="text-sm sm:text-base font-semibold text-gray-900 text-right break-all max-w-[200px] sm:max-w-[250px] truncate" title={user.email}>
                      {user.email}
                    </span>
                  </div>
                  
                  {/* Rôle */}
                  <div className="flex items-center justify-between p-2.5 sm:p-3 bg-white/40 rounded-lg border border-white/50">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-sm sm:text-base text-gray-600 font-medium">Rôle:</span>
                    </div>
                    <span className="text-sm sm:text-base font-semibold text-gray-900 capitalize">{user.role}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

        {/* Package Comparison Grid - Modern Design */}
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2 sm:mb-3">
              Choisissez votre nouveau package
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600">
              Comparez les fonctionnalités et changez de package à tout moment
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {packages.map((pkg) => {
              const isCurrentPackage = pkg === packageType;
              const isSelected = selectedPackage === pkg;
              const limits = PACKAGE_LIMITS[pkg];
              const features = PACKAGE_FEATURES[pkg];

              return (
                <div 
                  key={pkg} 
                  className={`relative group transition-all duration-300 transform hover:scale-105 ${
                    isCurrentPackage 
                      ? 'scale-105' 
                      : ''
                  }`}
                >
                  {/* Background Gradient */}
                  <div className={`absolute inset-0 rounded-2xl ${
                    isCurrentPackage 
                      ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50' 
                      : isSelected 
                      ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50'
                      : 'bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50'
                  }`}></div>
                  
                  {/* Glassmorphism Card */}
                  <div className={`relative backdrop-blur-sm bg-white/80 border border-white/20 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 ${
                    isCurrentPackage 
                      ? 'shadow-blue-500/20' 
                      : isSelected 
                      ? 'shadow-green-500/20'
                      : 'shadow-gray-500/10 hover:shadow-gray-500/20'
                  }`}>
                    {/* Badge package actuel */}
                    {isCurrentPackage && (
                      <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold shadow-lg">
                          <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                          Actuel
                        </span>
                      </div>
                    )}

                    {/* En-tête du package */}
                    <div className="text-center mb-6 sm:mb-8">
                      <div className="relative mb-4 sm:mb-6">
                        <div className={`inline-flex p-3 sm:p-4 rounded-2xl ${getPackageColor(pkg)} shadow-lg transform transition-transform group-hover:scale-110`}>
                          {getPackageIcon(pkg)}
                        </div>
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/20 to-purple-400/20 blur-xl"></div>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2 sm:mb-3">
                        {getPackageDisplayName(pkg)}
                      </h3>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                        {getPackagePrice(pkg)}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500">par mois</p>
                    </div>

                    {/* Limites principales */}
                    <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                      <div className="flex items-center justify-between p-1.5 sm:p-2 bg-white/60 backdrop-blur-sm rounded-lg border border-white/30">
                        <span className="text-gray-700 flex items-center font-medium text-xs sm:text-sm">
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-blue-500" />
                          Formulaires
                        </span>
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">{limits.maxForms === -1 ? 'Illimité' : limits.maxForms}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 sm:p-2 bg-white/60 backdrop-blur-sm rounded-lg border border-white/30">
                        <span className="text-gray-700 flex items-center font-medium text-xs sm:text-sm">
                          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-purple-500" />
                          Tableaux de bord
                        </span>
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">{limits.maxDashboards === -1 ? 'Illimité' : limits.maxDashboards}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 sm:p-2 bg-white/60 backdrop-blur-sm rounded-lg border border-white/30">
                        <span className="text-gray-700 flex items-center font-medium text-xs sm:text-sm">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-green-500" />
                          Utilisateurs
                        </span>
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">{limits.maxUsers === -1 ? 'Illimité' : limits.maxUsers}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 sm:p-2 bg-white/60 backdrop-blur-sm rounded-lg border border-white/30">
                        <span className="text-gray-700 flex items-center font-medium text-xs sm:text-sm">
                          <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-yellow-500" />
                          Tokens Archa
                        </span>
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">{limits.monthlyTokens === -1 ? 'Illimité' : limits.monthlyTokens.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Fonctionnalités principales */}
                    <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Fonctionnalités incluses</h4>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm p-1 sm:p-1.5 rounded-md bg-white/40">
                          {getFeatureIcon(features.advancedAI)}
                          <span className="text-gray-700">IA Avancée</span>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm p-1 sm:p-1.5 rounded-md bg-white/40">
                          {getFeatureIcon(features.customBranding)}
                          <span className="text-gray-700">Branding personnalisé</span>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm p-1 sm:p-1.5 rounded-md bg-white/40">
                          {getFeatureIcon(features.whatsappSupport)}
                          <span className="text-gray-700">Support WhatsApp</span>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm p-1 sm:p-1.5 rounded-md bg-white/40">
                          {getFeatureIcon(features.customIntegrations)}
                          <span className="text-gray-700">Intégrations personnalisées</span>
                        </div>
                      </div>
                    </div>

                    {/* Bouton d'action */}
                    <Button
                      onClick={() => handleUpgrade(pkg)}
                      disabled={isCurrentPackage || isProcessing}
                      className={`w-full py-3 text-lg font-semibold transition-all duration-200 ${
                        isCurrentPackage 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      {isProcessing && isSelected ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Traitement...</span>
                        </div>
                      ) : isCurrentPackage ? (
                        <div className="flex items-center space-x-2">
                          <Shield className="h-5 w-5" />
                          <span>Package actuel</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-5 w-5" />
                          <span>Choisir ce package</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Ressources Supplémentaires - Modern Design */}
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl"></div>
            
            {/* Glassmorphism Card */}
            <div className="relative backdrop-blur-sm bg-white/80 border border-white/20 rounded-2xl shadow-xl shadow-green-500/10 p-4 sm:p-6 lg:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Ressources Supplémentaires
                  </h2>
                </div>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
                  Achetez des ressources supplémentaires pour votre package actuel. 
                  Ces ressources sont facturées mensuellement jusqu'à désactivation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Tokens Archa */}
                <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  <div className="text-center">
                    <div className="relative mb-3 sm:mb-4">
                      <div className="inline-flex p-2.5 sm:p-3 rounded-xl bg-blue-100 text-blue-600 shadow-lg transform transition-transform group-hover:scale-110">
                        <Brain className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400/20 to-blue-600/20 blur-xl"></div>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2">Tokens Archa</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Achetez des tokens supplémentaires pour continuer à utiliser ARCHA
                    </p>
                    <div className="text-lg sm:text-xl font-bold text-blue-600 mb-3 sm:mb-4">
                      À partir de 2 500 FCFA
                    </div>
                    <Button
                      onClick={() => openPaymentModal('tokens', 0)}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center text-sm sm:text-base"
                    >
                      <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <span>Activer</span>
                    </Button>
                  </div>
                </div>

                {/* Formulaires */}
                <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  <div className="text-center">
                    <div className="relative mb-3 sm:mb-4">
                      <div className="inline-flex p-2.5 sm:p-3 rounded-xl bg-green-100 text-green-600 shadow-lg transform transition-transform group-hover:scale-110">
                        <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-green-400/20 to-green-600/20 blur-xl"></div>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2">Formulaires</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Ajoutez des formulaires supplémentaires à votre package
                    </p>
                    <div className="text-lg sm:text-xl font-bold text-green-600 mb-3 sm:mb-4">
                      À partir de 15 000 FCFA
                    </div>
                    <Button
                      onClick={() => openPaymentModal('forms', 4)}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center text-sm sm:text-base"
                    >
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <span>Activer</span>
                    </Button>
                  </div>
                </div>

                {/* Tableaux de bord */}
                <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  <div className="text-center">
                    <div className="relative mb-3 sm:mb-4">
                      <div className="inline-flex p-2.5 sm:p-3 rounded-xl bg-purple-100 text-purple-600 shadow-lg transform transition-transform group-hover:scale-110">
                        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400/20 to-purple-600/20 blur-xl"></div>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2">Tableaux de bord</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Créez plus de tableaux de bord pour vos analyses
                    </p>
                    <div className="text-lg sm:text-xl font-bold text-purple-600 mb-3 sm:mb-4">
                      À partir de 20 000 FCFA
                    </div>
                    <Button
                      onClick={() => openPaymentModal('dashboards', 1)}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center text-sm sm:text-base"
                    >
                      <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <span>Activer</span>
                    </Button>
                  </div>
                </div>

                {/* Utilisateurs */}
                <div className="group relative bg-white/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  <div className="text-center">
                    <div className="relative mb-3 sm:mb-4">
                      <div className="inline-flex p-2.5 sm:p-3 rounded-xl bg-orange-100 text-orange-600 shadow-lg transform transition-transform group-hover:scale-110">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-400/20 to-orange-600/20 blur-xl"></div>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2">Utilisateurs</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      Ajoutez des utilisateurs à votre équipe
                    </p>
                    <div className="text-lg sm:text-xl font-bold text-orange-600 mb-3 sm:mb-4">
                      À partir de 21 000 FCFA
                    </div>
                    <Button
                      onClick={() => openPaymentModal('users', 3)}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center text-sm sm:text-base"
                    >
                      <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <span>Activer</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                  <p className="text-sm text-gray-600 flex items-center justify-center space-x-4">
                    <span className="flex items-center space-x-1">
                      <span className="text-green-500">💳</span>
                      <span>Paiement sécurisé</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="text-blue-500">🔄</span>
                      <span>Ressources ajoutées immédiatement</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="text-purple-500">📞</span>
                      <span>Support 24/7</span>
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Les ressources supplémentaires sont facturées mensuellement jusqu'à désactivation
                  </p>
                </div>
              </div>
            </div>
          </div>
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
                          {Math.max(transitionPreview.priceBreakdown.finalAmount, 5000).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      
                      {transitionPreview.priceBreakdown.savings > 0 && (
                        <div className="flex justify-between items-center text-sm text-green-600 mt-2">
                          <span>Économie réalisée</span>
                          <span>-{transitionPreview.priceBreakdown.savings.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                      )}
                      
                      {transitionPreview.priceBreakdown.finalAmount === 0 && (
                        <div className="flex justify-between items-center text-sm text-blue-600 mt-2">
                          <span>Montant minimum appliqué</span>
                          <span>5 000 FCFA</span>
                        </div>
                      )}
                      
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> {transitionPreview.summary}
                      {transitionPreview.priceBreakdown.finalAmount === 0 && (
                        <><br/><strong>Montant minimum:</strong> Un montant minimum de 5 000 FCFA est appliqué pour le traitement du paiement.</>
                      )}
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
                      setPaymentRequest(null);
                      setCurrentPaymentId(null);
                      setIsCreatingPayment(false);
                      setAutoOpenPayment(false);
                      setIsPaymentModalOpen(false);
                    }}
                  >
                    Annuler
                  </Button>
                  
                  {paymentRequest ? (
                      <CampayPayment
                        key={paymentRequest.externalReference}
                        paymentRequest={paymentRequest}
                        onSuccess={handlePaymentSuccess}
                        onFail={handlePaymentFail}
                        onModalClose={handlePaymentModalClose}
                        buttonText="Payer maintenant"
                        buttonClassName="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        disabled={isProcessing}
                        autoOpen={autoOpenPayment}
                        onAutoOpened={() => setAutoOpenPayment(false)}
                        onModalOpen={handlePaymentModalOpen}
                        onModalClosed={handlePaymentModalClosed}
                      />
                  ) : (
                    <Button
                      onClick={confirmTransition}
                      disabled={isProcessing || isCreatingPayment || isPaymentModalOpen}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isCreatingPayment ? 'Préparation du paiement...' : 
                       isPaymentModalOpen ? 'Modal de paiement ouvert...' : 
                       isProcessing ? 'Traitement...' : 'Confirmer et payer'}
                    </Button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
};
