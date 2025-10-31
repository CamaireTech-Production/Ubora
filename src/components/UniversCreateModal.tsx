import React from 'react';
import { X, Sparkles, FileText } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Créer un Univers</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Create from scratch */}
            <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-blue-500" onClick={onCreateFromScratch}>
              <div className="p-6 text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Créer de 0
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Créez un Univers entièrement personnalisé en partant de zéro
                </p>
                <Button className="w-full">
                  Commencer
                </Button>
              </div>
            </Card>

            {/* Option 2: Create from template */}
            <Card className="border-2 border-gray-200 relative opacity-75 cursor-not-allowed">
              <div className="p-6 text-center">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Créer depuis un template
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Utilisez un template existant du marketplace pour créer rapidement votre Univers
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800">
                    Bientôt disponible
                  </p>
                </div>
                <div className="mt-4">
                  <Button variant="secondary" disabled className="w-full opacity-50 cursor-not-allowed">
                    Bientôt disponible
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

