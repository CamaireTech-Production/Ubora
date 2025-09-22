import { ChatMessage, GraphData, PDFData, PDFFileReference } from '../types';

export interface ParsedResponse {
  contentType: 'text' | 'graph' | 'pdf' | 'text-pdf' | 'table' | 'mixed' | 'multi-format';
  content: string;
  graphData?: GraphData;
  pdfData?: PDFData;
  tableData?: string; // Markdown table content
  pdfFiles?: PDFFileReference[]; // PDF files referenced in the response
}


export class ResponseParser {
  static parseAIResponse(response: string, _userMessage?: string, selectedFormat?: string | null, selectedFormats?: string[]): ParsedResponse {
    
    // Enhanced PDF file detection - always detect if files are mentioned
    const shouldDetectPDFFiles = selectedFormat === 'pdf' || 
                                 (selectedFormats && selectedFormats.includes('pdf')) ||
                                 response.includes('[FICHIER:') ||
                                 response.includes('[FICHIER PDF:');
    const pdfFiles = shouldDetectPDFFiles ? this.detectPDFFileReferences(response) : [];
    
    // Enhanced format detection with better reasoning
    const enhancedResult = this.parseEnhancedResponse(response, selectedFormat, selectedFormats);
    
    // Clean up file references from content if not in PDF format
    if (enhancedResult.contentType !== 'pdf' && enhancedResult.contentType !== 'text-pdf') {
      enhancedResult.content = this.cleanFileReferencesFromText(enhancedResult.content);
    }
    
    
    return { ...enhancedResult, pdfFiles };
  }

  private static parseEnhancedResponse(response: string, selectedFormat?: string | null, selectedFormats?: string[]): ParsedResponse {
    // Handle multi-format responses with enhanced detection
    if (selectedFormats && selectedFormats.length > 1) {
      return this.parseMultiFormatResponse(response, selectedFormats);
    }

    // Handle format-specific responses with enhanced parsing
    if (selectedFormat) {
      return this.parseFormatSpecificResponse(response, selectedFormat);
    }

    // Enhanced auto-detection with better reasoning
    return this.autoDetectContentType(response);
  }

  private static autoDetectContentType(response: string): ParsedResponse {
    // Try to detect statistics/graph content
    const statsResult = this.parseStatsResponse(response);
    if (statsResult.contentType === 'graph') {
      return statsResult;
    }
    
    // Try to detect table content
    const tableResult = this.parseTableResponse(response);
    if (tableResult.contentType === 'table') {
      return tableResult;
    }
    
    // Don't auto-detect PDF content - only use PDF format when explicitly selected
    // Default to text
    return {
      contentType: 'text',
      content: response
    };
  }
  
  private static parseMultiFormatResponse(response: string, selectedFormats: string[]): ParsedResponse {
    const multiFormatData: any = {};
    let hasAnyFormat = false;

    // Parse each selected format
    if (selectedFormats.includes('stats')) {
      const statsResponse = this.parseStatsResponse(response);
      if (statsResponse.graphData) {
        multiFormatData.graphData = statsResponse.graphData;
        hasAnyFormat = true;
      }
    }

    if (selectedFormats.includes('table')) {
      const tableResponse = this.parseTableResponse(response);
      if (tableResponse.tableData) {
        multiFormatData.tableData = tableResponse.tableData;
        hasAnyFormat = true;
      }
    }

    if (selectedFormats.includes('pdf')) {
      const pdfResponse = this.parsePDFResponse(response);
      if (pdfResponse.content) {
        multiFormatData.pdfContent = pdfResponse.content;
        hasAnyFormat = true;
      }
    }

    return {
      contentType: hasAnyFormat ? 'multi-format' : 'text',
      content: this.extractTextFromMultiFormatResponse(response),
      graphData: multiFormatData.graphData,
      tableData: multiFormatData.tableData,
      pdfData: multiFormatData.pdfContent ? this.parsePDFContentForMultiFormat(multiFormatData.pdfContent, multiFormatData.graphData, multiFormatData.tableData) : undefined
    };
  }

