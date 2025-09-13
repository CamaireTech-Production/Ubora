import React from 'react';
import { X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface PDFDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  extractedText: string;
  extractionStatus: 'pending' | 'completed' | 'failed';
  error?: string;
  pages?: number;
  fileSize?: number;
}

export const PDFDebugModal: React.FC<PDFDebugModalProps> = ({
  isOpen,
  onClose,
  fileName,
  extractedText,
  extractionStatus,
  error,
  pages,
  fileSize
}) => {
  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (extractionStatus) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <FileText className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    switch (extractionStatus) {
      case 'completed':
        return 'Extraction réussie';
      case 'failed':
        return 'Extraction échouée';
      default:
        return 'Extraction en cours...';
    }
  };

  const getStatusColor = () => {
    switch (extractionStatus) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-blue-500" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Debug PDF Extraction</h2>
                <p className="text-sm text-gray-500">{fileName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* File Info */}
          <div className="mb-6">
            <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
              <div className="flex items-center space-x-3">
                {getStatusIcon()}
                <div>
                  <h3 className="font-medium text-gray-900">{getStatusText()}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    {pages && <span>Pages: {pages} • </span>}
                    {fileSize && <span>Taille: {(fileSize / 1024).toFixed(2)} KB • </span>}
                    <span>Texte extrait: {extractedText.length} caractères</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {extractionStatus === 'failed' && error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2">Erreur d'extraction:</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Extracted Text */}
          {extractionStatus === 'completed' && extractedText && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Texte extrait:</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {extractedText}
                </div>
              </div>
            </div>
          )}

          {/* Raw Data (for debugging) */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Données brutes (debug):</h4>
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
              <pre className="text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify({
                  fileName,
                  extractionStatus,
                  textLength: extractedText.length,
                  pages,
                  fileSize,
                  error
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
