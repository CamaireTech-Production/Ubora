import { ChatMessage, PDFData, PDFSection, GraphData } from '../types';

/**
 * Utility class to convert multi-format chat messages to PDFData for PDF generation
 */
export class MultiFormatToPDF {
  /**
   * Convert a multi-format chat message to PDFData
   */
  static convertToPDFData(message: ChatMessage): PDFData {
    const sections: PDFSection[] = [];
    const charts: GraphData[] = [];

    // Add main content as a section
    if (message.content) {
      // Parse chart data from content if present
      const chartData = this.parseChartDataFromContent(message.content);
      if (chartData) {
        console.log('MultiFormatToPDF: Found chart data in content:', chartData.title, chartData.type);
        charts.push(chartData);
        
        // Remove the JSON chart data from the content to prevent it from appearing in the PDF
        const cleanedContent = this.removeChartDataFromContent(message.content);
        console.log('MultiFormatToPDF: Original content length:', message.content.length);
        console.log('MultiFormatToPDF: Cleaned content length:', cleanedContent.length);
        console.log('MultiFormatToPDF: Content cleaned, JSON removed');
        
        sections.push({
          title: 'Analyse',
          content: cleanedContent
        });
      } else {
        console.log('MultiFormatToPDF: No chart data found in content');
        sections.push({
          title: 'Analyse',
          content: message.content
        });
      }
    }

    // Add table data as a section if present
    if (message.tableData) {
      // Clean and validate the markdown table
      const cleanedTableData = this.cleanMarkdownTable(message.tableData);
      console.log('MultiFormatToPDF: Processing table data, length:', cleanedTableData.length);
      console.log('MultiFormatToPDF: Table preview:', cleanedTableData.substring(0, 200) + '...');
      
      sections.push({
        title: 'Données tabulaires',
        content: cleanedTableData,
        isMarkdownTable: true
      });
    }

    // Add chart data to charts array (from message.graphData if available)
    if (message.graphData) {
      charts.push(message.graphData);
    }

    // Create PDFData object
    const pdfData: PDFData = {
      title: this.generateTitle(message),
      subtitle: this.generateSubtitle(message),
      sections,
      charts,
      generatedAt: new Date(),
      metadata: this.generateMetadata(message)
    };

    return pdfData;
  }

  /**
   * Generate a title for the PDF based on message content and metadata
   */
  private static generateTitle(message: ChatMessage): string {
    if (message.meta?.selectedFormTitles && message.meta.selectedFormTitles.length > 0) {
      return `Rapport d'analyse - ${message.meta.selectedFormTitles.join(', ')}`;
    }
    
    if (message.meta?.period) {
      return `Rapport d'analyse - ${message.meta.period}`;
    }

    return 'Rapport d\'analyse Ubora';
  }

  /**
   * Generate a subtitle for the PDF
   */
  private static generateSubtitle(message: ChatMessage): string {
    const parts: string[] = [];

    if (message.meta?.period) {
      parts.push(`Période: ${message.meta.period}`);
    }

    if (message.meta?.usedEntries) {
      parts.push(`${message.meta.usedEntries} entrées analysées`);
    }

    if (message.meta?.users) {
      parts.push(`${message.meta.users} employés`);
    }

    if (message.meta?.forms) {
      parts.push(`${message.meta.forms} formulaire${message.meta.forms > 1 ? 's' : ''}`);
    }

    return parts.join(' • ');
  }

  /**
   * Generate metadata for the PDF
   */
  private static generateMetadata(message: ChatMessage) {
    return {
      period: message.meta?.period,
      totalEntries: message.meta?.usedEntries,
      totalUsers: message.meta?.users,
      totalForms: message.meta?.forms
    };
  }

