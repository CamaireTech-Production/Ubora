import React from 'react';
import { User, Clock } from 'lucide-react';
import { GraphRenderer } from './GraphRenderer';
import { PDFPreview, TextPDFPreview } from './PDFPreview';
import { TableRenderer } from './TableRenderer';
import { ChatMessage } from '../../types';
import { MultiFormatToPDF } from '../../utils/MultiFormatToPDF';
import { generatePDF } from '../../utils/PDFGenerator';

interface MessageBubbleProps {
  message: ChatMessage;
}

// Function to repair common JSON syntax errors
// Removed repairJsonString function - AI now returns correct format directly

// Function to detect and parse JSON content
const parseJsonInContent = (content: string, isStatsTableFormat: boolean = false): any | null => {
  if (!content) return null;
  
  // 🔍 DEBUG: Enhanced logging for stats + table format
  
  // Try to find JSON blocks in the content
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    
    try {
      const jsonString = jsonMatch[1].trim();
      console.log('🔍 FRONTEND DEBUG - Raw JSON string:', jsonString);
      console.log('🔍 FRONTEND DEBUG - JSON string length:', jsonString.length);
      console.log('🔍 FRONTEND DEBUG - JSON string first 100 chars:', jsonString.substring(0, 100));
      console.log('🔍 FRONTEND DEBUG - JSON string last 100 chars:', jsonString.substring(Math.max(0, jsonString.length - 100)));
      
      const jsonData = JSON.parse(jsonString);
      console.log('🔍 FRONTEND DEBUG - Parsed JSON data:', jsonData);
      console.log('JSON type:', typeof jsonData);
      console.log('Has type property:', 'type' in jsonData);
      console.log('Has data property:', 'data' in jsonData);
      console.log('Data is array:', Array.isArray(jsonData.data));
      console.log('Data length:', jsonData.data ? jsonData.data.length : 'N/A');
      console.log('Data content:', jsonData.data);
      console.log('Type value:', jsonData.type);
      console.log('Title value:', jsonData.title);
      console.log('xAxisKey value:', jsonData.xAxisKey);
      console.log('yAxisKey value:', jsonData.yAxisKey);
      console.log('dataKey value:', jsonData.dataKey);
      
      // Check if it's valid graph data
      if (jsonData && typeof jsonData === 'object' && jsonData.type && jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
        if (isStatsTableFormat) {
          console.log('✅ STATS+TABLE DEBUG - Valid graph data found');
          console.log('📊 Graph type:', jsonData.type);
          console.log('📊 Graph title:', jsonData.title);
          console.log('📊 Data points:', jsonData.data.length);
          console.log('✅ STATS+TABLE DEBUG - Returning valid graph data to GraphRenderer');
        } else {
          console.log('✅ FRONTEND DEBUG - Valid graph data found');
          console.log('✅ FRONTEND DEBUG - Returning valid graph data to GraphRenderer');
        }
        return jsonData;
      } else {
        console.log('❌ FRONTEND DEBUG - Invalid graph data structure');
        console.log('❌ FRONTEND DEBUG - Missing properties:', {
          hasType: !!jsonData.type,
          hasData: !!jsonData.data,
          dataIsArray: Array.isArray(jsonData.data),
          dataLength: jsonData.data ? jsonData.data.length : 0
        });
        
        // Try to create a fallback with sample data if the structure is mostly correct
        if (jsonData && typeof jsonData === 'object' && jsonData.type) {
          console.log('🔧 FRONTEND DEBUG - Attempting to create fallback graph data');
          const fallbackData = {
            type: jsonData.type,
            title: jsonData.title || 'Graphique',
            subtitle: jsonData.subtitle,
            data: jsonData.data && Array.isArray(jsonData.data) ? jsonData.data : [
              { x: 'Donnée 1', y: 10 },
              { x: 'Donnée 2', y: 20 }
            ],
            xAxisKey: jsonData.xAxisKey || 'x',
            yAxisKey: jsonData.yAxisKey || 'y',
            dataKey: jsonData.dataKey || 'y',
            colors: jsonData.colors || ['#3B82F6', '#10B981', '#F59E0B'],
            options: jsonData.options || { showLegend: true, showGrid: true, showTooltip: true },
            insights: jsonData.insights || [],
            recommendations: jsonData.recommendations || []
          };
          console.log('🔧 FRONTEND DEBUG - Created fallback data:', fallbackData);
          return fallbackData;
        }
      }
    } catch (error) {
      console.error('❌ FRONTEND DEBUG - Error parsing JSON in content:', error);
      console.error('❌ FRONTEND DEBUG - JSON string that failed:', jsonMatch[1]);
      console.error('❌ FRONTEND DEBUG - Error details:', (error as Error).message);
      return null; // Return null instead of showing raw JSON
    }
  }
  
  // Try to find JSON object directly (more robust pattern)
  const directJsonMatch = content.match(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}(?=\s*(?:\n|$|\s*###|\s*##|\s*#|\s*\|))/);
  if (directJsonMatch) {
    console.log('🔍 FRONTEND DEBUG - Found direct JSON in content');
    console.log('=====================================');
    console.log('Direct JSON String:', directJsonMatch[0]);
    console.log('=====================================');
    
    try {
      const jsonString = directJsonMatch[0].trim();
      console.log('🔍 FRONTEND DEBUG - Direct JSON string:', jsonString);
      console.log('🔍 FRONTEND DEBUG - Direct JSON string length:', jsonString.length);
      console.log('🔍 FRONTEND DEBUG - Direct JSON string first 100 chars:', jsonString.substring(0, 100));
      console.log('🔍 FRONTEND DEBUG - Direct JSON string last 100 chars:', jsonString.substring(Math.max(0, jsonString.length - 100)));
      
      const jsonData = JSON.parse(jsonString);
      console.log('🔍 FRONTEND DEBUG - Parsed direct JSON data:', jsonData);
      
      if (jsonData && typeof jsonData === 'object' && jsonData.type && jsonData.data) {
        console.log('✅ FRONTEND DEBUG - Valid direct graph data found');
        return jsonData;
      } else {
        console.log('❌ FRONTEND DEBUG - Invalid direct graph data structure');
      }
    } catch (error) {
      console.error('❌ FRONTEND DEBUG - Error parsing direct JSON in content:', error);
      console.error('❌ FRONTEND DEBUG - Direct JSON string that failed:', directJsonMatch[0]);
      console.error('❌ FRONTEND DEBUG - Error details:', (error as Error).message);
      return null; // Return null instead of showing raw JSON
    }
  }
  
  console.log('❌ FRONTEND DEBUG - No JSON found in content');
  return null;
};

// Function to format AI message content with markdown support
const formatMessageContent = (content: string, messageMeta?: any): React.ReactNode => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  // Determine if this is a stats + table combination
  const isStatsTableFormat = messageMeta?.selectedFormats?.includes('stats') && 
                            messageMeta?.selectedFormats?.includes('table') &&
                            messageMeta?.selectedFormats?.length === 2;

  // 🔍 DEBUG: Enhanced logging for stats + table format
  if (isStatsTableFormat) {
    console.log('🎯 STATS+TABLE DEBUG - Processing stats and table combination:');
    console.log('=====================================');
    console.log('📊 Selected formats:', messageMeta?.selectedFormats);
    console.log('📋 Content length:', content.length);
    console.log('📄 Content preview:', content.substring(0, 300) + '...');
    console.log('🔍 Looking for JSON blocks and markdown tables...');
    console.log('=====================================');
  } else {
    console.log('🔍 FRONTEND DEBUG - MessageBubble processing content:');
    console.log('=====================================');
    console.log('Content length:', content.length);
    console.log('Content preview:', content.substring(0, 200) + '...');
    console.log('=====================================');
  }
  
  while (currentIndex < lines.length) {
    // Check for JSON blocks first
    const jsonMatch = content.substring(currentIndex).match(/```json\s*([\s\S]*?)\s*```/);
    const directJsonMatch = content.substring(currentIndex).match(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}(?=\s*(?:\n|$|\s*###|\s*##|\s*#|\s*\|))/);
    
    // Enhanced logging for stats + table format
    if (isStatsTableFormat) {
      if (jsonMatch) {
        console.log('🎯 STATS+TABLE DEBUG - Found JSON block at position:', currentIndex);
        console.log('📊 JSON block length:', jsonMatch[0].length);
      }
      if (directJsonMatch) {
        console.log('🎯 STATS+TABLE DEBUG - Found direct JSON at position:', currentIndex);
        console.log('📊 Direct JSON length:', directJsonMatch[0].length);
      }
    }
    
    // Check for markdown tables
    let tableStart = -1;
    let tableEnd = -1;
    
    for (let i = currentIndex; i < lines.length; i++) {
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
    
    // Enhanced logging for table detection
    if (isStatsTableFormat && tableStart !== -1) {
      console.log('🎯 STATS+TABLE DEBUG - Found markdown table at lines:', tableStart, 'to', tableEnd);
      console.log('📋 Table lines count:', tableEnd - tableStart + 1);
    }
    
    // Determine which comes first: JSON or table
    let jsonIndex = -1;
    let tableIndex = -1;
    
    if (jsonMatch) {
      jsonIndex = currentIndex + content.substring(currentIndex).indexOf(jsonMatch[0]);
    }
    if (directJsonMatch) {
      const directJsonIndex = currentIndex + content.substring(currentIndex).indexOf(directJsonMatch[0]);
      if (jsonIndex === -1 || directJsonIndex < jsonIndex) {
        jsonIndex = directJsonIndex;
      }
    }
    if (tableStart !== -1) {
      tableIndex = tableStart;
    }
    
    // Process the element that comes first
    if (jsonIndex !== -1 && (tableIndex === -1 || jsonIndex < tableIndex)) {
      // Process JSON - show text before JSON but hide the JSON itself
      const beforeJson = content.substring(currentIndex, jsonIndex).trim();
      if (beforeJson) {
        if (isStatsTableFormat) {
          console.log('🎯 STATS+TABLE DEBUG - Processing text before JSON block');
          console.log('📄 Text length:', beforeJson.length);
        }
        elements.push(<div key={`text-${currentIndex}`} className="mb-4">{formatTextContent(beforeJson)}</div>);
      }
      
      if (isStatsTableFormat) {
        console.log('🎯 STATS+TABLE DEBUG - Attempting to parse JSON for graph rendering');
        console.log('📊 JSON content length:', content.substring(jsonIndex).length);
      }
      
      const jsonData = parseJsonInContent(content.substring(jsonIndex), isStatsTableFormat);
      if (jsonData) {
        // Only show the graph, not the raw JSON
        if (isStatsTableFormat) {
          console.log('✅ STATS+TABLE DEBUG - Successfully parsed JSON, rendering graph');
          console.log('📊 Graph type:', jsonData.type);
          console.log('📊 Graph title:', jsonData.title);
          console.log('📊 Data points count:', jsonData.data?.length || 0);
        } else {
          console.log('✅ FRONTEND DEBUG - Rendering graph from JSON');
        }
        elements.push(
          <div key={`graph-${currentIndex}`} className="mb-4">
            <GraphRenderer data={jsonData} />
          </div>
        );
      } else {
        // JSON parsing failed, show a user-friendly message instead of raw JSON
        if (isStatsTableFormat) {
          console.log('❌ STATS+TABLE DEBUG - JSON parsing failed for stats graph');
          console.log('📊 JSON content that failed to parse:', content.substring(jsonIndex, jsonIndex + 500));
        } else {
          console.log('❌ FRONTEND DEBUG - JSON parsing failed, showing error message');
          console.log('❌ FRONTEND DEBUG - JSON content that failed to parse:', content.substring(jsonIndex, jsonIndex + 500));
        }
        elements.push(
          <div key={`error-${currentIndex}`} className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-yellow-600 mr-2">⚠️</div>
              <div className="text-sm text-yellow-800">
                Format de données invalide - Impossible d'afficher le graphique
              </div>
            </div>
            <div className="text-xs text-yellow-600 mt-2">
              Vérifiez la console pour plus de détails sur l'erreur
            </div>
          </div>
        );
      }
      
      // Move to after JSON - skip the JSON content completely
      if (jsonMatch) {
        currentIndex = jsonIndex + jsonMatch[0].length;
      } else if (directJsonMatch) {
        currentIndex = jsonIndex + directJsonMatch[0].length;
      }
    } else if (tableIndex !== -1) {
      // Process table
      const beforeTable = lines.slice(currentIndex, tableIndex).join('\n').trim();
      if (beforeTable) {
        if (isStatsTableFormat) {
          console.log('🎯 STATS+TABLE DEBUG - Processing text before table');
          console.log('📄 Text length:', beforeTable.length);
        }
        elements.push(<div key={`text-${currentIndex}`} className="mb-4">{formatTextContent(beforeTable)}</div>);
      }
      
      const tableContent = lines.slice(tableStart, tableEnd + 1).join('\n');
      if (isStatsTableFormat) {
        console.log('✅ STATS+TABLE DEBUG - Rendering markdown table');
        console.log('📋 Table content length:', tableContent.length);
        console.log('📋 Table lines:', tableEnd - tableStart + 1);
        console.log('📋 Table preview:', tableContent.substring(0, 200) + '...');
      } else {
        console.log('✅ FRONTEND DEBUG - Rendering table from markdown');
      }
      elements.push(
        <div key={`table-${currentIndex}`} className="mb-4">
          <TableRenderer markdownTable={tableContent} />
        </div>
      );
      
      currentIndex = tableEnd + 1;
    } else {
      // No more special content, process remaining as text
      const remainingContent = lines.slice(currentIndex).join('\n').trim();
      if (remainingContent) {
        elements.push(<div key={`text-${currentIndex}`}>{formatTextContent(remainingContent)}</div>);
      }
      break;
    }
  }
  
  if (isStatsTableFormat) {
    console.log('✅ STATS+TABLE DEBUG - Processing completed successfully');
    console.log('📊 Total elements processed:', elements.length);
    console.log('📋 Elements breakdown:');
    elements.forEach((element, index) => {
      const elementKey = (element as any)?.key || `element-${index}`;
      if (elementKey.includes('graph')) {
        console.log('  📊 Graph element:', elementKey);
      } else if (elementKey.includes('table')) {
        console.log('  📋 Table element:', elementKey);
      } else if (elementKey.includes('text')) {
        console.log('  📄 Text element:', elementKey);
      } else if (elementKey.includes('error')) {
        console.log('  ⚠️ Error element:', elementKey);
      }
    });
    console.log('=====================================');
  } else {
    console.log('✅ FRONTEND DEBUG - MessageBubble processed', elements.length, 'elements');
  }
  
  return elements.length > 0 ? <>{elements}</> : formatTextContent(content);
};

// Function to format text content (without tables and JSON)
const formatTextContent = (content: string): React.ReactNode => {
  // Remove JSON blocks from content before processing
  let cleanContent = content;
  
  // Remove ```json blocks
  cleanContent = cleanContent.replace(/```json\s*[\s\S]*?\s*```/g, '');
  
  // Remove direct JSON objects (more robust pattern)
  cleanContent = cleanContent.replace(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}(?=\s*(?:\n|$|\s*###|\s*##|\s*#|\s*\|))/g, '');
  
  // Remove any remaining JSON-like content
  cleanContent = cleanContent.replace(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g, '');
  
  const lines = cleanContent.split('\n');
  
  return lines.map((line, index) => {
    // Skip empty lines
    if (line.trim() === '') {
      return <br key={index} />;
    }
    
    // Handle headers (lines starting with #)
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s*/, '');
      const className = level === 1 ? 'text-base font-bold mb-2 text-gray-900' : 
                      level === 2 ? 'text-sm font-semibold mb-1 text-gray-800' : 
                      'text-sm font-medium mb-1 text-gray-700';
      return <div key={index} className={className}>{text}</div>;
    }
    
    // Handle bold text (**text**)
    if (line.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={index} className="mb-1">
          {parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              return <strong key={partIndex} className="font-semibold text-gray-900">{boldText}</strong>;
            }
            return part;
          })}
        </div>
      );
    }
    
    // Handle bullet points (• or -)
    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
      const text = line.trim().substring(1).trim();
      return (
        <div key={index} className="ml-3 mb-1 flex items-start">
          <span className="text-blue-600 mr-2 text-sm">•</span>
          <span className="text-sm text-gray-700">{text}</span>
        </div>
      );
    }
    
    // Handle emoji lines (lines starting with emoji)
    if (/^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]|^[\u{1F1E0}-\u{1F1FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(line.trim())) {
      return <div key={index} className="mb-2 font-medium text-sm">{line}</div>;
    }
    
    // Regular text
    return <div key={index} className="mb-1 text-sm text-gray-700">{line}</div>;
  });
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.type === 'user';
  
  return (
    <div className={`mobile-message-container ${isUser ? 'user-message' : 'ai-message'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center mobile-avatar-spacing ${
        isUser 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'
      }`}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <img 
            src="/fav-icons/favicon-32x32.png" 
            alt="ARCHA" 
            className="w-6 h-6 rounded-full object-cover"
          />
        )}
      </div>

      {/* Message bubble */}
      <div className={`mobile-chat-bubble ${isUser ? 'mobile-user-message' : 'mobile-ai-message'} flex flex-col`}>
        <div className={`px-4 py-3 rounded-2xl shadow-sm min-w-0 w-full overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent mobile-chat-content ${
          isUser 
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md' 
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
        }`} style={{ scrollbarWidth: 'thin' }}>
          <div className="break-words min-w-0 w-full">
            {isUser ? (
              <div>
                {/* Display format and form information for user messages */}
                {(message.meta?.selectedFormat || message.meta?.selectedFormats?.length || message.meta?.selectedFormTitles?.length) && (
                  <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200 min-w-0">
                    {/* Row 1: Selected formats with count */}
                    <div className="flex items-center gap-2 text-xs mb-2 min-w-0">
                      {(message.meta?.selectedFormat || message.meta?.selectedFormats?.length) && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full flex-shrink-0">
                          <span className="font-medium">
                            {message.meta.selectedFormats && message.meta.selectedFormats.length > 1 ? (
                              `📊📋📄 Multi-format (${message.meta.selectedFormats.length})`
                            ) : (
                              message.meta.selectedFormat === 'stats' ? '📊 Statistiques' :
                              message.meta.selectedFormat === 'pdf' ? '📄 PDF' :
                              message.meta.selectedFormat === 'table' ? '📋 Tableau' :
                              message.meta.selectedFormat
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Row 2: Horizontally scrollable forms with count */}
                    {message.meta?.selectedFormTitles?.length && (
                      <div className="flex items-center gap-2 text-xs min-w-0">
                        <span className="text-blue-600 font-medium whitespace-nowrap flex-shrink-0">
                          Formulaires ({message.meta.selectedFormTitles.length}):
                        </span>
                        <div className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-w-0 flex-1 form-tags-container" style={{ scrollbarWidth: 'thin' }}>
                          {message.meta.selectedFormTitles.map((title, index) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs whitespace-nowrap flex-shrink-0 form-tag">
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">{message.content}</div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                {/* Display format and form information */}
                {(message.meta?.selectedFormat || message.meta?.selectedFormats?.length || message.meta?.selectedFormTitles?.length) && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 min-w-0">
                    {/* Row 1: Selected formats with count */}
                    <div className="flex items-center gap-2 text-xs mb-2 min-w-0">
                      {(message.meta?.selectedFormat || message.meta?.selectedFormats?.length) && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full flex-shrink-0">
                          <span className="font-medium">
                            {message.meta.selectedFormats && message.meta.selectedFormats.length > 1 ? (
                              `📊📋📄 Multi-format (${message.meta.selectedFormats.length})`
                            ) : (
                              message.meta.selectedFormat === 'stats' ? '📊 Statistiques' :
                              message.meta.selectedFormat === 'pdf' ? '📄 PDF' :
                              message.meta.selectedFormat === 'table' ? '📋 Tableau' :
                              message.meta.selectedFormat
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Row 2: Horizontally scrollable forms with count */}
                    {message.meta?.selectedFormTitles?.length && (
                      <div className="flex items-center gap-2 text-xs min-w-0">
                        <span className="text-gray-600 font-medium whitespace-nowrap flex-shrink-0">
                          Formulaires ({message.meta.selectedFormTitles.length}):
                        </span>
                        <div className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-w-0 flex-1 form-tags-container" style={{ scrollbarWidth: 'thin' }}>
                          {message.meta.selectedFormTitles.map((title, index) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs whitespace-nowrap flex-shrink-0 form-tag">
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Render content based on type */}
                {message.contentType === 'graph' && message.graphData ? (
                  <div className="space-y-4">
                    {/* Enhanced Graph Header with Insights */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-blue-900">
                          📊 {message.graphData.title}
                        </h3>
                        <button
                          onClick={async () => {
                            try {
                              const pdfData = MultiFormatToPDF.convertToPDFData(message);
                              await generatePDF(pdfData);
                            } catch (error) {
                              console.error('Error generating PDF:', error);
                            }
                          }}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                          title="Générer un PDF avec le graphique"
                        >
                          📄 Générer PDF
                        </button>
                      </div>
                      {message.graphData.subtitle && (
                        <p className="text-xs text-blue-700 mb-2">{message.graphData.subtitle}</p>
                      )}
                      
                      {/* Display Insights if available */}
                      {message.graphData.insights && message.graphData.insights.length > 0 && (
                        <div className="mb-2">
                          <h4 className="text-xs font-medium text-blue-800 mb-1">💡 Insights clés :</h4>
                          <ul className="text-xs text-blue-700 space-y-1">
                            {message.graphData.insights.map((insight: string, index: number) => (
                              <li key={index} className="flex items-start">
                                <span className="text-blue-500 mr-1">•</span>
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Display Recommendations if available */}
                      {message.graphData.recommendations && message.graphData.recommendations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-blue-800 mb-1">🎯 Recommandations :</h4>
                          <ul className="text-xs text-blue-700 space-y-1">
                            {message.graphData.recommendations.map((recommendation: string, index: number) => (
                              <li key={index} className="flex items-start">
                                <span className="text-green-500 mr-1">→</span>
                                <span>{recommendation}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Display Metadata if available */}
                      {message.graphData.metadata && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="flex items-center justify-between text-xs text-blue-600">
                            <span>
                              {message.graphData.metadata.totalEntries && 
                                `${message.graphData.metadata.totalEntries} points de données`
                              }
                            </span>
                            <span>
                              {message.graphData.metadata.generatedAt && 
                                `Généré le ${new Date(message.graphData.metadata.generatedAt).toLocaleDateString('fr-FR')}`
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <GraphRenderer data={message.graphData} />
                  </div>
                ) : message.contentType === 'pdf' && message.pdfData ? (
                  <PDFPreview data={message.pdfData} />
                ) : message.contentType === 'text-pdf' && message.pdfData ? (
                  <PDFPreview data={message.pdfData} />
                ) : message.contentType === 'text-pdf' ? (
                  <TextPDFPreview content={message.content} title="Rapport Ubora" />
                ) : message.contentType === 'table' && message.tableData ? (
                  <div className="space-y-4">
                    {/* PDF Generation Button for Table */}
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={async () => {
                          try {
                            const pdfData = MultiFormatToPDF.convertToPDFData(message);
                            await generatePDF(pdfData);
                          } catch (error) {
                            console.error('Error generating PDF:', error);
                          }
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                        title="Générer un PDF avec le tableau"
                      >
                        📄 Générer PDF
                      </button>
                    </div>
                    
                    {/* Render text content */}
                    {message.content && (
                      <div className="prose prose-sm max-w-none">
                        {formatMessageContent(message.content, message.meta)}
                      </div>
                    )}
                    {/* Render table */}
                    <TableRenderer markdownTable={message.tableData} />
                  </div>
                ) : message.contentType === 'mixed' || message.contentType === 'multi-format' ? (
                  <div className="space-y-4">
                    {/* PDF Generation Button for Multi-format */}
                    {MultiFormatToPDF.canConvertToPDF(message) && (
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={async () => {
                            try {
                              const pdfData = MultiFormatToPDF.convertToPDFData(message);
                              await generatePDF(pdfData);
                            } catch (error) {
                              console.error('Error generating PDF:', error);
                            }
                          }}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                          title={MultiFormatToPDF.getPDFDescription(message)}
                        >
                          📄 Générer PDF
                        </button>
                      </div>
                    )}
                    
                    {/* Render text content */}
                    {message.content && (
                      <div className="prose prose-sm max-w-none">
                        {formatMessageContent(message.content, message.meta)}
                      </div>
                    )}
                    {/* Render graph if present */}
                    {message.graphData && (
                      <GraphRenderer data={message.graphData} />
                    )}
                    {/* Render PDF if present */}
                    {message.pdfData && (
                      <PDFPreview data={message.pdfData} />
                    )}
                    {/* Render table if present */}
                    {message.tableData && (
                      <TableRenderer markdownTable={message.tableData} />
                    )}
                  </div>
                ) : (
                  /* Default text rendering */
                  <div className="prose prose-sm max-w-none break-words overflow-wrap-anywhere">
                    {formatMessageContent(message.content)}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Enhanced PDF Files Display with Source Attribution - Horizontal Layout */}
          {!isUser && message.pdfFiles && message.pdfFiles.length > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
              <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                <span className="mr-2">📄</span>
                Documents analysés
                <span className="ml-2 text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded-full font-medium">
                  {message.pdfFiles.length} fichier{message.pdfFiles.length > 1 ? 's' : ''}
                </span>
              </h4>
              
              {/* Horizontal scrollable container */}
              <div className="overflow-x-auto pb-2">
                <div className="flex space-x-3 min-w-max">
                  {message.pdfFiles.map((file, index) => (
                    <div key={index} className="flex-shrink-0 w-64 bg-white border border-blue-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-3">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="text-sm">📄</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate" title={file.fileName}>
                              {file.fileName}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Document PDF analysé
                              {file.fileSize && (
                                <span className="block">{(file.fileSize / 1024).toFixed(1)} KB</span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        {/* Download button with icon only */}
                        {file.downloadUrl && (
                          <div className="mt-3 flex justify-end">
                            <a
                              href={file.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                              title="Télécharger le document"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-3 p-2 bg-blue-100 rounded-md">
                <p className="text-xs text-blue-800 flex items-center">
                  <span className="mr-1">💡</span>
                  Le contenu de ces documents a été analysé pour générer cette réponse. Cliquez sur l'icône de téléchargement pour accéder aux documents originaux.
                </p>
              </div>
            </div>
          )}
          
          {/* Enhanced Meta information for assistant messages */}
          {!isUser && message.meta && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {message.meta.period && (
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    <span>{message.meta.period}</span>
                  </span>
                )}
                {message.meta.usedEntries && (
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    <span>{message.meta.usedEntries} entrées</span>
                  </span>
                )}
                {message.meta.users && (
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                    <span>{message.meta.users} employés</span>
                  </span>
                )}
                {message.meta.forms && (
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                    <span>{message.meta.forms} formulaires</span>
                  </span>
                )}
                {message.meta.tokensUsed && (
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                    <span>{message.meta.tokensUsed} tokens</span>
                  </span>
                )}
              </div>
              
              {/* Additional context information */}
              {((message.meta?.selectedFormTitles?.length ?? 0) > 0 || (message.meta?.selectedFormats?.length ?? 0) > 0) && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {(message.meta?.selectedFormats?.length ?? 0) > 0 && (
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-400">Formats:</span>
                        {message.meta?.selectedFormats?.map((format, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            {format === 'stats' ? '📊 Stats' : 
                             format === 'table' ? '📋 Tableau' : 
                             format === 'pdf' ? '📄 PDF' : format}
                          </span>
                        ))}
                      </div>
                    )}
                    {(message.meta?.selectedFormTitles?.length ?? 0) > 0 && (
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-400">Formulaires:</span>
                        <span className="text-gray-600">
                          {message.meta?.selectedFormTitles?.slice(0, 2).join(', ')}
                          {(message.meta?.selectedFormTitles?.length ?? 0) > 2 && ` +${(message.meta?.selectedFormTitles?.length ?? 0) - 2} autres`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Timestamp and response time */}
        <div className={`flex items-center space-x-2 mt-1 text-xs text-gray-400 ${
          isUser ? 'flex-row-reverse space-x-reverse' : ''
        }`}>
          <span>{message.timestamp.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</span>
          {message.responseTime && (
            <span className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{message.responseTime}ms</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};