import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, FileText } from 'lucide-react';
import { Button } from './Button';

interface UniversCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFromScratch: () => void;
}

export const UniversCreateModal: React.FC<UniversCreateModalProps> = ({
  isOpen,
  onClose,
  onCreateFromScratch
}) => {
  const navigate = useNavigate();
  
  const handleCreateFromTemplate = () => {
    onClose();
    navigate('/univers/marketplace');
  };
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Créer un Univers</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          {/* Option 1: Create from scratch */}
          <button
            onClick={onCreateFromScratch}
            className="w-full text-left p-4 sm:p-5 rounded-lg border-2 border-transparent hover:border-blue-500 bg-blue-50 hover:bg-blue-100 transition-all duration-200 group"
          >
            <div className="flex items-start space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  Créer de zéro
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-3">
                  Créez un Univers entièrement personnalisé en partant de zéro
                </p>
                <span className="inline-block px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white cursor-pointer">
                  Commencer
                </span>
              </div>
            </div>
          </button>

          {/* Option 2: Create from template */}
          <button
            onClick={handleCreateFromTemplate}
            className="w-full text-left p-4 sm:p-5 rounded-lg border-2 border-transparent hover:border-purple-500 bg-purple-50 hover:bg-purple-100 transition-all duration-200 group"
          >
            <div className="flex items-start space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  Créer depuis un template
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-3">
                  Utilisez un template existant du marketplace pour créer rapidement votre Univers
                </p>
                <span className="inline-block px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-600 text-white cursor-pointer">
                  Parcourir le marketplace
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-end z-10">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
};

