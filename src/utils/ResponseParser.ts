import { ChatMessage, GraphData, PDFData } from '../types';

export interface ParsedResponse {
  contentType: 'text' | 'graph' | 'pdf' | 'text-pdf' | 'mixed';
  content: string;
  graphData?: GraphData;
  pdfData?: PDFData;
}

export class ResponseParser {
  static parseAIResponse(response: string): ParsedResponse {
    // Check if this is a PDF report request (contains report keywords)
    if (this.isPDFReportRequest(response)) {
      return {
        contentType: 'text-pdf',
        content: response
      };
    }

    // Try to detect JSON data in the response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        
        // Check if it's graph data
        if (this.isGraphData(jsonData)) {
          return {
            contentType: 'graph',
            content: this.extractTextFromResponse(response),
            graphData: jsonData as GraphData
          };
        }
        
        // Check if it's PDF data
        if (this.isPDFData(jsonData)) {
          return {
            contentType: 'pdf',
            content: this.extractTextFromResponse(response),
            pdfData: jsonData as PDFData
          };
        }
        
        // Check if it's mixed content
        if (this.isMixedData(jsonData)) {
          return {
            contentType: 'mixed',
            content: this.extractTextFromResponse(response),
            graphData: jsonData.graphData,
            pdfData: jsonData.pdfData
          };
        }
      } catch (error) {
        console.error('Error parsing JSON from AI response:', error);
      }
    }
    
    // Check for inline JSON (without code blocks)
    const inlineJsonMatch = response.match(/\{[\s\S]*\}/);
    if (inlineJsonMatch) {
      try {
        const jsonData = JSON.parse(inlineJsonMatch[0]);
        
        if (this.isGraphData(jsonData)) {
          return {
            contentType: 'graph',
            content: this.extractTextFromResponse(response),
            graphData: jsonData as GraphData
          };
        }
        
        if (this.isPDFData(jsonData)) {
          return {
            contentType: 'pdf',
            content: this.extractTextFromResponse(response),
            pdfData: jsonData as PDFData
          };
        }
      } catch (error) {
        // Not valid JSON, continue with text parsing
      }
    }
    
    // Default to text content
    return {
      contentType: 'text',
      content: response
    };
  }
  
  private static isPDFReportRequest(response: string): boolean {
    const pdfKeywords = [
      'rapport', 'report', 'pdf', 'synthèse', 'résumé', 'complet', 
      'détaillé', 'analyse', 'document', 'génère un rapport'
    ];
    const lowerResponse = response.toLowerCase();
    return pdfKeywords.some(keyword => lowerResponse.includes(keyword)) && 
           !response.includes('```json') && 
           response.length > 200; // Long enough to be a report
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
  
  private static isPDFData(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      data.title &&
      Array.isArray(data.sections) &&
      data.sections.length > 0 &&
      data.generatedAt
    );
  }
  
  private static isMixedData(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      (data.graphData || data.pdfData) &&
      (this.isGraphData(data.graphData) || this.isPDFData(data.pdfData))
    );
  }
  
  private static extractTextFromResponse(response: string): string {
    // Remove JSON code blocks and return the remaining text
    return response
      .replace(/```json\s*[\s\S]*?\s*```/g, '')
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
    
    return baseMessage;
  }
}
