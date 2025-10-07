import React, { useState, useCallback } from 'react';
import { X, CreditCard, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { CampayPayment } from './CampayPayment';
import { PayAsYouGoPaymentService } from '../services/payAsYouGoPaymentService';
import { PaymentRequest } from '../types/payment';
import { CampayPaymentData } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

interface PayAsYouGoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (tokens: number) => Promise<void>;
  currentTokens: number;
  packageLimit: number;
  payAsYouGoTokens: number;
  requiredTokens?: number;
}

const TOKEN_PACKAGES = [
  {
    tokens: 80000, // 80k tokens (80 actual OpenAI tokens = ~2-3 requests)
    price: 2500, // 2500 FCFA
    popular: true,
    description: 'Pour conversations et analyses supplémentaires'
  },
  {
    tokens: 120000, // 120k tokens (120 actual OpenAI tokens = ~4 requests)
    price: 5000, // 5000 FCFA
    popular: false,
    description: 'Idéal pour un usage intensif'
  },
  {
    tokens: 240000, // 240k tokens (240 actual OpenAI tokens = ~8 requests)
    price: 8500, // 8500 FCFA
    popular: false,
    description: 'Pour une équipe active'
  }
];

export const PayAsYouGoModal: React.FC<PayAsYouGoModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
  currentTokens,
  packageLimit,
  payAsYouGoTokens,
  requiredTokens = 0
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  if (!isOpen) return null;

  const totalAvailableTokens = packageLimit + payAsYouGoTokens;
  const remainingTokens = totalAvailableTokens - currentTokens;

  const handlePurchase = async () => {
    if (!selectedPackage || !user?.id) return;

    setIsCreatingPayment(true);
    try {
      const packageData = TOKEN_PACKAGES.find(pkg => pkg.tokens === selectedPackage);
      if (!packageData) {
        throw new Error('Package data not found');
      }

      // Create payment request
      const paymentResult = await PayAsYouGoPaymentService.createPaymentRequest({
        userId: user.id,
        type: 'tokens',
        quantity: selectedPackage,
        price: packageData.price,
        description: PayAsYouGoPaymentService.getDescription('tokens', selectedPackage),
        metadata: {
          displayAmount: packageData.price,
          itemType: 'tokens',
          packageInfo: packageData
        }
      });

      if (!paymentResult.success || !paymentResult.paymentId || !paymentResult.paymentRequest) {
        throw new Error(paymentResult.error || 'Failed to create payment request');
      }

      // Set payment data for Campay
      setCurrentPaymentId(paymentResult.paymentId);
      setPaymentRequest(paymentResult.paymentRequest);
      setAutoOpenPayment(true);
      setIsPaymentModalOpen(true);

    } catch (error) {
      console.error('Purchase failed:', error);
      showError('Erreur lors de la création du paiement. Veuillez réessayer.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handlePaymentSuccess = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId || !selectedPackage || !user) return;

    try {
      // Process payment success
      const result = await PayAsYouGoPaymentService.processPaymentSuccess(
        currentPaymentId,
        data,
        user
      );

      if (result.success) {
        showSuccess(`${selectedPackage.toLocaleString()} tokens ajoutés avec succès !`);
        
        // Call the original onPurchase callback for UI updates
        await onPurchase(selectedPackage);
        
        // Close modal after success
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        showError(result.error || 'Erreur lors du traitement du paiement.');
      }
      
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      showError('Erreur lors du traitement du paiement. Veuillez contacter le support.');
    } finally {
      // Reset states
      setCurrentPaymentId(null);
      setPaymentRequest(null);
      setAutoOpenPayment(false);
      setIsPaymentModalOpen(false);
    }
  }, [currentPaymentId, selectedPackage, user, showSuccess, showError, onPurchase]);

  const handlePaymentFail = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId) return;

    try {
      await PayAsYouGoPaymentService.processPaymentFailure(currentPaymentId, data);
      showError('Paiement échoué. Veuillez réessayer.');
    } catch (error) {
      console.error('Error processing payment failure:', error);
    } finally {
      // Reset states
      setCurrentPaymentId(null);
      setPaymentRequest(null);
      setAutoOpenPayment(false);
      setIsPaymentModalOpen(false);
    }
  }, [currentPaymentId, showError]);

  const handlePaymentModalClose = useCallback(() => {
    setIsPaymentModalOpen(false);
    setAutoOpenPayment(false);
  }, []);

  const handleClose = () => {
    setSelectedPackage(null);
    setPurchaseSuccess(false);
    setCurrentPaymentId(null);
    setPaymentRequest(null);
    setAutoOpenPayment(false);
    setIsPaymentModalOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(2px)' }}>
      <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Tokens Insuffisants</h2>
              <p className="text-gray-600 text-sm">Achetez des tokens supplémentaires</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {purchaseSuccess ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-600 mb-2">
              Achat Réussi !
            </h3>
            <p className="text-gray-600">
              Vos tokens ont été ajoutés à votre compte
            </p>
          </div>
        ) : (
          <>
            {/* Status */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800 mb-1">
                    Limite de tokens atteinte
                  </h3>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <p>• Tokens utilisés ce mois: {currentTokens.toLocaleString()}</p>
                    <p>• Tokens de votre package: {packageLimit.toLocaleString()}</p>
                    <p>• Tokens pay-as-you-go: {payAsYouGoTokens.toLocaleString()}</p>
                    <p>• Tokens restants: {remainingTokens.toLocaleString()}</p>
                    {requiredTokens > 0 && (
                      <p>• Tokens nécessaires: {requiredTokens.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              <strong>Important :</strong> lors de la validation sur l'écran USSD, le <strong>nom du marchand doit être "TAKWID GROUP"</strong>. Si un autre nom s'affiche, annulez la transaction.
            </div>

            {/* Token Packages */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Choisissez un package de tokens</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TOKEN_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.tokens}
                    className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPackage === pkg.tokens
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${pkg.popular ? 'ring-2 ring-blue-200' : ''}`}
                    onClick={() => setSelectedPackage(pkg.tokens)}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          Populaire
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {pkg.tokens.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">tokens</div>
                      <div className="text-lg font-semibold text-blue-600 mb-2">
                        {pkg.price.toLocaleString()} FCFA
                      </div>
                      <div className="text-xs text-gray-600">
                        {pkg.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">💡 Comment ça marche ?</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Les tokens achetés s'ajoutent à votre quota mensuel</li>
                <li>• L'achat de tokens étend votre abonnement de 30 jours</li>
                <li>• Si votre abonnement expire, tous vos tokens sont perdus</li>
                <li>• Renouvelez votre abonnement pour récupérer vos tokens de package</li>
                <li>• Les tokens pay-as-you-go restent actifs tant que l'abonnement est valide</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={isPurchasing}
              >
                Annuler
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={!selectedPackage || isCreatingPayment}
                className="flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {isCreatingPayment ? 'Création du paiement...' : 'Acheter des tokens'}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Campay Payment Modal */}
      {paymentRequest && (
        <CampayPayment
          paymentRequest={paymentRequest}
          onSuccess={handlePaymentSuccess}
          onFail={handlePaymentFail}
          onModalClose={handlePaymentModalClose}
          autoOpen={autoOpenPayment}
          onAutoOpened={() => setAutoOpenPayment(false)}
          onModalOpen={() => setIsPaymentModalOpen(true)}
          onModalClosed={handlePaymentModalClose}
        />
      )}
    </div>
  );
};
