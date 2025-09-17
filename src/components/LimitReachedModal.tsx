import React from 'react';
import { X, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'forms' | 'dashboards' | 'users';
  current: number;
  limit: number;
  onUpgrade: () => void;
}

export const LimitReachedModal: React.FC<LimitReachedModalProps> = ({
  isOpen,
  onClose,
  type,
  current,
  limit,
  onUpgrade
}) => {
  const { user } = useAuth();
  
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
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

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className={`px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors ${
              user?.role === 'directeur' ? 'flex-1' : 'w-full'
            }`}
          >
            Fermer
          </button>
          {/* Only show "Voir les packages" button for actual directors */}
          {user?.role === 'directeur' && (
            <button
              onClick={handleUpgrade}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Voir les packages
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
