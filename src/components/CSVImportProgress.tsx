import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { FormField } from '../types';

interface FieldMapping {
  formFieldId: string;
  formFieldLabel: string;
  options: string[];
}

interface ImportResult {
  fieldId: string;
  fieldLabel: string;
  existingOptions: string[];
  newOptions: string[];
  finalOptions: string[];
  success: boolean;
  error?: string;
}

interface CSVImportProgressProps {
  mappings: FieldMapping[];
  formFields: FormField[];
  onImportComplete: (results: ImportResult[]) => void;
  onCancel: () => void;
}

export const CSVImportProgress: React.FC<CSVImportProgressProps> = ({
  mappings,
  formFields,
  onImportComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentField, setCurrentField] = useState<string>('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string>('');

  const totalSteps = mappings.length;
  const stepDuration = 1000; // 1 second per step

  useEffect(() => {
    if (isComplete) return;

    const processImport = async () => {
      const importResults: ImportResult[] = [];

      for (let i = 0; i < mappings.length; i++) {
        const mapping = mappings[i];
        setCurrentStep(i + 1);
        setProgress(((i + 1) / totalSteps) * 100);
        setCurrentField(mapping.formFieldLabel);

        try {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, stepDuration));

          // Find the form field
          const formField = formFields.find(field => field.id === mapping.formFieldId);
          if (!formField) {
            throw new Error(`Champ "${mapping.formFieldLabel}" non trouvé`);
          }

          // Get existing options
          const existingOptions = formField.options || [];
          
          // Get new options (remove duplicates)
          const newOptions = mapping.options.filter(option => 
            !existingOptions.includes(option)
          );

          // Combine options
          const finalOptions = [...existingOptions, ...newOptions];

          // Validate the result
          if (finalOptions.length === 0) {
            throw new Error('Aucune option valide à ajouter');
          }

          const result: ImportResult = {
            fieldId: mapping.formFieldId,
            fieldLabel: mapping.formFieldLabel,
            existingOptions,
            newOptions,
            finalOptions,
            success: true
          };

          importResults.push(result);
          setResults([...importResults]);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
          
          const result: ImportResult = {
            fieldId: mapping.formFieldId,
            fieldLabel: mapping.formFieldLabel,
            existingOptions: [],
            newOptions: [],
            finalOptions: [],
            success: false,
            error: errorMessage
          };

          importResults.push(result);
          setResults([...importResults]);
        }
      }

      setIsComplete(true);
      onImportComplete(importResults);
    };

    processImport();
  }, [mappings, formFields, totalSteps, stepDuration, isComplete, onImportComplete]);

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep - 1) return 'completed';
    if (stepIndex === currentStep - 1) return 'current';
    return 'pending';
  };

  const getStepIcon = (stepIndex: number) => {
    const status = getStepStatus(stepIndex);
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'current':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const successfulImports = results.filter(r => r.success).length;
  const failedImports = results.filter(r => !r.success).length;
  const totalNewOptions = results.reduce((sum, r) => sum + r.newOptions.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Import en cours...</h2>
          <p className="text-sm text-gray-600 mt-1">
            Traitement des options pour {totalSteps} champ(s)
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isComplete}
          className="flex items-center space-x-2"
        >
          <X className="h-4 w-4" />
          <span>Annuler</span>
        </Button>
      </div>

      {/* Progress Bar */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Progression</span>
            <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {currentField && (
            <div className="text-sm text-gray-600">
              Traitement en cours : <span className="font-medium">{currentField}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Steps List */}
      <Card>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Détail du traitement</h3>
        <div className="space-y-3">
          {mappings.map((mapping, index) => {
            const result = results[index];
            const status = getStepStatus(index);
            
            return (
              <div
                key={mapping.formFieldId}
                className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  status === 'completed' 
                    ? result?.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                    : status === 'current'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {getStepIcon(index)}
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {mapping.formFieldLabel}
                    </span>
                    {result && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        result.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.success ? 'Succès' : 'Échec'}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-600 mt-1">
                    {result ? (
                      result.success ? (
                        <span>
                          {result.newOptions.length} nouvelle(s) option(s) ajoutée(s)
                          {result.existingOptions.length > 0 && (
                            <span> • {result.existingOptions.length} option(s) existante(s)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-red-600">{result.error}</span>
                      )
                    ) : (
                      <span>
                        {mapping.options.length} option(s) à traiter
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Summary */}
      {isComplete && (
        <Card className="border-green-200 bg-green-50">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800 mb-2">
                Import terminé
              </h3>
              <div className="text-sm text-green-700 space-y-1">
                <div>• {successfulImports} champ(s) traité(s) avec succès</div>
                {failedImports > 0 && (
                  <div>• {failedImports} champ(s) en échec</div>
                )}
                <div>• {totalNewOptions} nouvelle(s) option(s) ajoutée(s)</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Error Summary */}
      {isComplete && failedImports > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                Erreurs rencontrées
              </h3>
              <div className="space-y-2">
                {results
                  .filter(r => !r.success)
                  .map((result, index) => (
                    <div key={index} className="text-sm text-red-700">
                      <span className="font-medium">{result.fieldLabel}:</span> {result.error}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
