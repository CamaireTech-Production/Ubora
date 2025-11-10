import { FileAttachment } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * Frontend-only service for converting firestore:// URLs to blob URLs
 * This eliminates the need for API calls by using base64 data stored in attachments
 */
export class FirestoreUrlConverter {
  /**
   * Convert a firestore:// URL to a blob URL using base64 data
   * This works entirely in the frontend without API calls
   */
  static async convertToBlobUrl(attachment: FileAttachment): Promise<string> {
    console.log('🔄 FirestoreUrlConverter.convertToBlobUrl called with:', {
      fileName: attachment.fileName,
      downloadUrl: attachment.downloadUrl,
      hasBase64Data: !!attachment.base64Data,
      fileType: attachment.fileType,
      fieldId: attachment.fieldId,
      fileSize: attachment.fileSize,
      storagePath: attachment.storagePath,
      fullAttachment: attachment
    });

    // If it's already a regular HTTP URL, return as-is
    if (!attachment.downloadUrl?.startsWith('firestore://')) {
      console.log('✅ Using direct HTTP URL:', attachment.downloadUrl);
      return attachment.downloadUrl;
    }

    // If we have base64 data, create blob URL directly
    if (attachment.base64Data) {
      console.log('✅ Using base64 data from attachment');
      return this.createBlobFromBase64(attachment.base64Data, attachment.fileType);
    }

    // If no base64 data in attachment, try to fetch it from fileData collection
    console.log('🔄 No base64 data in attachment, trying to fetch from fileData collection...');
    try {
      const base64Data = await this.fetchBase64FromFileData(attachment.downloadUrl);
      console.log('✅ Successfully fetched base64 data from fileData collection');
      return this.createBlobFromBase64(base64Data, attachment.fileType);
    } catch (firestoreError) {
      console.error('❌ Failed to fetch from fileData collection:', firestoreError);
      throw new Error('No base64 data available for firestore:// URL');
    }
  }

  /**
   * Fetch base64 data from fileData collection using firestore:// URL
   */
  private static async fetchBase64FromFileData(firestoreUrl: string): Promise<string> {
    try {
      console.log('🔄 fetchBase64FromFileData called with URL:', firestoreUrl);
      
      // Parse the firestore:// URL: firestore://agencyId/formId/userId/fileId
      const path = firestoreUrl.replace('firestore://', '');
      const pathParts = path.split('/');
      
      console.log('🔄 Parsed URL parts:', pathParts);
      
      if (pathParts.length < 4) {
        throw new Error('Invalid firestore:// URL format');
      }

      const [agencyId, formId, userId, fileId] = pathParts;
      
      console.log('🔄 Querying fileData collection with:', {
        agencyId,
        formId,
        userId,
        fileId,
        downloadUrl: firestoreUrl
      });

      // Query the fileData collection
      const fileDataQuery = query(
        collection(db, 'fileData'),
        where('agencyId', '==', agencyId),
        where('formId', '==', formId),
        where('userId', '==', userId),
        where('downloadUrl', '==', firestoreUrl),
        limit(1)
      );

      console.log('🔄 Executing Firestore query...');
      const querySnapshot = await getDocs(fileDataQuery);
      
      console.log('🔄 Query result:', {
        empty: querySnapshot.empty,
        size: querySnapshot.size,
        docs: querySnapshot.docs.length
      });
      
      if (querySnapshot.empty) {
        throw new Error('File data not found in fileData collection');
      }

      const fileDoc = querySnapshot.docs[0];
      const fileData = fileDoc.data();
      
      console.log('🔄 File document data:', {
        id: fileDoc.id,
        hasBase64Data: !!fileData.base64Data,
        fileName: fileData.fileName,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize
      });
      
      if (!fileData.base64Data) {
        throw new Error('No base64 data found in fileData document');
      }

      console.log('✅ Successfully retrieved base64 data from fileData collection');
      return fileData.base64Data;
    } catch (error) {
      console.error('❌ Error fetching base64 data from fileData collection:', error);
      throw error;
    }
  }


  /**
   * Create a blob URL from base64 data
   */
  private static createBlobFromBase64(base64Data: string, mimeType: string): string {
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
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating blob from base64:', error);
      throw new Error('Failed to convert base64 to blob');
    }
  }

  /**
   * Clean up blob URLs to prevent memory leaks
   */
  static revokeBlobUrl(blobUrl: string): void {
    if (blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl);
    }
  }

  /**
   * Check if a URL is a firestore:// URL
   */
  static isFirestoreUrl(url: string): boolean {
    return url?.startsWith('firestore://') || false;
  }

  /**
   * Convert multiple attachments to blob URLs
   * Useful for batch processing
   */
  static async convertMultipleToBlobUrls(attachments: FileAttachment[]): Promise<{ [key: string]: string }> {
    const blobUrls: { [key: string]: string } = {};
    
    await Promise.all(attachments.map(async (attachment) => {
      try {
        blobUrls[attachment.fieldId] = await this.convertToBlobUrl(attachment);
      } catch (error) {
        console.error(`Failed to convert attachment ${attachment.fieldId}:`, error);
      }
    }));
    
    return blobUrls;
  }

  /**
   * Clean up multiple blob URLs
   */
  static revokeMultipleBlobUrls(blobUrls: { [key: string]: string }): void {
    Object.values(blobUrls).forEach(url => {
      this.revokeBlobUrl(url);
    });
  }
}
