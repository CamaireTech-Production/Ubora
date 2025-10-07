import React, { useState, useCallback } from 'react';
import { X, CreditCard, Users, BarChart3, Brain, Check } from 'lucide-react';
import { Button } from './Button';
import { useToast } from '../hooks/useToast';
import { CampayPayment } from './CampayPayment';
import { PayAsYouGoPaymentService } from '../services/payAsYouGoPaymentService';
import { PaymentService } from '../services/paymentService.ts';
import { PaymentRequest } from '../types/payment';
import { CampayPaymentData } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';

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
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  type,
  currentLimit,
  onPurchase
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

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
        console.log('PaymentModal: Payment successful, processing...');
        
        // Get the option name from the selected option ID
        const optionName = selectedOption ? `${selectedOption} acheté(s)` : 'Ressources acheté(s)';
        showSuccess(`${optionName} avec succès !`);
        
        // Call the original onPurchase callback for UI updates
        // We'll pass a minimal option object since the actual purchase is handled by the service
        const mockOption = { id: selectedOption || '', name: optionName, price: 0, description: '', unit: 'FCFA', icon: null };
        await onPurchase(mockOption);
        
        console.log('PaymentModal: Calling handleClose...');
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
      setIsPaymentModalOpen(false);
    }
  }, [currentPaymentId, selectedOption, user, showSuccess, showError, onPurchase]);

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
      setIsPaymentModalOpen(false);
    }
  }, [currentPaymentId, showError]);

  const handlePaymentModalClose = useCallback(() => {
    console.log('PaymentModal: Campay modal closed, closing PaymentModal...');
    setIsPaymentModalOpen(false);
    setAutoOpenPayment(false);
    // Close the main PaymentModal when Campay modal closes
    setCurrentPaymentId(null);
    setPaymentRequest(null);
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    console.log('PaymentModal: Closing modal...');
    setCurrentPaymentId(null);
    setPaymentRequest(null);
    setAutoOpenPayment(false);
    setIsPaymentModalOpen(false);
    onClose();
    console.log('PaymentModal: Modal closed');
  }, [onClose]);

  if (!isOpen) return null;

  const getPaymentOptions = (): PaymentOption[] => {
    switch (type) {
      case 'tokens':
        return [
          {
            id: 'tokens-80k',
            name: '80 000 Tokens Archa',
            description: 'Pour conversations et analyses supplémentaires',
            price: 2500,
            unit: 'FCFA',
            icon: <Brain className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'tokens-120k',
            name: '120 000 Tokens Archa',
            description: 'Idéal pour usage intensif',
            price: 5000,
            unit: 'FCFA',
            icon: <Brain className="h-5 w-5" />
          },
          {
            id: 'tokens-240k',
            name: '240 000 Tokens Archa',
            description: 'Pour équipes importantes',
            price: 8500,
            unit: 'FCFA',
            icon: <Brain className="h-5 w-5" />
          }
        ];
      case 'forms':
        return [
          {
            id: 'forms-1',
            name: '1 Formulaire supplémentaire',
            description: 'Créez 1 formulaire de plus',
            price: 2000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          },
          {
            id: 'forms-3',
            name: '3 Formulaires supplémentaires',
            description: 'Idéal pour les structures en croissance',
            price: 5000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'forms-5',
            name: '5 Formulaires supplémentaires',
            description: 'Pour les grandes structures',
            price: 8000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          }
        ];
      case 'dashboards':
        return [
          {
            id: 'dashboards-1',
            name: '1 Tableau de bord supplémentaire',
            description: 'Créez 1 tableau de bord de plus',
            price: 30000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          },
          {
            id: 'dashboards-2',
            name: '2 Tableaux de bord supplémentaires',
            description: 'Pour analyses approfondies',
            price: 55000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'dashboards-3',
            name: '3 Tableaux de bord supplémentaires',
            description: 'Pour analyses complètes',
            price: 80000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          }
        ];
      case 'users':
        return [
          {
            id: 'users-1',
            name: '1 Utilisateur supplémentaire',
            description: 'Ajoutez 1 utilisateur à votre équipe',
            price: 7000,
            unit: 'FCFA',
            icon: <Users className="h-5 w-5" />
          },
          {
            id: 'users-2',
            name: '2 Utilisateurs supplémentaires',
            description: 'Idéal pour les équipes moyennes',
            price: 13000,
            unit: 'FCFA',
            icon: <Users className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'users-3',
            name: '3 Utilisateurs supplémentaires',
            description: 'Pour les grandes équipes',
            price: 20000,
            unit: 'FCFA',
            icon: <Users className="h-5 w-5" />
          }
        ];
      default:
        return [];
    }
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
    if (!selectedOption || !user?.id) {
      showError('Veuillez sélectionner une option');
      return;
    }

    const option = getPaymentOptions().find(opt => opt.id === selectedOption);
    if (!option) return;

    setIsCreatingPayment(true);
    try {
      // Extract quantity from option ID
      let quantity: number;
      if (option.id.startsWith('tokens-')) {
        // For tokens, the ID format is 'tokens-80k', 'tokens-120k', etc.
        const tokenAmount = option.id.split('-')[1];
        if (tokenAmount.endsWith('k')) {
          quantity = parseInt(tokenAmount.replace('k', '')) * 1000;
        } else {
          quantity = parseInt(tokenAmount);
        }
      } else {
        // For other types, the ID format is 'forms-1', 'dashboards-2', etc.
        quantity = parseInt(option.id.split('-')[1]);
      }
      
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('Invalid quantity');
      }

      // Create payment request directly like in package payment
      const externalReference = PaymentService.generateExternalReference('PAYGO');
      const paymentReq: PaymentRequest = {
        amount: option.price,
        currency: 'XAF',
        description: PayAsYouGoPaymentService.getDescription(type, quantity),
        externalReference,
        metadata: {
          type: 'pay_as_you_go',
          itemType: type,
          quantity,
          displayAmount: option.price,
          packageInfo: {
            id: option.id,
            name: option.name,
            description: option.description,
            price: option.price,
            unit: option.unit,
            popular: option.popular || false // Ensure boolean value, default to false
            // Note: Excluding 'icon' as it contains React components that can't be serialized
          }
        }
      };

      console.log('Creating payment request:', paymentReq);

      // Create payment record in Firebase
      const paymentId = await PaymentService.createPayment(user.id, paymentReq, {
        type: 'pay_as_you_go',
        itemType: type,
        quantity
      });

      console.log('Payment created with ID:', paymentId);

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
      
      showSuccess(`Paiement initialisé (montant: ${option.price.toLocaleString('fr-FR')} FCFA, démo: 10 FCFA). Ouverture du modal de paiement...`);

    } catch (error) {
      console.error('Purchase failed:', error);
      showError('Erreur lors de la création du paiement. Veuillez réessayer.');
    } finally {
      setIsCreatingPayment(false);
    }
  };


  const options = getPaymentOptions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {getTypeTitle()}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {getTypeDescription()}
            </p>
            <div className="mt-3 p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <strong>Important:</strong> lors de l'étape USSD sur votre téléphone, le <strong>nom du marchand affiché doit être "TAKWID GROUP"</strong>. Si un autre nom apparaît, annulez la transaction.
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6">
          <div className="grid gap-4">
            {options.map((option) => (
              <div
                key={option.id}
                className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedOption === option.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedOption(option.id)}
              >
                {option.popular && (
                  <div className="absolute -top-2 left-4">
                    <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Populaire
                    </span>
                  </div>
                )}
                
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {option.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {option.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {option.price.toLocaleString()} {option.unit}
                    </div>
                    {selectedOption === option.id && (
                      <Check className="h-5 w-5 text-blue-500 mt-1 ml-auto" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <p>💳 Paiement sécurisé par carte bancaire</p>
            <p>🔄 Ressources ajoutées immédiatement après paiement</p>
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={isCreatingPayment}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={!selectedOption || isCreatingPayment}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreatingPayment ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Création du paiement...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4" />
                  <span>Acheter</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

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
