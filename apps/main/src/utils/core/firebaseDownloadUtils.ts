/**
 * Firebase Storage specific download utilities
 */

import { logger } from '@ubora/shared/utils/logger';

/**
 * Force download a file from Firebase Storage by creating a proper download URL
 */
export const forceDownloadFromFirebase = async (
  storagePath: string, 
  fileName: string,
  onSuccess?: () => void,
  onError?: (error: string) => void
): Promise<void> => {
  try {

    // Method 1: Try to modify the URL to force download
    try {
      // Remove any existing query parameters and add download parameter
      const baseUrl = storagePath.split('?')[0];
      const downloadUrl = `${baseUrl}?alt=media&download=${encodeURIComponent(fileName)}`;
      
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'application/octet-stream, */*',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Create object URL from blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link with proper attributes
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      
      // Force download behavior
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

      onSuccess?.();
      return;
    } catch (fetchError) {
    }

    // Method 2: Try with original URL but force download headers
    try {
      
      const response = await fetch(storagePath, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'application/octet-stream, */*',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Create object URL from blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      
      // Force download behavior
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

      onSuccess?.();
      return;
    } catch (originalError) {
    }

    // Method 3: Create a form with POST method to force download
    try {
      
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = storagePath;
      form.target = '_blank';
      form.style.display = 'none';
      
      // Add download parameter
      const downloadInput = document.createElement('input');
      downloadInput.type = 'hidden';
      downloadInput.name = 'download';
      downloadInput.value = fileName;
      form.appendChild(downloadInput);
      
      // Add content disposition
      const dispositionInput = document.createElement('input');
      dispositionInput.type = 'hidden';
      dispositionInput.name = 'Content-Disposition';
      dispositionInput.value = `attachment; filename="${fileName}"`;
      form.appendChild(dispositionInput);
      
      document.body.appendChild(form);
      form.submit();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(form);
      }, 1000);
      
      onSuccess?.();
      return;
    } catch (formError) {
    }

    // Method 4: Try to create a blob URL with proper MIME type
    try {
      
      const response = await fetch(storagePath, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Create a new blob with proper MIME type for download
      const downloadBlob = new Blob([blob], { 
        type: 'application/octet-stream' 
      });
      
      const blobUrl = window.URL.createObjectURL(downloadBlob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      
      // Force download behavior
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

      onSuccess?.();
      return;
    } catch (blobError) {
    }

    // All methods failed
    throw new Error('All Firebase download methods failed');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
    logger.error('Firebase download failed', { errorMessage }, 'firebaseDownloadUtils');
    onError?.(errorMessage);
    throw error;
  }
};

/**
 * Check if a Firebase Storage URL is accessible
 */
export const checkFirebaseUrlAccessibility = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    return false;
  }
};
