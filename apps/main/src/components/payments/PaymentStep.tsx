import React, { useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CheckCircle, Info, CreditCard } from 'lucide-react';
import { CampayPayment } from './CampayPayment';
import { PaymentService } from '@ubora/shared/services/paymentService';
import { PaymentRequest, CampayPaymentData } from '../../types/payment';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';

interface PaymentStepProps {
  universName: string;
  price: number | null;
  currency: string;
  universId?: string; // ID de l'univers pour les métadonnées
  onPaymentComplete: (paymentId: string) => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export const PaymentStep: React.FC<PaymentStepProps> = ({
  universName,
  price,
  currency,
  universId,
  onPaymentComplete,
  onSkip,
  isLoading = false
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [autoOpenPayment, setAutoOpenPayment] = useState(false);

  const isFree = price === 0 || price === null || price === undefined;
  const formattedPrice = price ? price.toLocaleString('fr-FR') : '0';

  // Handler pour créer le paiement et ouvrir Campay
  const handleInitiatePayment = useCallback(async () => {
    if (!user?.id || !price || price <= 0) {
      showError('Impossible d\'initialiser le paiement. Vérifiez vos informations.');
      return;
    }

    setIsCreatingPayment(true);
    try {
      // Générer une référence externe unique
      const externalReference = PaymentService.generateExternalReference('UNIVERS');
      
      // Créer la requête de paiement
      const paymentReq: PaymentRequest = {
        amount: price,
        currency: currency || 'XAF',
        description: `TAKWID GROUP (USSD) — Achat de l'univers "${universName}"`,
        externalReference,
        metadata: {
          type: 'univers_purchase',
          universId: universId || '',
          universName: universName,
          price: price,
          currency: currency || 'XAF'
        }
      };

      // Créer le paiement dans Firebase
      const paymentId = await PaymentService.createPayment(user.id, paymentReq, {
        type: 'univers_purchase',
        universId: universId || '',
        universName: universName
      });

      // Vérifier que le paiement a été créé
      const createdPayment = await PaymentService.getPayment(paymentId);
      if (!createdPayment) {
        showError('Erreur lors de la création du paiement. Veuillez réessayer.');
        setIsCreatingPayment(false);
        return;
      }

      setCurrentPaymentId(paymentId);
      setPaymentRequest(paymentReq);
      
      // Auto-ouvrir le modal Campay après un court délai
      setTimeout(() => {
        setAutoOpenPayment(true);
      }, 500);

      showSuccess(`Paiement initialisé (montant: ${formattedPrice} ${currency}, démo: 10 FCFA). Ouverture du modal de paiement...`);

    } catch (error) {
      showError('Erreur lors de l\'initialisation du paiement. Veuillez réessayer.');
      setIsCreatingPayment(false);
    }
  }, [user, price, currency, universName, universId, formattedPrice, showSuccess, showError]);

  // Handler pour le succès du paiement
  const handlePaymentSuccess = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId) return;

    try {
      // Mettre à jour le statut du paiement dans Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'completed');
      
      // Appeler le callback avec l'ID du paiement
      onPaymentComplete(currentPaymentId);
      
      showSuccess('Paiement effectué avec succès !');
    } catch (error) {
      showError('Erreur lors de la mise à jour du paiement. Veuillez contacter le support.');
    } finally {
      setCurrentPaymentId(null);
      setPaymentRequest(null);
      setAutoOpenPayment(false);
    }
  }, [currentPaymentId, onPaymentComplete, showSuccess, showError]);

  // Handler pour l'échec du paiement
  const handlePaymentFail = useCallback(async (data: CampayPaymentData) => {
    if (!currentPaymentId) return;

    try {
      // Mettre à jour le statut du paiement dans Firebase
      await PaymentService.updatePaymentStatus(currentPaymentId, data, 'failed');
      showError('Paiement échoué. Veuillez réessayer.');
    } catch (error) {
      // Erreur silencieuse lors de la mise à jour
    } finally {
      setCurrentPaymentId(null);
      setPaymentRequest(null);
      setAutoOpenPayment(false);
      setIsCreatingPayment(false);
    }
  }, [currentPaymentId, showError]);

  // Handler pour la fermeture du modal
  const handlePaymentModalClose = useCallback(() => {
    setAutoOpenPayment(false);
    setCurrentPaymentId(null);
    setPaymentRequest(null);
    setIsCreatingPayment(false);
  }, []);

  // Si gratuit, passer directement à l'étape suivante
  React.useEffect(() => {
    if (isFree && onSkip) {
      onSkip();
    }
  }, [isFree, onSkip]);

  if (isFree) {
    return (
      <Card className="bg-green-50 border-green-200">
        <div className="flex items-center space-x-3 p-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 mb-1">
              Univers gratuit
            </h3>
            <p className="text-sm text-green-700">
              Ce Univers est disponible gratuitement. Vous pouvez continuer sans paiement.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Paiement
        </h2>
        <p className="text-gray-600">
          Finalisez votre achat pour utiliser ce Univers
        </p>
      </div>

      {/* Payment Summary */}
      <Card title="Résumé de l'achat">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-700">Univers</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{universName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">Prix</p>
              <p className="text-lg font-semibold text-blue-600 mt-1">
                {formattedPrice} {currency}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-base font-semibold text-gray-900">Total</p>
            <p className="text-xl font-bold text-blue-600">
              {formattedPrice} {currency}
            </p>
          </div>
        </div>
      </Card>

      {/* Payment Info */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-blue-800">
              <strong>Important :</strong> lors de l'étape USSD sur votre téléphone, le <strong>nom du marchand affiché doit être "TAKWID GROUP"</strong>. Si un autre nom apparaît, annulez la transaction.
            </p>
          </div>
        </div>
      </Card>

      {/* Payment Button */}
      <Card title="Paiement sécurisé">
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Paiement par Campay</span>
            </div>
            <p className="text-sm text-gray-600">
              Cliquez sur le bouton ci-dessous pour ouvrir le modal de paiement sécurisé. 
              Vous pourrez effectuer le paiement via USSD, Mobile Money ou Carte bancaire.
            </p>
          </div>

          {/* Payment Button */}
          <div className="pt-2">
            {!paymentRequest ? (
              <Button
                variant="primary"
                onClick={handleInitiatePayment}
                disabled={isCreatingPayment || isLoading}
                className="w-full flex items-center justify-center space-x-2"
              >
                {isCreatingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Initialisation du paiement...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    <span>Payer {formattedPrice} {currency}</span>
                  </>
                )}
              </Button>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">
                      Paiement en cours...
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Le modal de paiement va s'ouvrir automatiquement.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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
          onModalClosed={handlePaymentModalClose}
        />
      )}
    </div>
  );
};

