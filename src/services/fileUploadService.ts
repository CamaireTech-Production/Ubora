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
}

export interface ImageExtractionResult {
  fileName: string;
  extractedText: string;
  extractionStatus: 'completed' | 'failed';
  error?: string;
  confidence?: number;
  fileSize: number;
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
   * Upload file to Firebase Storage with PDF text extraction
   */
  static async uploadFile(
    file: File,
    fieldId: string,
    formId: string,
    userId: string,
    agencyId: string,
    onProgress?: (progress: UploadProgress) => void,
    onPDFExtraction?: (result: PDFExtractionResult) => void,
    onImageExtraction?: (result: ImageExtractionResult) => void
  ): Promise<FileAttachment> {
    try {
      // Validate file
      this.validateFile(file);

      // Generate unique file path
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `${fieldId}_${timestamp}.${fileExtension}`;
      const storagePath = `form-uploads/${agencyId}/${formId}/${userId}/${fileName}`;

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
      const uploadResult: UploadResult = await uploadBytes(storageRef, file);

      // Get download URL
      const downloadUrl = await getDownloadURL(uploadResult.ref);


      // Create file attachment
      const fileAttachment: FileAttachment = {
        fieldId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        downloadUrl,
        storagePath,
        uploadedAt: new Date(),
        textExtractionStatus: 'pending'
      };


      // Extract text if it's a PDF
      if (PDFTextExtractionService.isPDF(file)) {
        try {
          // Update progress - extracting (no percentage for PDF extraction)
          onProgress?.({
            fieldId,
            fileName: file.name,
            progress: 0, // No percentage shown for extraction
            status: 'extracting'
          });

          const extractionResult = await PDFTextExtractionService.extractTextFromPDF(file);
          
          if (extractionResult.success) {
            fileAttachment.extractedText = PDFTextExtractionService.cleanExtractedText(extractionResult.text);
            fileAttachment.textExtractionStatus = 'completed';


            // Trigger debug modal callback
            onPDFExtraction?.({
              fileName: file.name,
              extractedText: fileAttachment.extractedText,
              extractionStatus: 'completed',
              pages: extractionResult.pages,
              fileSize: file.size
            });
          } else {
            // Extraction failed
            fileAttachment.textExtractionStatus = 'failed';
            console.error(`❌ PDF text extraction failed for ${file.name}:`, extractionResult.error);

            // Trigger debug modal callback with error
            onPDFExtraction?.({
              fileName: file.name,
              extractedText: extractionResult.text, // This will be the error message
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
          // Update progress - extracting (no percentage for image extraction)
          onProgress?.({
            fieldId,
            fileName: file.name,
            progress: 0, // No percentage shown for extraction
            status: 'extracting'
          });

          const extractionResult = await ImageTextExtractionService.extractTextFromImage(file);
          
          if (extractionResult.success) {
            fileAttachment.extractedText = ImageTextExtractionService.cleanExtractedText(extractionResult.text);
            fileAttachment.textExtractionStatus = 'completed';

            // Trigger debug modal callback
            onImageExtraction?.({
              fileName: file.name,
              extractedText: fileAttachment.extractedText,
              extractionStatus: 'completed',
              confidence: extractionResult.confidence,
              fileSize: file.size
            });
          } else {
            // Extraction failed
            fileAttachment.textExtractionStatus = 'failed';
            console.error(`❌ Image text extraction failed for ${file.name}:`, extractionResult.error);

            // Trigger debug modal callback with error
            onImageExtraction?.({
              fileName: file.name,
              extractedText: extractionResult.text, // This will be the error message
              extractionStatus: 'failed',
              error: extractionResult.error,
              fileSize: file.size
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
        progress: (PDFTextExtractionService.isPDF(file) || ImageTextExtractionService.isImage(file)) ? 0 : 100, // No percentage for PDF/image extraction
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
   * Upload multiple files
   */
  static async uploadFiles(
    files: { file: File; fieldId: string }[],
    formId: string,
    userId: string,
    agencyId: string,
    onProgress?: (progress: UploadProgress) => void,
    onPDFExtraction?: (result: PDFExtractionResult) => void,
    onImageExtraction?: (result: ImageExtractionResult) => void
  ): Promise<FileAttachment[]> {
    const uploadPromises = files.map(({ file, fieldId }) =>
      this.uploadFile(file, fieldId, formId, userId, agencyId, onProgress, onPDFExtraction, onImageExtraction)
    );

    try {
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('Error uploading files:', error);
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
