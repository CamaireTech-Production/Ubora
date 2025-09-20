import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

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
    console.error('Error generating download URL:', error);
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
    console.error('Error checking download URL:', error);
    return false;
  }
};

/**
 * Get a download URL for a file attachment, generating one if needed
 * @param fileAttachment - The file attachment object
 * @returns Promise<string> - The download URL
 */
export const getFileDownloadURL = async (fileAttachment: any): Promise<string> => {
  console.log('🔍 getFileDownloadURL called with:', fileAttachment);
  
  // If we already have a download URL, use it
  if (fileAttachment.downloadUrl) {
    console.log('🔍 Using existing downloadUrl:', fileAttachment.downloadUrl);
    return fileAttachment.downloadUrl;
  }
  
  // If we have a storage path, generate a download URL
  if (fileAttachment.storagePath) {
    console.log('🔍 Generating download URL from storagePath:', fileAttachment.storagePath);
    return await generateDownloadURL(fileAttachment.storagePath);
  }
  
  console.error('🔍 No download URL or storage path available:', fileAttachment);
  throw new Error('No download URL or storage path available for file attachment');
};
