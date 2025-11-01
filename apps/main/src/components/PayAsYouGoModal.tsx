import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CreditCard, Zap, AlertCircle } from 'lucide-react';
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


export const PayAsYouGoModal: React.FC<PayAsYouGoModalProps> = ({
  isOpen,
  onClose,
  currentTokens,
  packageLimit,
  payAsYouGoTokens,
  requiredTokens = 0
}) => {
  const navigate = useNavigate();
  

  if (!isOpen) return null;

  const totalAvailableTokens = packageLimit + payAsYouGoTokens;
  const remainingTokens = totalAvailableTokens - currentTokens;


  const handleClose = () => {
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

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={handleClose}
          >
            Annuler
          </Button>
          <Button
            onClick={() => {
              onClose();
              navigate('/packages/manage?section=pay-as-you-go&type=tokens');
            }}
            className="flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Acheter des tokens
          </Button>
        </div>
      </Card>

    </div>
  );
};
