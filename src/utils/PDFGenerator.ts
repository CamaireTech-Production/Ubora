import jsPDF from 'jspdf';
import { PDFData, GraphData } from '../types';
import { ChartToImage } from './ChartToImage';

export class PDFGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageHeight: number = 280;
  private margin: number = 20;
  private pageWidth: number = 210;

  constructor() {
    this.doc = new jsPDF();
  }

  generateReportFromText(content: string, title: string = 'Rapport Ubora'): void {
    this.doc = new jsPDF();
    this.currentY = 20;

    // Add title
    this.addTitle(title);
    
    // Add subtitle
    this.addSubtitle('Rapport généré avec Archa');
    
    // Add generation date
    this.addSubtitle(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`);

    // Parse and add content
    this.addTextContent(content);

    // Add footer
    this.addFooter(new Date());

    // Save the PDF
    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(fileName);
  }

  async generateReport(pdfData: PDFData): Promise<void> {
    this.doc = new jsPDF();
    this.currentY = 20;

    // Add title
    this.addTitle(pdfData.title);
    
    // Add subtitle if exists
    if (pdfData.subtitle) {
      this.addSubtitle(pdfData.subtitle);
    }

    // Add metadata if exists
    if (pdfData.metadata) {
      this.addMetadata(pdfData.metadata);
    }

    // Add sections
    pdfData.sections.forEach((section, index) => {
      this.addSection(section);
      
      // Add page break if needed (except for last section)
      if (index < pdfData.sections.length - 1 && this.currentY > this.pageHeight - 40) {
        this.addPageBreak();
      }
    });

    // Add charts if they exist
    if (pdfData.charts && pdfData.charts.length > 0) {
      this.addPageBreak();
      await this.addChartsSection(pdfData.charts);
    }

    // Add footer
    this.addFooter(pdfData.generatedAt);

    // Save the PDF
    const fileName = `${pdfData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    this.doc.save(fileName);
  }

  private addTitle(title: string): void {
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    
    // Calculate available width for title
    const availableWidth = this.pageWidth - 2 * this.margin;
    const lineHeight = 8;
    
    // Split title into multiple lines if it's too long
    const lines = this.doc.splitTextToSize(title, availableWidth);
    
    // Add each line
    lines.forEach((line: string) => {
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += lineHeight;
    });
    
    this.currentY += 5; // Extra spacing after title
  }

  private addSubtitle(subtitle: string): void {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    
    // Calculate available width for subtitle
    const availableWidth = this.pageWidth - 2 * this.margin;
    const lineHeight = 6;
    
    // Split subtitle into multiple lines if it's too long
    const lines = this.doc.splitTextToSize(subtitle, availableWidth);
    
    // Add each line
    lines.forEach((line: string) => {
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += lineHeight;
    });
    
    this.currentY += 4; // Extra spacing after subtitle
    this.doc.setTextColor(0, 0, 0);
  }

  private addMetadata(metadata: any): void {
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(120, 120, 120);
    
    const metadataText = [];
    if (metadata.period) metadataText.push(`Période: ${metadata.period}`);
    if (metadata.totalEntries) metadataText.push(`Entrées: ${metadata.totalEntries}`);
    if (metadata.totalUsers) metadataText.push(`Utilisateurs: ${metadata.totalUsers}`);
    if (metadata.totalForms) metadataText.push(`Formulaires: ${metadata.totalForms}`);
    
    if (metadataText.length > 0) {
      const metadataString = metadataText.join(' | ');
      
      // Calculate available width for metadata
      const availableWidth = this.pageWidth - 2 * this.margin;
      const lineHeight = 5;
      
      // Split metadata into multiple lines if it's too long
      const lines = this.doc.splitTextToSize(metadataString, availableWidth);
      
      // Add each line
      lines.forEach((line: string) => {
        this.doc.text(line, this.margin, this.currentY);
        this.currentY += lineHeight;
      });
      
      this.currentY += 3; // Extra spacing after metadata
    }
    
    this.doc.setTextColor(0, 0, 0);
  }

  private addSection(section: any): void {
    // Add section title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(section.title, this.margin, this.currentY);
    this.currentY += 10;

    // Add section content based on type
    if (section.isMarkdownTable) {
      this.addMarkdownTable(section.content);
    } else {
      switch (section.type) {
        case 'text':
          this.addTextContent(section.content);
          break;
        case 'list':
          this.addListContent(section.data || []);
          break;
        case 'table':
          this.addTableContent(section.data || []);
          break;
        default:
          this.addTextContent(section.content);
      }
    }

    this.currentY += 10;
  }

  private addTextContent(content: string): void {
    // Parse markdown content and convert to PDF format
    const parsedContent = this.parseMarkdownContent(content);
    
    parsedContent.forEach((element) => {
      // Check if we need a page break before adding content
      if (this.currentY > this.pageHeight - 30) {
        this.addPageBreak();
      }
      
      switch (element.type) {
        case 'title':
          this.addTitle(element.text);
          break;
        case 'subtitle':
          this.addSubtitle(element.text);
          break;
        case 'heading1':
          this.addHeading1(element.text);
          break;
        case 'heading2':
          this.addHeading2(element.text);
          break;
        case 'heading3':
          this.addHeading3(element.text);
          break;
        case 'bold':
          this.addBoldText(element.text);
          break;
        case 'list':
          this.addListContent(element.items || []);
          break;
        case 'table':
          this.addTableContent(element.tableData || []);
          break;
        case 'separator':
          this.addSeparator();
          break;
        case 'text':
        default:
          this.addRegularText(element.text);
          break;
      }
    });
  }

  private parseMarkdownContent(content: string): Array<{type: string, text: string, items?: string[], tableData?: any[]}> {
    const elements: Array<{type: string, text: string, items?: string[], tableData?: any[]}> = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // Empty line - add some spacing
        elements.push({ type: 'text', text: '' });
        continue;
      }
      
      // Check for markdown table
      if (trimmedLine.includes('|') && trimmedLine.length > 0) {
        const { tableData, endIndex } = this.parseMarkdownTable(lines, i);
        if (tableData) {
          elements.push({ type: 'table', text: '', tableData });
          i = endIndex; // Skip the processed table lines
          continue;
        }
      }
      
      // Check for headers
      if (trimmedLine.match(/^###\s+/)) {
        const text = trimmedLine.replace(/^###\s+/, '').trim();
        elements.push({ type: 'heading3', text: this.cleanMarkdown(text) });
      } else if (trimmedLine.match(/^##\s+/)) {
        const text = trimmedLine.replace(/^##\s+/, '').trim();
        elements.push({ type: 'heading2', text: this.cleanMarkdown(text) });
      } else if (trimmedLine.match(/^#\s+/)) {
        const text = trimmedLine.replace(/^#\s+/, '').trim();
        elements.push({ type: 'heading1', text: this.cleanMarkdown(text) });
      } else if (trimmedLine.match(/^\*\*.*\*\*$/)) {
        // Bold text (entire line)
        const text = trimmedLine.replace(/^\*\*(.*)\*\*$/, '$1').trim();
        elements.push({ type: 'bold', text: this.cleanMarkdown(text) });
      } else if (trimmedLine.match(/^[-*]\s+\*\*.*\*\*$/)) {
        // List item with bold
        const text = trimmedLine.replace(/^[-*]\s+\*\*(.*)\*\*$/, '$1').trim();
        elements.push({ type: 'bold', text: this.cleanMarkdown(text) });
      } else if (trimmedLine.match(/^[-*]\s+/)) {
        // Regular list item
        const text = trimmedLine.replace(/^[-*]\s+/, '').trim();
        elements.push({ type: 'text', text: `• ${this.cleanMarkdown(text)}` });
      } else if (trimmedLine.match(/^\d+\.\s+/)) {
        // Numbered list
        elements.push({ type: 'text', text: this.cleanMarkdown(trimmedLine) });
      } else if (trimmedLine.includes('--')) {
        // Handle separator lines
        elements.push({ type: 'separator', text: '' });
      } else {
        // Regular text - clean all markdown
        elements.push({ type: 'text', text: this.cleanMarkdown(line) });
      }
    }
    
    return elements;
  }

  private parseMarkdownTable(lines: string[], startIndex: number): { tableData: any[] | null, endIndex: number } {
    const tableLines = [];
    let currentIndex = startIndex;
    
    // Collect all table lines
    while (currentIndex < lines.length) {
      const line = lines[currentIndex].trim();
      if (line.includes('|') && line.length > 0) {
        tableLines.push(line);
        currentIndex++;
      } else {
        break;
      }
    }
    
    if (tableLines.length < 2) {
      return { tableData: null, endIndex: startIndex };
    }
    
    // Parse header
    const headerLine = tableLines[0];
    const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
    
    // Skip separator line (second line)
    const dataLines = tableLines.slice(2);
    
    // Parse data rows
    const tableData = dataLines.map(line => {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = this.cleanMarkdown(cells[index] || '');
      });
      return row;
    });
    
    return { tableData, endIndex: currentIndex - 1 };
  }

  private cleanMarkdown(text: string): string {
    if (!text) return '';
    
    // Remove all markdown formatting
    let cleaned = text;
    
    // Remove bold markers (multiple passes to catch nested ones)
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // Second pass for nested
    
    // Remove italic markers
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
    
    // Remove code backticks
    cleaned = cleaned.replace(/`(.*?)`/g, '$1');
    
    // Remove markdown links
    cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    
    // Remove headers
    cleaned = cleaned.replace(/^#{1,6}\s+/, '');
    
    // Remove list markers
    cleaned = cleaned.replace(/^[-*]\s+/, '');
    cleaned = cleaned.replace(/^\d+\.\s+/, '');
    
    // Remove any remaining markdown artifacts
    cleaned = cleaned.replace(/\*\*/g, '');
    cleaned = cleaned.replace(/\*/g, '');
    cleaned = cleaned.replace(/`/g, '');
    cleaned = cleaned.replace(/\[/g, '');
    cleaned = cleaned.replace(/\]/g, '');
    cleaned = cleaned.replace(/\(/g, '');
    cleaned = cleaned.replace(/\)/g, '');
    
    // Remove extra whitespace and clean up
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/\s+/g, ' '); // Replace multiple spaces with single space
    
    return cleaned;
  }

  private addHeading1(text: string): void {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(text, this.margin, this.currentY);
    this.currentY += 10;
  }

  private addHeading2(text: string): void {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(text, this.margin, this.currentY);
    this.currentY += 8;
  }

  private addHeading3(text: string): void {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(text, this.margin, this.currentY);
    this.currentY += 6;
  }

  private addBoldText(text: string): void {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    const lines = this.doc.splitTextToSize(text, this.pageWidth - (this.margin * 2));
    
    lines.forEach((line: string) => {
      if (this.currentY > this.pageHeight - 15) {
        this.addPageBreak();
      }
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += 6;
    });
  }

  private addRegularText(text: string): void {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    if (!text) {
      this.currentY += 5; // Add small spacing for empty lines
      return;
    }
    
    // Clean up text and ensure proper wrapping
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const lines = this.doc.splitTextToSize(cleanText, this.pageWidth - (this.margin * 2));
    
    lines.forEach((line: string) => {
      // Check if we need a page break before adding the line
      if (this.currentY > this.pageHeight - 20) {
        this.addPageBreak();
      }
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += 7; // Increased line spacing for better readability
    });
    
    // Add extra spacing after paragraphs
    this.currentY += 3;
  }

  private addSeparator(): void {
    // Add some spacing before the separator
    this.currentY += 5;
    
    // Check if we need a page break
    if (this.currentY > this.pageHeight - 20) {
      this.addPageBreak();
    }
    
    // Draw a horizontal line using jsPDF's line method
    const lineWidth = this.pageWidth - (this.margin * 2);
    const lineY = this.currentY;
    
    // Set line color to gray
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.5);
    
    // Draw the line
    this.doc.line(this.margin, lineY, this.margin + lineWidth, lineY);
    
    // Add spacing after the separator
    this.currentY += 10;
  }

  private addListContent(items: any[]): void {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    items.forEach((item) => {
      if (this.currentY > this.pageHeight - 20) {
        this.addPageBreak();
      }
      
      const text = typeof item === 'string' ? item : item.toString();
      this.doc.text(`• ${text}`, this.margin + 5, this.currentY);
      this.currentY += 6;
    });
  }

  private addTableContent(data: any[]): void {
    if (data.length === 0) return;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    const colWidth = (this.pageWidth - (this.margin * 2)) / headers.length;
    
    // Add table headers
    this.doc.setFont('helvetica', 'bold');
    headers.forEach((header, index) => {
      const x = this.margin + (index * colWidth);
      this.doc.text(header, x, this.currentY);
    });
    this.currentY += 8;
    
    // Add table rows
    this.doc.setFont('helvetica', 'normal');
    data.forEach((row) => {
      if (this.currentY > this.pageHeight - 20) {
        this.addPageBreak();
      }
      
      headers.forEach((header, colIndex) => {
        const x = this.margin + (colIndex * colWidth);
        const value = row[header]?.toString() || '';
        this.doc.text(value, x, this.currentY);
      });
      this.currentY += 6;
    });
  }

  private addMarkdownTable(tableMarkdown: string): void {
    const lines = tableMarkdown.split('\n');
    const tableRows: string[][] = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
        
        // Skip separator rows (containing only dashes and spaces)
        if (!cells.every(cell => /^[-:\s]+$/.test(cell))) {
          tableRows.push(cells);
        }
      }
    }
    
    if (tableRows.length === 0) return;
    
    const headers = tableRows[0];
    const dataRows = tableRows.slice(1);
    
    // Calculate column widths based on content length
    const colWidths = this.calculateColumnWidths(headers, dataRows);
    const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
    const availableWidth = this.pageWidth - 2 * this.margin;
    
    // Scale column widths if they exceed available width
    const scaleFactor = availableWidth / totalWidth;
    const scaledColWidths = colWidths.map(width => width * scaleFactor);
    
    // Add table border
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.5);
    
    // Add headers with background
    this.doc.setFillColor(240, 240, 240);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    
    let currentX = this.margin;
    headers.forEach((header, index) => {
      const cellWidth = scaledColWidths[index];
      const cellHeight = 8;
      
      // Draw header background
      this.doc.rect(currentX, this.currentY - 6, cellWidth, cellHeight, 'F');
      this.doc.rect(currentX, this.currentY - 6, cellWidth, cellHeight, 'S');
      
      // Add header text with word wrapping
      this.addWrappedText(header, currentX + 2, this.currentY - 1, cellWidth - 4, 6);
      currentX += cellWidth;
    });
    this.currentY += 8;
    
    // Add data rows
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    dataRows.slice(0, 20).forEach((row) => { // Limit to 20 rows
      if (this.currentY > this.pageHeight - 30) {
        this.addPageBreak();
      }
      
      currentX = this.margin;
      row.forEach((cell, index) => {
        const cellWidth = scaledColWidths[index];
        const cellHeight = 6;
        
        // Draw cell border
        this.doc.rect(currentX, this.currentY - 4, cellWidth, cellHeight, 'S');
        
        // Add cell text with word wrapping
        this.addWrappedText(cell, currentX + 2, this.currentY - 1, cellWidth - 4, 4);
        currentX += cellWidth;
      });
      this.currentY += 6;
    });
  }
  
  private calculateColumnWidths(headers: string[], dataRows: string[][]): number[] {
    const colCount = headers.length;
    const colWidths = new Array(colCount).fill(0);
    
    // Calculate width based on header text
    headers.forEach((header, index) => {
      colWidths[index] = Math.max(colWidths[index], header.length * 1.2);
    });
    
    // Calculate width based on data text
    dataRows.forEach(row => {
      row.forEach((cell, index) => {
        colWidths[index] = Math.max(colWidths[index], cell.length * 1.1);
      });
    });
    
    // Set minimum and maximum widths
    return colWidths.map(width => Math.max(15, Math.min(width, 50)));
  }
  
  private addWrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const testWidth = this.doc.getTextWidth(testLine);
      
      if (testWidth > maxWidth && line !== '') {
        this.doc.text(line, x, currentY);
        line = words[i] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      this.doc.text(line, x, currentY);
    }
  }

  private async addChartsSection(charts: GraphData[]): Promise<void> {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Graphiques', this.margin, this.currentY);
    this.currentY += 15;

    for (const chart of charts) {
      if (this.currentY > this.pageHeight - 100) {
        this.addPageBreak();
      }
      
      // Add chart title
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(chart.title, this.margin, this.currentY);
      this.currentY += 8;
      
      try {
        // Convert chart to high-resolution image with better dimensions
        const chartImage = await ChartToImage.chartToBase64(chart, 800, 500);
        
        // Add chart image to PDF with proper scaling and centering
        const imgWidth = 170; // PDF width
        const imgHeight = 120; // Increased height for better visibility
        const x = this.margin;
        const y = this.currentY;
        
        // Check if chart fits on current page
        if (this.currentY + imgHeight > this.pageHeight - 30) {
          this.addPageBreak();
        }
        
        this.doc.addImage(chartImage, 'PNG', x, y, imgWidth, imgHeight);
        this.currentY += imgHeight + 15;
        
        // Add chart info with better formatting
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100, 100, 100);
        this.doc.text(`Type: ${chart.type} | Données: ${chart.data.length} points`, this.margin, this.currentY);
        this.currentY += 20;
        this.doc.setTextColor(0, 0, 0);
        
      } catch (error) {
        console.error('Error rendering chart to image:', error);
        
        // Fallback to placeholder if image generation fails
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(120, 120, 120);
        this.doc.text(`[Graphique ${chart.type} - ${chart.data.length} points de données]`, this.margin, this.currentY);
        this.currentY += 40;
        this.doc.setTextColor(0, 0, 0);
      }
    }
  }

  private addFooter(generatedAt: Date): void {
    const pageCount = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Add generated date
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(120, 120, 120);
      this.doc.text(
        `Généré le ${generatedAt.toLocaleDateString('fr-FR')} à ${generatedAt.toLocaleTimeString('fr-FR')}`,
        this.margin,
        this.pageHeight + 10
      );
      
      // Add page number
      this.doc.text(
        `Page ${i} sur ${pageCount}`,
        this.pageWidth - this.margin - 20,
        this.pageHeight + 10
      );
    }
  }

  private addPageBreak(): void {
    this.doc.addPage();
    this.currentY = 20;
  }
}

// Utility function to generate PDF from PDFData
export const generatePDF = async (pdfData: PDFData): Promise<void> => {
  const generator = new PDFGenerator();
  await generator.generateReport(pdfData);
};
