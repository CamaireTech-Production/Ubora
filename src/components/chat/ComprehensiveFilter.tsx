import React, { useState, useRef, useEffect } from 'react';
import { Filter, Calendar, FileText, Users, Search, X, ChevronUp, ChevronDown } from 'lucide-react';

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

interface PeriodOption {
  value: string;
  label: string;
  description: string;
}

const periodOptions: PeriodOption[] = [
  {
    value: 'all',
    label: 'Toutes les données',
    description: 'Analyser toutes les soumissions disponibles'
  },
  {
    value: 'today',
    label: "Aujourd'hui",
    description: 'Soumissions d\'aujourd\'hui uniquement'
  },
  {
    value: 'yesterday',
    label: 'Hier',
    description: 'Soumissions d\'hier uniquement'
  },
  {
    value: 'this_week',
    label: 'Cette semaine',
    description: 'Du lundi à aujourd\'hui'
  },
  {
    value: 'last_week',
    label: 'Semaine dernière',
    description: 'Lundi à dimanche de la semaine passée'
  },
  {
    value: 'this_month',
    label: 'Ce mois',
    description: 'Du 1er du mois à aujourd\'hui'
  },
  {
    value: 'last_month',
    label: 'Mois dernier',
    description: 'Tout le mois précédent'
  },
  {
    value: 'last_7d',
    label: '7 derniers jours',
    description: 'Les 7 derniers jours'
  },
  {
    value: 'last_30d',
    label: '30 derniers jours',
    description: 'Les 30 derniers jours'
  },
  {
    value: 'last_90d',
    label: '90 derniers jours',
    description: 'Les 90 derniers jours'
  }
];

interface ComprehensiveFilterProps {
  filters: ChatFilters;
  onFiltersChange: (filters: ChatFilters) => void;
  forms: Form[];
  employees: Employee[];
  selectedFormIds: string[];
  onFormSelectionChange: (formIds: string[]) => void;
  disabled?: boolean;
}

