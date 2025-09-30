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
  pages?: number; // For PDF files
  fileType?: 'image' | 'pdf'; // To distinguish between image and PDF
  extractionStats?: {
    totalCharacters: number;
    totalWords: number;
    averageWordsPerPage: number;
    extractionTime: number;
    tablesDetected: number;
  };
}

export const TextExtractionModal: React.FC<TextExtractionModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  fileName,
  extractedText,
  extractionStatus,
  error,
  fileSize,
  engine,
  pages,
  fileType = 'image',
  extractionStats
}) => {
  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleProceed = () => {
    onProceed();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Extraction de texte - {fileName}
              </h3>
              <p className="text-sm text-gray-500">
                {formatFileSize(fileSize)} • {fileType.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Status Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {extractionStatus === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <h4 className="font-medium text-gray-900">
                  {extractionStatus === 'completed' ? 'Extraction réussie' : 'Extraction échouée'}
                </h4>
                {engine && (
                  <span className="text-sm text-gray-500">
                    (Moteur: {engine})
                  </span>
                )}
              </div>

              {extractionStats && fileType === 'pdf' && (
                <div className="text-sm text-gray-600 mt-1">
                  <span className="inline-block mr-4">📊 {extractionStats.totalWords} mots</span>
                  <span className="inline-block mr-4">⏱️ {extractionStats.extractionTime}ms</span>
                  <span className="inline-block mr-4">📄 {extractionStats.averageWordsPerPage} mots/page</span>
                  {extractionStats.tablesDetected > 0 && (
                    <span className="inline-block">📋 {extractionStats.tablesDetected} tableau{extractionStats.tablesDetected > 1 ? 'x' : ''}</span>
                  )}
                </div>
              )}
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

            {/* Quality Warning Section */}
            {extractionStatus === 'completed' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">
                      {fileType === 'pdf' ? 'Conseils pour améliorer l\'extraction PDF' : 'Conseils pour améliorer l\'extraction'}
                    </h4>
                    <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                      {fileType === 'pdf' ? (
                        <>
                          <li>• Assurez-vous que le PDF contient du texte (pas seulement des images)</li>
                          <li>• Utilisez des PDFs avec des tableaux bien structurés</li>
                          <li>• Évitez les PDFs scannés de mauvaise qualité</li>
                          <li>• Les tableaux avec des bordures sont mieux extraits</li>
                        </>
                      ) : (
                        <>
                          <li>• Assurez-vous que l'image est nette et bien éclairée</li>
                          <li>• Évitez les reflets et les ombres sur le document</li>
                          <li>• Utilisez une résolution d'au moins 300 DPI</li>
                          <li>• Gardez le texte horizontal et lisible</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tables Detected Section */}
            {extractionStats && fileType === 'pdf' && extractionStats.tablesDetected > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 text-green-500">📋</div>
                  <h4 className="font-medium text-gray-900">Tableaux détectés</h4>
                  <span className="text-sm text-gray-500">
                    ({extractionStats.tablesDetected} tableau{extractionStats.tablesDetected > 1 ? 'x' : ''} formaté{extractionStats.tablesDetected > 1 ? 's' : ''} en Markdown)
                  </span>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 text-green-500 mt-0.5">✅</div>
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">🎯 Tableaux formatés en Markdown</p>
                      <p className="text-green-700">
                        Les tableaux ont été détectés et convertis au format Markdown pour une meilleure analyse. 
                        Ils sont maintenant structurés et peuvent être facilement traités par les systèmes d'analyse.
                      </p>
                    </div>
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
                  {fileType === 'pdf' && pages && ` • ${pages} page${pages > 1 ? 's' : ''}`}
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
              Continuer le formulaire
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};