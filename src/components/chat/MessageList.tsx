import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Bot, Loader2, ChevronUp } from 'lucide-react';
import { Button } from '../Button';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  meta?: any;
}

interface MessageListProps {
  messages: Message[];
  isTyping?: boolean;
  hasMoreMessages?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isTyping = false,
  hasMoreMessages = false,
  isLoadingMore = false,
  onLoadMore
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isTyping]);

  // Handle scroll to load more messages
  const handleScroll = () => {
    if (!containerRef.current || isLoadingMore || !hasMoreMessages || !onLoadMore) return;

    const { scrollTop } = containerRef.current;
    if (scrollTop < 100) { // Near top
      onLoadMore();
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto pt-4 pb-48 px-4 sm:px-6 lg:px-8"
      onScroll={handleScroll}
      style={{ 
        maxHeight: 'calc(100vh - 140px)',
        scrollBehavior: 'smooth'
      }}
    >
      {/* Load more button */}
      {hasMoreMessages && (
        <div className="flex justify-center mb-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-full px-4 py-2 text-sm bg-white border border-gray-200 hover:bg-gray-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Chargement...
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Messages précédents
              </>
            )}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isTyping && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4">
            <Bot className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Bienvenue dans Ubora avec ARCHA
          </h3>
          <p className="text-gray-500 max-w-sm leading-relaxed">
            Posez des questions sur vos données de formulaires pour obtenir des analyses détaillées et des insights personnalisés.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3 sm:space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <div className="flex items-start space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
            <img 
              src="/fav-icons/favicon-32x32.png" 
              alt="ARCHA" 
              className="w-6 h-6 rounded-full object-cover"
            />
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-sm text-gray-500">ARCHA analyse vos données...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};