export const ComprehensiveFilter: React.FC<ComprehensiveFilterProps> = ({
  filters,
  onFiltersChange,
  forms,
  employees,
  selectedFormIds,
  onFormSelectionChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'period' | 'forms' | 'employees' | null>(null);
  const [formSearchQuery, setFormSearchQuery] = useState('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter forms and employees based on search queries
  const filteredForms = forms.filter(form =>
    form.title.toLowerCase().includes(formSearchQuery.toLowerCase())
  );

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(employeeSearchQuery.toLowerCase())
  );

  // Get current selections for display
  const selectedPeriod = periodOptions.find(option => option.value === filters.period) || periodOptions[0];
  const selectedEmployee = employees.find(emp => emp.id === filters.userId);
  const selectedForms = forms.filter(form => selectedFormIds.includes(form.id));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveTab(null);
        setFormSearchQuery('');
        setEmployeeSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTabClick = (tab: 'period' | 'forms' | 'employees') => {
    if (activeTab === tab) {
      setActiveTab(null);
    } else {
      setActiveTab(tab);
      setIsOpen(true);
    }
  };

  const handlePeriodSelect = (period: string) => {
    onFiltersChange({ ...filters, period });
    setActiveTab(null);
  };

  const handleEmployeeSelect = (userId: string) => {
    onFiltersChange({ ...filters, userId: userId === filters.userId ? '' : userId });
    setActiveTab(null);
  };

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

  const handleSelectAllForms = () => {
    if (disabled) return;
    onFormSelectionChange(filteredForms.map(form => form.id));
  };

  const handleSelectNoForms = () => {
    if (disabled) return;
    onFormSelectionChange([]);
  };

  const getFilterSummary = () => {
    const parts = [];
    
    if (filters.period !== 'all') {
      parts.push(selectedPeriod.label);
    }
    
    if (selectedFormIds.length > 0) {
      parts.push(`${selectedFormIds.length} formulaire${selectedFormIds.length > 1 ? 's' : ''}`);
    }
    
    if (selectedEmployee) {
      parts.push(selectedEmployee.name);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'Tous les filtres';
  };

  const hasActiveFilters = filters.period !== 'all' || selectedFormIds.length > 0 || filters.userId;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected forms chips - only show if forms are selected */}
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

      {/* Main filter button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200
          ${isOpen 
            ? 'border-purple-500 bg-purple-50' 
            : hasActiveFilters 
              ? 'border-purple-300 bg-purple-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-2">
          <Filter className={`h-4 w-4 ${hasActiveFilters ? 'text-purple-600' : 'text-gray-500'}`} />
          <span className="text-sm text-gray-700">
            {getFilterSummary()}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Filter tabs - floating above input */}
      {isOpen && (
        <div className="fixed left-4 right-4 bottom-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden sm:absolute sm:bottom-full sm:left-0 sm:right-0 sm:mb-3 sm:mx-0">
            {/* Tab buttons */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
              <button
                onClick={() => handleTabClick('period')}
                className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors min-w-0 ${
                  activeTab === 'period' 
                    ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap">Période</span>
              </button>
              <button
                onClick={() => handleTabClick('forms')}
                className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors min-w-0 ${
                  activeTab === 'forms' 
                    ? 'bg-green-50 text-green-700 border-b-2 border-green-500' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap">Formulaires</span>
              </button>
              <button
                onClick={() => handleTabClick('employees')}
                className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors min-w-0 ${
                  activeTab === 'employees' 
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap">Employés</span>
              </button>
            </div>

            {/* Tab content */}
            <div className="max-h-64 overflow-y-auto">
            {/* Period Tab */}
            {activeTab === 'period' && (
              <div className="p-3">
                <div className="space-y-1">
                  {periodOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handlePeriodSelect(option.value)}
                      disabled={disabled}
                      className={`
                        w-full flex flex-col items-start px-3 py-2 text-left rounded-lg transition-all duration-200
                        ${filters.period === option.value 
                          ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                          : 'text-gray-700 hover:bg-gray-50'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Forms Tab */}
            {activeTab === 'forms' && (
              <div>
                {/* Search bar */}
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher des formulaires..."
                      value={formSearchQuery}
                      onChange={(e) => setFormSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Select all/none buttons */}
                <div className="p-2 border-b border-gray-100 flex gap-2">
                  <button
                    onClick={handleSelectAllForms}
                    disabled={disabled}
                    className="flex-1 text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    onClick={handleSelectNoForms}
                    disabled={disabled}
                    className="flex-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Tout désélectionner
                  </button>
                </div>

                {/* Forms list */}
                <div className="p-1">
                  {filteredForms.length === 0 ? (
                    <div className="p-3 text-center">
                      <p className="text-sm text-gray-500">
                        {formSearchQuery ? 'Aucun formulaire trouvé' : 'Aucun formulaire disponible'}
                      </p>
                    </div>
                  ) : (
                    filteredForms.map((form) => {
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
                    })
                  )}
                </div>
              </div>
            )}

            {/* Employees Tab */}
            {activeTab === 'employees' && (
              <div>
                {/* Search bar */}
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher des employés..."
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Clear selection button */}
                {filters.userId && (
                  <div className="p-2 border-b border-gray-100">
                    <button
                      onClick={() => onFiltersChange({ ...filters, userId: '' })}
                      disabled={disabled}
                      className="w-full text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Effacer la sélection
                    </button>
                  </div>
                )}

                {/* Employees list */}
                <div className="p-1">
                  {filteredEmployees.length === 0 ? (
                    <div className="p-3 text-center">
                      <p className="text-sm text-gray-500">
                        {employeeSearchQuery ? 'Aucun employé trouvé' : 'Aucun employé disponible'}
                      </p>
                    </div>
                  ) : (
                    filteredEmployees.map((employee) => {
                      const isSelected = filters.userId === employee.id;
                      
                      return (
                        <button
                          key={employee.id}
                          onClick={() => handleEmployeeSelect(employee.id)}
                          disabled={disabled}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all duration-200
                            ${isSelected 
                              ? 'bg-blue-50 text-blue-800' 
                              : 'text-gray-700 hover:bg-gray-50'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          {/* Avatar */}
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0
                            ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}
                          `}>
                            {employee.name.charAt(0).toUpperCase()}
                          </div>

                          {/* Employee info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {employee.name}
                            </div>
                            {employee.email && (
                              <div className="text-xs text-gray-500 truncate">
                                {employee.email}
                              </div>
                            )}
                          </div>

                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            </div>
        </div>
      )}
    </div>
  );
};
