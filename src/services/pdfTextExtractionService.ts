import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface TextExtractionResult {
  text: string;
  pages: number;
  info?: any;
}

export class PDFTextExtractionService {
  /**
   * Extract text from a PDF file using PDF.js
   */
  static async extractTextFromPDF(file: File): Promise<TextExtractionResult> {
    try {
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load the PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const numPages = pdf.numPages;
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items from the page
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
      }
      
      return {
        text: fullText,
        pages: numPages,
        info: {
          title: pdf.info?.Title || '',
          author: pdf.info?.Author || '',
          subject: pdf.info?.Subject || '',
          creator: pdf.info?.Creator || ''
        }
      };
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
}
