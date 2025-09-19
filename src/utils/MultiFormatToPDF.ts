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
      sections.push({
        title: 'Analyse',
        content: message.content
      });
    }

    // Add table data as a section if present
    if (message.tableData) {
      sections.push({
        title: 'Données tabulaires',
        content: message.tableData, // Keep as markdown for proper table rendering
        isMarkdownTable: true
      });
    }

    // Add chart data to charts array
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

    if (parts.length === 0) {
      return 'Aucun contenu à inclure dans le PDF';
    }

    return `Le PDF contiendra : ${parts.join(', ')}`;
  }
}
