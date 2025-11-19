/**
 * Simple file download utility that works with firestore:// URLs
 */

import { getFilesDownloadEndpoint } from '@ubora/shared/config/api';
import { logger } from '@ubora/shared/utils/logger';

/**
 * Get file data from Firestore and create a blob URL
 */
export const getFileBlobUrl = async (attachment: any): Promise<string> => {
  try {
    logger.debug('Getting file blob URL', { fileName: attachment.fileName }, 'simpleFileDownload');
    
    if (!attachment.downloadUrl) {
      throw new Error('No download URL available');
    }

    // If it's already a regular HTTP URL, use it directly
    if (!attachment.downloadUrl.startsWith('firestore://')) {
      logger.debug('Using direct HTTP URL', { downloadUrl: attachment.downloadUrl }, 'simpleFileDownload');
      return attachment.downloadUrl;
    }

    // For firestore:// URLs, we need to get the file data from Firestore
    if (attachment.base64Data) {
      logger.debug('Using base64 data from attachment', null, 'simpleFileDownload');
      return createBlobFromBase64(attachment.base64Data, attachment.fileType);
    }

    // If no base64 data, try to fetch from the download endpoint
    logger.debug('Fetching file from download endpoint', null, 'simpleFileDownload');
    const downloadUrl = `${getFilesDownloadEndpoint()}?downloadUrl=${encodeURIComponent(attachment.downloadUrl)}`;
    
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    logger.debug('Created blob URL from download endpoint', null, 'simpleFileDownload');
    return blobUrl;

  } catch (error) {
    logger.error('Error getting file blob URL', error, 'simpleFileDownload');
    throw error;
  }
};

/**
 * Create a blob URL from base64 data
 */
const createBlobFromBase64 = (base64Data: string, mimeType: string): string => {
  try {
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Convert base64 to binary
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create blob and URL
    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    
    logger.debug('Created blob URL from base64 data', null, 'simpleFileDownload');
    return blobUrl;
    
  } catch (error) {
    logger.error('Error creating blob from base64', error, 'simpleFileDownload');
    throw error;
  }
};

/**
 * Download file using blob URL
 */
export const downloadFileFromBlob = async (attachment: any): Promise<void> => {
  try {
    const blobUrl = await getFileBlobUrl(attachment);
    
    // Create download link
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = attachment.fileName;
    link.style.display = 'none';
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);
    
    logger.debug('File download initiated', { fileName: attachment.fileName }, 'simpleFileDownload');
    
  } catch (error) {
    logger.error('Error downloading file', error, 'simpleFileDownload');
    throw error;
  }
};