  private static parseFormatSpecificResponse(response: string, selectedFormat: string): ParsedResponse {
    switch (selectedFormat) {
      case 'stats':
        return this.parseStatsResponse(response);
      case 'pdf':
        return this.parsePDFResponse(response);
      case 'table':
        return this.parseTableResponse(response);
      default:
        return {
          contentType: 'text',
          content: response
        };
    }
  }

  private static parseStatsResponse(response: string): ParsedResponse {
    // Try to extract JSON graph data with multiple patterns
    let jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    
    // If no match with closing ```, try without closing ```
    if (!jsonMatch) {
      jsonMatch = response.match(/```json\s*([\s\S]*?)(?=\n\n|\nExplication|$)/);
    }
    
    // If still no match, try to find JSON object directly with more flexible patterns
    if (!jsonMatch) {
      // Try to find JSON object with type field
      jsonMatch = response.match(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/);
    }
    
    // If still no match, try to find any JSON object that might be graph data
    if (!jsonMatch) {
      jsonMatch = response.match(/\{\s*"title"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/);
    }
    
    // If still no match, try to find JSON array with data
    if (!jsonMatch) {
      jsonMatch = response.match(/\{\s*"data"\s*:\s*\[[\s\S]*?\]\s*[,\s\S]*?\}/);
    }
    
    if (jsonMatch) {
      try {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        const repairedJsonString = this.repairJsonString(jsonString);
        const jsonData = JSON.parse(repairedJsonString);
        
        if (this.isGraphData(jsonData)) {
          // Ensure the graph data has proper structure
          const enhancedGraphData = this.enhanceGraphData(jsonData);
          return {
            contentType: 'graph',
            content: this.extractTextFromResponse(response),
            graphData: enhancedGraphData
          };
        }
      } catch (error) {
        console.error('Error parsing stats JSON:', error);
        // Try to find and parse JSON more aggressively with multiple patterns
        const jsonPatterns = [
          /\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g,
          /\{\s*"title"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g,
          /\{\s*"data"\s*:\s*\[[\s\S]*?\]\s*[,\s\S]*?\}/g
        ];
        
        for (const pattern of jsonPatterns) {
          let match;
          while ((match = pattern.exec(response)) !== null) {
            try {
              const repairedJsonString = this.repairJsonString(match[0]);
              const jsonData = JSON.parse(repairedJsonString);
              if (this.isGraphData(jsonData)) {
                const enhancedGraphData = this.enhanceGraphData(jsonData);
                return {
                  contentType: 'graph',
                  content: this.extractTextFromResponse(response),
                  graphData: enhancedGraphData
                };
              }
            } catch (parseError) {
              console.error('Error parsing JSON pattern:', parseError);
            }
          }
        }
      }
    }
    
    // If no valid JSON, return as text with stats content type
    return {
      contentType: 'text',
      content: response
    };
  }

  private static enhanceGraphData(data: any): GraphData {
    
    // Ensure data.data is always an array
    const dataArray = Array.isArray(data.data) ? data.data : [];
    
    // Enhanced graph data with new properties and better defaults
    const enhancedData: GraphData = {
      type: data.type || 'bar',
      title: data.title || 'Graphique des données',
      subtitle: data.subtitle || undefined,
      data: dataArray,
      xAxisKey: data.xAxisKey || 'label',
      yAxisKey: data.yAxisKey || 'value',
      dataKey: data.dataKey || 'value',
      colors: data.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      options: {
        showLegend: data.options?.showLegend !== false,
        showGrid: data.options?.showGrid !== false,
        showTooltip: data.options?.showTooltip !== false,
        animation: data.options?.animation !== false,
        ...data.options
      }
    };

    // Add insights and recommendations if available
    if (data.insights && Array.isArray(data.insights)) {
      enhancedData.insights = data.insights;
    }
    if (data.recommendations && Array.isArray(data.recommendations)) {
      enhancedData.recommendations = data.recommendations;
    }
    
    // Add metadata if available
    if (data.metadata && typeof data.metadata === 'object') {
      enhancedData.metadata = {
        totalEntries: data.metadata.totalEntries,
        chartType: data.metadata.chartType,
        dataSource: data.metadata.dataSource,
        generatedAt: data.metadata.generatedAt ? new Date(data.metadata.generatedAt) : new Date()
      };
    }

    return enhancedData;
  }

  private static parsePDFResponse(response: string): ParsedResponse {
    // For PDF format, the response should be markdown content
    return {
      contentType: 'text-pdf',
      content: response
    };
  }

  private static parseTableResponse(response: string): ParsedResponse {
    
    // Try multiple patterns to detect tables
    let tableMatch = null;
    let tableContent = '';
    
    // Pattern 1: Tables wrapped in markdown code blocks
    tableMatch = response.match(/```markdown\s*([\s\S]*?)\s*```/);
    if (tableMatch) {
      tableContent = tableMatch[1];
    }
    
    // Pattern 2: Direct markdown table (most common)
    if (!tableMatch) {
      tableMatch = response.match(/(\|[^|\n]*\|[\s\S]*?\|[^|\n]*\|)/);
      if (tableMatch) {
        tableContent = tableMatch[0];
      }
    }
    
    // Pattern 3: Table with TABLEAU prefix
    if (!tableMatch) {
      tableMatch = response.match(/(TABLEAU[^|]*\|[\s\S]*?\|.*\|)/i);
      if (tableMatch) {
        tableContent = tableMatch[0];
      }
    }
    
    // Pattern 4: Look for any table-like structure with pipes
    if (!tableMatch) {
      const lines = response.split('\n');
      let tableStart = -1;
      let tableEnd = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('|') && line.split('|').length >= 3) {
          if (tableStart === -1) {
            tableStart = i;
          }
          tableEnd = i;
        } else if (tableStart !== -1 && !line.includes('|')) {
          break;
        }
      }
      
      if (tableStart !== -1 && tableEnd !== -1) {
        tableContent = lines.slice(tableStart, tableEnd + 1).join('\n');
      }
    }
    
    if (tableContent) {
      
      // Check if table has data rows (not just headers)
      const lines = tableContent.trim().split('\n').filter(line => line.trim());
      const hasSeparator = lines.length > 1 && /^[\s\|\-\:]+$/.test(lines[1]);
      const dataLines = hasSeparator ? lines.slice(2) : lines.slice(1);
      
      if (dataLines.length === 0) {
        return {
          contentType: 'text',
          content: response
        };
      }
      
      return {
        contentType: 'table',
        content: this.extractTextFromTableResponse(response),
        tableData: tableContent
      };
    }
    
    // If no table found, return as text
    return {
      contentType: 'text',
      content: response
    };
  }


  private static isGraphData(data: any): boolean {
    // Basic validation
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Check if it has a valid chart type
    const validTypes = ['line', 'bar', 'pie', 'area', 'scatter'];
    if (!data.type || !validTypes.includes(data.type)) {
      return false;
    }
    
    // Check if it has a title (required)
    if (!data.title || typeof data.title !== 'string') {
      return false;
    }
    
    // Check if it has data array (required)
    if (!Array.isArray(data.data) || data.data.length === 0) {
      return false;
    }
    
    // Additional validation for data structure
    // At least one data point should have a value or be a valid data structure
    const hasValidData = data.data.some((item: any) => {
      if (typeof item === 'object' && item !== null) {
        // Check for common data keys
        return item.value !== undefined || 
               item.label !== undefined || 
               item.employee !== undefined || 
               item.date !== undefined ||
               item.submissions !== undefined ||
               Object.keys(item).length > 0;
      }
      return false;
    });
    
    return hasValidData;
  }
  
  
  
  private static extractTextFromResponse(response: string): string {
    // Remove JSON code blocks and return the remaining text
    return response
      .replace(/```json\s*[\s\S]*?\s*```/g, '')
      .replace(/```json\s*[\s\S]*?(?=\n\n|\nExplication|$)/g, '')
      .replace(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g, '')
      .replace(/\{[\s\S]*\}/g, '')
      // Remove file references with metadata
      .replace(/\[FICHIER:\s*[^\]]+\]\s*\[METADATA:\s*[^\]]+\]/gi, '')
      // Remove standalone file references
      .replace(/\[FICHIER:\s*[^\]]+\]/gi, '')
      .trim();
  }

  private static extractTextFromTableResponse(response: string): string {
    // Remove markdown table code blocks and raw table syntax
    let cleanedResponse = response
      .replace(/```markdown\s*[\s\S]*?\s*```/g, '')
      .replace(/(\|.*\|[\s\S]*?\|.*\|)/g, '')
      .replace(/```\s*[\s\S]*?\s*```/g, '')
      // Remove file references with metadata
      .replace(/\[FICHIER:\s*[^\]]+\]\s*\[METADATA:\s*[^\]]+\]/gi, '')
      // Remove standalone file references
      .replace(/\[FICHIER:\s*[^\]]+\]/gi, '')
      .trim();
    
    // Clean up any remaining table-related text
    cleanedResponse = cleanedResponse
      .replace(/TABLEAU[^|]*\|[\s\S]*?\|.*\|/gi, '')
      .replace(/^\s*[-=]+\s*$/gm, '') // Remove separator lines
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .trim();
    
    return cleanedResponse;
  }

  private static extractTextFromMultiFormatResponse(response: string): string {
    // Remove all code blocks and format-specific content
    return response
      .replace(/```json\s*[\s\S]*?\s*```/g, '')
      .replace(/```markdown\s*[\s\S]*?\s*```/g, '')
      .replace(/(\|.*\|[\s\S]*?\|.*\|)/g, '')
      .replace(/```\s*[\s\S]*?\s*```/g, '')
      .replace(/\{[\s\S]*\}/g, '')
      // Remove file references with metadata
      .replace(/\[FICHIER:\s*[^\]]+\]\s*\[METADATA:\s*[^\]]+\]/gi, '')
      // Remove standalone file references
      .replace(/\[FICHIER:\s*[^\]]+\]/gi, '')
      .trim();
  }

  /**
   * Clean file references from text content
   */
  private static cleanFileReferencesFromText(text: string): string {
    return text
      // Remove file references with metadata
      .replace(/\[FICHIER:\s*[^\]]+\]\s*\[METADATA:\s*[^\]]+\]/gi, '')
      // Remove standalone file references
      .replace(/\[FICHIER:\s*[^\]]+\]/gi, '')
      .trim();
  }
  
  static createMessageFromParsedResponse(
    parsedResponse: ParsedResponse,
    messageId: string,
    responseTime?: number,
    meta?: any
  ): ChatMessage {
    const baseMessage: ChatMessage = {
      id: messageId,
      type: 'assistant',
      content: parsedResponse.content,
      timestamp: new Date(),
      responseTime,
      contentType: parsedResponse.contentType,
      meta
    };
    
    // Multi-format data is now directly on the parsedResponse object
    if (parsedResponse.graphData) {
      baseMessage.graphData = parsedResponse.graphData;
    }
    if (parsedResponse.tableData) {
      baseMessage.tableData = parsedResponse.tableData;
    }
    if (parsedResponse.pdfData) {
      baseMessage.pdfData = parsedResponse.pdfData;
    }
    
    if (parsedResponse.pdfFiles) {
      baseMessage.pdfFiles = parsedResponse.pdfFiles;
    }
    
    return baseMessage;
  }

  /**
   * Parse PDF content for multi-format responses, properly structuring sections and charts
   */
  private static parsePDFContentForMultiFormat(pdfContent: string, graphData?: GraphData, tableData?: string): PDFData {
    const sections: any[] = [];
    const charts: GraphData[] = [];

    // Split content into sections based on markdown headers
    const lines = pdfContent.split('\n');
    let currentSection: any = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n');
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: line.replace('## ', '').trim(),
          content: ''
        };
        currentContent = [];
      } else if (line.startsWith('### ')) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n');
          sections.push(currentSection);
        }
        
        // Start new subsection
        currentSection = {
          title: line.replace('### ', '').trim(),
          content: ''
        };
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n');
      sections.push(currentSection);
    }

    // If no sections were created, create a default one
    if (sections.length === 0) {
      sections.push({
        title: 'Contenu',
        content: pdfContent
      });
    }

    // Add graph data if available
    if (graphData) {
      charts.push(graphData);
    }

    // Add table data as a section if available
    if (tableData) {
      sections.push({
        title: 'Données tabulaires',
        content: tableData,
        isMarkdownTable: true
      });
    }

    return {
      title: 'Rapport d\'analyse',
      subtitle: 'Généré automatiquement',
      sections,
      charts,
      generatedAt: new Date()
    };
  }

  /**
   * Detect file references in AI responses
   * Looks for patterns like [FICHIER PDF: filename.pdf] or [FICHIER: filename.ext]
   */
  private static detectPDFFileReferences(response: string): PDFFileReference[] {
    const pdfFiles: PDFFileReference[] = [];
    
    
    // Pattern 1: [FICHIER PDF: filename.pdf]
    const pdfPattern1 = /\[FICHIER PDF:\s*([^\]]+\.pdf)\]/gi;
    let match;
    
    while ((match = pdfPattern1.exec(response)) !== null) {
      const fileName = match[1].trim();
      pdfFiles.push({
        fileName,
        fileType: 'application/pdf',
        fileSize: undefined,
        downloadUrl: undefined,
        storagePath: undefined,
        extractedText: undefined
      });
    }
    
    // Pattern 2: [FICHIER: filename.ext] [METADATA: {...}] (with metadata)
    const fileWithMetadataPattern = /\[FICHIER:\s*([^\]]+\.[a-zA-Z0-9]+)\]\s*\[METADATA:\s*([^\]]+)\]/gi;
    while ((match = fileWithMetadataPattern.exec(response)) !== null) {
      const fileName = match[1].trim();
      const metadataString = match[2].trim();
      
      try {
        const metadata = JSON.parse(metadataString);
        
        // Only add if not already added
        if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
          pdfFiles.push({
            fileName: metadata.fileName || fileName,
            fileType: metadata.fileType || 'application/octet-stream',
            fileSize: metadata.fileSize,
            downloadUrl: metadata.downloadUrl,
            storagePath: metadata.storagePath,
            extractedText: metadata.extractedText
          });
        }
      } catch (error) {
        console.warn('Failed to parse file metadata:', metadataString, error);
        // Fallback to basic file detection
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        let fileType = 'application/octet-stream';
        if (fileExtension === 'pdf') fileType = 'application/pdf';
        else if (fileExtension === 'doc' || fileExtension === 'docx') fileType = 'application/msword';
        else if (fileExtension === 'xls' || fileExtension === 'xlsx') fileType = 'application/vnd.ms-excel';
        else if (fileExtension === 'ppt' || fileExtension === 'pptx') fileType = 'application/vnd.ms-powerpoint';
        else if (fileExtension === 'txt') fileType = 'text/plain';
        else if (fileExtension === 'jpg' || fileExtension === 'jpeg') fileType = 'image/jpeg';
        else if (fileExtension === 'png') fileType = 'image/png';
        else if (fileExtension === 'gif') fileType = 'image/gif';
        else if (fileExtension === 'zip') fileType = 'application/zip';
        else if (fileExtension === 'rar') fileType = 'application/x-rar-compressed';
        
        if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
          pdfFiles.push({
            fileName,
            fileType,
            fileSize: undefined,
            downloadUrl: undefined,
            storagePath: undefined,
            extractedText: undefined
          });
        }
      }
    }
    
    // Pattern 3: [FICHIER: filename.ext] (without metadata - fallback)
    const filePattern = /\[FICHIER:\s*([^\]]+\.[a-zA-Z0-9]+)\](?!\s*\[METADATA:)/gi;
    while ((match = filePattern.exec(response)) !== null) {
      const fileName = match[1].trim();
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      
      // Determine file type based on extension
      let fileType = 'application/octet-stream'; // default
      if (fileExtension === 'pdf') fileType = 'application/pdf';
      else if (fileExtension === 'doc' || fileExtension === 'docx') fileType = 'application/msword';
      else if (fileExtension === 'xls' || fileExtension === 'xlsx') fileType = 'application/vnd.ms-excel';
      else if (fileExtension === 'ppt' || fileExtension === 'pptx') fileType = 'application/vnd.ms-powerpoint';
      else if (fileExtension === 'txt') fileType = 'text/plain';
      else if (fileExtension === 'jpg' || fileExtension === 'jpeg') fileType = 'image/jpeg';
      else if (fileExtension === 'png') fileType = 'image/png';
      else if (fileExtension === 'gif') fileType = 'image/gif';
      else if (fileExtension === 'zip') fileType = 'application/zip';
      else if (fileExtension === 'rar') fileType = 'application/x-rar-compressed';
      
      // Only add if not already added by previous patterns
      if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
        pdfFiles.push({
          fileName,
          fileType,
          fileSize: undefined,
          downloadUrl: undefined,
          storagePath: undefined,
          extractedText: undefined
        });
      }
    }
    
    // Pattern 4: Look for PDF content sections with file size info
    const pdfContentPattern = /📄 CONTENU PDF "([^"]+\.pdf)" \(([^)]+)\):/gi;
    while ((match = pdfContentPattern.exec(response)) !== null) {
      const fileName = match[1].trim();
      const sizeInfo = match[2].trim();
      
      // Parse file size if available
      let fileSize: number | undefined;
      if (sizeInfo.includes('KB')) {
        const sizeMatch = sizeInfo.match(/(\d+(?:\.\d+)?)\s*KB/);
        if (sizeMatch) {
          fileSize = parseFloat(sizeMatch[1]) * 1024; // Convert KB to bytes
        }
      }
      
      // Only add if not already added
      if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
        pdfFiles.push({
          fileName,
          fileType: 'application/pdf',
          fileSize,
          downloadUrl: undefined,
          storagePath: undefined,
          extractedText: undefined
        });
      }
    }
    
    // Pattern 5: Look for PDF content sections without size info
    const pdfContentPattern2 = /📄 CONTENU PDF "([^"]+\.pdf)":/gi;
    while ((match = pdfContentPattern2.exec(response)) !== null) {
      const fileName = match[1].trim();
      // Only add if not already added
      if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
        pdfFiles.push({
          fileName,
          fileType: 'application/pdf',
          fileSize: undefined,
          downloadUrl: undefined,
          storagePath: undefined,
          extractedText: undefined
        });
      }
    }
    
    // Pattern 6: Look for other file content sections
    const fileContentPattern = /📎 CONTENU FICHIER "([^"]+\.[a-zA-Z0-9]+)" \(([^)]+)\) - Champ: ([^:]+):/gi;
    while ((match = fileContentPattern.exec(response)) !== null) {
      const fileName = match[1].trim();
      const sizeInfo = match[2].trim();
      const fieldLabel = match[3].trim();
      
      // Parse file size if available
      let fileSize: number | undefined;
      if (sizeInfo.includes('KB')) {
        const sizeMatch = sizeInfo.match(/(\d+(?:\.\d+)?)\s*KB/);
        if (sizeMatch) {
          fileSize = parseFloat(sizeMatch[1]) * 1024; // Convert KB to bytes
        }
      }
      
      // Determine file type based on extension
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      let fileType = 'application/octet-stream';
      if (fileExtension === 'pdf') fileType = 'application/pdf';
      else if (fileExtension === 'doc' || fileExtension === 'docx') fileType = 'application/msword';
      else if (fileExtension === 'xls' || fileExtension === 'xlsx') fileType = 'application/vnd.ms-excel';
      else if (fileExtension === 'ppt' || fileExtension === 'pptx') fileType = 'application/vnd.ms-powerpoint';
      else if (fileExtension === 'txt') fileType = 'text/plain';
      else if (fileExtension === 'jpg' || fileExtension === 'jpeg') fileType = 'image/jpeg';
      else if (fileExtension === 'png') fileType = 'image/png';
      else if (fileExtension === 'gif') fileType = 'image/gif';
      else if (fileExtension === 'zip') fileType = 'application/zip';
      else if (fileExtension === 'rar') fileType = 'application/x-rar-compressed';
      
      // Only add if not already added
      if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
        pdfFiles.push({
          fileName,
          fileType,
          fileSize,
          downloadUrl: undefined,
          storagePath: undefined,
          extractedText: undefined,
          fieldId: fieldLabel // Store the field label for reference
        });
      }
    }
    
    // Pattern 7: Look for explicit file references
    const fileReferencePattern = /RÉFÉRENCE FICHIER:\s*\[FICHIER:\s*([^\]]+\.[a-zA-Z0-9]+)\]/gi;
    while ((match = fileReferencePattern.exec(response)) !== null) {
      const fileName = match[1].trim();
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      
      // Determine file type based on extension
      let fileType = 'application/octet-stream';
      if (fileExtension === 'pdf') fileType = 'application/pdf';
      else if (fileExtension === 'doc' || fileExtension === 'docx') fileType = 'application/msword';
      else if (fileExtension === 'xls' || fileExtension === 'xlsx') fileType = 'application/vnd.ms-excel';
      else if (fileExtension === 'ppt' || fileExtension === 'pptx') fileType = 'application/vnd.ms-powerpoint';
      else if (fileExtension === 'txt') fileType = 'text/plain';
      else if (fileExtension === 'jpg' || fileExtension === 'jpeg') fileType = 'image/jpeg';
      else if (fileExtension === 'png') fileType = 'image/png';
      else if (fileExtension === 'gif') fileType = 'image/gif';
      else if (fileExtension === 'zip') fileType = 'application/zip';
      else if (fileExtension === 'rar') fileType = 'application/x-rar-compressed';
      
      // Only add if not already added
      if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
        pdfFiles.push({
          fileName,
          fileType,
          fileSize: undefined,
          downloadUrl: undefined,
          storagePath: undefined,
          extractedText: undefined
        });
      }
    }
    
    // Pattern 8: Look for file content sections without field label (fallback)
    const fileContentPatternFallback = /📎 CONTENU FICHIER "([^"]+\.[a-zA-Z0-9]+)" \(([^)]+)\):/gi;
    while ((match = fileContentPatternFallback.exec(response)) !== null) {
      const fileName = match[1].trim();
      const sizeInfo = match[2].trim();
      
      // Parse file size if available
      let fileSize: number | undefined;
      if (sizeInfo.includes('KB')) {
        const sizeMatch = sizeInfo.match(/(\d+(?:\.\d+)?)\s*KB/);
        if (sizeMatch) {
          fileSize = parseFloat(sizeMatch[1]) * 1024; // Convert KB to bytes
        }
      }
      
      // Determine file type based on extension
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      let fileType = 'application/octet-stream';
      if (fileExtension === 'pdf') fileType = 'application/pdf';
      else if (fileExtension === 'doc' || fileExtension === 'docx') fileType = 'application/msword';
      else if (fileExtension === 'xls' || fileExtension === 'xlsx') fileType = 'application/vnd.ms-excel';
      else if (fileExtension === 'ppt' || fileExtension === 'pptx') fileType = 'application/vnd.ms-powerpoint';
      else if (fileExtension === 'txt') fileType = 'text/plain';
      else if (fileExtension === 'jpg' || fileExtension === 'jpeg') fileType = 'image/jpeg';
      else if (fileExtension === 'png') fileType = 'image/png';
      else if (fileExtension === 'gif') fileType = 'image/gif';
      else if (fileExtension === 'zip') fileType = 'application/zip';
      else if (fileExtension === 'rar') fileType = 'application/x-rar-compressed';
      
      // Only add if not already added
      if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
        pdfFiles.push({
          fileName,
          fileType,
          fileSize,
          downloadUrl: undefined,
          storagePath: undefined,
          extractedText: undefined
        });
      }
    }
    
    
    
    return pdfFiles;
  }

  /**
   * Repair common JSON syntax errors in AI-generated JSON
   */
  private static repairJsonString(jsonString: string): string {
    let repaired = jsonString.trim();
    
    // Remove any leading/trailing whitespace and ensure it starts with {
    if (!repaired.startsWith('{')) {
      repaired = '{' + repaired;
    }
    if (!repaired.endsWith('}')) {
      repaired = repaired + '}';
    }
    
    // Fix missing array brackets for data
    repaired = repaired.replace(/"data"\s*:\s*([^[\]]+?)(?=,|\s*"|$)/g, (match, dataContent) => {
      // Check if dataContent is already an array
      if (dataContent.trim().startsWith('[') && dataContent.trim().endsWith(']')) {
        return match;
      }
      
      // Wrap individual objects in array brackets
      const objects = dataContent.split('},{').map((obj: string, index: number) => {
        let cleanObj = obj.trim();
        if (index === 0 && !cleanObj.startsWith('{')) {
          cleanObj = '{' + cleanObj;
        }
        if (index === objects.length - 1 && !cleanObj.endsWith('}')) {
          cleanObj = cleanObj + '}';
        }
        return cleanObj;
      });
      
      return `"data": [${objects.join(', ')}]`;
    });
    
    // Fix missing array brackets for colors
    repaired = repaired.replace(/"colors"\s*:\s*([^[\]]+?)(?=,|\s*"|$)/g, (match, colorsContent) => {
      if (colorsContent.trim().startsWith('[') && colorsContent.trim().endsWith(']')) {
        return match;
      }
      
      // Split by comma and wrap in array brackets
      const colors = colorsContent.split(',').map((color: string) => color.trim()).filter((color: string) => color);
      return `"colors": [${colors.join(', ')}]`;
    });
    
    // Fix missing array brackets for insights
    repaired = repaired.replace(/"insights"\s*:\s*([^[\]]+?)(?=,|\s*"|$)/g, (match, insightsContent) => {
      if (insightsContent.trim().startsWith('[') && insightsContent.trim().endsWith(']')) {
        return match;
      }
      
      // Split by comma and wrap in array brackets, ensuring proper string quotes
      const insights = insightsContent.split(',').map((insight: string) => {
        let cleanInsight = insight.trim();
        if (!cleanInsight.startsWith('"')) {
          cleanInsight = '"' + cleanInsight;
        }
        if (!cleanInsight.endsWith('"')) {
          cleanInsight = cleanInsight + '"';
        }
        return cleanInsight;
      }).filter((insight: string) => insight.length > 2);
      
      return `"insights": [${insights.join(', ')}]`;
    });
    
    // Fix missing array brackets for recommendations
    repaired = repaired.replace(/"recommendations"\s*:\s*([^[\]]+?)(?=,|\s*"|$)/g, (match, recommendationsContent) => {
      if (recommendationsContent.trim().startsWith('[') && recommendationsContent.trim().endsWith(']')) {
        return match;
      }
      
      // Split by comma and wrap in array brackets, ensuring proper string quotes
      const recommendations = recommendationsContent.split(',').map((recommendation: string) => {
        let cleanRecommendation = recommendation.trim();
        if (!cleanRecommendation.startsWith('"')) {
          cleanRecommendation = '"' + cleanRecommendation;
        }
        if (!cleanRecommendation.endsWith('"')) {
          cleanRecommendation = cleanRecommendation + '"';
        }
        return cleanRecommendation;
      }).filter((recommendation: string) => recommendation.length > 2);
      
      return `"recommendations": [${recommendations.join(', ')}]`;
    });
    
    // Remove trailing commas before closing braces/brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix any remaining syntax issues
    repaired = repaired.replace(/,(\s*[,}])/g, '$1'); // Remove double commas
    
    // Fix common typos in JSON
    repaired = repaired.replace(/"datakev"/g, '"dataKey"');
    repaired = repaired.replace(/"xAxisKey"/g, '"xAxisKey"');
    repaired = repaired.replace(/"yAxisKey"/g, '"yAxisKey"');
    
    return repaired;
  }
}
