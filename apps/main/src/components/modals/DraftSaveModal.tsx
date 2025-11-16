import React from 'react';
import { FileText, X, Save, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from './Button';

interface DraftSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsDraft: () => void;
  onAbandon: () => void;
  hasProgress: boolean;
}

export const DraftSaveModal: React.FC<DraftSaveModalProps> = ({
  isOpen,
  onClose,
  onSaveAsDraft,
  onAbandon,
  hasProgress
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleBackdropClick}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {hasProgress ? 'Quitter la création ?' : 'Quitter sans sauvegarder ?'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {hasProgress ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Vous avez un brouillon en cours. Que souhaitez-vous faire ?
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Astuce :</strong> Votre brouillon sera automatiquement sauvegardé et vous pourrez le reprendre plus tard.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                Êtes-vous sûr de vouloir quitter ? Votre progression ne sera pas sauvegardée.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            {hasProgress ? (
              <>
                <Button
                  type="button"
                  onClick={onSaveAsDraft}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>Sauvegarder comme brouillon et quitter</span>
                </Button>
                <Button
                  type="button"
                  onClick={onAbandon}
                  variant="secondary"
                  className="w-full text-red-600 hover:bg-red-50 border-red-200 flex items-center justify-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Abandonner définitivement</span>
                </Button>
                <Button
                  type="button"
                  onClick={onClose}
                  variant="secondary"
                  className="w-full border-gray-300 flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Annuler - Continuer la création</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={onAbandon}
                  className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Quitter sans sauvegarder</span>
                </Button>
                <Button
                  type="button"
                  onClick={onClose}
                  variant="secondary"
                  className="w-full border-gray-300 flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Annuler - Continuer</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

