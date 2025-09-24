import React from 'react';
import { X, FileText, AlertCircle, CheckCircle, Lightbulb, ArrowRight } from 'lucide-react';

interface TextExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  fileName: string;
  extractedText: string;
  extractionStatus: 'completed' | 'failed';
  confidence?: number;
  error?: string;
  fileSize: number;
  engine?: string;
}

export const TextExtractionModal: React.FC<TextExtractionModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  fileName,
  extractedText,
  extractionStatus,
  confidence,
  error,
  fileSize,
  engine
}) => {
  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    if (extractionStatus === 'completed') {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    } else {
      return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    return extractionStatus === 'completed' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusText = () => {
    return extractionStatus === 'completed' ? 'Extraction réussie' : 'Extraction échouée';
  };

  const handleProceed = () => {
    onProceed();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Extraction de texte - {fileName}
              </h3>
              <p className="text-sm text-gray-500">
                Taille du fichier: {formatFileSize(fileSize)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Image Quality Warning */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">💡 Pour de meilleurs résultats</p>
                  <p className="text-amber-700">
                    Pour une extraction de texte optimale, veuillez uploader des images avec une bonne luminosité, 
                    un contraste élevé et une résolution claire. Les images manuscrites doivent être nettes et lisibles.
                  </p>
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              {getStatusIcon()}
              <div className="flex-1">
                <h4 className={`font-medium ${getStatusColor()}`}>
                  {getStatusText()}
                </h4>
              </div>
            </div>

            {/* Error Section */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Erreur</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Extracted Text Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <h4 className="font-medium text-gray-900">Texte extrait</h4>
                <span className="text-sm text-gray-500">
                  ({extractedText.length} caractères)
                </span>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="max-h-96 overflow-auto">
                  {extractedText ? (
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                      {extractedText}
                    </pre>
                  ) : (
                    <p className="text-gray-500 italic">Aucun texte extrait</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
          >
            Annuler
          </button>
          
          <div className="flex gap-3">
            {extractedText && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(extractedText);
                  // You could add a toast notification here
                }}
                className="px-4 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                Copier le texte
              </button>
            )}
            
            <button
              onClick={handleProceed}
              className="px-6 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-2"
            >
              Continuer la soumission
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};