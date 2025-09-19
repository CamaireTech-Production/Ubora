import { ChatMessage, GraphData, PDFData, PDFFileReference } from '../types';

export interface ParsedResponse {
  contentType: 'text' | 'graph' | 'pdf' | 'text-pdf' | 'table' | 'mixed' | 'multi-format';
  content: string;
  graphData?: GraphData;
  pdfData?: PDFData;
  tableData?: string; // Markdown table content
  pdfFiles?: PDFFileReference[]; // PDF files referenced in the response
  multiFormatData?: {
    graphData?: GraphData;
    tableData?: string;
    pdfContent?: string;
  };
}


export class ResponseParser {
  static parseAIResponse(response: string, _userMessage?: string, selectedFormat?: string | null, selectedFormats?: string[]): ParsedResponse {
    // Detect PDF file references in the response
    const pdfFiles = this.detectPDFFileReferences(response);
    
    
    // Handle multi-format responses
    if (selectedFormats && selectedFormats.length > 1) {
      const result = this.parseMultiFormatResponse(response, selectedFormats);
      return { ...result, pdfFiles };
    }

    // Handle format-specific responses based on selected format
    if (selectedFormat) {
      const result = this.parseFormatSpecificResponse(response, selectedFormat);
      return { ...result, pdfFiles };
    }

    // If no format is selected, try to auto-detect content type
    const autoDetectedResult = this.autoDetectContentType(response);
    return { ...autoDetectedResult, pdfFiles };
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
    
    // Try to detect PDF content
    const pdfResult = this.parsePDFResponse(response);
    if (pdfResult.contentType === 'text-pdf') {
      return pdfResult;
    }
    
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
      multiFormatData: hasAnyFormat ? multiFormatData : undefined
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
    
    // If still no match, try to find JSON object directly
    if (!jsonMatch) {
      jsonMatch = response.match(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/);
    }
    
    if (jsonMatch) {
      try {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        const jsonData = JSON.parse(jsonString);
        
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
        // Try to find and parse JSON more aggressively
        const jsonPattern = /\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g;
        let match;
        while ((match = jsonPattern.exec(response)) !== null) {
          try {
            const jsonData = JSON.parse(match[0]);
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
    
    // If no valid JSON, return as text with stats content type
    return {
      contentType: 'text',
      content: response
    };
  }

  private static enhanceGraphData(data: any): GraphData {
    // Ensure all required fields are present with defaults
    return {
      type: data.type || 'bar',
      title: data.title || 'Graphique des données',
      data: data.data || [],
      xAxisKey: data.xAxisKey || 'label',
      yAxisKey: data.yAxisKey || 'value',
      dataKey: data.dataKey || 'value',
      colors: data.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      options: {
        showLegend: data.options?.showLegend !== false
      }
    };
  }

  private static parsePDFResponse(response: string): ParsedResponse {
    // For PDF format, the response should be markdown content
    return {
      contentType: 'text-pdf',
      content: response
    };
  }

  private static parseTableResponse(response: string): ParsedResponse {
    // Extract markdown table from response
    const tableMatch = response.match(/```markdown\s*([\s\S]*?)\s*```/) || 
                      response.match(/(\|.*\|[\s\S]*?\|.*\|)/);
    
    if (tableMatch) {
      const tableContent = tableMatch[1] || tableMatch[0];
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
    return (
      data &&
      typeof data === 'object' &&
      data.type &&
      ['line', 'bar', 'pie', 'area', 'scatter'].includes(data.type) &&
      data.title &&
      Array.isArray(data.data)
    );
  }
  
  
  
  private static extractTextFromResponse(response: string): string {
    // Remove JSON code blocks and return the remaining text
    return response
      .replace(/```json\s*[\s\S]*?\s*```/g, '')
      .replace(/```json\s*[\s\S]*?(?=\n\n|\nExplication|$)/g, '')
      .replace(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g, '')
      .replace(/\{[\s\S]*\}/g, '')
      .trim();
  }

  private static extractTextFromTableResponse(response: string): string {
    // Remove markdown table code blocks and raw table syntax
    return response
      .replace(/```markdown\s*[\s\S]*?\s*```/g, '')
      .replace(/(\|.*\|[\s\S]*?\|.*\|)/g, '')
      .replace(/```\s*[\s\S]*?\s*```/g, '')
      .trim();
  }

  private static extractTextFromMultiFormatResponse(response: string): string {
    // Remove all code blocks and format-specific content
    return response
      .replace(/```json\s*[\s\S]*?\s*```/g, '')
      .replace(/```markdown\s*[\s\S]*?\s*```/g, '')
      .replace(/(\|.*\|[\s\S]*?\|.*\|)/g, '')
      .replace(/```\s*[\s\S]*?\s*```/g, '')
      .replace(/\{[\s\S]*\}/g, '')
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
    
    if (parsedResponse.graphData) {
      baseMessage.graphData = parsedResponse.graphData;
    }
    
    if (parsedResponse.pdfData) {
      baseMessage.pdfData = parsedResponse.pdfData;
    }
    
    if (parsedResponse.tableData) {
      baseMessage.tableData = parsedResponse.tableData;
    }
    
    if (parsedResponse.multiFormatData) {
      if (parsedResponse.multiFormatData.graphData) {
        baseMessage.graphData = parsedResponse.multiFormatData.graphData;
      }
      if (parsedResponse.multiFormatData.tableData) {
        baseMessage.tableData = parsedResponse.multiFormatData.tableData;
      }
      if (parsedResponse.multiFormatData.pdfContent) {
        baseMessage.content = parsedResponse.multiFormatData.pdfContent;
        baseMessage.contentType = 'text-pdf';
      }
    }
    
    if (parsedResponse.pdfFiles) {
      baseMessage.pdfFiles = parsedResponse.pdfFiles;
    }
    
    return baseMessage;
  }

  /**
   * Detect file references in AI responses
   * Looks for patterns like [FICHIER PDF: filename.pdf] or [FICHIER: filename.ext]
   */
  private static detectPDFFileReferences(response: string): PDFFileReference[] {
    console.log('🔍 ResponseParser received response:', response.substring(0, 200) + '...');
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
    console.log('🔍 Looking for metadata pattern in response...');
    while ((match = fileWithMetadataPattern.exec(response)) !== null) {
      const fileName = match[1].trim();
      const metadataString = match[2].trim();
      console.log('🔍 Found metadata pattern:', fileName, metadataString);
      
      try {
        const metadata = JSON.parse(metadataString);
        console.log('🔍 Parsed file metadata:', metadata);
        // Only add if not already added
        if (!pdfFiles.some(pdf => pdf.fileName === fileName)) {
          pdfFiles.push({
            fileName: metadata.fileName || fileName,
            fileType: metadata.fileType || 'application/octet-stream',
            fileSize: metadata.fileSize,
            downloadUrl: metadata.downloadUrl,
            storagePath: metadata.storagePath,
            extractedText: undefined
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
    
    
    console.log('🔍 Final detected files:', pdfFiles);
    return pdfFiles;
  }
}
