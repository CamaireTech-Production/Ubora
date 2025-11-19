import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@ubora/shared/firebaseConfig';
import { FirestoreUrlConverter } from '../services/firestoreUrlConverter';
import { logger } from '@ubora/shared/utils/logger';

/**
 * Generate a download URL from a Firebase Storage path
 * @param storagePath - The storage path (e.g., "form-uploads/agencyId/formId/userId/filename.pdf")
 * @returns Promise<string> - The download URL
 */
export const generateDownloadURL = async (storagePath: string): Promise<string> => {
  try {
    const storageRef = ref(storage, storagePath);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    logger.error('Error generating download URL', error, 'firebaseStorageUtils');
    throw new Error(`Failed to generate download URL for path: ${storagePath}`);
  }
};

/**
 * Check if a download URL is valid and accessible
 * @param url - The download URL to check
 * @returns Promise<boolean> - True if the URL is accessible
 */
export const isValidDownloadURL = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    logger.error('Error checking download URL', error, 'firebaseStorageUtils');
    return false;
  }
};

/**
 * Get a download URL for a file attachment, generating one if needed
 * @param fileAttachment - The file attachment object
 * @returns Promise<string> - The download URL
 */
export const getFileDownloadURL = async (fileAttachment: any): Promise<string> => {
  logger.debug('getFileDownloadURL called', {
    fileName: fileAttachment.fileName,
    downloadUrl: fileAttachment.downloadUrl,
    storagePath: fileAttachment.storagePath,
    hasBase64Data: !!fileAttachment.base64Data
  }, 'firebaseStorageUtils');

  // Handle firestore:// URLs with frontend-only conversion
  if (fileAttachment.downloadUrl?.startsWith('firestore://')) {
    logger.debug('Detected firestore:// URL, using FirestoreUrlConverter', null, 'firebaseStorageUtils');
    return await FirestoreUrlConverter.convertToBlobUrl(fileAttachment);
  }
  
  // Handle regular HTTP URLs
  if (fileAttachment.downloadUrl) {
    logger.debug('Using direct HTTP URL', null, 'firebaseStorageUtils');
    return fileAttachment.downloadUrl;
  }
  
  // Handle Firebase Storage paths
  if (fileAttachment.storagePath) {
    logger.debug('Using Firebase Storage path', null, 'firebaseStorageUtils');
    return await generateDownloadURL(fileAttachment.storagePath);
  }
  
  logger.error('No download URL or storage path available', { fileAttachment }, 'firebaseStorageUtils');
  throw new Error('No download URL or storage path available for file attachment');
};
