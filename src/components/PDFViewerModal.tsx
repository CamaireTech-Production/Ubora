import React, { useState, useRef, useEffect } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
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
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle ESC key to close modal - MUST be before early return
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

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

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full h-full flex flex-col ${isFullscreen ? 'max-w-none max-h-none rounded-none' : 'max-w-6xl max-h-[90vh]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          {/* Top Row - Title and Close */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {fileName}
              </h3>
              <span className="text-sm text-gray-500 whitespace-nowrap">({zoom}%)</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex items-center space-x-1 ml-2 flex-shrink-0"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Fermer</span>
            </Button>
          </div>
          
          {/* Bottom Row - Controls and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* PDF Controls */}
            <div className="flex items-center space-x-2 flex-wrap">
              <div className="flex items-center space-x-1 border border-gray-300 rounded">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="px-2 py-1"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="px-2 py-1 text-sm text-gray-600 min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 300}
                  className="px-2 py-1"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRotate}
                className="px-2 py-1"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleFullscreen}
                className="px-2 py-1"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                className="flex items-center space-x-1"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Télécharger</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenInNewTab}
                className="flex items-center space-x-1"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Nouvel onglet</span>
              </Button>
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 p-4 bg-gray-100 relative">
          {/* Close button overlay for easy access */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all duration-200 sm:hidden"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="w-full h-full border border-gray-300 rounded-lg overflow-hidden bg-white relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-gray-600">Chargement du PDF...</p>
                </div>
              </div>
            )}
            
            {hasError ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">Impossible de charger le PDF</p>
                  <p className="text-sm mb-4">Le fichier ne peut pas être affiché dans le navigateur.</p>
                  <div className="space-x-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleOpenInNewTab}
                    >
                      Ouvrir dans un nouvel onglet
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDownload}
                    >
                      Télécharger
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={fileUrl}
                className="w-full h-full"
                title={fileName}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'top left',
                  width: `${100 / (zoom / 100)}%`,
                  height: `${100 / (zoom / 100)}%`
                }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

