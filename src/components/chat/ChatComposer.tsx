import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain } from 'lucide-react';
import { Button } from '../Button';
import { FormatSelector } from './FormatSelector';
import { ComprehensiveFilter } from './ComprehensiveFilter';
import { useAuth } from '../../contexts/AuthContext';
import { usePackageAccess } from '../../hooks/usePackageAccess';

interface Form {
  id: string;
  title: string;
  description?: string;
}

interface Employee {
  id: string;
  name: string;
  email?: string;
}

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  selectedFormat: string | null;
  selectedFormats?: string[]; // For multi-format selection
  onFormatChange: (format: string | null) => void;
  onFormatsChange?: (formats: string[]) => void; // For multi-format selection
  forms: Form[];
  employees: Employee[];
  filters: ChatFilters;
  onFiltersChange: (filters: ChatFilters) => void;
  selectedFormIds: string[];
  onFormSelectionChange: (formIds: string[]) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showFormatSelector?: boolean;
  showComprehensiveFilter?: boolean;
  allowMultipleFormats?: boolean; // Enable multi-format selection
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSend,
  selectedFormat,
  selectedFormats = [],
  onFormatChange,
  onFormatsChange,
  forms,
  employees,
  filters,
  onFiltersChange,
  selectedFormIds,
  onFormSelectionChange,
  onKeyPress,
  disabled = false,
  placeholder = "Écrivez votre message…",
  maxLength = 2000,
  showFormatSelector = true,
  showComprehensiveFilter = true,
  allowMultipleFormats = false
}) => {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(1);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Calculer les tokens restants
  const { packageInfo } = usePackageAccess();
  const isUnlimited = packageInfo?.totalTokens === -1;
  const remainingTokens = packageInfo?.tokensRemaining || 0;
  
  // Stable initial viewport height for reliable keyboard detection
  const initialViewportHeightRef = useRef<number>(
    (typeof window !== 'undefined' && (window.visualViewport?.height || window.innerHeight)) || 0
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Debug token data (safe logging)
  if (packageInfo) {
    // Token data available for debugging if needed
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24; // Standard line height for chat input
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

  // Comprehensive mobile keyboard detection and handling
  useEffect(() => {
    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      
      const initialHeight = initialViewportHeightRef.current;
      const currentHeight = window.visualViewport.height;
      const heightDifference = initialHeight - currentHeight;
      
      // More sensitive threshold for better detection
      const keyboardOpen = heightDifference > 100;
      setIsKeyboardOpen(keyboardOpen);
      setKeyboardHeight(keyboardOpen ? heightDifference : 0);

      if (keyboardOpen) {
        // Ensure input stays visible immediately - no delay
        textareaRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        });
      }
    };

    // Use visualViewport API for accurate keyboard detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
    onKeyPress?.(e);
  };

  const handleFocus = () => {
    // On mobile, ensure the input is visible when focused - immediate scroll
    if (textareaRef.current) {
      // Immediate scroll, then another after a short delay for keyboard animation
      textareaRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
      
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        });
      }, 100);
    }
  };

  const canSend = !disabled && value.trim().length > 0;
  const isNearLimit = value.length > maxLength * 0.8;


  return (
    <div 
      className={`fixed left-0 right-0 z-10 bg-gradient-to-t from-white via-white to-transparent pt-4 transition-all duration-300 ${
        isKeyboardOpen ? 'pb-2' : 'pb-4'
      }`}
      style={{ 
        paddingBottom: isKeyboardOpen ? '0.25rem' : 'max(1rem, env(safe-area-inset-bottom))',
        bottom: isKeyboardOpen ? '0' : '0',
        // Ensure composer stays above keyboard with minimal spacing
        transform: isKeyboardOpen ? `translateY(-${Math.max(0, keyboardHeight - 80)}px)` : 'translateY(0)',
        transition: 'transform 0.2s ease-out'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Common background container for filters and input */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-visible">
          {/* Format Selector and Comprehensive Filter - Same Row */}
          <div className="flex gap-1 p-3 pb-2 relative">
            {/* Format Selector - always show when enabled */}
            {showFormatSelector && (
              <div className="flex-1">
                <FormatSelector 
                  selectedFormat={selectedFormat}
                  selectedFormats={selectedFormats}
                  onFormatChange={onFormatChange}
                  onFormatsChange={onFormatsChange}
                  disabled={disabled}
                  allowMultiple={allowMultipleFormats}
                />
              </div>
            )}

            {/* Comprehensive Filter - always show when enabled */}
            {showComprehensiveFilter && (
              <div className="flex-1">
                <ComprehensiveFilter 
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  forms={forms}
                  employees={employees}
                  selectedFormIds={selectedFormIds}
                  onFormSelectionChange={onFormSelectionChange}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        {/* Character counter (when near limit) */}
        {isNearLimit && (
          <div className="text-center mb-2">
            <span className={`text-xs ${value.length >= maxLength ? 'text-red-500' : 'text-yellow-600'}`}>
              {value.length}/{maxLength} caractères
            </span>
          </div>
        )}

          {/* Composer input section */}
          <div className="p-4">
            <div className="flex items-end space-x-3 bg-white rounded-2xl">
              {/* Textarea */}
              <div className="flex-1 p-3">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={handleFocus}
                  placeholder={placeholder}
                  disabled={disabled}
                  maxLength={maxLength}
                  rows={rows}
                  className="w-full resize-none border-0 outline-none text-base placeholder-gray-500 bg-transparent leading-6 overflow-y-auto"
                  style={{
                    minHeight: '24px',
                    maxHeight: '120px' // 5 lines * 24px line height
                  }}
                />
              </div>

              {/* Send button */}
              <div className="p-2">
                <Button
                  onClick={onSend}
                  disabled={!canSend}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    canSend
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      : 'bg-blue-300 text-gray-500 cursor-not-allowed border border-blue-300'
                  }`}
                  title="Envoyer le message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Affichage des tokens restants */}
        {user && packageInfo && (
          <div className="flex items-center justify-center space-x-1 text-xs text-gray-500 mt-2">
            <Brain className="h-3 w-3 text-blue-500" />
            <span>
              {isUnlimited ? (
                <span className="text-green-600 font-medium">Tokens illimités</span>
              ) : (
                <span>
                  <span className="font-medium text-gray-700">{remainingTokens.toLocaleString()}</span>
                  <span className="text-gray-400"> tokens restants</span>
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};