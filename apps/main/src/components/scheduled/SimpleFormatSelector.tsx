import React from 'react';

interface SimpleFormatSelectorProps {
  selectedFormat: string | null;
  onFormatChange: (format: string | null) => void;
  disabled?: boolean;
}

const FORMAT_OPTIONS = [
  { value: 'table', label: 'Tableau' },
  { value: 'list', label: 'Liste' },
  { value: 'summary', label: 'Résumé' },
  { value: 'detailed', label: 'Détaillé' },
  { value: 'chart', label: 'Graphique' },
  { value: 'raw', label: 'Données brutes' }
];

export const SimpleFormatSelector: React.FC<SimpleFormatSelectorProps> = ({
  selectedFormat,
  onFormatChange,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFormatChange(value === '' ? null : value);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Format de réponse
      </label>
      
      <select
        value={selectedFormat || ''}
        onChange={handleChange}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Sélectionner un format</option>
        {FORMAT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
