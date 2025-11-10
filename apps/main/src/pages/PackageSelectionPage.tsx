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
  CheckCircle
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bienvenue sur Ubora !
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choisissez le package qui correspond le mieux à vos besoins pour commencer à analyser vos données avec ARCHA.
          </p>
        </div>

        {/* Grille des packages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {packages.map((pkg) => (
            <Card 
              key={pkg} 
              className={`relative transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 ${
                selectedPackage === pkg 
                  ? 'ring-2 ring-blue-500 shadow-xl scale-105' 
                  : 'hover:shadow-lg'
              } ${pkg === 'standard' ? 'ring-2 ring-green-500 shadow-lg' : ''}`}
            >
              {/* Badge populaire pour Standard */}
              {pkg === 'standard' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-green-500 text-white text-sm px-4 py-2 rounded-full font-semibold shadow-lg">
                    Populaire
                  </span>
                </div>
              )}

              {/* En-tête du package */}
              <div className="text-center mb-8 pt-4">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${getPackageColor(pkg)}`}>
                  {getPackageIcon(pkg)}
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">
                  {getPackageDisplayName(pkg)}
                </h3>
                
                {/* Prix avec sélection de période pour packages payants */}
                {pkg !== 'free' ? (
                  <div className="mb-4">
                    {/* Sélection de période */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Période d'abonnement
                      </label>
                      <div className="flex flex-col space-y-2">
                        {(['30days', '6months', '1year'] as SubscriptionPeriod[]).map((period) => {
                          const priceCalc = SubscriptionPriceCalculator.calculatePrice(pkg, period);
                          const isSelected = selectedPackage === pkg && selectedPeriod === period;
                          return (
                            <button
                              key={period}
                              type="button"
                              onClick={() => {
                                setSelectedPackage(pkg);
                                setSelectedPeriod(period);
                              }}
                              className={`text-left px-4 py-3 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {SubscriptionPriceCalculator.getPeriodDisplayName(period)}
                                  </div>
                                  {priceCalc.discountApplied > 0 && (
                                    <div className="text-xs text-green-600 mt-1">
                                      {priceCalc.discountApplied * 100}% de réduction
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-blue-600">
                                    {SubscriptionPriceCalculator.formatPrice(priceCalc.totalAmount)}
                                  </div>
                                  {priceCalc.discountApplied > 0 && (
                                    <div className="text-xs text-gray-500 line-through">
                                      {SubscriptionPriceCalculator.formatPrice(
                                        priceCalc.monthlyAmount * (priceCalc.totalPeriodDays / 30)
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl font-bold text-blue-600 mb-4">
                      {getPackagePrice(pkg)}
                    </p>
                    <div className="text-sm text-gray-500">
                      Gratuit
                    </div>
                  </div>
                )}
              </div>

              {/* Liste des fonctionnalités */}
              <div className="space-y-3 mb-6">
                {getFeatureList(pkg).map((feature, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      {feature.icon}
                      <span className="text-base text-gray-700 font-medium">{feature.name}</span>
                    </div>
                    <span className="text-base font-semibold text-gray-900">
                      {feature.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bouton de sélection */}
              <Button
                onClick={() => handlePackageSelection(pkg)}
                disabled={isCreatingPayment || (pkg !== 'free' && !selectedPeriod)}
                className={`w-full py-4 text-lg font-semibold rounded-lg transition-all duration-200 ${
                  pkg === 'standard' 
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                } ${(pkg !== 'free' && !selectedPeriod) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCreatingPayment && selectedPackage === pkg ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Initialisation du paiement...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <div className="flex items-center space-x-3">
                      <span>Choisir ce package</span>
                      <ArrowRight className="h-6 w-6" />
                    </div>
                    {pkg !== 'free' && selectedPackage === pkg && selectedPeriod && (
                      <div className="text-sm font-normal opacity-90">
                        {SubscriptionPriceCalculator.formatPrice(
                          SubscriptionPriceCalculator.calculatePrice(pkg, selectedPeriod).totalAmount
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Button>
            </Card>
          ))}
        </div>

        {/* Informations supplémentaires */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-4 p-4">
            <CheckCircle className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Vous pouvez changer de package à tout moment
              </h3>
              <p className="text-base text-blue-800">
                Votre sélection n'est pas définitive. Vous pourrez modifier votre package depuis votre tableau de bord 
                selon l'évolution de vos besoins.
              </p>
            </div>
          </div>
        </Card>
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
