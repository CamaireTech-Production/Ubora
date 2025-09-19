import React, { useState } from 'react';
import { X, CreditCard, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

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
    tokens: 5000,
    price: 5000, // 5000 FCFA
    popular: false,
    description: 'Pour quelques questions supplémentaires'
  },
  {
    tokens: 15000,
    price: 12000, // 12000 FCFA (20% discount)
    popular: true,
    description: 'Idéal pour un usage intensif'
  },
  {
    tokens: 30000,
    price: 20000, // 20000 FCFA (33% discount)
    popular: false,
    description: 'Pour une utilisation professionnelle'
  },
  {
    tokens: 50000,
    price: 30000, // 30000 FCFA (40% discount)
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
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  if (!isOpen) return null;

  const totalAvailableTokens = packageLimit + payAsYouGoTokens;
  const remainingTokens = totalAvailableTokens - currentTokens;

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsPurchasing(true);
    try {
      const packageData = TOKEN_PACKAGES.find(pkg => pkg.tokens === selectedPackage);
      if (packageData) {
        await onPurchase(selectedPackage);
        setPurchaseSuccess(true);
        setTimeout(() => {
          setPurchaseSuccess(false);
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    setSelectedPackage(null);
    setPurchaseSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
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
                disabled={!selectedPackage || isPurchasing}
                className="flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {isPurchasing ? 'Achat en cours...' : 'Acheter des tokens'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
