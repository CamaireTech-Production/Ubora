import React, { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { CheckCircle, DollarSign, Loader2, CreditCard, Info } from 'lucide-react';

interface PaymentStepProps {
  universName: string;
  price: number | null;
  currency: string;
  onPaymentComplete: (paymentId: string) => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export const PaymentStep: React.FC<PaymentStepProps> = ({
  universName,
  price,
  currency,
  onPaymentComplete,
  onSkip,
  isLoading = false
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const isFree = price === 0 || price === null || price === undefined;
  const formattedPrice = price ? price.toLocaleString('fr-FR') : '0';

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    
    // Simuler un délai de paiement
    setTimeout(() => {
      // Générer un ID de paiement simulé
      const simulatedPaymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setPaymentId(simulatedPaymentId);
      setIsSimulating(false);
      onPaymentComplete(simulatedPaymentId);
    }, 2000); // 2 secondes de simulation
  };

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
              <strong>Mode simulation :</strong> Pour l'instant, le paiement est simulé. 
              Dans une version future, vous serez redirigé vers une passerelle de paiement sécurisée.
            </p>
          </div>
        </div>
      </Card>

      {/* Payment Form (Simulated) */}
      <Card title="Informations de paiement">
        <div className="space-y-4">
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Carte de crédit</span>
            </div>
            
            <div className="space-y-3">
              <div className="bg-white p-4 rounded border border-gray-300">
                <p className="text-sm text-gray-600 mb-1">Numéro de carte</p>
                <p className="text-lg font-mono text-gray-400">**** **** **** 1234</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded border border-gray-300">
                  <p className="text-sm text-gray-600 mb-1">Date d'expiration</p>
                  <p className="text-lg font-mono text-gray-400">12/25</p>
                </div>
                
                <div className="bg-white p-4 rounded border border-gray-300">
                  <p className="text-sm text-gray-600 mb-1">CVV</p>
                  <p className="text-lg font-mono text-gray-400">***</p>
                </div>
              </div>
            </div>
          </div>

          {/* Simulate Payment Button */}
          <div className="pt-4">
            <Button
              variant="primary"
              onClick={handleSimulatePayment}
              disabled={isSimulating || isLoading || paymentId !== null}
              className="w-full flex items-center justify-center space-x-2"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Traitement du paiement...</span>
                </>
              ) : paymentId ? (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>Paiement effectué</span>
                </>
              ) : (
                <>
                  <DollarSign className="h-5 w-5" />
                  <span>Simuler le paiement</span>
                </>
              )}
            </Button>
          </div>

          {paymentId && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    Paiement simulé avec succès
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    ID de transaction : {paymentId}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

