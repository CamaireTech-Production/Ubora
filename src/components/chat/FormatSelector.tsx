import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, FileText, Table, ChevronUp, ChevronDown } from 'lucide-react';

export interface FormatOption {
  id: 'stats' | 'pdf' | 'table';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const formatOptions: FormatOption[] = [
  {
    id: 'stats',
    label: 'Statistiques',
    icon: BarChart3,
    description: 'Génère des graphiques et analyses statistiques'
  },
  {
    id: 'pdf',
    label: 'PDF',
    icon: FileText,
    description: 'Crée un rapport PDF détaillé'
  },
  {
    id: 'table',
    label: 'Tableau',
    icon: Table,
    description: 'Affiche les données sous forme de tableau'
  }
];

interface FormatSelectorProps {
  selectedFormat: string | null;
  selectedFormats?: string[]; // For multi-format selection
  onFormatChange: (format: string | null) => void;
  onFormatsChange?: (formats: string[]) => void; // For multi-format selection
  disabled?: boolean;
  allowMultiple?: boolean; // Enable multi-format selection
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({
  selectedFormat,
  selectedFormats = [],
  onFormatChange,
  onFormatsChange,
  disabled = false,
  allowMultiple = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleFormatSelect = (formatId: string) => {
    if (disabled) return;
    
    console.log('🎯 FormatSelector - Format clicked:', formatId);
    console.log('🎯 FormatSelector - allowMultiple:', allowMultiple);
    console.log('🎯 FormatSelector - selectedFormat:', selectedFormat);
    console.log('🎯 FormatSelector - selectedFormats:', selectedFormats);
    
    if (allowMultiple && onFormatsChange) {
      // Multi-format selection
      const isSelected = selectedFormats.includes(formatId);
      const newFormats = isSelected 
        ? selectedFormats.filter(f => f !== formatId)
        : [...selectedFormats, formatId];
      console.log('🎯 FormatSelector - Multi-format newFormats:', newFormats);
      onFormatsChange(newFormats);
    } else {
      // Single format selection
      const newFormat = selectedFormat === formatId ? null : formatId;
      console.log('🎯 FormatSelector - Single format newFormat:', newFormat);
      onFormatChange(newFormat);
      setIsOpen(false);
    }
  };

  const getFormatSummary = () => {
    if (allowMultiple && selectedFormats.length > 0) {
      const selectedLabels = selectedFormats.map(id => 
        formatOptions.find(opt => opt.id === id)?.label
      ).filter(Boolean);
      return selectedLabels.join(', ');
    } else if (selectedFormat) {
      return formatOptions.find(opt => opt.id === selectedFormat)?.label || 'Format sélectionné';
    }
    return 'Format de réponse';
  };

  const hasActiveFormat = allowMultiple ? selectedFormats.length > 0 : selectedFormat !== null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main format button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200
          ${isOpen 
            ? 'border-blue-500 bg-blue-50' 
            : hasActiveFormat 
              ? 'border-blue-300 bg-blue-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-2">
          <div className={`
            w-4 h-4 rounded flex items-center justify-center flex-shrink-0
            ${hasActiveFormat 
              ? 'bg-blue-100 text-blue-600' 
              : 'bg-gray-100 text-gray-500'
            }
          `}>
            <BarChart3 className="h-3 w-3" />
          </div>
          <span className="text-sm text-gray-700">
            {getFormatSummary()}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Format options dropdown - floating above input */}
      {isOpen && (
        <div className="fixed left-4 right-4 bottom-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden sm:absolute sm:bottom-full sm:left-0 sm:right-0 sm:mb-3 sm:mx-0">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">Format de réponse</h3>
                <span className="text-xs text-gray-500">
                  {allowMultiple ? 'Sélectionnez plusieurs formats' : 'Sélectionnez un format'}
                </span>
              </div>
              
              {/* Mobile: Horizontal scrollable layout */}
              <div className="block sm:hidden">
                <div className="flex gap-2 overflow-x-auto pb-2" style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#cbd5e0 transparent',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {formatOptions.map((option) => {
                    const IconComponent = option.icon;
                    const isSelected = allowMultiple 
                      ? selectedFormats.includes(option.id)
                      : selectedFormat === option.id;
                    
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleFormatSelect(option.id)}
                        disabled={disabled}
                        className={`
                          flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 min-w-fit
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50 text-blue-700' 
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }
                          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {/* Selection indicator */}
                        <div className={`
                          w-4 h-4 border-2 flex items-center justify-center flex-shrink-0
                          ${allowMultiple ? 'rounded' : 'rounded-full'}
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-500' 
                            : 'border-gray-300 bg-white'
                          }
                        `}>
                          {isSelected && (
                            allowMultiple ? (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            )
                          )}
                        </div>

                        {/* Icon */}
                        <div className={`
                          w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                          ${isSelected 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-gray-100 text-gray-500'
                          }
                        `}>
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>

                        {/* Label only */}
                        <div className="text-sm font-medium whitespace-nowrap">
                          {option.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desktop: Vertical layout */}
              <div className="hidden sm:block space-y-3">
              {formatOptions.map((option) => {
                const IconComponent = option.icon;
                const isSelected = allowMultiple 
                  ? selectedFormats.includes(option.id)
                  : selectedFormat === option.id;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => handleFormatSelect(option.id)}
                    disabled={disabled}
                    className={`
                      w-full flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-200 text-left
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {/* Selection indicator */}
                    <div className={`
                      w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
                      ${allowMultiple ? 'rounded' : 'rounded-full'}
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300 bg-white'
                      }
                    `}>
                      {isSelected && (
                        allowMultiple ? (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )
                      )}
                    </div>

                    {/* Icon */}
                    <div className={`
                      w-8 h-8 rounded flex items-center justify-center flex-shrink-0
                      ${isSelected 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-500'
                      }
                    `}>
                      <IconComponent className="h-5 w-5" />
                    </div>

                    {/* Label and description */}
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium">
                        {option.label}
                      </div>
                      <div className="text-sm text-gray-500">
                        {option.description}
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

