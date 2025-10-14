/**
 * Simple file download utility that works with firestore:// URLs
 */

/**
 * Get file data from Firestore and create a blob URL
 */
export const getFileBlobUrl = async (attachment: any): Promise<string> => {
  try {
    console.log('🔄 Getting file blob URL for:', attachment.fileName);
    
    if (!attachment.downloadUrl) {
      throw new Error('No download URL available');
    }

    // If it's already a regular HTTP URL, use it directly
    if (!attachment.downloadUrl.startsWith('firestore://')) {
      console.log('✅ Using direct HTTP URL:', attachment.downloadUrl);
      return attachment.downloadUrl;
    }

    // For firestore:// URLs, we need to get the file data from Firestore
    if (attachment.base64Data) {
      console.log('✅ Using base64 data from attachment');
      return createBlobFromBase64(attachment.base64Data, attachment.fileType);
    }

    // If no base64 data, try to fetch from the download endpoint
    console.log('🔄 Fetching file from download endpoint...');
    const apiEndpoint = import.meta.env.VITE_AI_ENDPOINT 
      ? import.meta.env.VITE_AI_ENDPOINT.replace('/api/ai/ask', '')
      : import.meta.env.DEV 
        ? 'http://localhost:3000'
        : 'http://apidev.ubora-app.com';

    const downloadUrl = `${apiEndpoint}/api/files/download?downloadUrl=${encodeURIComponent(attachment.downloadUrl)}`;
    
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    console.log('✅ Created blob URL from download endpoint');
    return blobUrl;

  } catch (error) {
    console.error('❌ Error getting file blob URL:', error);
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
    
    console.log('✅ Created blob URL from base64 data');
    return blobUrl;
    
  } catch (error) {
    console.error('❌ Error creating blob from base64:', error);
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
    
    console.log('✅ File download initiated');
    
  } catch (error) {
    console.error('❌ Error downloading file:', error);
    throw error;
  }
};
