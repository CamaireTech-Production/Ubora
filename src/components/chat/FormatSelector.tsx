import React from 'react';
import { BarChart3, FileText, Table } from 'lucide-react';

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
  selectedFormats: string[];
  onFormatChange: (formats: string[]) => void;
  disabled?: boolean;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({
  selectedFormats,
  onFormatChange,
  disabled = false
}) => {
  const handleFormatToggle = (formatId: string) => {
    if (disabled) return;
    
    const newFormats = selectedFormats.includes(formatId)
      ? selectedFormats.filter(id => id !== formatId)
      : [...selectedFormats, formatId];
    
    onFormatChange(newFormats);
  };

  return (
    <div className="px-4 pb-2">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2 border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-900">Format de réponse</h3>
          <span className="text-xs text-gray-500">Sélectionnez un ou plusieurs formats</span>
        </div>
        
        <div className="flex gap-2">
          {formatOptions.map((option) => {
            const IconComponent = option.icon;
            const isSelected = selectedFormats.includes(option.id);
            
            return (
              <button
                key={option.id}
                onClick={() => handleFormatToggle(option.id)}
                disabled={disabled}
                className={`
                  relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all duration-200 flex-1
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* Checkbox indicator */}
                <div className={`
                  w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-500' 
                    : 'border-gray-300 bg-white'
                  }
                `}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
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
                  <IconComponent className="h-3 w-3" />
                </div>

                {/* Label */}
                <span className="text-xs font-medium truncate">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
