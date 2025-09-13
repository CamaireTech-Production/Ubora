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

export interface UploadProgress {
  fieldId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'extracting' | 'completed' | 'error';
  error?: string;
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
   * Upload a single file to Firebase Storage with PDF text extraction
   */
  static async uploadFile(
    file: File,
    fieldId: string,
    formId: string,
    userId: string,
    agencyId: string,
    onProgress?: (progress: UploadProgress) => void
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

      // Upload file
      const uploadResult: UploadResult = await uploadBytes(storageRef, file);

      // Get download URL
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // Initialize file attachment
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
          // Update progress - extracting
          onProgress?.({
            fieldId,
            fileName: file.name,
            progress: 50,
            status: 'extracting'
          });

          const extractionResult = await PDFTextExtractionService.extractTextFromPDF(file);
          fileAttachment.extractedText = PDFTextExtractionService.cleanExtractedText(extractionResult.text);
          fileAttachment.textExtractionStatus = 'completed';

          console.log(`✅ PDF text extracted successfully for ${file.name}:`, {
            pages: extractionResult.pages,
            textLength: fileAttachment.extractedText.length
          });
        } catch (extractionError) {
          console.error('Failed to extract PDF text:', extractionError);
          fileAttachment.textExtractionStatus = 'failed';
          // Don't throw error - file upload succeeded, just text extraction failed
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
      console.error('Error uploading file:', error);
      
      onProgress?.({
        fieldId,
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      });

      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    onProgress?: (progress: UploadProgress) => void
  ): Promise<FileAttachment[]> {
    const uploadPromises = files.map(({ file, fieldId }) =>
      this.uploadFile(file, fieldId, formId, userId, agencyId, onProgress)
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
