import React, { useState } from 'react';
import { X, AlertCircle, ArrowRight, Plus, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { useToast } from '../hooks/useToast';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'forms' | 'dashboards' | 'users';
  current: number;
  limit: number;
  onUpgrade: () => void;
  onPayAsYouGo?: (type: 'forms' | 'dashboards' | 'users', quantity: number) => void;
}

export const LimitReachedModal: React.FC<LimitReachedModalProps> = ({
  isOpen,
  onClose,
  type,
  current,
  limit,
  onUpgrade,
  onPayAsYouGo
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [showPayAsYouGo, setShowPayAsYouGo] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  
  if (!isOpen) return null;

  const getTypeLabel = () => {
    switch (type) {
      case 'forms': return 'formulaires';
      case 'dashboards': return 'tableaux de bord';
      case 'users': return 'utilisateurs';
      default: return 'éléments';
    }
  };

  const getMessage = () => {
    if (limit === 0) {
      return `Vous avez actuellement ${current} ${getTypeLabel()}, mais votre package actuel ne permet pas de créer de nouveaux ${getTypeLabel()}.`;
    } else {
      return `Vous avez atteint la limite de ${limit} ${getTypeLabel()} pour votre package actuel. Vous avez actuellement ${current} ${getTypeLabel()}.`;
    }
  };

  const handleUpgrade = () => {
    onUpgrade();
    onClose();
  };

  const getPayAsYouGoOptions = () => {
    switch (type) {
      case 'forms':
        return [
          { quantity: 1, price: 2000, label: '1 formulaire supplémentaire' },
          { quantity: 3, price: 5000, label: '3 formulaires supplémentaires' },
          { quantity: 5, price: 8000, label: '5 formulaires supplémentaires' }
        ];
      case 'dashboards':
        return [
          { quantity: 1, price: 3000, label: '1 tableau de bord supplémentaire' },
          { quantity: 2, price: 5500, label: '2 tableaux de bord supplémentaires' },
          { quantity: 3, price: 8000, label: '3 tableaux de bord supplémentaires' }
        ];
      case 'users':
        return [
          { quantity: 1, price: 7000, label: '1 utilisateur supplémentaire' },
          { quantity: 2, price: 13000, label: '2 utilisateurs supplémentaires' },
          { quantity: 3, price: 20000, label: '3 utilisateurs supplémentaires' }
        ];
      default:
        return [];
    }
  };

  const handlePayAsYouGo = async () => {
    if (!onPayAsYouGo) return;
    
    setIsProcessing(true);
    try {
      await onPayAsYouGo(type, selectedQuantity);
      showSuccess(`${selectedQuantity} ${getTypeLabel()} supplémentaire(s) ajouté(s) pour ce mois !`);
      onClose();
    } catch (error) {
      showError('Erreur lors de l\'ajout des ressources supplémentaires');
    } finally {
      setIsProcessing(false);
    }
  };

  const payAsYouGoOptions = getPayAsYouGoOptions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative shadow-2xl">
        {/* Bouton de fermeture */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icône d'alerte */}
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4">
          <AlertCircle className="h-6 w-6 text-blue-600" />
        </div>

        {/* Titre */}
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-4">
          Limite de package atteinte
        </h2>

        {/* Message */}
        <div className="text-center mb-6">
          <p className="text-gray-600 mb-3">
            {getMessage()}
          </p>
          <p className="text-gray-800 font-medium">
            Mettez à niveau votre package pour créer plus de {getTypeLabel()}.
          </p>
        </div>

        {/* Pay-as-you-go Options */}
        {!showPayAsYouGo && user?.role === 'directeur' && (
          <div className="mb-6">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Vous pouvez acheter des ressources supplémentaires pour ce mois uniquement :
              </p>
            </div>
            
            <div className="space-y-2 mb-4">
              {payAsYouGoOptions.map((option) => (
                <div
                  key={option.quantity}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedQuantity === option.quantity
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedQuantity(option.quantity)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {option.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {option.price.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-xs text-gray-500 text-center mb-4">
              💡 Ces ressources sont valables uniquement pour le mois en cours
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {!showPayAsYouGo ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Fermer
                </Button>
                {user?.role === 'directeur' && (
                  <Button
                    onClick={handleUpgrade}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    Voir les packages
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {user?.role === 'directeur' && (
                <Button
                  onClick={handlePayAsYouGo}
                  disabled={isProcessing}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Acheter pour ce mois ({payAsYouGoOptions.find(opt => opt.quantity === selectedQuantity)?.price.toLocaleString()} FCFA)
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={() => setShowPayAsYouGo(false)}
              variant="outline"
              className="w-full"
            >
              Retour
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
