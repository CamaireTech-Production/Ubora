import React from 'react';
import { X, FileText } from 'lucide-react';
import { Button } from '../ui/Button';

interface TextExtractionReviewModalProps {
  isOpen: boolean;
  title?: string;
  fileName?: string;
  extractedText: string;
  onAccept: () => void;
  onReupload: () => void;
  onClose: () => void;
}

export const TextExtractionReviewModal: React.FC<TextExtractionReviewModalProps> = ({
  isOpen,
  title = 'Texte extrait de l\'image',
  fileName,
  extractedText,
  onAccept,
  onReupload,
  onClose
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleBackdropClick}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                {fileName && (
                  <p className="text-xs text-gray-500 mt-0.5">Fichier: {fileName}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 pb-4">
            <div className="h-64 sm:h-80 border rounded-md bg-gray-50 p-3 overflow-auto whitespace-pre-wrap text-sm text-gray-800">
              {extractedText || 'Aucun texte détecté.'}
            </div>
            <p className="text-xs text-gray-500 mt-2">Vérifiez et validez le texte. Vous pouvez continuer à remplir le formulaire ou réimporter une image si le résultat est incorrect.</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 bg-gray-50">
            <Button
              type="button"
              variant="secondary"
              onClick={onReupload}
              className="w-full sm:w-auto"
            >
              Réimporter une image
            </Button>
            <Button
              type="button"
              onClick={onAccept}
              className="w-full sm:w-auto"
            >
              Utiliser ce texte et continuer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


