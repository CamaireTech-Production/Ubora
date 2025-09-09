import React from 'react';
import { Bot, User, Clock } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  meta?: {
    period?: string;
    usedEntries?: number;
    forms?: number;
    users?: number;
    tokensUsed?: number;
    model?: string;
  };
}

interface MessageBubbleProps {
  message: Message;
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
    <div className={`flex items-start space-x-3 mb-4 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'
      }`}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message bubble */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`px-4 py-3 rounded-2xl shadow-sm ${
          isUser 
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md' 
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
        }`}>
          <div className="break-words">
            {isUser ? (
              <div className="text-sm leading-relaxed">{message.content}</div>
            ) : (
              <div className="prose prose-sm max-w-none">
                {formatMessageContent(message.content)}
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