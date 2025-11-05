import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Select } from './Select';
import { AlertCircle, CheckCircle, X, ArrowRight } from 'lucide-react';
import { FormField } from '../types';

interface CSVRow {
  option_value: string;
}

interface FieldMapping {
  formFieldId: string | null;
  formFieldLabel: string;
  options: string[];
}

interface CSVFieldMappingProps {
  csvData: CSVRow[];
  formFields: FormField[];
  onMappingComplete: (mapping: FieldMapping[]) => void;
  onCancel: () => void;
}

export const CSVFieldMapping: React.FC<CSVFieldMappingProps> = ({
  csvData,
  formFields,
  onMappingComplete,
  onCancel
}) => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Get only select fields from form
  const selectFields = formFields.filter(field => field.type === 'select');

  useEffect(() => {
    // Since we're importing for a specific field, we only need one mapping
    const field = selectFields[0]; // Should be the only field passed
    const options = csvData.map(row => row.option_value).filter((value, index, array) => array.indexOf(value) === index);

    const initialMappings: FieldMapping[] = [{
      formFieldId: field?.id || null,
      formFieldLabel: field?.label || '',
      options: options
    }];

    setMappings(initialMappings);
  }, [csvData, selectFields]);

  const updateMapping = (formFieldId: string) => {
    const formField = selectFields.find(field => field.id === formFieldId);
    
    setMappings(prev => prev.map(mapping => ({
      ...mapping,
      formFieldId,
      formFieldLabel: formField?.label || ''
    })));
  };

  const validateMappings = (): string[] => {
    const validationErrors: string[] = [];

    // Check if field is mapped
    const unmappedFields = mappings.filter(mapping => !mapping.formFieldId);
    if (unmappedFields.length > 0) {
      validationErrors.push('Aucun champ sélectionné pour l\'import');
    }

    // Check if there are any select fields to map to
    if (selectFields.length === 0) {
      validationErrors.push('Aucun champ de type "Liste déroulante" trouvé dans le formulaire');
    }

    return validationErrors;
  };

  const handleContinue = () => {
    const validationErrors = validateMappings();
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onMappingComplete(mappings.filter(mapping => mapping.formFieldId));
  };

  const getFieldOptions = (formFieldId: string) => {
    const formField = selectFields.find(field => field.id === formFieldId);
    return formField?.options || [];
  };

  const getPreviewOptions = (mapping: FieldMapping) => {
    if (!mapping.formFieldId) return [];
    
    const existingOptions = getFieldOptions(mapping.formFieldId);
    const newOptions = mapping.options;
    
    // Combine existing and new options, removing duplicates
    const allOptions = [...existingOptions, ...newOptions];
    return Array.from(new Set(allOptions));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import des options</h2>
          <p className="text-sm text-gray-600 mt-1">
            {csvData.length} option(s) trouvée(s) dans le fichier CSV
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

      {/* Select Fields Info */}
      {selectFields.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-amber-800 mb-1">
                Aucun champ "Liste déroulante" trouvé
              </h3>
              <p className="text-sm text-amber-700">
                Vous devez d'abord créer des champs de type "Liste déroulante" dans votre formulaire 
                pour pouvoir importer des options via CSV.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-blue-200 bg-blue-50">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 mb-1">
                Champs "Liste déroulante" disponibles
              </h3>
              <p className="text-sm text-blue-700">
                {selectFields.length} champ(s) de type "Liste déroulante" trouvé(s) dans votre formulaire
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Field Mapping */}
      <div className="space-y-4">
        {mappings.map((mapping, index) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                  Options à importer
                </h3>
                <div className="text-sm text-gray-500">
                  {mapping.options.length} option(s)
                </div>
              </div>

              {/* Options Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options du CSV
                </label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex flex-wrap gap-1">
                    {mapping.options.map((option, optionIndex) => (
                      <span
                        key={optionIndex}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Field Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Champ de destination
                </label>
                <Select
                  value={mapping.formFieldId || ''}
                  onChange={(e) => updateMapping(e.target.value)}
                  options={[
                    { value: '', label: 'Sélectionner un champ...' },
                    ...selectFields.map(field => ({
                      value: field.id,
                      label: field.label
                    }))
                  ]}
                />
              </div>

              {/* Preview */}
              {mapping.formFieldId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aperçu des options (après import)
                  </label>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm text-green-800">
                      <div className="font-medium mb-1">Options existantes + nouvelles :</div>
                      <div className="flex flex-wrap gap-1">
                        {getPreviewOptions(mapping).map((option, optionIndex) => {
                          const isNew = !getFieldOptions(mapping.formFieldId!).includes(option);
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
        ))}
      </div>

      {/* Summary */}
      <Card className="border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Résumé de l'import</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Options à importer</div>
            <div className="font-medium text-gray-900">{csvData.length}</div>
          </div>
          <div>
            <div className="text-gray-600">Champ de destination</div>
            <div className="font-medium text-gray-900">
              {mappings.find(m => m.formFieldId)?.formFieldLabel || 'Non sélectionné'}
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
          disabled={selectFields.length === 0}
          className="flex items-center space-x-2"
        >
          <span>Continuer l'import</span>
        </Button>
      </div>
    </div>
  );
};
