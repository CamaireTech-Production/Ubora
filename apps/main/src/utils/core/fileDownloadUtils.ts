/**
 * Convert firestore:// URLs to actual HTTP download URLs
 */

import { getFilesDownloadEndpoint } from '@ubora/shared/config/api';
import { logger } from '@ubora/shared/utils/logger';
export const convertToDownloadUrl = (firestoreUrl: string): string => {
  if (!firestoreUrl || !firestoreUrl.startsWith('firestore://')) {
    return firestoreUrl; // Return as-is if not a firestore URL
  }

  // Convert firestore://agencyId/formId/userId/fileId to HTTP URL
  const httpUrl = `${getFilesDownloadEndpoint()}?downloadUrl=${encodeURIComponent(firestoreUrl)}`;
  
  return httpUrl;
};

/**
 * Check if a URL is a firestore URL that needs conversion
 */
export const isFirestoreUrl = (url: string): boolean => {
  return url && url.startsWith('firestore://');
};

/**
 * Get the appropriate download URL for a file attachment
 */
export const getFileDownloadUrl = (attachment: any): string => {
  if (!attachment.downloadUrl) {
    logger.warn('No downloadUrl in attachment', { attachment }, 'fileDownloadUtils');
    return '';
  }

  logger.debug('Processing downloadUrl', { downloadUrl: attachment.downloadUrl }, 'fileDownloadUtils');

  if (isFirestoreUrl(attachment.downloadUrl)) {
    const convertedUrl = convertToDownloadUrl(attachment.downloadUrl);
    logger.debug('Converted firestore URL to HTTP', { convertedUrl }, 'fileDownloadUtils');
    return convertedUrl;
  }

  logger.debug('Using original URL (not firestore)', { downloadUrl: attachment.downloadUrl }, 'fileDownloadUtils');
  return attachment.downloadUrl;
};
