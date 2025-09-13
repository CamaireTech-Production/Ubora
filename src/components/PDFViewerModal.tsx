import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { Button } from './Button';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  onDownload?: () => void;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  onDownload
}) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Fallback download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {fileName}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="flex items-center space-x-1"
            >
              <Download className="h-4 w-4" />
              <span>Télécharger</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenInNewTab}
              className="flex items-center space-x-1"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Ouvrir dans un nouvel onglet</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Fermer</span>
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 p-4">
          <div className="w-full h-full border border-gray-300 rounded-lg overflow-hidden">
            <iframe
              src={fileUrl}
              className="w-full h-full"
              title={fileName}
              onError={(e) => {
                console.error('Error loading PDF:', e);
                // Fallback: show error message
                const iframe = e.target as HTMLIFrameElement;
                iframe.style.display = 'none';
                const errorDiv = document.createElement('div');
                errorDiv.className = 'flex items-center justify-center h-full text-gray-500';
                errorDiv.innerHTML = `
                  <div class="text-center">
                    <p class="text-lg font-medium mb-2">Impossible de charger le PDF</p>
                    <p class="text-sm mb-4">Le fichier ne peut pas être affiché dans le navigateur.</p>
                    <button onclick="window.open('${fileUrl}', '_blank')" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                      Ouvrir dans un nouvel onglet
                    </button>
                  </div>
                `;
                iframe.parentNode?.appendChild(errorDiv);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
