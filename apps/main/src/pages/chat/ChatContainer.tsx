import React from 'react';
import { ChatTopBar } from '../../components/chat/ChatTopBar';
import MessageList from '../../components/chat/MessageList';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { ChatMessage } from '../../types';

interface ChatContainerProps {
  messages: ChatMessage[];
  inputMessage: string;
  isTyping: boolean;
  typingMessage?: string;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onLoadMore: () => void;
  onOpenPanel: () => void;
  onLogout: () => void;
  keyboardHeight: number;
  // Optional props for ChatComposer
  selectedFormat?: string | null;
  selectedFormats?: string[];
  selectedFormIds?: string[];
  onFormatChange?: (format: string | null) => void;
  onFormatsChange?: (formats: string[]) => void;
  forms?: Array<{ id: string; title: string }>;
  employees?: Array<{ id: string; name: string; email: string }>;
  filters?: { period: string; formId: string; userId: string };
  onFiltersChange?: (filters: { period: string; formId: string; userId: string }) => void;
  onFormSelectionChange?: (formIds: string[]) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  inputMessage,
  isTyping,
  typingMessage,
  hasMoreMessages,
  isLoadingMore,
  onInputChange,
  onSendMessage,
  onLoadMore,
  onOpenPanel,
  onLogout,
  keyboardHeight,
  selectedFormat,
  selectedFormats,
  selectedFormIds,
  onFormatChange,
  onFormatsChange,
  forms,
  employees,
  filters,
  onFiltersChange,
  onFormSelectionChange,
  inputRef
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      {/* Container centré pour toute l'interface */}
      <div 
        className="max-w-7xl mx-auto flex flex-col px-0 sm:px-6 lg:px-8" 
        style={{ 
          height: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh',
          minHeight: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh'
        }}
      >
        {/* Top bar */}
        <ChatTopBar
          title="ARCHA"
          isLoading={isTyping}
          onOpenPanel={onOpenPanel}
          onLogout={onLogout}
        />

        {/* Messages list */}
        <MessageList
          messages={messages}
          isTyping={isTyping}
          typingMessage={typingMessage}
          hasMoreMessages={hasMoreMessages}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />

        {/* Composer */}
        <ChatComposer
          value={inputMessage}
          onChange={onInputChange}
          onSend={onSendMessage}
          disabled={isTyping}
          selectedFormat={selectedFormat}
          selectedFormats={selectedFormats}
          onFormatChange={onFormatChange}
          onFormatsChange={onFormatsChange}
          forms={forms}
          employees={employees}
          filters={filters}
          onFiltersChange={onFiltersChange}
          selectedFormIds={selectedFormIds}
          onFormSelectionChange={onFormSelectionChange}
          placeholder="Posez une question sur vos données..."
          showFormatSelector={true}
          showComprehensiveFilter={true}
          allowMultipleFormats={true}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
};

