export interface TextExtractionResult {
  text: string;
  pages: number;
  info?: any;
  success: boolean;
  error?: string;
}

// Import PDF.js types
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export class PDFTextExtractionService {
  /**
   * Extract text from a PDF file using browser-compatible PDF.js library
   */
  static async extractTextFromPDF(file: File): Promise<TextExtractionResult> {
    try {
      console.log('🔍 Starting PDF text extraction for:', file.name);
      
      // Use PDF.js for browser-based PDF text extraction
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to use local worker file
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      let fullText = '';
      const pageTexts: string[] = [];
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items from the page
        const pageText = textContent.items
          .filter((item): item is TextItem => 'str' in item)
          .map((item: TextItem) => item.str)
          .join(' ');
        
        pageTexts.push(pageText);
        fullText += pageText + '\n';
      }
      
      // Clean and format the extracted text
      const cleanedText = this.cleanExtractedText(fullText);
      
      console.log('✅ PDF text extraction completed!');
      console.log('📊 Total text length:', cleanedText.length);
      console.log('📄 Pages extracted:', numPages);
      
      return {
        text: cleanedText,
        pages: numPages,
        success: true,
        info: {
          title: file.name.replace('.pdf', ''),
          author: 'Unknown',
          subject: 'PDF Document',
          creator: 'PDF.js',
          producer: 'PDF.js',
          creationDate: null,
          modificationDate: null,
          extractionStatus: 'success'
        }
      };
    } catch (error) {
      console.error('❌ Error extracting text from PDF:', error);
      console.error('📄 File details:', {
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
   * Fallback method that returns clear error message if PDF parsing fails
   */
  private static getFallbackText(file: File): TextExtractionResult {
    const errorMessage = `❌ ERREUR D'EXTRACTION PDF

Le fichier "${file.name}" n'a pas pu être analysé automatiquement.

RAISONS POSSIBLES:
- Le fichier PDF est corrompu ou protégé
- Le fichier contient des images sans texte extractible
- Le fichier utilise un format PDF non standard
- Problème technique temporaire

SOLUTIONS:
- Vérifiez que le fichier PDF est valide
- Essayez de convertir le PDF en texte manuellement
- Contactez le support technique si le problème persiste

Le fichier original reste disponible en téléchargement pour consultation manuelle.`;

    return {
      text: errorMessage,
      pages: 0,
      success: false,
      error: 'PDF text extraction failed',
      info: {
        title: file.name.replace('.pdf', ''),
        author: 'Unknown',
        subject: 'PDF Document - Extraction Failed',
        creator: 'PDF Parser',
        extractionStatus: 'failed'
      }
    };
  }

  /**
   * Check if a file is a PDF
   */
  static isPDF(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  /**
   * Clean and format extracted text
   */
  static cleanExtractedText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }

  /**
   * Check if text extraction was successful
   */
  static isExtractionSuccessful(result: TextExtractionResult): boolean {
    return result.success === true && result.text.length > 0;
  }

  /**
   * Get extraction status message
   */
  static getExtractionStatus(result: TextExtractionResult): string {
    if (result.success) {
      return `✅ Extraction réussie (${result.pages} page${result.pages > 1 ? 's' : ''}, ${result.text.length} caractères)`;
    } else {
      return `❌ Extraction échouée: ${result.error || 'Erreur inconnue'}`;
    }
  }
}
