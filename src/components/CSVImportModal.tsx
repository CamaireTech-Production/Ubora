import React, { useState } from 'react';
import { FormField } from '../types';
import { CSVImportInstructions } from './CSVImportInstructions';
import { CSVFileUpload } from './CSVFileUpload';
import { CSVFieldMapping } from './CSVFieldMapping';
import { CSVImportProgress } from './CSVImportProgress';
import { CSVImportSummary } from './CSVImportSummary';

interface CSVRow {
  field_label: string;
  option_value: string;
}

interface FieldMapping {
  csvFieldLabel: string;
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

type ImportStep = 'instructions' | 'upload' | 'mapping' | 'progress' | 'summary';

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  formFields,
  onImportComplete
}) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('instructions');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState('');

  const resetModal = () => {
    setCurrentStep('instructions');
    setCsvData([]);
    setFileName('');
    setMappings([]);
    setImportResults([]);
    setError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleInstructionsComplete = () => {
    setCurrentStep('upload');
  };

  const handleFileParsed = (data: CSVRow[], file: string) => {
    setCsvData(data);
    setFileName(file);
    setError('');
    setCurrentStep('mapping');
  };

  const handleFileError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleMappingComplete = (mappingData: FieldMapping[]) => {
    setMappings(mappingData);
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
    setCurrentStep('instructions');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'instructions':
        return (
          <CSVImportInstructions
            isOpen={true}
            onClose={handleClose}
            onDownloadSample={() => {
              // Sample download is handled in the component
            }}
          />
        );

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
          <CSVFieldMapping
            csvData={csvData}
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
        {renderCurrentStep()}
      </div>
    </div>
  );
};
