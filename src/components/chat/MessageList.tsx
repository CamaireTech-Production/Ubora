import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import { Bot, Loader2, ChevronUp } from 'lucide-react';
import { Button } from '../Button';
import { ScrollButtons } from './ScrollButtons';

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
  const [lastMessageCount, setLastMessageCount] = useState(messages.length);
  const [isAtTop, setIsAtTop] = useState(false);
  const [autoScrollDisabled, setAutoScrollDisabled] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Helpers: FR labels for date group headers
  const formatDateLabel = (d: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(d, today)) return "Aujourd’hui";
    if (sameDay(d, yesterday)) return "Hier";

    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(d);
  };

  // Group messages by day (expects messages sorted asc by timestamp)
  const groupedMessages = (() => {
    const groups: { label: string; items: typeof messages }[] = [];
    let currentLabel: string | null = null;
    let current: typeof messages = [];

    for (const m of messages) {
      const label = formatDateLabel(m.timestamp);
      if (label !== currentLabel) {
        if (currentLabel) groups.push({ label: currentLabel, items: current });
        currentLabel = label;
        current = [m];
      } else {
        current.push(m);
      }
    }
    if (currentLabel) groups.push({ label: currentLabel, items: current });
    return groups;
  })();

  // Track keyboard height for proper spacing
  useEffect(() => {
    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      
      const initialHeight = window.innerHeight;
      const currentHeight = window.visualViewport.height;
      const heightDifference = initialHeight - currentHeight;
      
      setKeyboardHeight(heightDifference > 50 ? heightDifference : 0);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if auto-scroll is not disabled)
  useEffect(() => {
    const hasNewMessages = messages.length > lastMessageCount;
    
    // On initial load, always scroll to bottom
    if (isInitialLoad && messages.length > 0) {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
        setIsInitialLoad(false);
      }, 200); // Slightly longer delay to ensure DOM is ready
      setLastMessageCount(messages.length);
      return;
    }
    
    // Only auto-scroll if:
    // 1. Auto-scroll is not disabled
    // 2. We have new messages OR user is typing
    // 3. User is not at the top
    const shouldAutoScroll = !autoScrollDisabled && 
                            (hasNewMessages || isTyping) && 
                            !isAtTop;
    
    if (shouldAutoScroll && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    
    setLastMessageCount(messages.length);
  }, [messages.length, isTyping, autoScrollDisabled, isAtTop, lastMessageCount, isInitialLoad]);

  // Handle scroll to load more messages and track user scrolling
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    // Check if user is at the top (within 50px)
    const atTop = scrollTop < 50;
    setIsAtTop(atTop);
    
    // Check if user is near bottom (within 100px)
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    // If user scrolls to top, disable auto-scroll
    if (atTop) {
      setAutoScrollDisabled(true);
    }
    // If user scrolls back to bottom, re-enable auto-scroll
    else if (isNearBottom) {
      setAutoScrollDisabled(false);
    }
    
    // Load more messages when near top
    if (scrollTop < 100 && !isLoadingMore && hasMoreMessages && onLoadMore) {
      onLoadMore();
    }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto pt-4 px-4 sm:px-6 lg:px-8"
        onScroll={handleScroll}
        style={{ 
          // Use viewport height minus keyboard height for precise sizing
          height: keyboardHeight > 0 
            ? `calc(100dvh - 140px - ${keyboardHeight}px)` 
            : 'calc(100dvh - 140px)',
          scrollBehavior: 'smooth',
          // Minimal padding - just enough for the composer
          paddingBottom: keyboardHeight > 0 
            ? '4rem'
            : 'max(8rem, calc(8rem + env(safe-area-inset-bottom)))'
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

      {/* Messages with date grouping */}
      <div className="space-y-3 sm:space-y-6">
        {groupedMessages.map(group => (
          <div key={group.label} className="space-y-3 sm:space-y-6">
            {/* Date separator */}
            <div className="flex justify-center my-2">
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                {group.label}
              </span>
            </div>

            {/* Group messages */}
            {group.items.map((message, index) => (
              <MessageBubble
                key={`${message.id}-${message.timestamp.getTime()}-${index}`}
                message={message}
              />
            ))}
          </div>
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
      
      {/* Scroll buttons */}
      <ScrollButtons 
        containerRef={containerRef} 
      />
    </>
  );
};