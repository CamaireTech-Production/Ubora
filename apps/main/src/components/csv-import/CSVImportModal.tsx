import React, { useState } from 'react';
import { FormField } from '../types';
import { CSVFileUpload } from './CSVFileUpload';
import { CSVFieldMapper } from './CSVFieldMapper';
import { CSVImportProgress } from './CSVImportProgress';
import { CSVImportSummary } from './CSVImportSummary';

interface CSVRow {
  option_value: string;
}

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

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  formFields: FormField[];
  onImportComplete: (results: ImportResult[]) => void;
}

type ImportStep = 'upload' | 'mapping' | 'progress' | 'summary';

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  formFields,
  onImportComplete
}) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState('');

  const resetModal = () => {
    setCurrentStep('upload');
    setCsvData([]);
    setCsvHeaders([]);
    setFileName('');
    setMappings([]);
    setImportResults([]);
    setError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };


  const handleFileParsed = (data: CSVRow[], file: string, headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setFileName(file);
    setError('');
    setCurrentStep('mapping');
  };

  const handleFileError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleMappingComplete = (fieldId: string, options: string[]) => {
    const mapping: FieldMapping = {
      formFieldId: fieldId,
      formFieldLabel: formFields.find(f => f.id === fieldId)?.label || '',
      options: options
    };
    setMappings([mapping]);
    setCurrentStep('progress');
  };

  const handleProgressComplete = (results: ImportResult[]) => {
    setImportResults(results);
    setCurrentStep('summary');
  };

  const handleApplyImport = (results: ImportResult[]) => {
    onImportComplete(results);
    handleClose();
  };

  const handleRestart = () => {
    resetModal();
    setCurrentStep('upload');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Sélection du fichier CSV</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Choisissez votre fichier CSV avec les options à importer
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-red-600">⚠️</div>
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <CSVFileUpload
              onFileParsed={handleFileParsed}
              onError={handleFileError}
            />

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        );

      case 'mapping':
        return (
          <CSVFieldMapper
            csvData={csvData}
            csvHeaders={csvHeaders}
            formFields={formFields}
            onMappingComplete={handleMappingComplete}
            onCancel={handleClose}
          />
        );

      case 'progress':
        return (
          <CSVImportProgress
            mappings={mappings}
            formFields={formFields}
            onImportComplete={handleProgressComplete}
            onCancel={handleClose}
          />
        );

      case 'summary':
        return (
          <CSVImportSummary
            results={importResults}
            onApply={handleApplyImport}
            onCancel={handleClose}
            onRestart={handleRestart}
          />
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {renderCurrentStep()}
        </div>
      </div>
    </div>
  );
};
