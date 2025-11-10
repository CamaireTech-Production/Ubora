import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { 
  getPackageDisplayName, 
  getPackagePrice, 
  getPackagePriceNumeric,
  PACKAGE_LIMITS, 
  PACKAGE_FEATURES,
  PackageType 
} from '@ubora/shared/config/packageFeatures';
import { 
  Check, 
  X, 
  Star, 
  Zap, 
  Users,
  BarChart3,
  Brain,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Crown
} from 'lucide-react';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../components/Toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { AnalyticsService } from '@ubora/shared/services/analyticsService';
import { PaymentService } from '@ubora/shared/services/paymentService';
import { CampayPayment } from '../components/CampayPayment';
import { SubscriptionSessionCollectionService } from '@ubora/shared/services/subscriptionSessionCollectionService';
import { SubscriptionPriceCalculator, SubscriptionPeriod } from '@ubora/shared/services/subscriptionPriceCalculator';
import { SubscriptionRenewalService } from '@ubora/shared/services/subscriptionRenewalService';
import { CampayPaymentData, PaymentRequest } from '../types/payment';

export const PackageSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>('30days');
  
  // Payment state management
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);
  

  const packages: PackageType[] = ['free', 'starter', 'standard'];

  const getPackageIcon = (pkg: PackageType) => {
    switch (pkg) {
      case 'free': return <CheckCircle className="h-6 w-6" />;
      case 'starter': return <Zap className="h-6 w-6" />;
      case 'standard': return <Star className="h-6 w-6" />;
    }
  };

  const getPackageColor = (pkg: PackageType) => {
    switch (pkg) {
      case 'free': return 'text-green-600 bg-green-100';
      case 'starter': return 'text-blue-600 bg-blue-100';
      case 'standard': return 'text-purple-600 bg-purple-100';
    }
  };

  const getPackageGradient = (pkg: PackageType) => {
    switch (pkg) {
      case 'free': return 'from-green-50 to-emerald-50';
      case 'starter': return 'from-blue-50 to-cyan-50';
      case 'standard': return 'from-purple-50 via-pink-50 to-purple-50';
    }
  };

  const getPackageBorderColor = (pkg: PackageType) => {
    switch (pkg) {
      case 'free': return 'border-green-200';
      case 'starter': return 'border-blue-200';
      case 'standard': return 'border-purple-300';
    }
  };


  const getFeatureIcon = (feature: boolean) => {
    return feature ? (
      <Check className="h-4 w-4 text-green-500" />
    ) : (
      <X className="h-4 w-4 text-gray-300" />
    );
  };

  const handlePackageSelection = async (pkg: PackageType) => {
    if (!user) {
      showError('Utilisateur non connecté');
      return;
    }

    setSelectedPackage(pkg);

    // Handle free package - no payment required
    if (pkg === 'free') {
      try {
        // Create free session using SubscriptionSessionCollectionService
        const sessionId = await SubscriptionSessionCollectionService.createFreeDefaultSession(user.id);

        if (!sessionId) {
          throw new Error('Failed to create free session');
        }

        // Update user to clear package selection flag
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          needsPackageSelection: false,
          updatedAt: serverTimestamp()
        });

        // Track analytics
        await AnalyticsService.logPackageSelection(user.id, pkg, user.agencyId);

        showSuccess('Package gratuit activé avec succès !');
        navigate('/directeur/dashboard');
        return;
      } catch (error) {
        console.error('Error activating free package:', error);
        showError('Erreur lors de l\'activation du package gratuit');
        return;
      }
    }

    // For paid packages, check if period is selected
    if (!selectedPeriod) {
      showError('Veuillez sélectionner une période d\'abonnement');
      return;
    }

    setIsCreatingPayment(true);

    try {
      // Calculate price with discount
      const priceCalculation = SubscriptionPriceCalculator.calculatePrice(pkg, selectedPeriod);
      
      console.log('Package selection:', { 
        packageType: pkg,
        period: selectedPeriod,
        priceCalculation,
        packageName: getPackageDisplayName(pkg)
      });
      
      const externalReference = PaymentService.generateExternalReference('PACKAGE');
      const paymentReq: PaymentRequest = {
        amount: priceCalculation.totalAmount,
        currency: 'XAF',
        description: `TAKWID GROUP (USSD) — Sélection du package ${getPackageDisplayName(pkg)} (${SubscriptionPriceCalculator.getPeriodDisplayName(selectedPeriod)})`,
        externalReference,
        metadata: {
          type: 'package_selection',
          packageType: pkg,
          packageName: getPackageDisplayName(pkg),
          packagePrice: priceCalculation.totalAmount,
          monthlyAmount: priceCalculation.monthlyAmount,
          subscriptionPeriod: selectedPeriod,
          discountApplied: priceCalculation.discountApplied,
          totalPeriodDays: priceCalculation.totalPeriodDays,
          maxRenewals: priceCalculation.maxRenewals
        }
      };

      console.log('Creating package selection payment request:', paymentReq);

      // Create payment record in Firebase
      const paymentId = await PaymentService.createPayment(user.id, paymentReq, {
        type: 'package_selection',
        packageType: pkg,
        subscriptionPeriod: selectedPeriod
      });

      console.log('Package selection payment created with ID:', paymentId);

      // Verify payment was created
      const createdPayment = await PaymentService.getPayment(paymentId);
      if (!createdPayment) {
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

      const discountText = priceCalculation.discountApplied > 0 
        ? ` (${(priceCalculation.discountApplied * 100).toFixed(0)}% de réduction)`
        : '';
      showSuccess(`Paiement initialisé pour le package ${getPackageDisplayName(pkg)}${discountText}. Ouverture du modal de paiement...`);

    } catch (error) {
      console.error('Package selection payment failed:', error);
      showError('Erreur lors de la création du paiement. Veuillez réessayer.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const getFeatureList = (pkg: PackageType) => {
    const features = PACKAGE_FEATURES[pkg];
    const limits = PACKAGE_LIMITS[pkg];
    
    return [
      {
        name: 'Formulaires',
        value: limits.maxForms === -1 ? 'Illimités' : `${limits.maxForms} formulaires`,
        icon: <BarChart3 className="h-4 w-4" />
      },
      {
        name: 'Tableaux de bord',
        value: limits.maxDashboards === -1 ? 'Illimités' : `${limits.maxDashboards} tableaux`,
        icon: <BarChart3 className="h-4 w-4" />
      },
      {
        name: 'Utilisateurs',
        value: limits.maxUsers === -1 ? 'Illimités' : `${limits.maxUsers} utilisateurs`,
        icon: <Users className="h-4 w-4" />
      },
      {
        name: 'Tokens ARCHA mensuels',
        value: limits.monthlyTokens === -1 ? 'Illimités' : `${limits.monthlyTokens.toLocaleString()} tokens`,
        icon: <Brain className="h-4 w-4" />
      },
      {
        name: 'Instructions Archa programmées',
        value: features.advancedAI ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.advancedAI)
      },
      {
        name: 'Indicateurs push',
        value: features.pushIndicators ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.pushIndicators)
      },
      {
        name: 'Notifications de remplissage',
        value: features.formFillNotifications ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.formFillNotifications)
      },
      {
        name: 'Import de fichiers (PDF, Images)',
        value: features.fileImport ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.fileImport)
      },
      {
        name: 'Support WhatsApp',
        value: features.whatsappSupport ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.whatsappSupport)
      },
      {
        name: 'Intégrations personnalisées',
        value: features.customIntegrations ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.customIntegrations)
      }
    ];
  };

  // Payment success handler for package selection
  const handlePaymentSuccess = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId || !user || !selectedPackage || !selectedPeriod) return;

    try {
      console.log('PackageSelectionPage: Payment successful, processing...');
      
      // Update payment status in Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'completed');
      
      // Get payment details to get the amount actually stored/charged (min-fee applied if needed)
      const payment = await PaymentService.getPayment(currentPaymentId);
      const amountPaid = payment?.amount || 0;
      
      // Calculate price details
      const priceCalculation = SubscriptionPriceCalculator.calculatePrice(selectedPackage, selectedPeriod);
      
      // Calculate dates
      const now = new Date();
      const startDate = now;
      const endDate = new Date(now.getTime() + priceCalculation.totalPeriodDays * 24 * 60 * 60 * 1000);
      const nextRenewalDate = SubscriptionRenewalService.calculateNextRenewalDate(now);
      
      // Create subscription session using SubscriptionSessionCollectionService
      const sessionId = await SubscriptionSessionCollectionService.createSession(user.id, {
        packageType: selectedPackage as 'starter' | 'standard',
        subscriptionPeriod: selectedPeriod,
        totalPeriodDays: priceCalculation.totalPeriodDays,
        sessionType: 'subscription',
        startDate: startDate,
        endDate: endDate,
        nextRenewalDate: nextRenewalDate,
        amountPaid: amountPaid,
        monthlyAmount: priceCalculation.monthlyAmount,
        discountApplied: priceCalculation.discountApplied,
        paymentId: currentPaymentId, // Reference to payment document (not Campay reference)
        durationDays: priceCalculation.totalPeriodDays,
        isActive: true,
        autoRenew: true,
        renewalCount: 0,
        maxRenewals: priceCalculation.maxRenewals,
        packageResources: {
          tokensIncluded: PACKAGE_LIMITS[selectedPackage].monthlyTokens,
          formsIncluded: PACKAGE_LIMITS[selectedPackage].maxForms,
          dashboardsIncluded: PACKAGE_LIMITS[selectedPackage].maxDashboards,
          usersIncluded: PACKAGE_LIMITS[selectedPackage].maxUsers
        },
        payAsYouGoResources: {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: []
        },
        usage: {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        }
      });

      if (!sessionId) {
        throw new Error('Failed to create subscription session');
      }

      // Update user to clear package selection flag
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        needsPackageSelection: false, // Clear the flag
        updatedAt: serverTimestamp()
      });

      // Track package selection analytics
      try {
        await AnalyticsService.logPackageSelection(user.id, selectedPackage, user.agencyId);
      } catch (analyticsError) {
        console.error('Analytics error:', analyticsError);
      }

      showSuccess(`Package ${getPackageDisplayName(selectedPackage)} activé avec succès !`);
      
      // Redirect to dashboard after success
      setTimeout(() => {
        navigate('/directeur/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('Error processing package selection payment success:', error);
      showError('Erreur lors du traitement du paiement. Veuillez contacter le support.');
    } finally {
      // Reset states
      setCurrentPaymentId(null);
      setPaymentRequest(null);
      setAutoOpenPayment(false);
    }
  }, [currentPaymentId, selectedPackage, selectedPeriod, user, showSuccess, showError, navigate]);

  // Payment failure handler
  const handlePaymentFail = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId) return;

    try {
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'failed');
      showError('Paiement échoué. Veuillez réessayer.');
    } catch (error) {
      console.error('Error processing payment failure:', error);
    } finally {
      setCurrentPaymentId(null);
      setPaymentRequest(null);
      setAutoOpenPayment(false);
    }
  }, [currentPaymentId, showError]);

  // Payment modal close handler
  const handlePaymentModalClose = useCallback(() => {
    console.log('PackageSelectionPage: Campay modal closed');
    setAutoOpenPayment(false);
    setCurrentPaymentId(null);
    setPaymentRequest(null);
  }, []);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* En-tête amélioré */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-6 shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Bienvenue sur Ubora !
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Choisissez le package qui correspond le mieux à vos besoins pour commencer à analyser vos données avec ARCHA.
          </p>
        </div>

        {/* Sélecteur de période en tabs horizontaux modernes */}
        <div className="mb-8">
          <div className="bg-transparent">
            <label className="block text-base sm:text-lg font-semibold text-gray-700 mb-3 text-center">
              Période d'abonnement
            </label>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {(['30days', '6months', '1year'] as SubscriptionPeriod[]).map((period) => {
                const isSelected = selectedPeriod === period;
                const discount = SubscriptionPriceCalculator.calculateDiscount(period);
                
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setSelectedPeriod(period)}
                    className={`relative flex-1 min-w-[120px] sm:min-w-[140px] max-w-[180px] px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl border-2 transition-all duration-300 transform ${
                      isSelected
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100 shadow-lg scale-105 z-10'
                        : 'border-gray-200 hover:border-blue-300 bg-white/80 hover:bg-white hover:shadow-md hover:scale-[1.02]'
                    }`}
                  >
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`font-bold text-sm sm:text-base ${
                          isSelected ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          {SubscriptionPriceCalculator.getPeriodDisplayName(period)}
                        </div>
                        {discount > 0 && (
                          <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isSelected 
                              ? 'text-green-700 bg-green-100' 
                              : 'text-green-600 bg-green-50'
                          }`}>
                            -{discount * 100}%
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Grille des packages modernisée */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
          {packages.map((pkg) => {
            const isStandard = pkg === 'standard';
            const isSelected = selectedPackage === pkg;
            
            return (
              <div
                key={pkg}
                className={`relative transition-all duration-300 ${
                  isStandard ? 'lg:-mt-4 lg:mb-4' : ''
                }`}
              >
                {/* Badge populaire pour Standard */}
                {isStandard && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs sm:text-sm px-4 py-1.5 rounded-full font-semibold shadow-xl">
                      <Crown className="h-3.5 w-3.5" />
                      <span>Populaire</span>
                    </div>
                  </div>
                )}

                <Card 
                  className={`relative h-full flex flex-col transition-all duration-300 ${
                    isSelected 
                      ? `ring-2 ring-offset-2 ${isStandard ? 'ring-purple-500 shadow-2xl scale-[1.02]' : 'ring-blue-500 shadow-xl scale-[1.02]'}` 
                      : 'hover:shadow-xl hover:-translate-y-1'
                  } ${isStandard ? `ring-2 ring-purple-300 shadow-xl bg-gradient-to-b ${getPackageGradient(pkg)}` : `bg-white border-2 ${getPackageBorderColor(pkg)}`}`}
                >
                  {/* En-tête du package avec gradient */}
                  <div className={`text-center mb-6 ${isStandard ? 'pt-6' : 'pt-4'}`}>
                    <div className={`inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mb-4 ${getPackageColor(pkg)} shadow-lg transition-transform duration-300 hover:scale-110`}>
                      {getPackageIcon(pkg)}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                      {getPackageDisplayName(pkg)}
                    </h3>
                    
                    {/* Prix avec période sélectionnée pour packages payants */}
                    {pkg !== 'free' ? (
                      <div className="mb-4">
                        {(() => {
                          const priceCalc = SubscriptionPriceCalculator.calculatePrice(pkg, selectedPeriod);
                          return (
                            <div className="text-center">
                              <div className="mb-2">
                                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1">
                                  {SubscriptionPriceCalculator.formatPrice(priceCalc.totalAmount)}
                                </p>
                                {priceCalc.discountApplied > 0 && (
                                  <div className="flex items-center justify-center gap-2 mt-1">
                                    <span className="text-xs sm:text-sm text-gray-500 line-through">
                                      {SubscriptionPriceCalculator.formatPrice(
                                        priceCalc.monthlyAmount * (priceCalc.totalPeriodDays / 30)
                                      )}
                                    </span>
                                    <span className="text-xs sm:text-sm font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                      -{priceCalc.discountApplied * 100}%
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 font-medium">
                                pour {SubscriptionPriceCalculator.getPeriodDisplayName(selectedPeriod)}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div>
                        <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                          {getPackagePrice(pkg)}
                        </p>
                        <div className="text-sm text-gray-500 font-medium">
                          Gratuit à vie
                        </div>
                      </div>
                    )}
                  </div>


                  {/* Liste des fonctionnalités améliorée */}
                  <div className="space-y-2.5 mb-6 flex-grow">
                    {getFeatureList(pkg).map((feature, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {feature.icon}
                          </div>
                          <span className="text-sm sm:text-base text-gray-700 font-medium truncate">
                            {feature.name}
                          </span>
                        </div>
                        <span className="text-sm sm:text-base font-semibold text-gray-900 ml-2 flex-shrink-0">
                          {feature.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Bouton de sélection amélioré */}
                  <Button
                    onClick={() => {
                      setSelectedPackage(pkg);
                      handlePackageSelection(pkg);
                    }}
                    disabled={isCreatingPayment || (pkg !== 'free' && !selectedPeriod)}
                    className={`w-full py-3.5 sm:py-4 text-base sm:text-lg font-semibold rounded-xl transition-all duration-200 mt-auto ${
                      isStandard
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]' 
                        : pkg === 'free'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                    } ${(pkg !== 'free' && !selectedPeriod) ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                  >
                    {isCreatingPayment && selectedPackage === pkg ? (
                      <div className="flex items-center justify-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-2 border-white border-t-transparent"></div>
                        <span>Initialisation du paiement...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-3">
                        <span>{pkg === 'free' ? 'Commencer gratuitement' : 'Choisir ce package'}</span>
                        <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                    )}
                  </Button>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Informations supplémentaires améliorées */}
        <div className="mt-8">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg">
            <div className="flex items-start space-x-4 p-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-grow">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                  Flexibilité totale
                </h3>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                  Votre sélection n'est pas définitive. Vous pourrez modifier votre package depuis votre tableau de bord 
                  selon l'évolution de vos besoins, à tout moment.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Toast pour les notifications */}
      <Toast show={false} message="" type="success" />

      {/* Campay Payment Modal for Package Selection */}
      {paymentRequest && (
        <CampayPayment
          paymentRequest={paymentRequest}
          onSuccess={handlePaymentSuccess}
          onFail={handlePaymentFail}
          onModalClose={handlePaymentModalClose}
          autoOpen={autoOpenPayment}
          onAutoOpened={() => setAutoOpenPayment(false)}
          onModalClosed={handlePaymentModalClose}
        />
      )}
    </div>
  );
};
