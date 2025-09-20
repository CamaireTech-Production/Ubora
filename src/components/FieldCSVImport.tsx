import React, { useState } from 'react';
import { Button } from './Button';
import { Upload, FileText, X } from 'lucide-react';
import { CSVImportModal } from './CSVImportModal';

interface FieldCSVImportProps {
  fieldId: string;
  fieldLabel: string;
  currentOptions: string[];
  onOptionsUpdate: (fieldId: string, newOptions: string[]) => void;
}

export const FieldCSVImport: React.FC<FieldCSVImportProps> = ({
  fieldId,
  fieldLabel,
  currentOptions,
  onOptionsUpdate
}) => {
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportComplete = (results: any[]) => {
    // Find the result for this specific field
    const result = results.find(r => r.fieldId === fieldId);
    if (result && result.success) {
      onOptionsUpdate(fieldId, result.finalOptions);
    }
    setShowImportModal(false);
  };

  const generateSampleCSV = () => {
    const sampleContent = `option_value
"Option 1"
"Option 2"
"Option 3"
"Option 4"
"Option 5"`;
    
    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `options_${fieldLabel.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-blue-800">
            Importer des options via CSV
          </h4>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-1 text-xs"
          >
            <Upload className="h-3 w-3" />
            <span>Importer CSV</span>
          </Button>
        </div>
        
        <div className="text-xs text-blue-700 space-y-1">
          <p>• Le CSV doit contenir la colonne: <code className="bg-blue-100 px-1 rounded">option_value</code></p>
          <p>• Chaque ligne = une option pour le champ <strong>"{fieldLabel}"</strong></p>
          <p>• Les nouvelles options seront ajoutées aux options existantes</p>
        </div>

        <div className="flex items-center space-x-2 mt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={generateSampleCSV}
            className="flex items-center space-x-1 text-xs"
          >
            <FileText className="h-3 w-3" />
            <span>Télécharger exemple</span>
          </Button>
        </div>
      </div>

      {/* CSV Import Modal for this specific field */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        formFields={[{
          id: fieldId,
          label: fieldLabel,
          type: 'select',
          required: false,
          options: currentOptions
        }]}
        onImportComplete={handleImportComplete}
      />
    </>
  );
};
