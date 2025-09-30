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
    tablesDetected: number;
  };
}

export class PDFTextExtractionService {
  /**
   * Extract text from a PDF file using browser-compatible PDF.js library
   * Simple version with basic table detection
   */
  static async extractTextFromPDF(file: File): Promise<TextExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Starting PDF text extraction for:', file.name);
      
      // Use PDF.js for browser-based PDF text extraction
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to use local worker file
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableFontFace: false,
        disableRange: false,
        disableStream: false
      });
      
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      
      console.log('📊 PDF loaded successfully. Pages:', numPages);
      
      let fullText = '';
      let totalWords = 0;
      let tablesDetected = 0;
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          console.log(`📄 Processing page ${pageNum}/${numPages}...`);
          
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Extract text with basic table detection
          const pageResult = this.extractTextWithBasicTableDetection(textContent.items);
          const pageWords = pageResult.text.split(/\s+/).filter(word => word.length > 0).length;
          
          fullText += pageResult.text + '\n\n'; // Double newline between pages
          totalWords += pageWords;
          tablesDetected += pageResult.tablesDetected;
          
          console.log(`✅ Page ${pageNum} extracted: ${pageWords} words`);
          
        } catch (pageError) {
          console.warn(`⚠️ Error extracting page ${pageNum}:`, pageError);
          // Continue with other pages even if one fails
          fullText += `[Page ${pageNum} extraction failed]\n\n`;
        }
      }
      
      // Clean the extracted text
      const cleanedText = this.cleanExtractedText(fullText);
      const extractionTime = Date.now() - startTime;
      
      console.log('✅ PDF text extraction completed!');
      console.log('📊 Total text length:', cleanedText.length);
      console.log('📝 Total words:', totalWords);
      console.log('📋 Tables detected:', tablesDetected);
      
      return {
        text: cleanedText,
        pages: numPages,
        success: true,
        extractionStats: {
          totalCharacters: cleanedText.length,
          totalWords: totalWords,
          averageWordsPerPage: Math.round(totalWords / numPages),
          extractionTime: extractionTime,
          tablesDetected: tablesDetected
        }
      };
      
    } catch (error) {
      console.error('❌ PDF text extraction failed:', error);
      return {
        text: '',
        pages: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Extract text with basic table detection
   */
  private static extractTextWithBasicTableDetection(items: any[]): { text: string; tablesDetected: number } {
    if (!items || items.length === 0) {
      return { text: '', tablesDetected: 0 };
    }

    // Convert items to text with positioning
    const textItems = items.map((item: any) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height
    }));

    // Sort items by position (top to bottom, left to right)
    textItems.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) { // Same row
        return a.x - b.x;
      }
      return b.y - a.y; // Top to bottom
    });

    // Try to detect tables by looking for aligned columns
    const tables = this.detectBasicTables(textItems);
    let tablesDetected = 0;

    // Process text and format tables
    let result = '';
    let currentTable: any = null;

    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i];
      
      // Check if this item is part of a table
      const table = tables.find(t => 
        item.x >= t.startX && item.x <= t.endX && 
        item.y >= t.startY && item.y <= t.endY
      );

      if (table) {
        if (!currentTable || currentTable !== table) {
          // Start of a new table
          if (currentTable) {
            result += this.formatTableAsMarkdown(currentTable.items);
            tablesDetected++;
          }
          currentTable = table;
        }
        // Skip individual table items, we'll process them as a group
        continue;
      } else {
        // Not part of a table, add as regular text
        if (currentTable) {
          result += this.formatTableAsMarkdown(currentTable.items);
          tablesDetected++;
          currentTable = null;
        }
        result += item.text + ' ';
      }
    }

    // Handle last table if exists
    if (currentTable) {
      result += this.formatTableAsMarkdown(currentTable.items);
      tablesDetected++;
    }

    return { text: result.trim(), tablesDetected };
  }

  /**
   * Detect basic tables by looking for aligned columns
   */
  private static detectBasicTables(textItems: any[]): any[] {
    const tables: any[] = [];

    // Group items by similar Y positions (rows)
    const rows: any[][] = [];
    let currentRow: any[] = [];
    let currentY = textItems[0]?.y;

    for (const item of textItems) {
      if (Math.abs(item.y - currentY) < 10) { // Same row
        currentRow.push(item);
      } else {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [item];
        currentY = item.y;
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // Look for rows with similar column structure
    for (let i = 0; i < rows.length - 1; i++) {
      const row1 = rows[i];
      const row2 = rows[i + 1];

      // Check if rows have similar column structure
      if (this.hasSimilarColumnStructure(row1, row2)) {
        // Find all consecutive rows with similar structure
        const tableRows = [row1, row2];
        let j = i + 2;
        
        while (j < rows.length && this.hasSimilarColumnStructure(tableRows[tableRows.length - 1], rows[j])) {
          tableRows.push(rows[j]);
          j++;
        }

        if (tableRows.length >= 2) { // At least 2 rows
          const table = {
            items: tableRows.flat(),
            startX: Math.min(...tableRows.flat().map(item => item.x)),
            endX: Math.max(...tableRows.flat().map(item => item.x + item.width)),
            startY: Math.min(...tableRows.flat().map(item => item.y)),
            endY: Math.max(...tableRows.flat().map(item => item.y + item.height)),
            rows: tableRows
          };
          tables.push(table);
          i = j - 1; // Skip processed rows
        }
      }
    }

    return tables;
  }

  /**
   * Check if two rows have similar column structure
   */
  private static hasSimilarColumnStructure(row1: any[], row2: any[]): boolean {
    if (row1.length !== row2.length) return false;
    if (row1.length < 2) return false; // Need at least 2 columns

    // Check if items are roughly aligned
    for (let i = 0; i < row1.length; i++) {
      const item1 = row1[i];
      const item2 = row2[i];
      
      // Allow some tolerance in alignment
      if (Math.abs(item1.x - item2.x) > 20) {
        return false;
      }
    }

    return true;
  }

  /**
   * Format table items as Markdown
   */
  private static formatTableAsMarkdown(tableItems: any[]): string {
    // Group items by rows
    const rows: any[][] = [];
    let currentRow: any[] = [];
    let currentY = tableItems[0]?.y;

    for (const item of tableItems) {
      if (Math.abs(item.y - currentY) < 10) { // Same row
        currentRow.push(item);
      } else {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [item];
        currentY = item.y;
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    if (rows.length === 0) return '';

    // Sort each row by X position
    rows.forEach(row => row.sort((a, b) => a.x - b.x));

    // Create Markdown table
    let markdown = '\n\n## 📊 Tableau détecté\n\n';
    
    // Header row
    const headerRow = rows[0];
    markdown += '| ' + headerRow.map(item => item.text.trim()).join(' | ') + ' |\n';
    markdown += '| ' + headerRow.map(() => '---').join(' | ') + ' |\n';
    
    // Data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      markdown += '| ' + row.map(item => item.text.trim()).join(' | ') + ' |\n';
    }
    
    markdown += '\n';
    return markdown;
  }

  /**
   * Clean extracted text
   */
  static cleanExtractedText(text: string): string {
    if (!text) return '';

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove excessive newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Clean up common PDF artifacts
      .replace(/\f/g, '\n') // Form feed to newline
      .replace(/\r/g, '') // Remove carriage returns
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