  /**
   * Format markdown table for PDF display
   */
  private static formatTableForPDF(tableMarkdown: string): string {
    // Convert markdown table to a more readable format for PDF
    const lines = tableMarkdown.split('\n');
    const formattedLines: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // This is a table row
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
        
        // Skip separator rows (containing only dashes and spaces)
        if (cells.every(cell => /^[-:\s]+$/.test(cell))) {
          continue;
        }

        // Format the row
        const formattedRow = cells.join(' | ');
        formattedLines.push(formattedRow);
      } else if (line.trim()) {
        // This is regular text
        formattedLines.push(line.trim());
      }
    }

    return formattedLines.join('\n');
  }

  /**
   * Check if a message can be converted to PDF
   */
  static canConvertToPDF(message: ChatMessage): boolean {
    return (
      message.contentType === 'multi-format' ||
      message.contentType === 'mixed' ||
      (message.contentType === 'text' && (message.graphData || message.tableData)) ||
      message.graphData !== undefined ||
      message.tableData !== undefined
    );
  }

  /**
   * Get a description of what will be included in the PDF
   */
  static getPDFDescription(message: ChatMessage): string {
    const parts: string[] = [];

    if (message.content) {
      parts.push('Analyse textuelle');
    }

    if (message.tableData) {
      parts.push('Données tabulaires');
    }

    if (message.graphData) {
      parts.push('Graphique statistique');
    }

    // Check if there's chart data in the content
    if (message.content && this.parseChartDataFromContent(message.content)) {
      parts.push('Graphique statistique');
    }

    if (parts.length === 0) {
      return 'Aucun contenu à inclure dans le PDF';
    }

    return `Le PDF contiendra : ${parts.join(', ')}`;
  }

  /**
   * Parse chart data from message content
   */
  private static parseChartDataFromContent(content: string): GraphData | null {
    if (!content) {
      return null;
    }

    // Try to find JSON blocks in the content
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const jsonString = jsonMatch[1].trim();
        const jsonData = JSON.parse(jsonString);

        // Check if it's valid graph data
        if (jsonData && typeof jsonData === 'object' && jsonData.type && jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
          return jsonData as GraphData;
        }
      } catch (error) {
        console.error('Error parsing JSON chart data:', error);
      }
    }

    // Try to find JSON object directly
    const directJsonMatch = content.match(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/);
    if (directJsonMatch) {
      try {
        const jsonString = directJsonMatch[0];
        const jsonData = JSON.parse(jsonString);

        if (jsonData && typeof jsonData === 'object' && jsonData.type && jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
          return jsonData as GraphData;
        }
      } catch (error) {
        console.error('Error parsing direct JSON chart data:', error);
      }
    }

    return null;
  }

  /**
   * Remove chart data JSON from content to prevent it from appearing in the PDF
   */
  private static removeChartDataFromContent(content: string): string {
    if (!content) {
      return content;
    }

    let cleanedContent = content;

    // Remove JSON code blocks
    cleanedContent = cleanedContent.replace(/```json\s*[\s\S]*?\s*```/g, '');
    
    // Remove standalone JSON objects that look like chart data
    cleanedContent = cleanedContent.replace(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g, '');
    
    // Clean up extra whitespace and empty lines
    cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanedContent = cleanedContent.trim();

    return cleanedContent;
  }

  /**
   * Clean and validate markdown table data
   */
  private static cleanMarkdownTable(tableData: string): string {
    if (!tableData) {
      return '';
    }

    const lines = tableData.split('\n');
    const cleanedLines: string[] = [];
    let inTable = false;
    let tableStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line looks like a table row
      if (line.includes('|') && line.length > 0) {
        if (!inTable) {
          inTable = true;
          tableStartIndex = i;
        }
        
        // Clean the table row
        const cleanedLine = this.cleanTableRow(line);
        cleanedLines.push(cleanedLine);
      } else if (inTable && line === '') {
        // Empty line within table - keep it
        cleanedLines.push('');
      } else if (inTable && !line.includes('|')) {
        // End of table
        inTable = false;
        break;
      } else if (!inTable) {
        // Non-table content before table starts
        continue;
      }
    }

    // Ensure we have a proper table structure
    if (cleanedLines.length < 2) {
      console.warn('MultiFormatToPDF: Table has insufficient rows, returning original data');
      return tableData;
    }

    // Validate table structure
    const headerRow = cleanedLines[0];
    const headerCells = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell);
    
    if (headerCells.length === 0) {
      console.warn('MultiFormatToPDF: Table has no valid headers, returning original data');
      return tableData;
    }

    // Check if we need to add a separator row
    const hasSeparator = cleanedLines.length > 1 && 
      cleanedLines[1].split('|').every(cell => /^[-:\s]+$/.test(cell.trim()));
    
    if (!hasSeparator && cleanedLines.length > 1) {
      // Add separator row after header
      const separatorRow = headerCells.map(() => '---').join(' | ');
      cleanedLines.splice(1, 0, separatorRow);
    }

    const result = cleanedLines.join('\n');
    console.log('MultiFormatToPDF: Cleaned table structure:');
    console.log('MultiFormatToPDF: - Rows:', cleanedLines.length);
    console.log('MultiFormatToPDF: - Columns:', headerCells.length);
    console.log('MultiFormatToPDF: - Headers:', headerCells);
    
    return result;
  }

  /**
   * Clean a single table row
   */
  private static cleanTableRow(row: string): string {
    // Remove leading and trailing pipes if present
    let cleaned = row.replace(/^\|+|\|+$/g, '');
    
    // Split by pipes and clean each cell
    const cells = cleaned.split('|').map(cell => {
      let cellContent = cell.trim();
      
      // Remove markdown formatting from cell content
      cellContent = cellContent.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
      cellContent = cellContent.replace(/\*(.*?)\*/g, '$1'); // Italic
      cellContent = cellContent.replace(/`(.*?)`/g, '$1'); // Code
      cellContent = cellContent.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
      
      // Clean up extra whitespace
      cellContent = cellContent.replace(/\s+/g, ' ').trim();
      
      return cellContent;
    });
    
    // Rejoin with proper pipe formatting
    return '| ' + cells.join(' | ') + ' |';
  }
}
