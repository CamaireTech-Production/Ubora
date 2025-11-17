import React from 'react';
import { Check } from 'lucide-react';

interface FileTypeSelectorProps {
  label: string;
  selectedTypes: string[];
  onChange: (types: string[]) => void;
  className?: string;
}

const FILE_TYPE_OPTIONS = [
  { value: '.pdf', label: 'PDF', description: 'Documents PDF' },
  { value: '.doc', label: 'DOC', description: 'Documents Word (ancien format)' },
  { value: '.docx', label: 'DOCX', description: 'Documents Word' },
  { value: '.xls', label: 'XLS', description: 'Feuilles de calcul Excel (ancien format)' },
  { value: '.xlsx', label: 'XLSX', description: 'Feuilles de calcul Excel' },
  { value: '.ppt', label: 'PPT', description: 'Présentations PowerPoint (ancien format)' },
  { value: '.pptx', label: 'PPTX', description: 'Présentations PowerPoint' },
  { value: '.txt', label: 'TXT', description: 'Fichiers texte' },
  { value: '.jpg', label: 'JPG', description: 'Images JPEG' },
  { value: '.jpeg', label: 'JPEG', description: 'Images JPEG' },
  { value: '.png', label: 'PNG', description: 'Images PNG' },
  { value: '.gif', label: 'GIF', description: 'Images GIF' },
  { value: '.zip', label: 'ZIP', description: 'Archives ZIP' },
  { value: '.rar', label: 'RAR', description: 'Archives RAR' },
  { value: '.csv', label: 'CSV', description: 'Fichiers CSV' },
];

export const FileTypeSelector: React.FC<FileTypeSelectorProps> = ({
  label,
  selectedTypes,
  onChange,
  className = ""
}) => {
  const handleTypeToggle = (typeValue: string) => {
    if (selectedTypes.includes(typeValue)) {
      onChange(selectedTypes.filter(type => type !== typeValue));
    } else {
      onChange([...selectedTypes, typeValue]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTypes.length === FILE_TYPE_OPTIONS.length) {
      onChange([]);
    } else {
      onChange(FILE_TYPE_OPTIONS.map(option => option.value));
    }
  };

  const isAllSelected = selectedTypes.length === FILE_TYPE_OPTIONS.length;
  const isPartiallySelected = selectedTypes.length > 0 && selectedTypes.length < FILE_TYPE_OPTIONS.length;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-sm text-blue-600 hover:text-blue-500 font-medium"
        >
          {isAllSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FILE_TYPE_OPTIONS.map((option) => {
            const isSelected = selectedTypes.includes(option.value);
            
            return (
              <label
                key={option.value}
                className={`flex items-start space-x-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50 border border-blue-200' : ''
                }`}
              >
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTypeToggle(option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {selectedTypes.length > 0 && (
        <div className="text-sm text-gray-600">
          <span className="font-medium">{selectedTypes.length}</span> type(s) sélectionné(s)
        </div>
      )}
    </div>
  );
};
