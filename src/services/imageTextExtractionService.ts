export interface ImageTextExtractionResult {
  text: string;
  confidence?: number;
  success: boolean;
  error?: string;
  info?: any;
}

export class ImageTextExtractionService {
  /**
   * Extract text from an image file using Tesseract.js OCR
   */
  static async extractTextFromImage(file: File): Promise<ImageTextExtractionResult> {
    try {
      console.log('🔍 Starting image text extraction for:', file.name);
      
      // Import Tesseract.js dynamically
      const Tesseract = await import('tesseract.js');
      
      // Convert File to image data URL for Tesseract
      const imageDataUrl = await this.fileToDataURL(file);
      
      // Perform OCR with Tesseract.js
      const { data: { text, confidence } } = await Tesseract.recognize(
        imageDataUrl,
        'fra+eng', // French and English languages
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      // Clean and format the extracted text
      const cleanedText = this.cleanExtractedText(text);
      
      console.log('✅ Image text extraction completed!');
      console.log('📊 Total text length:', cleanedText.length);
      console.log('🎯 Confidence score:', confidence);
      
      return {
        text: cleanedText,
        confidence: confidence,
        success: true,
        info: {
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
          originalFileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          extractionStatus: 'success',
          confidence: confidence
        }
      };
    } catch (error) {
      console.error('❌ Error extracting text from image:', error);
      console.error('🖼️ File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      // Fallback to error message if extraction fails
      console.log('🔄 Falling back to error message...');
      return this.getFallbackText(file);
    }
  }

  /**
   * Convert File to data URL for Tesseract.js
   */
  private static fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Clean and format extracted text
   */
  static cleanExtractedText(text: string): string {
    if (!text || text.trim().length === 0) {
      return 'Aucun texte détecté dans l\'image.';
    }

    // Remove excessive whitespace and normalize line breaks
    let cleaned = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    // Remove common OCR artifacts
    cleaned = cleaned
      .replace(/[^\w\s\u00C0-\u017F\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF.,;:!?()[\]{}'"-]/g, ' ') // Keep only letters, numbers, common punctuation, and accented characters
      .replace(/\s+/g, ' ') // Clean up spaces again
      .trim();

    // If text is too short or seems like OCR noise, return a fallback message
    if (cleaned.length < 10) {
      return 'Texte extrait de l\'image (contenu limité détecté).';
    }

    return cleaned;
  }

  /**
   * Check if file is an image
   */
  static isImage(file: File): boolean {
    const imageTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'image/tiff'
    ];
    return imageTypes.includes(file.type.toLowerCase());
  }

  /**
   * Fallback method that returns clear error message if image parsing fails
   */
  private static getFallbackText(file: File): ImageTextExtractionResult {
    const errorMessage = `Erreur lors de l'extraction du texte de l'image "${file.name}". L'image a été uploadée mais le texte n'a pas pu être extrait automatiquement.`;
    
    return {
      text: errorMessage,
      success: false,
      error: 'OCR extraction failed',
      info: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        originalFileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        extractionStatus: 'failed',
        error: 'OCR extraction failed'
      }
    };
  }

  /**
   * Get supported image formats
   */
  static getSupportedFormats(): string[] {
    return [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'image/bmp',
      'image/webp',
      'image/tiff'
    ];
  }

  /**
   * Validate if image format is supported for OCR
   */
  static isSupportedFormat(file: File): boolean {
    return this.getSupportedFormats().includes(file.type.toLowerCase());
  }
}
