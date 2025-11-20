import { enhancedFetch } from '../utils/errorHandling';
import { logger } from '@ubora/shared/utils/logger';
import { getOCRPDFEndpoint } from '@ubora/shared/config/api';
import { TokenUsageLogService } from './tokenUsageLogService';
import { TokenStatsService } from './tokenStatsService';
import { TokenCounter } from './tokenCounter';

export interface TextExtractionResult {
  text: string;
  pages: number;
  info?: any;
  success: boolean;
  error?: string;
  submissionId?: string;
  tokenInfo?: {
    estimatedTokens: number;
    actualTokens: number;
    tokensCharged: boolean;
  };
  extractionStats?: {
    totalCharacters: number;
    totalWords: number;
    averageWordsPerPage: number;
    extractionTime: number;
    tablesDetected: number;
  };
}

export class PDFTextExtractionService {
  /**
   * Extract text from a PDF file using OpenAI Vision API
   * Provides excellent extraction for complex structures like tables, lists, and multi-column layouts
   */
  static async extractTextFromPDF(file: File, userId?: string): Promise<TextExtractionResult> {
    const startTime = Date.now();
    
    try {
      
      // Convert PDF to base64 for OpenAI Vision API
      const base64Pdf = await this.fileToBase64(file);
      
      // Prepare the request payload
      const payload = {
        pdfData: `data:${file.type};base64,${base64Pdf}`,
        model: "gpt-4o",
        fileName: file.name
      };
      
      // Make API request to the dedicated PDF extraction endpoint with enhanced error handling
      const response = await enhancedFetch.ocrRequest(getOCRPDFEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'PDF text extraction failed');
      }
      
      // Extract text from the response
      const extractedText = result.text || result.extractedText || '';
      
      // Clean and format the extracted text
      const cleanedText = this.cleanExtractedText(extractedText);
      
      const extractionTime = Date.now() - startTime;
      const totalWords = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
      const tablesDetected = this.countTablesInMarkdown(cleanedText);
      
      logger.debug('Starting token calculation for PDF extraction', {
        fileName: file.name,
        size: file.size,
        type: file.type
      }, 'PDFTextExtractionService');
      logger.debug('UserId provided', { userId }, 'PDFTextExtractionService');
      logger.debug('API Response', { result }, 'PDFTextExtractionService');
      
      // Calculate token information
      const estimatedTokens = TokenCounter.estimateExtractionTokens(file.size, 'pdf');
      logger.debug('Estimated tokens', { estimatedTokens }, 'PDFTextExtractionService');
      
      const actualTokens = result.tokenInfo?.actualTokens || estimatedTokens;
      logger.debug('Calculated actual tokens', { actualTokens }, 'PDFTextExtractionService');
      
      // Log token usage if userId is provided (do not mutate users doc)
      let tokensCharged = false;
      logger.debug('Token charging conditions', {
        hasUserId: !!userId,
        actualTokens,
        willCharge: !!(userId && actualTokens > 0)
      });
      
      if (userId && actualTokens > 0) {
        try {
          logger.debug(`Logging ${actualTokens} tokens for PDF extraction`, { fileName: file.name, actualTokens }, 'PDFTextExtractionService');
          tokensCharged = await TokenUsageLogService.logTokenUsage(
            userId,
            actualTokens,
            'pdf_extraction',
            { fileName: file.name, fileSize: file.size, fileType: file.type }
          );
          if (tokensCharged) {
            logger.info(`Successfully logged ${actualTokens} tokens for PDF extraction`, { actualTokens, fileName: file.name }, 'PDFTextExtractionService');
            try {
              await TokenStatsService.incrementUsage(userId, actualTokens);
            } catch (e) {
              logger.warn('Failed to increment token stats (non-blocking)', e, 'PDFTextExtractionService');
            }
          } else {
            logger.error('Failed to log token usage for PDF extraction', undefined, 'PDFTextExtractionService');
          }
        } catch (tokenError) {
          logger.error('Error logging token usage for PDF extraction', tokenError, 'PDFTextExtractionService');
          // Don't throw the error to prevent UI disruption
        }
      } else {
        logger.debug('Skipping token charging - conditions not met', undefined, 'PDFTextExtractionService');
      }
      
      return {
        text: cleanedText,
        pages: 1, // OpenAI Vision processes the entire PDF as one image
        success: true,
        tokenInfo: {
          estimatedTokens,
          actualTokens,
          tokensCharged
        },
        extractionStats: {
          totalCharacters: cleanedText.length,
          totalWords: totalWords,
          averageWordsPerPage: totalWords, // Since we process as one page
          extractionTime: extractionTime,
          tablesDetected: tablesDetected
        }
      };
      
    } catch (error) {
      logger.error('PDF text extraction failed', error, 'PDFTextExtractionService');
      return {
        text: '',
        pages: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }


  /**
   * Convert File to base64 string
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 string
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Count tables in markdown text
   */
  private static countTablesInMarkdown(text: string): number {
    if (!text) return 0;
    
    // Count markdown tables (lines that start with | and contain |)
    // Count table lines for statistics
    const tableLines = text.split('\n').filter(line => 
      line.trim().startsWith('|') && line.includes('|') && !line.includes('---')
    );
    
    // Group consecutive table lines to count actual tables
    let tableCount = 0;
    let inTable = false;
    
    for (const line of text.split('\n')) {
      const isTableLine = line.trim().startsWith('|') && line.includes('|');
      const isSeparatorLine = line.trim().startsWith('|') && line.includes('---');
      
      if (isTableLine && !isSeparatorLine && !inTable) {
        tableCount++;
        inTable = true;
      } else if (!isTableLine && !isSeparatorLine) {
        inTable = false;
      }
    }
    
    return tableCount;
  }

  /**
   * Clean extracted text while preserving markdown structure
   */
  static cleanExtractedText(text: string): string {
    if (!text) return '';

    return text
      // Remove excessive whitespace but preserve markdown structure
      .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
      // Remove excessive newlines but preserve markdown structure
      .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
      // Clean up common PDF artifacts
      .replace(/\f/g, '\n') // Form feed to newline
      .replace(/\r/g, '') // Remove carriage returns
      // Ensure proper spacing around markdown elements
      .replace(/\n\s*\n\s*#/g, '\n\n#') // Ensure headers have proper spacing
      .replace(/\n\s*\n\s*\*/g, '\n\n*') // Ensure list items have proper spacing
      .replace(/\n\s*\n\s*\d+\./g, '\n\n1.') // Ensure numbered lists have proper spacing
      // Trim whitespace
      .trim();
  }

  /**
   * Check if file is a PDF
   */
  static isPDF(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }
}