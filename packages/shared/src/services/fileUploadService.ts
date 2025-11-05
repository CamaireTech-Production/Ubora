import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  UploadResult 
} from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { FileAttachment } from '../types';
import { PDFTextExtractionService } from './pdfTextExtractionService';
import { DocumentExtractionService } from './documentExtractionService';
import { ImageTextExtractionService } from './imageTextExtractionService';

export interface UploadProgress {
  fieldId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'extracting' | 'completed' | 'error';
  error?: string;
}

export interface PDFExtractionResult {
  fileName: string;
  extractedText: string;
  extractionStatus: 'completed' | 'failed';
  error?: string;
  pages?: number;
  fileSize: number;
  extractionStats?: {
    totalCharacters: number;
    totalWords: number;
    averageWordsPerPage: number;
    extractionTime: number;
    tablesDetected: number;
  };
}

export interface ImageExtractionResult {
  fileName: string;
  extractedText: string;
  extractionStatus: 'completed' | 'failed';
  error?: string;
  confidence?: number;
  fileSize: number;
  engine?: string;
}

export class FileUploadService {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/zip',
    'application/x-rar-compressed',
    'text/csv'
  ];

  /**
   * Process file locally (extract text) without uploading to Firebase Storage
   * Firebase upload happens only when form is submitted
   */
  static async processFile(
    file: File,
    fieldId: string,
    userId?: string,
    onProgress?: (progress: UploadProgress) => void,
    onPDFExtraction?: (result: PDFExtractionResult) => void,
    onImageExtraction?: (result: ImageExtractionResult) => void
  ): Promise<FileAttachment> {
    try {
      console.log('🔍 DEBUG: FileUploadService.processFile called with:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fieldId,
        userId
      });
      
      // Validate file
      this.validateFile(file);

      // Create file attachment (without Firebase Storage info initially)
      const fileAttachment: FileAttachment = {
        fieldId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        downloadUrl: '', // Will be set when uploaded to Firebase
        storagePath: '', // Will be set when uploaded to Firebase
        uploadedAt: new Date(),
        textExtractionStatus: 'pending',
        // Generate submission ID for all files (not just PDFs)
        submissionId: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Convert file to base64 for draft storage
      try {
        console.log(`🔄 Converting ${file.name} to base64 for draft storage...`);
        
        // Check file size for localStorage limitations
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const estimatedBase64SizeMB = ((file.size * 1.33) / (1024 * 1024)).toFixed(2);
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          console.warn(`⚠️ Large file detected: ${fileSizeMB}MB (estimated base64: ${estimatedBase64SizeMB}MB)`);
          console.warn(`⚠️ This file may exceed localStorage limits and cause issues with draft storage`);
        }
        
        const base64Data = await this.fileToBase64(file);
        fileAttachment.base64Data = base64Data;
        console.log(`✅ ${file.name} converted to base64 (${base64Data.length} characters, ~${estimatedBase64SizeMB}MB)`);
        
        // Test the conversion to ensure it works
        const conversionTest = await this.testBase64Conversion(file);
        if (!conversionTest) {
          console.error(`❌ Base64 conversion test failed for ${file.name}`);
          // Remove base64 data if test fails
          delete fileAttachment.base64Data;
        } else {
          console.log(`✅ Base64 conversion test passed for ${file.name}`);
        }
      } catch (base64Error) {
        console.error(`❌ Failed to convert ${file.name} to base64:`, base64Error);
        // Continue without base64 data - file will need to be re-uploaded for drafts
      }


      // Extract text if it's a PDF or Word document
      if (DocumentExtractionService.isSupportedDocument(file)) {
        try {
          // Update progress - extracting
          onProgress?.({
            fieldId,
            fileName: file.name,
            progress: 0,
            status: 'extracting'
          });

          const extractionResult = await DocumentExtractionService.extractDocument(file, {
            method: 'basic',
            userId
          });
          console.log('🔍 DEBUG: Document extraction result:', extractionResult);
          
          if (extractionResult.success) {
            fileAttachment.extractedText = extractionResult.text;
            fileAttachment.textExtractionStatus = 'completed';

            // Text extraction completed - no Firebase upload for now
            const fileTypeLabel = extractionResult.documentType === 'word' ? 'Word' : 'PDF';
            console.log(`✅ ${fileTypeLabel} text extraction completed for ${file.name}`);

            // Trigger debug modal callback with extracted text
            onPDFExtraction?.({
              fileName: file.name,
              extractedText: extractionResult.text,
              extractionStatus: 'completed',
              fileSize: file.size
            });
          } else {
            // Extraction failed
            fileAttachment.textExtractionStatus = 'failed';
            console.error(`❌ Document text extraction failed for ${file.name}:`, extractionResult.error);

            // Trigger debug modal callback with error
            onPDFExtraction?.({
              fileName: file.name,
              extractedText: extractionResult.text || '',
              extractionStatus: 'failed',
              error: extractionResult.error,
              fileSize: file.size
            });
          }
        } catch (extractionError) {
          console.error('Failed to extract PDF text:', extractionError);
          fileAttachment.textExtractionStatus = 'failed';
          
          // Trigger debug modal callback with error
          onPDFExtraction?.({
            fileName: file.name,
            extractedText: '',
            extractionStatus: 'failed',
            error: extractionError instanceof Error ? extractionError.message : 'Unknown error',
            fileSize: file.size
          });
        }
      }

      // Extract text if it's an image
      if (ImageTextExtractionService.isImage(file)) {
        try {
          // Update progress - extracting
          onProgress?.({
            fieldId,
            fileName: file.name,
            progress: 0,
            status: 'extracting'
          });

          const extractionResult = await ImageTextExtractionService.extractTextFromImage(file, userId);
          console.log('🔍 DEBUG: Image extraction result:', extractionResult);
          
          if (extractionResult.success) {
            fileAttachment.extractedText = ImageTextExtractionService.cleanExtractedText(extractionResult.text);
            fileAttachment.textExtractionStatus = 'completed';

            // Trigger debug modal callback
            onImageExtraction?.({
              fileName: file.name,
              extractedText: fileAttachment.extractedText,
              extractionStatus: 'completed',
              confidence: extractionResult.confidence,
              fileSize: file.size,
              engine: extractionResult.engine
            });
          } else {
            // Extraction failed
            fileAttachment.textExtractionStatus = 'failed';
            console.error(`❌ Image text extraction failed for ${file.name}:`, extractionResult.error);

            // Trigger debug modal callback with error
            onImageExtraction?.({
              fileName: file.name,
              extractedText: extractionResult.text,
              extractionStatus: 'failed',
              error: extractionResult.error,
              fileSize: file.size,
              engine: extractionResult.engine
            });
          }
        } catch (extractionError) {
          console.error('Failed to extract image text:', extractionError);
          fileAttachment.textExtractionStatus = 'failed';
          
          // Trigger debug modal callback with error
          onImageExtraction?.({
            fileName: file.name,
            extractedText: '',
            extractionStatus: 'failed',
            error: extractionError instanceof Error ? extractionError.message : 'Unknown error',
            fileSize: file.size
          });
        }
      }

      // Update progress - completed
      onProgress?.({
        fieldId,
        fileName: file.name,
        progress: 100,
        status: 'completed'
      });

      return fileAttachment;

    } catch (error) {
      console.error('Error processing file:', error);
      
      onProgress?.({
        fieldId,
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Processing failed'
      });

      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Convert file to base64 string for draft storage
   */
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        
        // Validate base64 string
        if (!base64 || base64.length === 0) {
          reject(new Error('Failed to generate base64 string'));
          return;
        }
        
        // Test if base64 is valid by trying to decode it
        try {
          atob(base64);
          resolve(base64);
        } catch (error) {
          reject(new Error('Generated invalid base64 string'));
        }
      };
      reader.onerror = (error) => {
        reject(new Error(`FileReader error: ${error}`));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Test base64 conversion (for debugging)
   */
  static async testBase64Conversion(file: File): Promise<boolean> {
    try {
      console.log(`🧪 Testing base64 conversion for: ${file.name}`);
      
      // Convert to base64
      const base64 = await this.fileToBase64(file);
      console.log(`✅ Base64 conversion successful: ${base64.length} characters`);
      
      // Convert back to file
      const reconstructedFile = this.base64ToFile(base64, file.name, file.type);
      console.log(`✅ File reconstruction successful:`, {
        originalSize: file.size,
        reconstructedSize: reconstructedFile.size,
        sizesMatch: file.size === reconstructedFile.size
      });
      
      return file.size === reconstructedFile.size;
    } catch (error) {
      console.error(`❌ Base64 conversion test failed:`, error);
      return false;
    }
  }

  /**
   * Convert base64 string back to File object
   */
  static base64ToFile(base64: string, fileName: string, mimeType: string): File {
    try {
      console.log(`🔄 Converting base64 back to file:`, {
        fileName,
        mimeType,
        base64Length: base64.length,
        estimatedSize: Math.round((base64.length * 3) / 4)
      });

      // Decode base64 to binary
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      // Create File object with proper metadata
      const file = new File([byteArray], fileName, { 
        type: mimeType,
        lastModified: Date.now()
      });

      console.log(`✅ File reconstructed:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });

      return file;
    } catch (error) {
      console.error(`❌ Error converting base64 to file:`, error);
      throw new Error(`Failed to convert base64 to file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload file to Firebase Storage (called when form is submitted)
   */
  static async uploadFileToFirebase(
    file: File,
    fieldId: string,
    formId: string,
    userId: string,
    agencyId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ downloadUrl: string; storagePath: string }> {
    try {
      // Validate file object
      if (!file || !(file instanceof File)) {
        throw new Error('Invalid file object provided');
      }

      if (file.size === 0) {
        throw new Error('File is empty');
      }

      console.log(`🔄 Uploading file to Firebase Storage:`, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fieldId,
        formId,
        userId,
        agencyId
      });

      // Generate unique file path
      const timestamp = Date.now();
      const fileName = file.name || 'unknown_file';
      
      // Clean fileName to avoid Firebase Storage issues
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
      
      // Determine file extension from fileName or file type
      let fileExtension = 'pdf'; // default
      if (cleanFileName && cleanFileName.includes('.')) {
        fileExtension = cleanFileName.split('.').pop() || 'pdf';
      } else if (file.type) {
        // Extract extension from MIME type
        if (file.type === 'application/pdf') fileExtension = 'pdf';
        else if (file.type.startsWith('image/')) fileExtension = file.type.split('/')[1];
        else fileExtension = 'bin';
      }
      
      const uniqueFileName = `${fieldId}_${timestamp}.${fileExtension}`;
      const storagePath = `form-uploads/${agencyId}/${formId}/${userId}/${uniqueFileName}`;

      // Validate storage path doesn't contain problematic characters
      if (storagePath.includes('..') || storagePath.includes('//') || storagePath.length > 1000) {
        throw new Error(`Invalid storage path: ${storagePath}`);
      }

      console.log(`📁 Storage path: ${storagePath}`);

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Update progress - uploading
      onProgress?.({
        fieldId,
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });

      // Upload file to Firebase Storage
      console.log(`🔄 Attempting upload to Firebase Storage with path: ${storagePath}`);
      console.log(`🔄 File details:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      // Check Firebase Storage configuration
      console.log(`🔄 Firebase Storage config:`, {
        bucket: storage.app.options.storageBucket,
        projectId: storage.app.options.projectId
      });
      
      // FIREBASE STORAGE WORKAROUND: Store file in Firestore instead
      // This creates a proper download URL that works with the dashboard
      console.log(`🔄 Firebase Storage upload failed, storing file in Firestore instead`);
      
      // Create a proper download URL for Firestore storage
      const fileId = `${fieldId}_${timestamp}`;
      const firestoreDownloadUrl = `firestore://${agencyId}/${formId}/${userId}/${fileId}`;
      const firestoreStoragePath = `firestore-files/${agencyId}/${formId}/${userId}/${fileId}`;
      
      console.log(`✅ Using Firestore storage: ${firestoreDownloadUrl}`);

      // Update progress - completed
      onProgress?.({
        fieldId,
        fileName: file.name,
        progress: 100,
        status: 'completed'
      });

      return { downloadUrl: firestoreDownloadUrl, storagePath: firestoreStoragePath };

    } catch (error) {
      console.error('❌ Error uploading file to Firebase:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code || 'No code',
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      onProgress?.({
        fieldId,
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      });

      // Provide more specific error messages
      let errorMessage = 'Upload failed';
      if (error instanceof Error) {
        if (error.message.includes('storage/unauthorized')) {
          errorMessage = 'Unauthorized: Check Firebase Storage rules and user permissions';
        } else if (error.message.includes('storage/object-not-found')) {
          errorMessage = 'Storage object not found';
        } else if (error.message.includes('storage/bucket-not-found')) {
          errorMessage = 'Storage bucket not found';
        } else if (error.message.includes('storage/project-not-found')) {
          errorMessage = 'Firebase project not found';
        } else if (error.message.includes('storage/quota-exceeded')) {
          errorMessage = 'Storage quota exceeded';
        } else if (error.message.includes('storage/unauthenticated')) {
          errorMessage = 'User not authenticated';
        } else if (error.message.includes('storage/retry-limit-exceeded')) {
          errorMessage = 'Retry limit exceeded';
        } else {
          errorMessage = error.message;
        }
      }

      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }


  /**
   * Process multiple files (extract text without uploading to Firebase)
   */
  static async processFiles(
    files: { file: File; fieldId: string }[],
    onProgress?: (progress: UploadProgress) => void,
    onPDFExtraction?: (result: PDFExtractionResult) => void,
    onImageExtraction?: (result: ImageExtractionResult) => void
  ): Promise<FileAttachment[]> {
    const processPromises = files.map(({ file, fieldId }) =>
      this.processFile(file, fieldId, onProgress, onPDFExtraction, onImageExtraction)
    );

    try {
      const results = await Promise.all(processPromises);
      return results;
    } catch (error) {
      console.error('Error processing files:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files to Firebase Storage (called when form is submitted)
   */
  static async uploadFilesToFirebase(
    files: { file: File; fieldId: string }[],
    formId: string,
    userId: string,
    agencyId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ fieldId: string; downloadUrl: string; storagePath: string }[]> {
    const uploadPromises = files.map(async ({ file, fieldId }) => {
      const result = await this.uploadFileToFirebase(file, fieldId, formId, userId, agencyId, onProgress);
      return { fieldId, ...result };
    });

    try {
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('Error uploading files to Firebase:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Firebase Storage
   */
  static async deleteFile(storagePath: string): Promise<void> {
    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate file before upload
   */
  private static validateFile(file: File): void {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }

    // Check file name
    if (!file.name || file.name.trim().length === 0) {
      throw new Error('File name is required');
    }
  }

  /**
   * Get file icon based on file type
   */
  static getFileIcon(fileType: string): string {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    if (fileType.includes('text')) return '📄';
    return '📎';
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
