import React from 'react';
import { Bot, User, Clock } from 'lucide-react';
import { GraphRenderer } from './GraphRenderer';
import { PDFPreview, TextPDFPreview } from './PDFPreview';
import { TableRenderer } from './TableRenderer';
import { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

// Function to format AI message content (remove markdown and clean up)
const formatMessageContent = (content: string): React.ReactNode => {
  // Split content into lines and process each line
  const lines = content.split('\n');
  
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
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
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
      <div className={`w-full max-w-[95%] sm:max-w-[85%] min-w-0 mobile-chat-bubble ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
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
                        <div className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-w-0 flex-1" style={{ scrollbarWidth: 'thin' }}>
                          {message.meta.selectedFormTitles.map((title, index) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs whitespace-nowrap flex-shrink-0">
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
                        <div className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-w-0 flex-1" style={{ scrollbarWidth: 'thin' }}>
                          {message.meta.selectedFormTitles.map((title, index) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs whitespace-nowrap flex-shrink-0">
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
                  <GraphRenderer data={message.graphData} />
                ) : message.contentType === 'pdf' && message.pdfData ? (
                  <PDFPreview data={message.pdfData} />
                ) : message.contentType === 'text-pdf' ? (
                  <TextPDFPreview content={message.content} title="Rapport IA" />
                ) : message.contentType === 'table' && message.tableData ? (
                  <div className="space-y-4">
                    {/* Render text content */}
                    {message.content && (
                      <div className="prose prose-sm max-w-none">
                        {formatMessageContent(message.content)}
                      </div>
                    )}
                    {/* Render table */}
                    <TableRenderer markdownTable={message.tableData} />
                  </div>
                ) : message.contentType === 'mixed' || message.contentType === 'multi-format' ? (
                  <div className="space-y-4">
                    {/* Render text content */}
                    {message.content && (
                      <div className="prose prose-sm max-w-none">
                        {formatMessageContent(message.content)}
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
          
          {/* Meta information for assistant messages */}
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
                  <span>{message.meta.usedEntries} entrées</span>
                )}
                {message.meta.users && (
                  <span>{message.meta.users} employés</span>
                )}
              </div>
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