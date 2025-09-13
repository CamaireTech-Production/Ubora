/**
 * Firebase Storage specific download utilities
 */

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
    console.log('🔍 Force downloading from Firebase Storage:', { storagePath, fileName });

    // Method 1: Try to modify the URL to force download
    try {
      // Remove any existing query parameters and add download parameter
      const baseUrl = storagePath.split('?')[0];
      const downloadUrl = `${baseUrl}?alt=media&download=${encodeURIComponent(fileName)}`;
      
      console.log('🔄 Trying modified URL:', downloadUrl);
      
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
      console.log('📦 Blob created:', { size: blob.size, type: blob.type });
      
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

      console.log('✅ Firebase force download completed');
      onSuccess?.();
      return;
    } catch (fetchError) {
      console.warn('Firebase force download failed:', fetchError);
    }

    // Method 2: Try with original URL but force download headers
    try {
      console.log('🔄 Trying with original URL and download headers...');
      
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
      console.log('📦 Blob created from original URL:', { size: blob.size, type: blob.type });
      
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

      console.log('✅ Original URL download completed');
      onSuccess?.();
      return;
    } catch (originalError) {
      console.warn('Original URL download failed:', originalError);
    }

    // Method 3: Create a form with POST method to force download
    try {
      console.log('🔄 Trying form POST method...');
      
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
      
      console.log('✅ Form POST download initiated');
      onSuccess?.();
      return;
    } catch (formError) {
      console.warn('Form POST method failed:', formError);
    }

    // Method 4: Try to create a blob URL with proper MIME type
    try {
      console.log('🔄 Trying blob URL with proper MIME type...');
      
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

      console.log('✅ Blob URL download completed');
      onSuccess?.();
      return;
    } catch (blobError) {
      console.warn('Blob URL method failed:', blobError);
    }

    // All methods failed
    throw new Error('All Firebase download methods failed');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
    console.error('❌ Firebase download failed:', errorMessage);
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
    console.warn('Firebase URL accessibility check failed:', error);
    return false;
  }
};
