import React from 'react';

interface Form {
  id: string;
  title: string;
}

interface Employee {
  id: string;
  name: string;
}

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

interface SimpleFilterSelectorProps {
  filters: ChatFilters;
  onFiltersChange: (filters: ChatFilters) => void;
  forms: Form[];
  employees: Employee[];
  disabled?: boolean;
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Toutes les périodes' },
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'this_week', label: 'Cette semaine' },
  { value: 'last_week', label: 'Semaine dernière' },
  { value: 'this_month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois dernier' },
  { value: 'this_quarter', label: 'Ce trimestre' },
  { value: 'last_quarter', label: 'Trimestre dernier' },
  { value: 'this_year', label: 'Cette année' },
  { value: 'last_year', label: 'Année dernière' }
];

export const SimpleFilterSelector: React.FC<SimpleFilterSelectorProps> = ({
  filters,
  onFiltersChange,
  forms,
  employees,
  disabled = false
}) => {
  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      period: e.target.value
    });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      formId: e.target.value
    });
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      userId: e.target.value
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Filtres</h3>
      
      {/* Période */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-600">
          Période
        </label>
        <select
          value={filters.period}
          onChange={handlePeriodChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Formulaire */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-600">
          Formulaire (optionnel)
        </label>
        <select
          value={filters.formId}
          onChange={handleFormChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Tous les formulaires</option>
          {forms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.title}
            </option>
          ))}
        </select>
      </div>

      {/* Utilisateur */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-600">
          Utilisateur (optionnel)
        </label>
        <select
          value={filters.userId}
          onChange={handleUserChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Tous les utilisateurs</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
