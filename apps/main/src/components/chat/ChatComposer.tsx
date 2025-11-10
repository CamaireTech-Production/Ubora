import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Brain } from 'lucide-react';
import { Button } from '../Button';
import { FormatSelector } from './FormatSelector';
import { ComprehensiveFilter } from './ComprehensiveFilter';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { usePackageAccess } from '@ubora/shared/hooks/usePackageAccess';

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
  inputRef?: React.RefObject<HTMLTextAreaElement>; // For direct access
  hideSendButton?: boolean; // Hide the send button (useful for scheduled questions)
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
  allowMultipleFormats = false,
  inputRef: externalInputRef,
  hideSendButton = false
}) => {
  const { user } = useAuth();
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalInputRef || internalTextareaRef;
  const [, setIsKeyboardOpen] = useState(false);
  
  // Simple uncontrolled input - no state updates during typing
  const [localValue, setLocalValue] = useState(value);

  // Only sync when value changes externally (e.g., after sending)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Clear input when disabled (during analysis)
  useEffect(() => {
    if (disabled) {
      setLocalValue('');
    }
  }, [disabled]);

  // Handle input changes - only update local state, no parent updates
  const handleInputChange = useCallback((newValue: string) => {
    setLocalValue(newValue); // Only local state update
    // NO parent state update during typing
  }, []);

  // Calculer les tokens restants - memoized for performance
  const { packageInfo } = usePackageAccess();
  const tokenCalculations = useMemo(() => ({
    isUnlimited: packageInfo?.totalTokens === -1,
    remainingTokens: packageInfo?.tokensRemaining || 0
  }), [packageInfo?.totalTokens, packageInfo?.tokensRemaining]);
  
  // Stable initial viewport height for reliable keyboard detection
  const initialViewportHeightRef = useRef<number>(
    (typeof window !== 'undefined' && (window.visualViewport?.height || window.innerHeight)) || 0
  );
  const [, setKeyboardHeight] = useState(0);

  // Debug token data (safe logging)
  if (packageInfo) {
    // Token data available for debugging if needed
  }

  // Fallback auto-resize for browsers that don't support fieldSizing
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Check if fieldSizing is supported
    const supportsFieldSizing = 'fieldSizing' in textarea.style;
    
    if (!supportsFieldSizing) {
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 120; // 5 lines * 24px
        
        if (scrollHeight <= maxHeight) {
          textarea.style.height = `${scrollHeight}px`;
        } else {
          textarea.style.height = `${maxHeight}px`;
        }
      };

      // Initial adjustment
      adjustHeight();
      
      // Listen for input changes
      textarea.addEventListener('input', adjustHeight);
      
      return () => {
        textarea.removeEventListener('input', adjustHeight);
      };
    }
  }, [localValue]);

  // Comprehensive mobile keyboard detection and handling
  useEffect(() => {
    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      
      const initialHeight = initialViewportHeightRef.current;
      const currentHeight = window.visualViewport.height;
      const heightDifference = initialHeight - currentHeight;
      
      // More sensitive threshold for better detection
      const keyboardOpen = heightDifference > 30;
      setIsKeyboardOpen(keyboardOpen);
      setKeyboardHeight(keyboardOpen ? heightDifference : 0);

      if (keyboardOpen) {
        // Ensure input stays visible immediately - no delay
        textareaRef.current?.scrollIntoView({ 
          behavior: 'auto', 
          block: 'end',
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

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && localValue.trim()) {
        // Update parent state with current value before sending
        onChange(localValue);
        onSend();
      }
    }
    onKeyPress?.(e);
  }, [disabled, localValue, onSend, onKeyPress, onChange]);

  const handleFocus = useCallback(() => {
    // On mobile, ensure the input is visible when focused - immediate scroll
    if (textareaRef.current) {
      // Immediate scroll to bring input into view
      textareaRef.current?.scrollIntoView({ 
        behavior: 'auto', 
        block: 'end' 
      });
    }
  }, []);

  // Memoize these calculations to prevent unnecessary re-renders
  const canSend = useMemo(() => !disabled && localValue.trim().length > 0, [disabled, localValue]);
  const isNearLimit = useMemo(() => localValue.length > maxLength * 0.8, [localValue, maxLength]);


  return (
    <div 
      className="bg-gradient-to-t from-white via-white to-transparent pt-1 pb-1 transition-all duration-300"
      style={{ 
        // Use relative positioning to allow natural scrolling
        position: 'relative',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
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
            <span className={`text-xs ${localValue.length >= maxLength ? 'text-red-500' : 'text-yellow-600'}`}>
              {localValue.length}/{maxLength} caractères
            </span>
          </div>
        )}

          {/* Composer input section */}
          <div className="p-1.5">
            <div className="flex items-end space-x-3 bg-white rounded-2xl">
              {/* Textarea */}
              <div className="flex-1 p-2">
                <textarea
                  ref={textareaRef}
                  value={localValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={handleFocus}
                  placeholder={placeholder}
                  disabled={disabled}
                  maxLength={maxLength}
                  className="w-full resize-none border-0 outline-none text-base placeholder-gray-500 bg-transparent leading-6"
                  style={{
                    minHeight: '24px',
                    maxHeight: '120px', // 5 lines * 24px line height
                    height: 'auto',
                    overflow: 'hidden',
                    fieldSizing: 'content' // Modern CSS auto-resize
                  } as React.CSSProperties & { fieldSizing?: string }}
                />
              </div>

              {/* Send button - only show if not hidden */}
              {!hideSendButton && (
                <div className="p-2">
                  <Button
                    onClick={() => {
                      // Update parent state with current value before sending
                      onChange(localValue);
                      onSend();
                    }}
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
              )}
            </div>
          </div>
        </div>
        
        {/* Affichage des tokens restants */}
        {user && packageInfo && (
          <div className="flex items-center justify-center space-x-1 text-xs text-gray-500 mt-2">
            <Brain className="h-3 w-3 text-blue-500" />
            <span>
              {tokenCalculations.isUnlimited ? (
                <span className="text-green-600 font-medium">Tokens illimités</span>
              ) : (
                <span>
                  <span className="font-medium text-gray-700">{tokenCalculations.remainingTokens.toLocaleString()}</span>
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