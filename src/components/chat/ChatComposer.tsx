import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip } from 'lucide-react';
import { Button } from '../Button';
import { MessageSuggestions } from './MessageSuggestions';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSuggestionClick?: (suggestion: string) => void;
  onFileUpload?: (files: File[]) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showSuggestions?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSend,
  onSuggestionClick,
  onFileUpload,
  onKeyPress,
  disabled = false,
  placeholder = "Écrivez votre message…",
  maxLength = 2000,
  showSuggestions = true
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState(1);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24; // Approximate line height
      const maxHeight = lineHeight * 5; // Max 5 lines
      
      if (scrollHeight <= maxHeight) {
        textarea.style.height = `${scrollHeight}px`;
        setRows(Math.max(1, Math.floor(scrollHeight / lineHeight)));
      } else {
        textarea.style.height = `${maxHeight}px`;
        setRows(5);
      }
    }
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
    onKeyPress?.(e);
  };

  const canSend = !disabled && value.trim().length > 0;
  const isNearLimit = value.length > maxLength * 0.8;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0 && onFileUpload) {
      onFileUpload(files);
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-white via-white to-transparent pt-4">
      <div className="max-w-screen-md mx-auto px-4 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        
        {/* Message Suggestions - only show when input is empty */}
        {showSuggestions && !value.trim() && onSuggestionClick && (
          <MessageSuggestions 
            onSuggestionClick={onSuggestionClick}
            disabled={disabled}
          />
        )}
        {/* Character counter (when near limit) */}
        {isNearLimit && (
          <div className="text-center mb-2">
            <span className={`text-xs ${value.length >= maxLength ? 'text-red-500' : 'text-yellow-600'}`}>
              {value.length}/{maxLength} caractères
            </span>
          </div>
        )}

        {/* Composer card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3">
          <div className="flex items-end space-x-3">
            {/* Textarea */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                disabled={disabled}
                maxLength={maxLength}
                rows={rows}
                className="w-full resize-none border-0 outline-none text-base placeholder-gray-400 bg-transparent"
                style={{
                  minHeight: '24px',
                  maxHeight: '120px',
                  lineHeight: '24px'
                }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-2">
              {/* File upload button */}
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={handleFileButtonClick}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 border-0"
                title="Joindre un fichier"
              >
                <Paperclip className="h-4 w-4 text-gray-600" />
              </Button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Voice input button (placeholder) */}
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 border-0"
                title="Enregistrement vocal"
              >
                <Mic className="h-4 w-4 text-gray-600" />
              </Button>

              {/* Send button */}
              <Button
                onClick={onSend}
                disabled={!canSend}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  canSend
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                title="Envoyer le message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};