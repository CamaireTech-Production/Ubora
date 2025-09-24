import React, { useState } from 'react';
import { X, CreditCard, Plus, Users, BarChart3, Brain, Check } from 'lucide-react';
import { Button } from './Button';
import { useToast } from '../hooks/useToast';

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
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showSuccess, showError } = useToast();

  if (!isOpen) return null;

  const getPaymentOptions = (): PaymentOption[] => {
    switch (type) {
      case 'tokens':
        return [
          {
            id: 'tokens-10k',
            name: '10 000 Tokens Archa',
            description: 'Pour conversations et analyses supplémentaires',
            price: 2500,
            unit: 'FCFA',
            icon: <Brain className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'tokens-25k',
            name: '25 000 Tokens Archa',
            description: 'Idéal pour usage intensif',
            price: 5000,
            unit: 'FCFA',
            icon: <Brain className="h-5 w-5" />
          },
          {
            id: 'tokens-40k',
            name: '40 000 Tokens Archa',
            description: 'Pour équipes importantes',
            price: 8500,
            unit: 'FCFA',
            icon: <Brain className="h-5 w-5" />
          }
        ];
      case 'forms':
        return [
          {
            id: 'forms-5',
            name: '5 Formulaires supplémentaires',
            description: 'Créez 5 formulaires de plus',
            price: 15000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'forms-10',
            name: '10 Formulaires supplémentaires',
            description: 'Idéal pour les structures en croissance',
            price: 25000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          },
          {
            id: 'forms-unlimited',
            name: 'Formulaires illimités',
            description: 'Accès illimité aux formulaires',
            price: 50000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          }
        ];
      case 'dashboards':
        return [
          {
            id: 'dashboards-3',
            name: '3 Tableaux de bord supplémentaires',
            description: 'Créez 3 tableaux de bord de plus',
            price: 20000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'dashboards-5',
            name: '5 Tableaux de bord supplémentaires',
            description: 'Pour analyses approfondies',
            price: 30000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          },
          {
            id: 'dashboards-unlimited',
            name: 'Tableaux de bord illimités',
            description: 'Accès illimité aux tableaux de bord',
            price: 60000,
            unit: 'FCFA',
            icon: <BarChart3 className="h-5 w-5" />
          }
        ];
      case 'users':
        return [
          {
            id: 'users-3',
            name: '3 Utilisateurs supplémentaires',
            description: 'Ajoutez 3 utilisateurs à votre équipe',
            price: 21000,
            unit: 'FCFA',
            icon: <Users className="h-5 w-5" />,
            popular: true
          },
          {
            id: 'users-5',
            name: '5 Utilisateurs supplémentaires',
            description: 'Idéal pour les équipes moyennes',
            price: 35000,
            unit: 'FCFA',
            icon: <Users className="h-5 w-5" />
          },
          {
            id: 'users-10',
            name: '10 Utilisateurs supplémentaires',
            description: 'Pour les grandes équipes',
            price: 70000,
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
      case 'tokens': return 'Vous avez atteint votre limite de tokens Archa. Achetez des tokens supplémentaires pour continuer à utiliser l\'IA.';
      case 'forms': return `Vous avez atteint votre limite de ${currentLimit} formulaires. Achetez des formulaires supplémentaires.`;
      case 'dashboards': return `Vous avez atteint votre limite de ${currentLimit} tableaux de bord. Achetez des tableaux de bord supplémentaires.`;
      case 'users': return `Vous avez atteint votre limite de ${currentLimit} utilisateurs. Achetez des utilisateurs supplémentaires.`;
      default: return 'Achetez des ressources supplémentaires pour votre package.';
    }
  };

  const handlePurchase = async () => {
    if (!selectedOption) {
      showError('Veuillez sélectionner une option');
      return;
    }

    const option = getPaymentOptions().find(opt => opt.id === selectedOption);
    if (!option) return;

    setIsProcessing(true);

    try {
      // Simulation de paiement
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Call the onPurchase callback which should handle database updates
      await onPurchase(option);
      showSuccess(`${option.name} acheté avec succès !`);
      onClose();
    } catch (error) {
      console.error('Purchase error:', error);
      showError('Erreur lors de l\'achat. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
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
          </div>
          <button
            onClick={onClose}
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
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={!selectedOption || isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Traitement...</span>
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
    </div>
  );
};
