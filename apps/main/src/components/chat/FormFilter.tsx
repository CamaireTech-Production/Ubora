import React, { useState, useRef, useEffect } from 'react';
import { FileText, Filter, Search, X, ChevronUp, ChevronDown } from 'lucide-react';

interface Form {
  id: string;
  title: string;
  description?: string;
}

interface FormFilterProps {
  forms: Form[];
  selectedFormIds: string[];
  onFormSelectionChange: (formIds: string[]) => void;
  disabled?: boolean;
}

export const FormFilter: React.FC<FormFilterProps> = ({
  forms,
  selectedFormIds,
  onFormSelectionChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter forms based on search query
  const filteredForms = forms.filter(form =>
    form.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFormToggle = (formId: string) => {
    if (disabled) return;
    
    const newSelection = selectedFormIds.includes(formId)
      ? selectedFormIds.filter(id => id !== formId)
      : [...selectedFormIds, formId];
    
    onFormSelectionChange(newSelection);
  };

  const handleRemoveForm = (formId: string) => {
    if (disabled) return;
    onFormSelectionChange(selectedFormIds.filter(id => id !== formId));
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onFormSelectionChange(filteredForms.map(form => form.id));
  };

  const handleSelectNone = () => {
    if (disabled) return;
    onFormSelectionChange([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedForms = forms.filter(form => selectedFormIds.includes(form.id));
  const allFilteredSelected = filteredForms.length > 0 && filteredForms.every(form => selectedFormIds.includes(form.id));

  return (
    <div className="px-4 pb-2 relative" ref={dropdownRef}>
      {/* Selected forms chips */}
      {selectedForms.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedForms.map((form) => (
            <div
              key={form.id}
              className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs border border-green-200"
            >
              <FileText className="h-3 w-3" />
              <span className="truncate max-w-24">{form.title}</span>
              <button
                onClick={() => handleRemoveForm(form.id)}
                disabled={disabled}
                className="hover:bg-green-200 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200
          ${isOpen 
            ? 'border-green-500 bg-green-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-green-600" />
          <span className="text-sm text-gray-700">
            {selectedFormIds.length === 0 
              ? 'Sélectionner des formulaires' 
              : `${selectedFormIds.length} formulaire${selectedFormIds.length > 1 ? 's' : ''} sélectionné${selectedFormIds.length > 1 ? 's' : ''}`
            }
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher des formulaires..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Select all/none buttons */}
          <div className="p-2 border-b border-gray-100 flex gap-2">
            <button
              onClick={handleSelectAll}
              disabled={disabled || allFilteredSelected}
              className="flex-1 text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Tout sélectionner
            </button>
            <button
              onClick={handleSelectNone}
              disabled={disabled || selectedFormIds.length === 0}
              className="flex-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Tout désélectionner
            </button>
          </div>

          {/* Forms list */}
          <div className="max-h-40 overflow-y-auto">
            {filteredForms.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'Aucun formulaire trouvé' : 'Aucun formulaire disponible'}
                </p>
              </div>
            ) : (
              <div className="p-1">
                {filteredForms.map((form) => {
                  const isSelected = selectedFormIds.includes(form.id);
                  
                  return (
                    <button
                      key={form.id}
                      onClick={() => handleFormToggle(form.id)}
                      disabled={disabled}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all duration-200
                        ${isSelected 
                          ? 'bg-green-50 text-green-800' 
                          : 'text-gray-700 hover:bg-gray-50'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      {/* Checkbox indicator */}
                      <div className={`
                        w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                        ${isSelected 
                          ? 'border-green-500 bg-green-500' 
                          : 'border-gray-300 bg-white'
                        }
                      `}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>

                      {/* Form icon */}
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />

                      {/* Form title */}
                      <span className="text-sm font-medium truncate flex-1">
                        {form.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
