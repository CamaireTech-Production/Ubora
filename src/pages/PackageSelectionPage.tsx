import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { 
  getPackageDisplayName, 
  getPackagePrice, 
  getPackagePriceNumeric,
  PACKAGE_LIMITS, 
  PACKAGE_FEATURES,
  PackageType 
} from '../config/packageFeatures';
import { 
  Check, 
  X, 
  Star, 
  Crown, 
  Zap, 
  // Shield, // Unused for now
  Users,
  BarChart3,
  Brain,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AnalyticsService } from '../services/analyticsService';
import { PaymentService } from '../services/paymentService.ts';
import { CampayPayment } from '../components/CampayPayment';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { CampayPaymentData, PaymentRequest } from '../types/payment';

export const PackageSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  
  // Payment state management
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);
  

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

  const handlePackageSelection = async (pkg: PackageType) => {
    if (!user) {
      showError('Utilisateur non connecté');
      return;
    }

    setSelectedPackage(pkg);
    setIsCreatingPayment(true);

    try {
      // Get numeric price for the package
      const price = getPackagePriceNumeric(pkg);
      
      console.log('Package selection:', { 
        packageType: pkg,
        price,
        packageName: getPackageDisplayName(pkg)
      });
      
      const externalReference = PaymentService.generateExternalReference('PACKAGE');
      const paymentReq: PaymentRequest = {
        amount: price,
        currency: 'XAF',
        description: `Sélection du package ${getPackageDisplayName(pkg)}`,
        externalReference,
        metadata: {
          type: 'package_selection',
          packageType: pkg,
          packageName: getPackageDisplayName(pkg),
          packagePrice: price
        }
      };

      console.log('Creating package selection payment request:', paymentReq);

      // Create payment record in Firebase
      const paymentId = await PaymentService.createPayment(user.id, paymentReq, {
        type: 'package_selection',
        packageType: pkg
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

      showSuccess(`Paiement initialisé pour le package ${getPackageDisplayName(pkg)}. Ouverture du modal de paiement...`);

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
        name: 'IA Avancée',
        value: features.advancedAI ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.advancedAI)
      },
      {
        name: 'IA Prédictive',
        value: features.predictiveAI ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.predictiveAI)
      },
      {
        name: 'Notifications Push',
        value: features.pushNotifications ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.pushNotifications)
      },
      {
        name: 'Support WhatsApp',
        value: features.whatsappSupport ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.whatsappSupport)
      },
      {
        name: 'Branding personnalisé',
        value: features.customBranding ? 'Incluse' : 'Non incluse',
        icon: getFeatureIcon(features.customBranding)
      }
    ];
  };

  // Payment success handler for package selection
  const handlePaymentSuccess = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId || !user || !selectedPackage) return;

    try {
      console.log('PackageSelectionPage: Payment successful, processing...');
      
      // Update payment status in Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'completed');
      
      // Get payment details to get the amount actually stored/charged (min-fee applied if needed)
      const payment = await PaymentService.getPayment(currentPaymentId);
      const amountPaid = payment?.amount || 0;
      
      // Get package resources from configuration
      const packageLimits = PACKAGE_LIMITS[selectedPackage];
      
      // Create subscription session using SubscriptionSessionService
      const sessionCreated = await SubscriptionSessionService.createSession(user.id, {
        packageType: selectedPackage,
        sessionType: 'subscription',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        durationDays: 30,
        amountPaid: amountPaid,
        paymentReference: currentPaymentId,
        isActive: true,
        packageResources: {
          tokensIncluded: packageLimits.monthlyTokens,
          formsIncluded: packageLimits.maxForms,
          dashboardsIncluded: packageLimits.maxDashboards,
          usersIncluded: packageLimits.maxUsers
        },
        payAsYouGoResources: {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0,
          purchases: []
        }
      });

      if (!sessionCreated) {
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
  }, [currentPaymentId, selectedPackage, user, showSuccess, showError, navigate]);

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
                <p className="text-4xl font-bold text-blue-600 mb-4">
                  {getPackagePrice(pkg)}
                </p>
                <div className="text-sm text-gray-500">
                  {typeof getPackagePrice(pkg) === 'string' ? '' : '/mois'}
                </div>
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
                disabled={isCreatingPayment}
                className={`w-full py-4 text-lg font-semibold rounded-lg transition-all duration-200 ${
                  pkg === 'standard' 
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isCreatingPayment && selectedPackage === pkg ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Initialisation du paiement...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-3">
                    <span>Choisir ce package</span>
                    <ArrowRight className="h-6 w-6" />
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
