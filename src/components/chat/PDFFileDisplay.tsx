import React, { useState } from 'react';
import { Download, Eye, FileText, File, FileImage, FileSpreadsheet, FileType } from 'lucide-react';
import { PDFFileReference } from '../../types';
import { useToast } from '../../hooks/useToast';
import { getFileDownloadURL } from '../../utils/firebaseStorageUtils';
import { PDFViewerModal } from '../PDFViewerModal';
import { downloadFile } from '../../utils/downloadUtils';
import { forceDownloadFromFirebase } from '../../utils/firebaseDownloadUtils';

interface PDFFileDisplayProps {
  pdfFiles: PDFFileReference[];
}

export const PDFFileDisplay: React.FC<PDFFileDisplayProps> = ({ pdfFiles }) => {
  const { showSuccess, showError } = useToast();

  // Get appropriate file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4 text-red-600" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileType className="h-4 w-4 text-blue-600" />;
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <FileText className="h-4 w-4 text-orange-600" />;
    if (fileType.includes('image')) return <FileImage className="h-4 w-4 text-purple-600" />;
    if (fileType.includes('zip') || fileType.includes('rar')) return <File className="h-4 w-4 text-gray-600" />;
    if (fileType.includes('text')) return <FileText className="h-4 w-4 text-gray-600" />;
    return <File className="h-4 w-4 text-gray-600" />;
  };

  // Check if file can be viewed (PDFs only for now)
  const canViewFile = (fileType: string) => {
    return fileType.includes('pdf');
  };

  // Clean file name for display (remove technical prefixes)
  const getCleanFileName = (fileName: string) => {
    return fileName.replace(/^[0-9-]+-/, '').replace(/\.pdf$/i, '');
  };
  const [pdfViewerModal, setPdfViewerModal] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
  }>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });

  const handleViewPDF = async (pdfFile: PDFFileReference) => {
    try {
      console.log('🔍 Attempting to view file:', pdfFile);
      const downloadUrl = await getFileDownloadURL(pdfFile);
      console.log('🔍 Generated download URL:', downloadUrl);
      
      // Open in PDF viewer modal
      setPdfViewerModal({
        isOpen: true,
        fileUrl: downloadUrl,
        fileName: pdfFile.fileName
      });
    } catch (error) {
      console.error('Error viewing file:', error);
      showError('Erreur lors de l\'ouverture du fichier');
    }
  };

  const handleDownloadPDF = async (pdfFile: PDFFileReference) => {
    try {
      console.log('🔍 Attempting to download file:', pdfFile);
      
      // Try Firebase-specific download first
      if (pdfFile.storagePath) {
        console.log('🔄 Using Firebase-specific download method...');
        await forceDownloadFromFirebase(
          pdfFile.storagePath,
          pdfFile.fileName,
          () => {
            showSuccess('Téléchargement démarré');
          },
          (error) => {
            console.warn('Firebase download failed, trying fallback:', error);
            // Fallback to regular download
            handleDownloadFallback(pdfFile);
          }
        );
        return;
      }
      
      // Fallback to regular download
      await handleDownloadFallback(pdfFile);
    } catch (error) {
      console.error('Error downloading file:', error);
      showError('Erreur lors du téléchargement du fichier');
    }
  };

  const handleDownloadFallback = async (pdfFile: PDFFileReference) => {
    try {
      const downloadUrl = await getFileDownloadURL(pdfFile);
      console.log('🔍 Generated download URL:', downloadUrl);
      
      await downloadFile({
        fileName: pdfFile.fileName,
        url: downloadUrl,
        onSuccess: () => {
          showSuccess('Téléchargement démarré');
        },
        onError: (error) => {
          showError(`Erreur lors du téléchargement: ${error}`);
        }
      });
    } catch (error) {
      console.error('Fallback download failed:', error);
      showError('Erreur lors du téléchargement du fichier');
    }
  };

  const handleClosePdfModal = () => {
    setPdfViewerModal({
      isOpen: false,
      fileUrl: '',
      fileName: ''
    });
  };

  if (!pdfFiles || pdfFiles.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <FileText className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-semibold text-gray-800">
            Fichiers joints ({pdfFiles.length})
          </span>
        </div>
        <div className="space-y-3">
          {pdfFiles.map((pdfFile, index) => (
            <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3">
                {getFileIcon(pdfFile.fileType)}
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{getCleanFileName(pdfFile.fileName)}</span>
                  {pdfFile.fileSize && (
                    <span className="text-xs text-gray-500">
                      {(pdfFile.fileSize / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {canViewFile(pdfFile.fileType) && (
                  <button
                    onClick={() => handleViewPDF(pdfFile)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-600 transition-colors"
                    title="Voir le fichier"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Voir</span>
                  </button>
                )}
                <button
                  onClick={() => handleDownloadPDF(pdfFile)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors"
                  title="Télécharger le fichier"
                >
                  <Download className="h-3 w-3" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={pdfViewerModal.isOpen}
        onClose={handleClosePdfModal}
        fileUrl={pdfViewerModal.fileUrl}
        fileName={pdfViewerModal.fileName}
        onDownload={() => {
          // Download from modal
          downloadFile({
            fileName: pdfViewerModal.fileName,
            url: pdfViewerModal.fileUrl,
            onSuccess: () => {
              showSuccess('Téléchargement démarré');
            },
            onError: (error) => {
              showError(`Erreur lors du téléchargement: ${error}`);
            }
          });
        }}
      />
    </>
  );
};
