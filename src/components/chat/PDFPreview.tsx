import React, { useState } from 'react';
import { FileText, Download, Maximize2, Eye } from 'lucide-react';
import { Button } from '../Button';
import { PDFData, GraphData } from '../../types';
import { generatePDF, PDFGenerator } from '../../utils/PDFGenerator';
import { GraphRenderer } from './GraphRenderer';

interface TextPDFPreviewProps {
  content: string;
  title?: string;
  onExpand?: () => void;
}

// Function to clean markdown from text
const cleanMarkdown = (text: string): string => {
  if (!text) return '';
  
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
};

// Removed repairJsonString function - AI now returns correct format directly

// Function to detect and parse JSON content in sections
const parseJsonInContent = (content: string): GraphData | null => {
  if (!content) return null;
  
  // 🔍 DEBUG: Log the content being parsed in PDF preview
  
  // Try to find JSON blocks in the content
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    
    try {
      const jsonString = jsonMatch[1];
      // console.log('🔍 FRONTEND DEBUG - PDFPreview raw JSON:', jsonString);
      
      const jsonData = JSON.parse(jsonString);
      // console.log('🔍 FRONTEND DEBUG - PDFPreview parsed JSON:', jsonData);
      
      // Check if it's valid graph data
      if (jsonData && typeof jsonData === 'object' && jsonData.type && jsonData.data) {
        // console.log('✅ FRONTEND DEBUG - PDFPreview valid graph data found');
        return jsonData as GraphData;
      } else {
        // console.log('❌ FRONTEND DEBUG - PDFPreview invalid graph data structure');
      }
    } catch (error) {
      // console.error('❌ FRONTEND DEBUG - PDFPreview error parsing JSON:', error);
    }
  }
  
  // Try to find JSON object directly
  const directJsonMatch = content.match(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/);
  if (directJsonMatch) {
    // console.log('🔍 FRONTEND DEBUG - PDFPreview found direct JSON');
    // console.log('=====================================');
    // console.log('Direct JSON String:', directJsonMatch[0]);
    // console.log('=====================================');
    
    try {
      const jsonString = directJsonMatch[0];
      // console.log('🔍 FRONTEND DEBUG - PDFPreview direct JSON:', jsonString);
      
      const jsonData = JSON.parse(jsonString);
      // console.log('🔍 FRONTEND DEBUG - PDFPreview parsed direct JSON:', jsonData);
      
      if (jsonData && typeof jsonData === 'object' && jsonData.type && jsonData.data) {
        // console.log('✅ FRONTEND DEBUG - PDFPreview valid direct graph data found');
        return jsonData as GraphData;
      } else {
        // console.log('❌ FRONTEND DEBUG - PDFPreview invalid direct graph data structure');
      }
    } catch (error) {
      // console.error('❌ FRONTEND DEBUG - PDFPreview error parsing direct JSON:', error);
    }
  }
  
  // console.log('❌ FRONTEND DEBUG - PDFPreview no JSON found in content');
  return null;
};

