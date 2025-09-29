export interface TextExtractionResult {
  text: string;
  pages: number;
  info?: any;
  success: boolean;
  error?: string;
  extractionStats?: {
    totalCharacters: number;
    totalWords: number;
    averageWordsPerPage: number;
    extractionTime: number;
  };
}

// Import PDF.js types
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export class PDFTextExtractionService {
  /**
   * Extract text from a PDF file using browser-compatible PDF.js library
   * Enhanced version with better text positioning and extraction accuracy
   */
  static async extractTextFromPDF(file: File): Promise<TextExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Starting enhanced PDF text extraction for:', file.name);
      console.log('📄 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      
      // Use PDF.js for browser-based PDF text extraction
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to use local worker file
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF document with enhanced options
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        // Enhanced options for better text extraction
        disableFontFace: false,
        disableRange: false,
        disableStream: false,
        // Increase memory limits for large PDFs
        maxImageSize: 1024 * 1024 * 10, // 10MB
        isEvalSupported: false,
        useSystemFonts: true
      });
      
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      
      console.log('📊 PDF loaded successfully. Pages:', numPages);
      
      let fullText = '';
      const pageTexts: string[] = [];
      let totalWords = 0;
      
      // Extract text from each page with improved positioning
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          console.log(`📄 Processing page ${pageNum}/${numPages}...`);
          
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent({
            // Enhanced text extraction options
            normalizeWhitespace: false,
            disableCombineTextItems: false
          });
          
          // Extract text with proper positioning and spacing
          const pageText = this.extractTextWithPositioning(textContent.items);
          const pageWords = pageText.split(/\s+/).filter(word => word.length > 0).length;
          
          pageTexts.push(pageText);
          fullText += pageText + '\n\n'; // Double newline between pages
          totalWords += pageWords;
          
          console.log(`✅ Page ${pageNum} extracted: ${pageWords} words, ${pageText.length} characters`);
          
        } catch (pageError) {
          console.warn(`⚠️ Error extracting page ${pageNum}:`, pageError);
          // Continue with other pages even if one fails
          pageTexts.push(`[Page ${pageNum} extraction failed]`);
          fullText += `[Page ${pageNum} extraction failed]\n\n`;
        }
      }
      
      // Clean and format the extracted text with improved cleaning
      const cleanedText = this.cleanExtractedTextEnhanced(fullText);
      const extractionTime = Date.now() - startTime;
      
      console.log('✅ Enhanced PDF text extraction completed!');
      console.log('📊 Total text length:', cleanedText.length);
      console.log('📄 Pages extracted:', numPages);
      console.log('⏱️ Extraction time:', extractionTime, 'ms');
      console.log('📝 Total words:', totalWords);
      
      return {
        text: cleanedText,
        pages: numPages,
        success: true,
        extractionStats: {
          totalCharacters: cleanedText.length,
          totalWords: totalWords,
          averageWordsPerPage: Math.round(totalWords / numPages),
          extractionTime: extractionTime
        },
        info: {
          title: file.name.replace('.pdf', ''),
          author: 'Unknown',
          subject: 'PDF Document',
          creator: 'PDF.js Enhanced',
          producer: 'PDF.js Enhanced',
          creationDate: null,
          modificationDate: null,
          extractionStatus: 'success',
          fileSize: file.size,
          extractionMethod: 'enhanced_positioning'
        }
      };
    } catch (error) {
      const extractionTime = Date.now() - startTime;
      console.error('❌ Error extracting text from PDF:', error);
      console.error('📄 File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        extractionTime: extractionTime
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
   * Extract text with proper positioning and spacing from PDF text items
   */
  private static extractTextWithPositioning(items: any[]): string {
    if (!items || items.length === 0) return '';
    
    // Sort items by position (top to bottom, left to right)
    const sortedItems = items
      .filter((item): item is TextItem => 'str' in item && item.str.trim().length > 0)
      .sort((a, b) => {
        // Sort by y position (top to bottom)
        const yDiff = Math.abs(b.transform[5] - a.transform[5]);
        if (yDiff > 5) { // Different lines
          return b.transform[5] - a.transform[5];
        }
        // Same line, sort by x position (left to right)
        return a.transform[4] - b.transform[4];
      });
    
    let result = '';
    let lastY = -1;
    let lastX = -1;
    
    for (const item of sortedItems) {
      const currentY = item.transform[5];
      const currentX = item.transform[4];
      
      // Add line break if we're on a new line
      if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
        result += '\n';
      }
      // Add space if we're on the same line but with significant x difference
      else if (lastX !== -1 && Math.abs(currentX - lastX) > 10) {
        result += ' ';
      }
      
      result += item.str;
      lastY = currentY;
      lastX = currentX + (item.width || 0);
    }
    
    return result;
  }

  /**
   * Enhanced text cleaning that preserves important formatting
   */
  static cleanExtractedTextEnhanced(text: string): string {
    return text
      // Preserve line breaks but clean up excessive whitespace
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/\n[ \t]+/g, '\n') // Remove leading spaces from lines
      .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces from lines
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with double newline
      .replace(/^\s+|\s+$/g, '') // Trim start and end
      // Fix common PDF extraction issues
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase words
      .replace(/([.!?])([A-Z])/g, '$1 $2') // Add space after sentence endings
      .replace(/([a-z])([0-9])/g, '$1 $2') // Add space between letters and numbers
      .replace(/([0-9])([A-Z])/g, '$1 $2'); // Add space between numbers and letters
  }

  /**
   * Clean and format extracted text (legacy method for backward compatibility)
   */
  static cleanExtractedText(text: string): string {
    return this.cleanExtractedTextEnhanced(text);
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
      const stats = result.extractionStats;
      const baseMessage = `✅ Extraction réussie (${result.pages} page${result.pages > 1 ? 's' : ''}, ${result.text.length} caractères)`;
      
      if (stats) {
        return `${baseMessage} - ${stats.totalWords} mots, ${stats.extractionTime}ms`;
      }
      
      return baseMessage;
    } else {
      return `❌ Extraction échouée: ${result.error || 'Erreur inconnue'}`;
    }
  }
}
