/**
 * Convert firestore:// URLs to actual HTTP download URLs
 */
export const convertToDownloadUrl = (firestoreUrl: string): string => {
  if (!firestoreUrl || !firestoreUrl.startsWith('firestore://')) {
    return firestoreUrl; // Return as-is if not a firestore URL
  }

  // Get the API endpoint
  const apiEndpoint = import.meta.env.VITE_AI_ENDPOINT 
    ? import.meta.env.VITE_AI_ENDPOINT.replace('/api/ai/ask', '')
    : import.meta.env.DEV 
      ? 'http://localhost:3000'
      : 'https://apidev.ubora-app.com';

  // Convert firestore://agencyId/formId/userId/fileId to HTTP URL
  const httpUrl = `${apiEndpoint}/api/files/download?downloadUrl=${encodeURIComponent(firestoreUrl)}`;
  
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
    console.log('❌ No downloadUrl in attachment:', attachment);
    return '';
  }

  console.log('🔍 Processing downloadUrl:', attachment.downloadUrl);

  if (isFirestoreUrl(attachment.downloadUrl)) {
    const convertedUrl = convertToDownloadUrl(attachment.downloadUrl);
    console.log('✅ Converted firestore URL to HTTP:', convertedUrl);
    return convertedUrl;
  }

  console.log('✅ Using original URL (not firestore):', attachment.downloadUrl);
  return attachment.downloadUrl;
};
