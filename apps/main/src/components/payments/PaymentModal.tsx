import React, { useState, useCallback } from 'react';
import { X, CreditCard } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '@ubora/shared/hooks/useToast';
import { CampayPayment } from './CampayPayment';
import { PayAsYouGoPaymentService } from '@ubora/shared/services/payAsYouGoPaymentService';
import { PaymentService } from '@ubora/shared/services/paymentService';
import { PaymentRequest } from '../types/payment';
import { CampayPaymentData } from '../types/payment';
import { useAuth } from '@ubora/shared/contexts/AuthContext';

interface PaymentOption {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  icon: React.ReactNode;
  popular?: boolean;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'tokens' | 'forms' | 'dashboards' | 'users';
  currentLimit: number;
  onPurchase: (option: PaymentOption) => void;
  onPaymentCreated?: (paymentRequest: PaymentRequest, paymentId: string) => void;
  hideInternalPayment?: boolean; // New prop to hide internal CampayPayment
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  type,
  currentLimit,
  onPurchase,
  onPaymentCreated,
  hideInternalPayment = false
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);

  // All hooks must be called before any conditional returns
  const handlePaymentSuccess = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId || !user) return;

    try {
      // Update payment status in Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'completed');
      
      // Process payment success using PayAsYouGoPaymentService
      const result = await PayAsYouGoPaymentService.processPaymentSuccess(
        currentPaymentId,
        data,
        user
      );

      if (result.success) {
        // Get the option name from the quantity and type
        const optionName = `${quantity} ${getUnitName()}${quantity > 1 ? 's' : ''} acheté(s)`;
        showSuccess(`${optionName} avec succès !`);
        
        // Call the original onPurchase callback for UI updates
        // We'll pass a minimal option object since the actual purchase is handled by the service
        const mockOption = { id: `${type}-${quantity}`, name: optionName, price: quantity * getUnitPrice(), description: '', unit: 'FCFA', icon: null };
        await onPurchase(mockOption);
        
        // Close modal immediately after success
        handleClose();
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
    }
  }, [currentPaymentId, quantity, user, showSuccess, showError, onPurchase]);

  const handlePaymentFail = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId) return;

    try {
      // Update payment status in Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'failed');
      showError('Paiement échoué. Veuillez réessayer.');
    } catch (error) {
      console.error('Error processing payment failure:', error);
    } finally {
      // Reset states
      setCurrentPaymentId(null);
      setPaymentRequest(null);
      setAutoOpenPayment(false);
    }
  }, [currentPaymentId, showError]);

  const handlePaymentModalClose = useCallback(() => {
    setAutoOpenPayment(false);
    // Close the main PaymentModal when Campay modal closes
    setCurrentPaymentId(null);
    setPaymentRequest(null);
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    setCurrentPaymentId(null);
    setPaymentRequest(null);
    setAutoOpenPayment(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // New pricing structure based on user requirements
  const getUnitPrice = (): number => {
    switch (type) {
      case 'tokens':
        return 1800; // 35,000 tokens for 1,800 FCFA (per 35k tokens)
      case 'forms':
        return 2000; // 2,000 FCFA per form
      case 'dashboards':
        return 2100; // 2,100 FCFA per dashboard
      case 'users':
        return 0; // No additional user cost mentioned in new structure
      default:
        return 0;
    }
  };

  const getUnitName = (): string => {
    switch (type) {
      case 'tokens':
        return '35 000 tokens';
      case 'forms':
        return 'formulaire';
      case 'dashboards':
        return 'tableau de bord';
      case 'users':
        return 'utilisateur';
      default:
        return 'unité';
    }
  };

  // Format the quantity display for tokens (better calculation display)
  const getQuantityDisplay = (): string => {
    if (type === 'tokens') {
      const totalTokens = quantity * 35000;
      if (quantity === 1) {
        return '35 000 tokens';
      } else {
        return `${quantity} × 35 000 tokens = ${totalTokens.toLocaleString('fr-FR')} tokens`;
      }
    } else {
      return `${quantity} ${getUnitName()}${quantity > 1 ? 's' : ''}`;
    }
  };

  // Get total tokens for display
  const getTotalTokens = (): number => {
    if (type === 'tokens') {
      return quantity * 35000;
    }
    return quantity;
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'tokens': return 'Acheter des Tokens Archa';
      case 'forms': return 'Acheter des Formulaires';
      case 'dashboards': return 'Acheter des Tableaux de bord';
      case 'users': return 'Acheter des Utilisateurs';
      default: return 'Acheter des Ressources';
    }
  };

  const getTypeDescription = () => {
    switch (type) {
      case 'tokens': return 'Vous avez atteint votre limite de tokens ARCHA. Achetez des tokens supplémentaires pour continuer à utiliser ARCHA.';
      case 'forms': return `Vous avez atteint votre limite de ${currentLimit} formulaires. Achetez des formulaires supplémentaires.`;
      case 'dashboards': return `Vous avez atteint votre limite de ${currentLimit} tableaux de bord. Achetez des tableaux de bord supplémentaires.`;
      case 'users': return `Vous avez atteint votre limite de ${currentLimit} utilisateurs. Achetez des utilisateurs supplémentaires.`;
      default: return 'Achetez des ressources supplémentaires pour votre package.';
    }
  };

  const handlePurchase = async () => {
    if (!user?.id || quantity <= 0) {
      showError('Veuillez entrer une quantité valide');
      return;
    }

    const unitPrice = getUnitPrice();
    if (unitPrice === 0) {
      showError('Ce type de ressource n\'est pas disponible à l\'achat');
      return;
    }

    setIsCreatingPayment(true);
    try {
      // Calculate total price based on quantity and unit price
      const totalPrice = quantity * unitPrice;
      
      // For tokens, we need to calculate the actual token amount
      let actualQuantity = quantity;
      if (type === 'tokens') {
        actualQuantity = quantity * 35000; // Each unit is 35,000 tokens
      }

      // Create payment request directly like in package payment
      const externalReference = PaymentService.generateExternalReference('PAYGO');
      const paymentReq: PaymentRequest = {
        amount: totalPrice,
        currency: 'XAF',
        description: PayAsYouGoPaymentService.getDescription(type, actualQuantity),
        externalReference,
        metadata: {
          type: 'pay_as_you_go',
          itemType: type,
          quantity: actualQuantity,
          displayAmount: totalPrice,
          packageInfo: {
            id: `${type}-${quantity}`,
            name: `${quantity} ${getUnitName()}${quantity > 1 ? 's' : ''}`,
            description: `Achat de ${quantity} ${getUnitName()}${quantity > 1 ? 's' : ''} à ${unitPrice.toLocaleString()} FCFA l'unité`,
            price: totalPrice,
            unit: 'FCFA',
            popular: false
          }
        }
      };

      // Create payment record in Firebase
      const paymentId = await PaymentService.createPayment(user.id, paymentReq, {
        type: 'pay_as_you_go',
        itemType: type,
        quantity
      });

      // Verify payment was created
      const createdPayment = await PaymentService.getPayment(paymentId);
      if (!createdPayment) {
        showError('Erreur lors de la création du paiement. Veuillez réessayer.');
        return;
      }

      setCurrentPaymentId(paymentId);
      setPaymentRequest(paymentReq);
      
      // Notify parent component that payment was created
      onPaymentCreated?.(paymentReq, paymentId);
      
      // Auto-open payment modal after a short delay
      setTimeout(() => {
        setAutoOpenPayment(true);
      }, 1000);
      
      showSuccess(`Paiement initialisé (montant: ${totalPrice.toLocaleString('fr-FR')} FCFA, démo: 10 FCFA). Ouverture du modal de paiement...`);

    } catch (error) {
      console.error('Purchase failed:', error);
      showError('Erreur lors de la création du paiement. Veuillez réessayer.');
    } finally {
      setIsCreatingPayment(false);
    }
  };



  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" style={{ backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex-1 pr-2 sm:pr-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {getTypeTitle()}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {getTypeDescription()}
            </p>
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <strong>Important:</strong> lors de l'étape USSD sur votre téléphone, le <strong>nom du marchand affiché doit être "TAKWID GROUP"</strong>. Si un autre nom apparaît, annulez la transaction.
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-1"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Quantity Input */}
        <div className="p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Unit Price Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <div className="flex-1">
                  <h3 className="text-sm sm:text-base font-medium text-blue-900">
                    Prix unitaire
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-700 mt-1">
                    {getUnitName()} à {getUnitPrice().toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-blue-900">
                  {getUnitPrice().toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                Quantité souhaitée
              </label>
              <div className="flex items-center justify-center sm:justify-start space-x-3 sm:space-x-4">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={quantity <= 1}
                  aria-label="Diminuer la quantité"
                >
                  <span className="text-lg sm:text-xl font-medium">-</span>
                </button>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 sm:w-24 text-center border-2 border-gray-300 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 font-medium text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  aria-label="Augmenter la quantité"
                >
                  <span className="text-lg sm:text-xl font-medium">+</span>
                </button>
              </div>
              {/* Display total quantity for tokens */}
              {type === 'tokens' && (
                <div className="text-center sm:text-left mt-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">Total: </span>
                    <span className="font-semibold text-blue-600">{getTotalTokens().toLocaleString('fr-FR')} tokens</span>
                  </p>
                </div>
              )}
            </div>

            {/* Total Price Display */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <div className="flex-1">
                  <h3 className="text-sm sm:text-base font-medium text-green-900">
                    Total à payer
                  </h3>
                  <p className="text-xs sm:text-sm text-green-700 mt-1 break-words">
                    {getQuantityDisplay()} × {getUnitPrice().toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-green-900 mt-2 sm:mt-0">
                  {(quantity * getUnitPrice()).toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-xs sm:text-sm text-gray-600 space-y-1">
            <p className="flex items-center gap-1.5">
              <span>💳</span>
              <span>Paiement sécurisé par carte bancaire</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span>🔄</span>
              <span>Ressources ajoutées immédiatement après paiement</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={isCreatingPayment}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={quantity <= 0 || isCreatingPayment}
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            >
              {isCreatingPayment ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Création du paiement...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="whitespace-nowrap">
                    Acheter ({(quantity * getUnitPrice()).toLocaleString('fr-FR')} FCFA)
                  </span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Campay Payment Modal */}
      {paymentRequest && !hideInternalPayment && (
        <CampayPayment
          paymentRequest={paymentRequest}
          onSuccess={handlePaymentSuccess}
          onFail={handlePaymentFail}
          onModalClose={handlePaymentModalClose}
          autoOpen={autoOpenPayment}
          onAutoOpened={() => setAutoOpenPayment(false)}
          onModalOpen={() => {}}
          onModalClosed={handlePaymentModalClose}
        />
      )}
    </div>
  );
};
