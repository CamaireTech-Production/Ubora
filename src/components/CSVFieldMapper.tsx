import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Select } from './Select';
import { AlertCircle, CheckCircle, X, ArrowRight } from 'lucide-react';
import { FormField } from '../types';

interface CSVRow {
  option_value: string;
}

interface CSVFieldMapperProps {
  csvData: CSVRow[];
  csvHeaders: string[];
  formFields: FormField[];
  onMappingComplete: (fieldId: string, options: string[]) => void;
  onCancel: () => void;
}

export const CSVFieldMapper: React.FC<CSVFieldMapperProps> = ({
  csvData,
  csvHeaders,
  formFields,
  onMappingComplete,
  onCancel
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);

  // Get only select fields from form
  const selectFields = formFields.filter(field => field.type === 'select');

  // Auto-select the best column if available
  useEffect(() => {
    if (csvHeaders.length > 0) {
      // Prefer 'option_value' if available, otherwise use first column
      const preferredColumn = csvHeaders.includes('option_value') ? 'option_value' : csvHeaders[0];
      setSelectedColumn(preferredColumn);
    }
  }, [csvHeaders]);

  const validateMapping = (): string[] => {
    const validationErrors: string[] = [];

    if (!selectedFieldId) {
      validationErrors.push('Veuillez sélectionner un champ de destination');
    }

    if (!selectedColumn) {
      validationErrors.push('Veuillez sélectionner une colonne CSV');
    }

    if (selectFields.length === 0) {
      validationErrors.push('Aucun champ de type "Liste déroulante" trouvé dans le formulaire');
    }

    return validationErrors;
  };

  const handleContinue = () => {
    const validationErrors = validateMapping();
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    
    // Extract options from the selected column
    const options = csvData.map(row => row.option_value).filter((value, index, array) => array.indexOf(value) === index);
    onMappingComplete(selectedFieldId, options);
  };

  const getPreviewOptions = () => {
    if (!selectedColumn || !selectedFieldId) return [];
    
    const formField = selectFields.find(field => field.id === selectedFieldId);
    if (!formField) return [];

    const existingOptions = formField.options || [];
    const newOptions = csvData.map(row => row.option_value).filter((value, index, array) => array.indexOf(value) === index);
    
    // Combine existing and new options, removing duplicates
    const allOptions = [...existingOptions, ...newOptions];
    return Array.from(new Set(allOptions));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Correspondance des champs</h2>
          <p className="text-sm text-gray-600 mt-1">
            Associez la colonne CSV au champ "Liste déroulante" de destination
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          className="flex items-center space-x-2"
        >
          <X className="h-4 w-4" />
          <span>Annuler</span>
        </Button>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                Erreurs de validation :
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* CSV Info */}
      <Card className="border-blue-200 bg-blue-50">
        <div className="flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800 mb-1">
              Fichier CSV chargé
            </h3>
            <p className="text-sm text-blue-700">
              {csvData.length} ligne(s) trouvée(s) avec {csvHeaders.length} colonne(s): {csvHeaders.join(', ')}
            </p>
          </div>
        </div>
      </Card>

      {/* Field Mapping */}
      <Card className="border-l-4 border-l-blue-500">
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">
            Configuration de l'import
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CSV Column Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Colonne CSV à importer
              </label>
              <Select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                options={[
                  { value: '', label: 'Sélectionner une colonne...' },
                  ...csvHeaders.map(header => ({
                    value: header,
                    label: header
                  }))
                ]}
              />
              <p className="text-xs text-gray-500 mt-1">
                Choisissez la colonne contenant les options à importer
              </p>
            </div>

            {/* Form Field Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Champ de destination
              </label>
              <Select
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                options={[
                  { value: '', label: 'Sélectionner un champ...' },
                  ...selectFields.map(field => ({
                    value: field.id,
                    label: field.label
                  }))
                ]}
              />
              <p className="text-xs text-gray-500 mt-1">
                Choisissez le champ "Liste déroulante" de destination
              </p>
            </div>
          </div>

          {/* Preview */}
          {selectedColumn && selectedFieldId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aperçu des options (après import)
              </label>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-800">
                  <div className="font-medium mb-1">Options existantes + nouvelles :</div>
                  <div className="flex flex-wrap gap-1">
                    {getPreviewOptions().map((option, optionIndex) => {
                      const formField = selectFields.find(field => field.id === selectedFieldId);
                      const existingOptions = formField?.options || [];
                      const isNew = !existingOptions.includes(option);
                      return (
                        <span
                          key={optionIndex}
                          className={`px-2 py-1 rounded text-xs ${
                            isNew 
                              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {option}
                          {isNew && <span className="ml-1 text-blue-600">(nouveau)</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Summary */}
      <Card className="border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Résumé de l'import</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Lignes CSV</div>
            <div className="font-medium text-gray-900">{csvData.length}</div>
          </div>
          <div>
            <div className="text-gray-600">Colonne sélectionnée</div>
            <div className="font-medium text-gray-900">{selectedColumn || 'Non sélectionnée'}</div>
          </div>
          <div>
            <div className="text-gray-600">Champ de destination</div>
            <div className="font-medium text-gray-900">
              {selectFields.find(f => f.id === selectedFieldId)?.label || 'Non sélectionné'}
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <Button
          variant="secondary"
          onClick={onCancel}
        >
          Annuler
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedFieldId || !selectedColumn}
          className="flex items-center space-x-2"
        >
          <span>Continuer l'import</span>
        </Button>
      </div>
    </div>
  );
};
