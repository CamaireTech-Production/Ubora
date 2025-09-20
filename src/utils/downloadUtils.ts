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

    // Method 1: Force download using fetch + blob (most reliable for Firebase Storage)
    try {
      console.log('🔄 Trying fetch + blob method...');
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'application/octet-stream, */*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('📦 Blob created:', { size: blob.size, type: blob.type });
      
      // Create object URL from blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      
      // Force download by setting target
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      
      // Add to DOM and trigger
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      console.log('✅ Fetch + blob download completed');
      onSuccess?.();
      return;
    } catch (fetchError) {
      console.warn('Fetch + blob method failed:', fetchError);
    }

    // Method 2: Try direct download with forced download attribute
    try {
      console.log('🔄 Trying direct download method...');
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      // Force download behavior
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      
      // Add to DOM
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
      }, 1000);
      
      console.log('✅ Direct download initiated');
      onSuccess?.();
      return;
    } catch (directError) {
      console.warn('Direct download failed:', directError);
    }

    // Method 3: Create a form with POST method (for problematic URLs)
    try {
      console.log('🔄 Trying form POST method...');
      
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = url;
      form.target = '_blank';
      form.style.display = 'none';
      
      // Add download parameter to force download
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'download';
      input.value = fileName;
      form.appendChild(input);
      
      document.body.appendChild(form);
      form.submit();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(form);
      }, 1000);
      
      console.log('✅ Form POST download initiated');
      onSuccess?.();
      return;
    } catch (formError) {
      console.warn('Form POST method failed:', formError);
    }

    // Method 4: Open in new tab as final fallback
    try {
      console.log('🔄 Trying new tab fallback...');
      
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

