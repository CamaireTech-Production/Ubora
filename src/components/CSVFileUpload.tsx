import React, { useRef, useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

interface CSVRow {
  option_value: string;
}

interface CSVFileUploadProps {
  onFileParsed: (data: CSVRow[], fileName: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export const CSVFileUpload: React.FC<CSVFileUploadProps> = ({
  onFileParsed,
  onError,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    lastModified: number;
  } | null>(null);

  const parseCSV = (csvText: string): CSVRow[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Le fichier CSV est vide');
    }

    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    
    // Validate headers
    const requiredHeaders = ['option_value'];
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Colonne manquante: ${missingHeaders.join(', ')}. La colonne requise est: ${requiredHeaders.join(', ')}`);
    }

    // Parse data rows
    const data: CSVRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        if (values.length !== headers.length) {
          errors.push(`Ligne ${i + 1}: Nombre de colonnes incorrect (${values.length} au lieu de ${headers.length})`);
          continue;
        }

        const row: CSVRow = {
          option_value: values[headers.indexOf('option_value')]?.trim() || ''
        };

        // Validate row data
        if (!row.option_value) {
          errors.push(`Ligne ${i + 1}: La valeur de l'option est vide`);
          continue;
        }

        data.push(row);
      } catch (error) {
        errors.push(`Ligne ${i + 1}: Erreur de parsing - ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Erreurs de parsing:\n${errors.join('\n')}`);
    }

    if (data.length === 0) {
      throw new Error('Aucune donnée valide trouvée dans le fichier CSV');
    }

    return data;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current);

    return result;
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onError('Veuillez sélectionner un fichier CSV (.csv)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      onError('Le fichier est trop volumineux. Taille maximale autorisée: 5MB');
      return;
    }

    setIsProcessing(true);
    setUploadedFile({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    });

    try {
      const text = await file.text();
      const data = parseCSV(text);
      onFileParsed(data, file.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du parsing du fichier CSV';
      onError(errorMessage);
      setUploadedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.name.toLowerCase().endsWith('.csv'));
    
    if (csvFile) {
      handleFileSelect(csvFile);
    } else {
      onError('Veuillez déposer un fichier CSV (.csv)');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const clearFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      <Card className={`transition-colors ${isDragOver ? 'border-blue-500 bg-blue-50' : ''}`}>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
          />

          {isProcessing ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Traitement du fichier...</h3>
                <p className="text-sm text-gray-600">Veuillez patienter pendant l'analyse du CSV</p>
              </div>
            </div>
          ) : uploadedFile ? (
            <div className="space-y-4">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Fichier chargé avec succès</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-gray-700">{uploadedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="flex items-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Changer de fichier</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {isDragOver ? 'Déposez le fichier ici' : 'Sélectionner un fichier CSV'}
                </h3>
                <p className="text-sm text-gray-600">
                  Cliquez pour parcourir ou glissez-déposez votre fichier CSV
                </p>
              </div>
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                <FileText className="h-4 w-4" />
                <span>Formats acceptés: .csv (max 5MB)</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* File Requirements */}
      <Card className="border-blue-200 bg-blue-50">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <h4 className="font-medium text-blue-800 mb-1">Exigences du fichier CSV :</h4>
            <ul className="space-y-1">
              <li>• Colonne requise : <code className="bg-blue-100 px-1 rounded">option_value</code></li>
              <li>• Encodage UTF-8 recommandé</li>
              <li>• Taille maximale : 5MB</li>
              <li>• Première ligne doit contenir l'en-tête</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
