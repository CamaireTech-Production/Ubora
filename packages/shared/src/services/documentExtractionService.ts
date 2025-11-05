/**
 * Unified Document Extraction Service
 */

import { PDFTextExtractionService, TextExtractionResult } from './pdfTextExtractionService';
import { WordExtractionService, WordExtractionResult } from './wordExtractionService';

export type DocumentType = 'pdf' | 'word';
export type ExtractionMethod = 'basic' | 'ai-enhanced';

export interface DocumentExtractionOptions {
  method?: ExtractionMethod;
  userId?: string;
}

export interface UnifiedExtractionResult {
  text: string;
  html?: string;
  success: boolean;
  error?: string;
  documentType: DocumentType;
  method: ExtractionMethod;
  structure?: {
    headings: Array<{ level: number; text: string; position: number }>;
    tables: Array<{ rows: number; columns: number; position: number; markdown?: string }>;
    formatting: Array<{ type: 'bold' | 'italic' | 'color'; text: string; position: number }>;
  };
  extractionStats: {
    totalCharacters: number;
    totalWords: number;
    extractionTime: number;
    tablesDetected: number;
  };
  tokenInfo?: {
    estimatedTokens: number;
    actualTokens: number;
    tokensCharged: boolean;
  };
}

export class DocumentExtractionService {
  static detectDocumentType(file: File): DocumentType | null {
    if (PDFTextExtractionService.isPDF(file)) {
      return 'pdf';
    }
    if (WordExtractionService.isWord(file)) {
      return 'word';
    }
    return null;
  }

  static async extractDocument(
    file: File,
    options: DocumentExtractionOptions = {}
  ): Promise<UnifiedExtractionResult> {
    const documentType = this.detectDocumentType(file);

    if (!documentType) {
      return {
        text: '',
        success: false,
        error: 'Unsupported file type. Only PDF and Word documents are supported.',
        documentType: 'pdf',
        method: 'basic',
        extractionStats: {
          totalCharacters: 0,
          totalWords: 0,
          extractionTime: 0,
          tablesDetected: 0
        }
      };
    }

    if (documentType === 'word') {
      return this.extractWord(file);
    } else {
      return this.extractPDF(file, options);
    }
  }

  private static async extractWord(file: File): Promise<UnifiedExtractionResult> {
    const wordResult = await WordExtractionService.extractTextFromWord(file);

    return {
      text: wordResult.text,
      html: wordResult.html,
      success: wordResult.success,
      error: wordResult.error,
      documentType: 'word',
      method: 'basic',
      structure: wordResult.structure,
      extractionStats: wordResult.extractionStats
    };
  }

  private static async extractPDF(
    file: File,
    options: DocumentExtractionOptions
  ): Promise<UnifiedExtractionResult> {
    const method = options.method || 'basic';
    const userId = options.userId;

    const pdfResult = await PDFTextExtractionService.extractTextFromPDF(file, userId);

    const structure = this.extractStructureFromText(pdfResult.text);

    return {
      text: pdfResult.text,
      success: pdfResult.success,
      error: pdfResult.error,
      documentType: 'pdf',
      method: method,
      structure,
      extractionStats: pdfResult.extractionStats || {
        totalCharacters: pdfResult.text.length,
        totalWords: pdfResult.text.split(/\s+/).filter(w => w.length > 0).length,
        extractionTime: 0,
        tablesDetected: structure.tables.length
      },
      tokenInfo: pdfResult.tokenInfo
    };
  }

  private static extractStructureFromText(text: string): UnifiedExtractionResult['structure'] {
    const headings: Array<{ level: number; text: string; position: number }> = [];
    const tables: Array<{ rows: number; columns: number; position: number }> = [];
    const formatting: Array<{ type: 'bold' | 'italic' | 'color'; text: string; position: number }> = [];

    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(text)) !== null) {
      const level = match[1].length;
      const headingText = match[2].trim();
      headings.push({
        level,
        text: headingText,
        position: match.index
      });
    }

    const lines = text.split('\n');
    let inTable = false;
    let tableStartPos = 0;
    let tableRows = 0;
    let tableCols = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isTableRow = line.startsWith('|') && line.endsWith('|');
      const isSeparator = line.match(/^\|[\s\-:]+\|$/);

      if (isTableRow && !isSeparator) {
        if (!inTable) {
          inTable = true;
          tableStartPos = text.indexOf(line);
        }
        tableRows++;
        const cols = line.split('|').filter(c => c.trim()).length;
        tableCols = Math.max(tableCols, cols);
      } else if (inTable && !isTableRow) {
        if (tableRows > 0 && tableCols > 0) {
          tables.push({
            rows: tableRows,
            columns: tableCols,
            position: tableStartPos
          });
        }
        inTable = false;
        tableRows = 0;
        tableCols = 0;
      }
    }

    if (inTable && tableRows > 0 && tableCols > 0) {
      tables.push({
        rows: tableRows,
        columns: tableCols,
        position: tableStartPos
      });
    }

    return { headings, tables, formatting };
  }

  static isSupportedDocument(file: File): boolean {
    return PDFTextExtractionService.isPDF(file) || WordExtractionService.isWord(file);
  }
}
