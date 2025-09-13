import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { CheckCircle, AlertCircle, X, Download, Eye, EyeOff } from 'lucide-react';
import { FormField } from '../types';

interface ImportResult {
  fieldId: string;
  fieldLabel: string;
  existingOptions: string[];
  newOptions: string[];
  finalOptions: string[];
  success: boolean;
  error?: string;
}

interface CSVImportSummaryProps {
  results: ImportResult[];
  onApply: (results: ImportResult[]) => void;
  onCancel: () => void;
  onRestart: () => void;
}

export const CSVImportSummary: React.FC<CSVImportSummaryProps> = ({
  results,
  onApply,
  onCancel,
  onRestart
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [expandedFields, setExpandedFields] = React.useState<Set<string>>(new Set());

  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  const totalNewOptions = results.reduce((sum, r) => sum + r.newOptions.length, 0);
  const totalExistingOptions = results.reduce((sum, r) => sum + r.existingOptions.length, 0);

  const toggleFieldExpansion = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  const generateReport = () => {
    const report = [
      'RAPPORT D\'IMPORT CSV - OPTIONS DE FORMULAIRE',
      '=' .repeat(50),
      '',
      `Date: ${new Date().toLocaleString('fr-FR')}`,
      `Total des champs traités: ${results.length}`,
      `Succès: ${successfulResults.length}`,
      `Échecs: ${failedResults.length}`,
      `Nouvelles options ajoutées: ${totalNewOptions}`,
      '',
      'DÉTAIL PAR CHAMP:',
      '-'.repeat(30),
      ''
    ];

    results.forEach((result, index) => {
      report.push(`${index + 1}. ${result.fieldLabel}`);
      report.push(`   Statut: ${result.success ? 'SUCCÈS' : 'ÉCHEC'}`);
      
      if (result.success) {
        report.push(`   Options existantes: ${result.existingOptions.length}`);
        report.push(`   Nouvelles options: ${result.newOptions.length}`);
        report.push(`   Total final: ${result.finalOptions.length}`);
        
        if (result.newOptions.length > 0) {
          report.push(`   Nouvelles options ajoutées:`);
          result.newOptions.forEach(option => {
            report.push(`     - ${option}`);
          });
        }
      } else {
        report.push(`   Erreur: ${result.error}`);
      }
      
      report.push('');
    });

    return report.join('\n');
  };

  const downloadReport = () => {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_import_csv_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Résumé de l'import</h2>
          <p className="text-sm text-gray-600 mt-1">
            Vérifiez les résultats avant d'appliquer les modifications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center space-x-2"
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showDetails ? 'Masquer' : 'Détails'}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadReport}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Rapport</span>
          </Button>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-gray-900">{results.length}</div>
          <div className="text-sm text-gray-600">Champs traités</div>
        </Card>
        
        <Card className="text-center border-green-200 bg-green-50">
          <div className="text-2xl font-bold text-green-600">{successfulResults.length}</div>
          <div className="text-sm text-green-700">Succès</div>
        </Card>
        
        {failedResults.length > 0 && (
          <Card className="text-center border-red-200 bg-red-50">
            <div className="text-2xl font-bold text-red-600">{failedResults.length}</div>
            <div className="text-sm text-red-700">Échecs</div>
          </Card>
        )}
        
        <Card className="text-center border-blue-200 bg-blue-50">
          <div className="text-2xl font-bold text-blue-600">{totalNewOptions}</div>
          <div className="text-sm text-blue-700">Nouvelles options</div>
        </Card>
      </div>

      {/* Success Summary */}
      {successfulResults.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800 mb-2">
                Import réussi pour {successfulResults.length} champ(s)
              </h3>
              <div className="text-sm text-green-700">
                {totalNewOptions} nouvelle(s) option(s) seront ajoutée(s) à vos champs "Liste déroulante"
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Error Summary */}
      {failedResults.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                {failedResults.length} champ(s) en échec
              </h3>
              <div className="space-y-1">
                {failedResults.map((result, index) => (
                  <div key={index} className="text-sm text-red-700">
                    <span className="font-medium">{result.fieldLabel}:</span> {result.error}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Detailed Results */}
      {showDetails && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Détail des modifications</h3>
          <div className="space-y-4">
            {results.map((result, index) => {
              const isExpanded = expandedFields.has(result.fieldId);
              
              return (
                <div
                  key={result.fieldId}
                  className={`border rounded-lg ${
                    result.success 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleFieldExpansion(result.fieldId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900">{result.fieldLabel}</h4>
                          <p className="text-sm text-gray-600">
                            {result.success ? (
                              <>
                                {result.newOptions.length} nouvelle(s) option(s) • 
                                {result.existingOptions.length} existante(s) • 
                                {result.finalOptions.length} total
                              </>
                            ) : (
                              <span className="text-red-600">{result.error}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {isExpanded ? 'Masquer' : 'Voir les détails'}
                      </div>
                    </div>
                  </div>

                  {isExpanded && result.success && (
                    <div className="px-4 pb-4 border-t border-green-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {/* Existing Options */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">
                            Options existantes ({result.existingOptions.length})
                          </h5>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {result.existingOptions.length > 0 ? (
                              result.existingOptions.map((option, optionIndex) => (
                                <div
                                  key={optionIndex}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                                >
                                  {option}
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">Aucune option existante</div>
                            )}
                          </div>
                        </div>

                        {/* New Options */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">
                            Nouvelles options ({result.newOptions.length})
                          </h5>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {result.newOptions.length > 0 ? (
                              result.newOptions.map((option, optionIndex) => (
                                <div
                                  key={optionIndex}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                                >
                                  {option}
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">Aucune nouvelle option</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Final Result Preview */}
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">
                          Résultat final ({result.finalOptions.length} options)
                        </h5>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {result.finalOptions.map((option, optionIndex) => {
                            const isNew = result.newOptions.includes(option);
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
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex space-x-3">
          <Button
            variant="secondary"
            onClick={onRestart}
            className="flex items-center space-x-2"
          >
            <span>Nouvel import</span>
          </Button>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Annuler</span>
          </Button>
        </div>
        
        <Button
          onClick={() => onApply(successfulResults)}
          disabled={successfulResults.length === 0}
          className="flex items-center space-x-2"
        >
          <CheckCircle className="h-4 w-4" />
          <span>Appliquer les modifications</span>
        </Button>
      </div>
    </div>
  );
};
