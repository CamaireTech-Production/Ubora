import { ChatMessage, GraphData, PDFData } from '../types';

export interface ParsedResponse {
  contentType: 'text' | 'graph' | 'pdf' | 'text-pdf' | 'table' | 'mixed' | 'multi-format';
  content: string;
  graphData?: GraphData;
  pdfData?: PDFData;
  tableData?: string; // Markdown table content
  multiFormatData?: {
    graphData?: GraphData;
    tableData?: string;
    pdfContent?: string;
  };
}

export class ResponseParser {
  static parseAIResponse(response: string, _userMessage?: string, selectedFormat?: string | null, selectedFormats?: string[]): ParsedResponse {
    // Handle multi-format responses
    if (selectedFormats && selectedFormats.length > 1) {
      return this.parseMultiFormatResponse(response, selectedFormats);
    }

    // Handle format-specific responses based on selected format
    if (selectedFormat) {
      return this.parseFormatSpecificResponse(response, selectedFormat);
    }

    // If no format is selected, return as simple text
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
    // Try to extract JSON graph data
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
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
    
    return baseMessage;
  }
}
