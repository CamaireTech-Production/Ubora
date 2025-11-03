/**
 * Word Document Extraction Service
 * Extracts text and formatting from .docx files using mammoth.js
 */

import mammoth from 'mammoth';

export interface WordExtractionResult {
  text: string;
  html: string;
  success: boolean;
  error?: string;
  structure: {
    headings: Array<{ level: number; text: string; position: number }>;
    tables: Array<{ rows: number; columns: number; position: number; markdown: string }>;
    formatting: Array<{ type: 'bold' | 'italic' | 'color'; text: string; position: number }>;
  };
  extractionStats: {
    totalCharacters: number;
    totalWords: number;
    extractionTime: number;
    tablesDetected: number;
  };
}

export class WordExtractionService {
  /**
   * Check if file is a Word document
   */
  static isWord(file: File): boolean {
    return (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.name.toLowerCase().endsWith('.docx') ||
      file.name.toLowerCase().endsWith('.doc')
    );
  }

  /**
   * Extract text and formatting from Word document
   */
  static async extractTextFromWord(file: File): Promise<WordExtractionResult> {
    const startTime = Date.now();

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();

      // Extract text and HTML using mammoth
      const result = await mammoth.extractRawText({ arrayBuffer });
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });

      const extractedText = result.value;
      const extractedHtml = htmlResult.value;

      // Convert HTML to markdown-like structure for better placeholder detection
      const markdownText = this.htmlToMarkdown(extractedHtml);

      // Extract structure from HTML
      const structure = this.extractStructure(extractedHtml, extractedText);

      // Clean extracted text
      const cleanedText = this.cleanExtractedText(extractedText || markdownText);

      const extractionTime = Date.now() - startTime;
      const totalWords = cleanedText.split(/\s+/).filter(word => word.length > 0).length;
      const tablesDetected = structure.tables.length;

      return {
        text: cleanedText,
        html: extractedHtml,
        success: true,
        structure,
        extractionStats: {
          totalCharacters: cleanedText.length,
          totalWords,
          extractionTime,
          tablesDetected
        }
      };
    } catch (error) {
      console.error('❌ Word document extraction failed:', error);
      return {
        text: '',
        html: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        structure: {
          headings: [],
          tables: [],
          formatting: []
        },
        extractionStats: {
          totalCharacters: 0,
          totalWords: 0,
          extractionTime: Date.now() - startTime,
          tablesDetected: 0
        }
      };
    }
  }

  /**
   * Convert HTML to markdown-like text for placeholder detection
   */
  private static htmlToMarkdown(html: string): string {
    if (!html) return '';

    // Check if we're in browser environment
    if (typeof document === 'undefined') {
      // Server-side: return plain text
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Create temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Convert headings
    tempDiv.querySelectorAll('h1').forEach(h => {
      h.textContent = `# ${h.textContent}\n\n`;
    });
    tempDiv.querySelectorAll('h2').forEach(h => {
      h.textContent = `## ${h.textContent}\n\n`;
    });
    tempDiv.querySelectorAll('h3').forEach(h => {
      h.textContent = `### ${h.textContent}\n\n`;
    });
    tempDiv.querySelectorAll('h4').forEach(h => {
      h.textContent = `#### ${h.textContent}\n\n`;
    });

    // Convert bold
    tempDiv.querySelectorAll('strong, b').forEach(el => {
      el.textContent = `**${el.textContent}**`;
    });

    // Convert italic
    tempDiv.querySelectorAll('em, i').forEach(el => {
      el.textContent = `*${el.textContent}*`;
    });

    // Convert tables to markdown
    tempDiv.querySelectorAll('table').forEach(table => {
      const markdownTable = this.tableToMarkdown(table);
      table.outerHTML = markdownTable;
    });

    return tempDiv.textContent || tempDiv.innerText || '';
  }

  /**
   * Convert HTML table to markdown table
   */
  private static tableToMarkdown(table: HTMLTableElement): string {
    const rows: string[] = [];
    const headerRows = table.querySelectorAll('thead tr, tr:first-child');
    const bodyRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');

    // Process header row(s)
    headerRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      const cellTexts = cells.map(cell => cell.textContent?.trim() || '');
      if (cellTexts.length > 0) {
        rows.push(`| ${cellTexts.join(' | ')} |`);
        
        // Add separator row after header
        if (rows.length === 1) {
          rows.push(`| ${cellTexts.map(() => '---').join(' | ')} |`);
        }
      }
    });

    // Process body rows
    bodyRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const cellTexts = cells.map(cell => cell.textContent?.trim() || '');
      if (cellTexts.length > 0) {
        rows.push(`| ${cellTexts.join(' | ')} |`);
      }
    });

    return rows.join('\n');
  }

  /**
   * Extract structure (headings, tables, formatting) from HTML
   */
  private static extractStructure(html: string, text: string): WordExtractionResult['structure'] {
    // Check if we're in browser environment
    if (typeof document === 'undefined') {
      // Server-side: return empty structure
      return {
        headings: [],
        tables: [],
        formatting: []
      };
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const headings: Array<{ level: number; text: string; position: number }> = [];
    const tables: Array<{ rows: number; columns: number; position: number; markdown: string }> = [];
    const formatting: Array<{ type: 'bold' | 'italic' | 'color'; text: string; position: number }> = [];

    // Extract headings
    [1, 2, 3, 4, 5, 6].forEach(level => {
      tempDiv.querySelectorAll(`h${level}`).forEach((heading) => {
        const headingText = heading.textContent || '';
        if (headingText.trim()) {
          headings.push({
            level,
            text: headingText.trim(),
            position: text.indexOf(headingText)
          });
        }
      });
    });

    // Extract tables
    tempDiv.querySelectorAll('table').forEach((table) => {
      const rows = table.querySelectorAll('tr').length;
      const firstRow = table.querySelector('tr');
      const columns = firstRow ? firstRow.querySelectorAll('th, td').length : 0;
      const tableMarkdown = this.tableToMarkdown(table as HTMLTableElement);
      
      tables.push({
        rows,
        columns,
        position: text.indexOf(tableMarkdown.split('\n')[0] || ''),
        markdown: tableMarkdown
      });
    });

    // Extract formatting (bold, italic)
    tempDiv.querySelectorAll('strong, b').forEach(el => {
      const textContent = el.textContent || '';
      if (textContent.trim()) {
        formatting.push({
          type: 'bold',
          text: textContent.trim(),
          position: text.indexOf(textContent)
        });
      }
    });

    tempDiv.querySelectorAll('em, i').forEach(el => {
      const textContent = el.textContent || '';
      if (textContent.trim()) {
        formatting.push({
          type: 'italic',
          text: textContent.trim(),
          position: text.indexOf(textContent)
        });
      }
    });

    return { headings, tables, formatting };
  }

  /**
   * Clean extracted text while preserving structure
   */
  static cleanExtractedText(text: string): string {
    if (!text) return '';

    return text
      // Normalize whitespace but preserve structure
      .replace(/[ \t]+/g, ' ')
      // Remove excessive newlines but preserve markdown structure
      .replace(/\n{4,}/g, '\n\n\n')
      // Clean up artifacts
      .replace(/\f/g, '\n')
      .replace(/\r/g, '')
      // Ensure proper spacing around markdown elements
      .replace(/\n\s*\n\s*#/g, '\n\n#')
      .replace(/\n\s*\n\s*\*/g, '\n\n*')
      .trim();
  }
}
