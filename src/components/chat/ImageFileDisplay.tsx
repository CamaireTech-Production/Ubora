import React, { useState } from 'react';
import { Download, Eye, X, FileImage } from 'lucide-react';
import { ImageFileReference } from '../../types';
import { getFileDownloadURL } from '../../utils/firebaseDownloadUtils';
import { downloadFile } from '../../utils/downloadUtils';
import { useToast } from '../../hooks/useToast';

interface ImageFileDisplayProps {
  imageFiles: ImageFileReference[];
}

interface ImageViewerModal {
  isOpen: boolean;
  fileUrl: string;
  fileName: string;
}

export const ImageFileDisplay: React.FC<ImageFileDisplayProps> = ({ imageFiles }) => {
  const { showSuccess, showError } = useToast();
  const [imageViewerModal, setImageViewerModal] = useState<ImageViewerModal>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });

  const handleViewImage = async (imageFile: ImageFileReference) => {
    try {
      const downloadUrl = await getFileDownloadURL(imageFile);
      
      // Open in image viewer modal
      setImageViewerModal({
        isOpen: true,
        fileUrl: downloadUrl,
        fileName: imageFile.fileName
      });
    } catch (error) {
      showError('Erreur lors de l\'ouverture de l\'image');
    }
  };

  const handleDownloadImage = async (imageFile: ImageFileReference) => {
    try {
      const downloadUrl = await getFileDownloadURL(imageFile);
      
      await downloadFile({
        fileName: imageFile.fileName,
        url: downloadUrl,
        onSuccess: () => {
          showSuccess('Téléchargement démarré');
        },
        onError: (error) => {
          showError(`Erreur lors du téléchargement: ${error}`);
        }
      });
    } catch (error) {
      showError('Erreur lors du téléchargement de l\'image');
    }
  };

  const handleCloseImageModal = () => {
    setImageViewerModal({
      isOpen: false,
      fileUrl: '',
      fileName: ''
    });
  };

  if (!imageFiles || imageFiles.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <FileImage className="w-4 h-4" />
          Images jointes ({imageFiles.length})
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {imageFiles.map((imageFile, index) => (
            <div
              key={`${imageFile.fileName}-${index}`}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <FileImage className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {imageFile.fileName}
                    </span>
                  </div>
                  
                  {imageFile.fileSize && (
                    <p className="text-xs text-gray-500 mb-2">
                      {(imageFile.fileSize / 1024).toFixed(1)} KB
                    </p>
                  )}
                  
                  {imageFile.confidence && (
                    <p className="text-xs text-green-600 mb-2">
                      Confiance OCR: {imageFile.confidence.toFixed(1)}%
                    </p>
                  )}
                  
                  {imageFile.extractedText && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-600 mb-1">Texte extrait:</p>
                      <p className="text-xs text-gray-700 bg-white p-2 rounded border max-h-20 overflow-y-auto">
                        {imageFile.extractedText.length > 100 
                          ? `${imageFile.extractedText.substring(0, 100)}...` 
                          : imageFile.extractedText
                        }
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => handleViewImage(imageFile)}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Voir l'image"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDownloadImage(imageFile)}
                    className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Télécharger l'image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {imageViewerModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {imageViewerModal.fileName}
              </h3>
              <button
                onClick={handleCloseImageModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-auto">
              <div className="flex justify-center">
                <img
                  src={imageViewerModal.fileUrl}
                  alt={imageViewerModal.fileName}
                  className="max-w-full max-h-full object-contain rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex items-center justify-center h-64 text-gray-500">
                          <div class="text-center">
                            <FileImage class="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p>Impossible de charger l'image</p>
                          </div>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => handleDownloadImage({
                  fileName: imageViewerModal.fileName,
                  downloadUrl: imageViewerModal.fileUrl
                } as ImageFileReference)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </button>
              <button
                onClick={handleCloseImageModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