// Function to parse markdown table
const parseMarkdownTable = (lines: string[], startIndex: number): { table: React.ReactNode, endIndex: number } => {
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
    return { table: null, endIndex: startIndex };
  }
  
  // Parse header
  const headerLine = tableLines[0];
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
  
  // Skip separator line (second line)
  const dataLines = tableLines.slice(2);
  
  // Parse data rows
  const rows = dataLines.map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    return cells;
  });
  
  const table = (
    <div key={`table-${startIndex}`} className="my-4 overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
              >
                {cleanMarkdown(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200"
                >
                  {cleanMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
  return { table, endIndex: currentIndex - 1 };
};

// Function to format markdown content for display
const formatMarkdownContent = (content: string): React.ReactNode => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let index = 0;
  
  while (index < lines.length) {
    const line = lines[index];
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      elements.push(<br key={index} />);
      index++;
      continue;
    }
    
    // Check for JSON code blocks - preserve them completely
    if (trimmedLine.startsWith('```json')) {
      // Find the end of the JSON block
      let jsonBlock = '';
      let jsonIndex = index;
      while (jsonIndex < lines.length) {
        const currentLine = lines[jsonIndex];
        jsonBlock += currentLine + '\n';
        if (currentLine.trim() === '```') {
          break;
        }
        jsonIndex++;
      }
      
      // Parse and render the JSON as a graph
      const graphData = parseJsonInContent(jsonBlock);
      if (graphData) {
        elements.push(
          <div key={index} className="my-4">
            <GraphRenderer data={graphData} />
          </div>
        );
      } else {
        // If parsing fails, show the raw JSON in a code block
        elements.push(
          <div key={index} className="my-4">
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
              <code>{jsonBlock}</code>
            </pre>
          </div>
        );
      }
      
      index = jsonIndex + 1;
      continue;
    }
    
    // Check for markdown table
    if (trimmedLine.includes('|') && trimmedLine.length > 0) {
      const { table, endIndex } = parseMarkdownTable(lines, index);
      if (table) {
        elements.push(table);
        index = endIndex + 1;
        continue;
      }
    }
    
    // Handle headers
    if (trimmedLine.match(/^###\s+/)) {
      const text = cleanMarkdown(trimmedLine.replace(/^###\s+/, '').trim());
      elements.push(<h3 key={index} className="text-lg font-semibold text-gray-900 mt-4 mb-2">{text}</h3>);
    } else if (trimmedLine.match(/^##\s+/)) {
      const text = cleanMarkdown(trimmedLine.replace(/^##\s+/, '').trim());
      elements.push(<h2 key={index} className="text-xl font-bold text-gray-900 mt-6 mb-3">{text}</h2>);
    } else if (trimmedLine.match(/^#\s+/)) {
      const text = cleanMarkdown(trimmedLine.replace(/^#\s+/, '').trim());
      elements.push(<h1 key={index} className="text-2xl font-bold text-gray-900 mt-8 mb-4">{text}</h1>);
    }
    // Handle bold text (entire line)
    else if (trimmedLine.match(/^\*\*.*\*\*$/)) {
      const text = cleanMarkdown(trimmedLine.replace(/^\*\*(.*)\*\*$/, '$1').trim());
      elements.push(<div key={index} className="font-semibold text-gray-900 mb-2">{text}</div>);
    }
    // Handle list items with bold
    else if (trimmedLine.match(/^[-*]\s+\*\*.*\*\*$/)) {
      const text = cleanMarkdown(trimmedLine.replace(/^[-*]\s+\*\*(.*)\*\*$/, '$1').trim());
      elements.push(
        <div key={index} className="ml-4 mb-1 flex items-start">
          <span className="text-blue-600 mr-2 text-sm">•</span>
          <span className="text-sm text-gray-700 font-semibold">{text}</span>
        </div>
      );
    }
    // Handle regular list items
    else if (trimmedLine.match(/^[-*]\s+/)) {
      const text = cleanMarkdown(trimmedLine.replace(/^[-*]\s+/, '').trim());
      elements.push(
        <div key={index} className="ml-4 mb-1 flex items-start">
          <span className="text-blue-600 mr-2 text-sm">•</span>
          <span className="text-sm text-gray-700">{text}</span>
        </div>
      );
    }
    // Handle numbered lists
    else if (trimmedLine.match(/^\d+\.\s+/)) {
      const text = cleanMarkdown(trimmedLine);
      elements.push(<div key={index} className="ml-4 mb-1 text-sm text-gray-700">{text}</div>);
    }
    // Handle separator lines
    else if (trimmedLine.includes('--')) {
      elements.push(<hr key={index} className="my-4 border-gray-300" />);
    }
    // Regular text - clean all markdown
    else {
      const cleanedText = cleanMarkdown(line);
      elements.push(<div key={index} className="mb-2 text-sm text-gray-700">{cleanedText}</div>);
    }
    
    index++;
  }
  
  return elements;
};

interface PDFPreviewProps {
  data: PDFData;
  onExpand?: () => void;
}

interface PDFModalProps {
  data: PDFData;
  isOpen: boolean;
  onClose: () => void;
}

const PDFModal: React.FC<PDFModalProps> = ({ data, isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownload = async () => {
    await generatePDF(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{data.title}</h2>
              {data.subtitle && (
                <p className="text-sm text-gray-500">{data.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Télécharger PDF</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Metadata */}
            {data.metadata && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Informations du rapport</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {data.metadata.period && (
                    <div>
                      <span className="text-gray-500">Période:</span>
                      <p className="font-medium">{data.metadata.period}</p>
                    </div>
                  )}
                  {data.metadata.totalEntries && (
                    <div>
                      <span className="text-gray-500">Entrées:</span>
                      <p className="font-medium">{data.metadata.totalEntries}</p>
                    </div>
                  )}
                  {data.metadata.totalUsers && (
                    <div>
                      <span className="text-gray-500">Utilisateurs:</span>
                      <p className="font-medium">{data.metadata.totalUsers}</p>
                    </div>
                  )}
                  {data.metadata.totalForms && (
                    <div>
                      <span className="text-gray-500">Formulaires:</span>
                      <p className="font-medium">{data.metadata.totalForms}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Contenu du rapport</h3>
              {data.sections.map((section, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-2">{section.title}</h4>
                  <div className="text-sm text-gray-700">
                    {section.type === 'list' && section.data ? (
                      <ul className="list-disc list-inside space-y-1">
                        {section.data.map((item: any, itemIndex: number) => (
                          <li key={itemIndex}>{typeof item === 'string' ? item : item.toString()}</li>
                        ))}
                      </ul>
                    ) : section.type === 'table' && section.data ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              {Object.keys(section.data[0] || {}).map((header) => (
                                <th key={header} className="text-left py-2 px-3 font-medium text-gray-900">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.data.slice(0, 5).map((row: any, rowIndex: number) => (
                              <tr key={rowIndex} className="border-b border-gray-100">
                                {Object.values(row).map((value: any, colIndex: number) => (
                                  <td key={colIndex} className="py-2 px-3 text-gray-700">
                                    {value?.toString() || ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {section.data.length > 5 && (
                              <tr>
                                <td colSpan={Object.keys(section.data[0] || {}).length} className="py-2 px-3 text-gray-500 text-center">
                                  ... et {section.data.length - 5} autres lignes
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (() => {
                      // Check if content contains JSON graph data
                      const graphData = parseJsonInContent(section.content);
                      if (graphData) {
                        return (
                          <div className="space-y-4">
                            <GraphRenderer data={graphData} />
                          </div>
                        );
                      }
                      
                      // Check if it's a markdown table
                      if (section.isMarkdownTable) {
                        const lines = section.content.split('\n');
                        const { table } = parseMarkdownTable(lines, 0);
                        if (table) {
                          return table;
                        }
                      }
                      
                      // Clean content by removing JSON blocks before rendering
                      let cleanContent = section.content;
                      
                      // Remove ```json blocks
                      cleanContent = cleanContent.replace(/```json\s*[\s\S]*?\s*```/g, '');
                      
                      // Remove direct JSON objects
                      cleanContent = cleanContent.replace(/\{\s*"type"\s*:\s*"[^"]*"\s*,[\s\S]*?\}/g, '');
                      
                      // Only render if there's content left after removing JSON
                      if (cleanContent.trim()) {
                        return <p className="whitespace-pre-wrap">{cleanContent}</p>;
                      } else {
                        // If no content left after removing JSON, don't render anything
                        return null;
                      }
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            {data.charts && data.charts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Graphiques inclus</h3>
                <div className="space-y-6 overflow-x-auto">
                  {data.charts.map((chart, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 min-w-fit">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">{chart.title}</h4>
                      <div className="overflow-x-auto">
                        <GraphRenderer data={chart} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TextPDFPreview: React.FC<TextPDFPreviewProps> = ({ content, title = 'Rapport Ubora', onExpand }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExpand = () => {
    if (onExpand) {
      onExpand();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleDownload = () => {
    const generator = new PDFGenerator();
    generator.generateReportFromText(content, title);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">Rapport généré avec Archa</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="p-1.5 rounded-lg hover:bg-gray-100"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExpand}
              className="p-1.5 rounded-lg hover:bg-gray-100"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-xs text-gray-600 line-clamp-3">
            {content.replace(/\*\*/g, '').replace(/###\s+/g, '').replace(/##\s+/g, '').replace(/#\s+/g, '').substring(0, 150)}...
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span className="flex items-center space-x-1">
              <Eye className="h-3 w-3" />
              <span>Rapport complet</span>
            </span>
            <span>Généré le {new Date().toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      </div>

      {/* Modal for full content */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                  <p className="text-sm text-gray-500">Rapport généré avec Archa</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Télécharger PDF</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
              <div className="prose prose-sm max-w-none">
                <div className="text-sm text-gray-700 leading-relaxed">
                  {formatMarkdownContent(content)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const PDFPreview: React.FC<PDFPreviewProps> = ({ data, onExpand }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExpand = () => {
    if (onExpand) {
      onExpand();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleDownload = () => {
    generatePDF(data);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{data.title}</h3>
              {data.subtitle && (
                <p className="text-xs text-gray-500">{data.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="p-1.5 rounded-lg hover:bg-gray-100"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExpand}
              className="p-1.5 rounded-lg hover:bg-gray-100"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span className="flex items-center space-x-1">
              <Eye className="h-3 w-3" />
              <span>{data.sections.length} sections</span>
            </span>
            {data.charts && data.charts.length > 0 && (
              <span>{data.charts.length} graphiques</span>
            )}
            {data.metadata && (
              <span>Généré le {data.generatedAt.toLocaleDateString('fr-FR')}</span>
            )}
          </div>
          
          <div className="text-xs text-gray-600 line-clamp-2">
            {data.sections[0]?.content?.substring(0, 100)}...
          </div>
        </div>
      </div>

      <PDFModal
        data={data}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
