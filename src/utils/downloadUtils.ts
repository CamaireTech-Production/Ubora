/**
 * Utility functions for downloading files from Firebase Storage
 */

export interface DownloadOptions {
  fileName: string;
  url: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Download a file using multiple fallback methods
 */
export const downloadFile = async (options: DownloadOptions): Promise<void> => {
  const { fileName, url, onSuccess, onError } = options;

  try {
    console.log('🔍 Attempting to download file:', { fileName, url });

    // Method 1: Try direct download with download attribute
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      // Add to DOM
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
      console.log('✅ Direct download initiated');
      onSuccess?.();
      return;
    } catch (directError) {
      console.warn('Direct download failed, trying fetch method:', directError);
    }

    // Method 2: Try fetch with blob (for same-origin or CORS-enabled URLs)
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);

      console.log('✅ Fetch download completed');
      onSuccess?.();
      return;
    } catch (fetchError) {
      console.warn('Fetch download failed, trying new tab method:', fetchError);
    }

    // Method 3: Open in new tab as fallback
    try {
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (newWindow) {
        console.log('✅ Opened in new tab');
        onSuccess?.();
        return;
      } else {
        throw new Error('Popup blocked');
      }
    } catch (tabError) {
      console.error('New tab method failed:', tabError);
    }

    // All methods failed
    throw new Error('All download methods failed');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
    console.error('❌ Download failed:', errorMessage);
    onError?.(errorMessage);
    throw error;
  }
};

/**
 * Check if a URL is accessible
 */
export const checkUrlAccessibility = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    console.warn('URL accessibility check failed:', error);
    return false;
  }
};

/**
 * Generate a proper download URL for Firebase Storage
 */
export const generateFirebaseDownloadUrl = (storagePath: string): string => {
  // Firebase Storage URLs should already be properly formatted
  // This function can be used to validate or modify URLs if needed
  return storagePath;
};
