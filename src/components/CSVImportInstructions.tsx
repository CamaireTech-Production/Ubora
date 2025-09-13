import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { X, FileText, Download, Info } from 'lucide-react';

interface CSVImportInstructionsProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadSample: () => void;
}

export const CSVImportInstructions: React.FC<CSVImportInstructionsProps> = ({
  isOpen,
  onClose,
  onDownloadSample
}) => {
  if (!isOpen) return null;

  const sampleCSVContent = `option_value
"Option 1"
"Option 2"
"Option 3"
"Option 4"
"Option 5"`;

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCSVContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'exemple_options_formulaire.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDownloadSample();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Instructions d'import CSV
            </h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Fermer</span>
          </Button>
        </div>

        <div className="p-6 space-y-4">
          {/* Simple Introduction */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-800 mb-1">
                  Import d'options via CSV
                </h3>
                <p className="text-sm text-blue-700">
                  Importez rapidement des options pour ce champ "Liste déroulante" à partir d'un fichier CSV.
                </p>
              </div>
            </div>
          </div>

          {/* CSV Format and Sample File - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Simple CSV Format */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Format du fichier CSV
              </h3>
              
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Structure simple :</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="font-mono text-sm text-gray-800">
                      <div className="text-green-600">option_value</div>
                      <div className="text-gray-600">"Option 1"</div>
                      <div className="text-gray-600">"Option 2"</div>
                      <div className="text-gray-600">"Option 3"</div>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <p><strong>Une seule colonne :</strong> Chaque ligne = une option</p>
                  <p><strong>Encodage :</strong> UTF-8 recommandé</p>
                  <p><strong>Doublons :</strong> Supprimés automatiquement</p>
                </div>
              </div>
            </Card>

            {/* Sample File */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Fichier d'exemple
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Télécharger</span>
                </Button>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="font-mono text-xs text-gray-700 whitespace-pre-line">
                  {sampleCSVContent}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Fermer
          </Button>
          <Button
            onClick={onClose}
            className="flex items-center space-x-2"
          >
            <span>Commencer l'import</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
