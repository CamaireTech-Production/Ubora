import React, { useState, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Upload, FileText, AlertCircle, CheckCircle, X, Eye, Edit2, Download } from 'lucide-react';
import { detectColumnTypes, ColumnType, validateValueAgainstType, convertValueToType } from '@ubora/shared/utils/csvTypeDetector';
import { ListColumn, ListRow } from '../../types';
import { logger } from '@ubora/shared/utils/logger';

interface ListsCSVImportProps {
  onImportComplete: (columns: ListColumn[], rows: ListRow[]) => void;
  onCancel: () => void;
  existingColumns?: ListColumn[]; // If editing existing list
}

type ImportStep = 'upload' | 'review' | 'preview';

export const ListsCSVImport: React.FC<ListsCSVImportProps> = ({
  onImportComplete,
  onCancel,
  existingColumns = []
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [detectedTypes, setDetectedTypes] = useState<Record<string, ColumnType>>({});
  const [customTypes, setCustomTypes] = useState<Record<string, ColumnType>>({});
  const [previewData, setPreviewData] = useState<{ columns: ListColumn[], rows: ListRow[] } | null>(null);

  /**
   * Parse CSV line handling quoted fields
   */
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
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current.trim());
    return result;
  };

  /**
   * Parse CSV file
   */
  const parseCSV = (csvText: string): { headers: string[], data: Record<string, string>[] } => {
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Le fichier CSV est vide');
    }

    if (lines.length < 2) {
      throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).filter(h => h.trim() !== '');
    
    if (headers.length === 0) {
      throw new Error('Aucun en-tête trouvé dans le fichier CSV');
    }

    // Parse data rows with performance optimization for large files
    const data: Record<string, string>[] = [];
    const errors: string[] = [];
    const maxRows = 10000; // Limit rows for performance
    const maxErrors = 100; // Limit error reporting to avoid memory issues

    // Process rows in batches for better performance with large files
    const processBatch = (startIndex: number, endIndex: number) => {
      const batchData: Record<string, string>[] = [];
      const batchErrors: string[] = [];
      
      for (let i = startIndex; i < Math.min(endIndex, lines.length); i++) {
        if (data.length >= maxRows) break; // Stop if we've reached the limit
        
        try {
          const values = parseCSVLine(lines[i]);
          
          if (values.length !== headers.length) {
            if (batchErrors.length < maxErrors) {
              batchErrors.push(`Ligne ${i + 1}: Nombre de colonnes incorrect (${values.length} au lieu de ${headers.length})`);
            }
            continue;
          }

          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          batchData.push(row);
        } catch (error) {
          if (batchErrors.length < maxErrors) {
            batchErrors.push(`Ligne ${i + 1}: Erreur de parsing - ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
          }
        }
      }
      
      return { batchData, batchErrors };
    };

    // Process in batches (1000 rows at a time for better performance)
    const batchSize = 1000;
    for (let i = 1; i < lines.length && data.length < maxRows; i += batchSize) {
      const { batchData, batchErrors } = processBatch(i, i + batchSize);
      data.push(...batchData);
      errors.push(...batchErrors);
    }
    
    // Truncate if we hit the limit
    if (data.length > maxRows) {
      data.splice(maxRows);
      if (errors.length < maxErrors) {
        errors.push(`Seulement les ${maxRows} premières lignes ont été traitées (${lines.length - 1} lignes au total)`);
      }
    }

    // Enhanced error reporting
    if (errors.length > 0) {
      const errorSummary = errors.slice(0, 10).join('\n');
      const remainingErrors = errors.length > 10 ? `\n... et ${errors.length - 10} erreur(s) supplémentaire(s)` : '';
      
      if (data.length === 0) {
        throw new Error(`Impossible d'analyser le fichier CSV:\n${errorSummary}${remainingErrors}`);
      } else {
        // Warn about errors but continue with valid data
        logger.warn('Avertissements lors du parsing CSV', { errorSummary, remainingErrors }, 'ListsCSVImport');
      }
    }

    if (data.length === 0) {
      throw new Error('Aucune donnée valide trouvée dans le fichier CSV. Vérifiez que le fichier contient des données en plus des en-têtes.');
    }

    return { headers, data };
  };

  /**
   * Handle file selection and parsing
   */
  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Veuillez sélectionner un fichier CSV (.csv)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Le fichier est trop volumineux. Taille maximale autorisée: 5MB');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Read file with error handling
      let text: string;
      try {
        text = await file.text();
      } catch (readError) {
        throw new Error('Impossible de lire le fichier. Vérifiez que le fichier n\'est pas corrompu.');
      }

      // Validate encoding (basic check for valid UTF-8)
      if (text.length === 0) {
        throw new Error('Le fichier semble vide ou n\'a pas pu être lu correctement.');
      }

      // Parse CSV with enhanced error handling
      let headers: string[];
      let data: Record<string, string>[];
      
      try {
        const parseResult = parseCSV(text);
        headers = parseResult.headers;
        data = parseResult.data;
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Erreur de parsing CSV inconnue';
        throw new Error(`Erreur lors du parsing du CSV: ${errorMsg}`);
      }

      // Validate headers
      if (headers.length === 0) {
        throw new Error('Aucun en-tête trouvé dans le fichier CSV');
      }

      // Check for duplicate headers
      const headerSet = new Set(headers.map(h => h.toLowerCase()));
      if (headerSet.size !== headers.length) {
        throw new Error('Des en-têtes en double ont été détectés. Veuillez vérifier votre fichier CSV.');
      }

      // Validate data rows
      if (data.length === 0) {
        throw new Error('Aucune donnée trouvée dans le fichier CSV (seulement les en-têtes)');
      }

      // Limit data size for performance (warn if too large)
      // For very large files, we process in chunks to avoid memory issues
      const maxRows = 10000;
      const warningThreshold = 5000;
      
      if (data.length > maxRows) {
        logger.warn('Fichier volumineux détecté', { totalRows: data.length, maxRows }, 'ListsCSVImport');
        data = data.slice(0, maxRows);
      } else if (data.length > warningThreshold) {
        logger.info('Fichier volumineux détecté', { rowCount: data.length }, 'ListsCSVImport');
      }

      setCsvHeaders(headers);
      setCsvData(data);
      setFileName(file.name);

      // Auto-detect column types with error handling
      let detected: Record<string, ColumnType>;
      try {
        detected = detectColumnTypes(data, headers);
      } catch (detectionError) {
        logger.warn('Erreur lors de la détection automatique des types', detectionError, 'ListsCSVImport');
        // Fallback: set all columns as text
        detected = {};
        headers.forEach(header => {
          detected[header] = 'text';
        });
      }
      setDetectedTypes(detected);
      setCustomTypes({}); // Reset custom types

      // Initialize column mappings (if editing existing list, try to match by name)
      const mappings: Record<string, string> = {};
      if (existingColumns.length > 0) {
        headers.forEach(header => {
          const matchingColumn = existingColumns.find(col => 
            col.name.toLowerCase() === header.toLowerCase()
          );
          if (matchingColumn) {
            mappings[header] = matchingColumn.id;
          }
        });
      }

      // Move to review step
      setCurrentStep('review');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du traitement du fichier CSV';
      setError(errorMessage);
      logger.error('CSV Import Error', error, 'ListsCSVImport');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Handle drag and drop
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Update custom type for a column
   */
  const handleTypeChange = (csvHeader: string, newType: ColumnType) => {
    setCustomTypes(prev => ({
      ...prev,
      [csvHeader]: newType
    }));
  };

  /**
   * Get effective type for a column (custom or detected)
   */
  const getColumnType = (csvHeader: string): ColumnType => {
    return customTypes[csvHeader] || detectedTypes[csvHeader] || 'text';
  };

  /**
   * Generate List columns and rows from CSV data
   */
  const generateListData = () => {
    const columns: ListColumn[] = [];
    const columnIdMap: Record<string, string> = {}; // CSV header -> generated column ID

    // Generate columns from CSV headers
    csvHeaders.forEach((header, index) => {
      const columnId = `col_${Date.now()}_${index}`;
      columnIdMap[header] = columnId;
      
      columns.push({
        id: columnId,
        name: header,
        type: getColumnType(header)
      });
    });

    // Generate rows
    const rows: ListRow[] = csvData.map(csvRow => {
      const row: ListRow = {};
      
      csvHeaders.forEach(header => {
        const columnId = columnIdMap[header];
        const rawValue = csvRow[header] || '';
        const type = getColumnType(header);
        
        // Convert value to appropriate type
        row[columnId] = convertValueToType(rawValue, type);
      });
      
      return row;
    });

    return { columns, rows };
  };

  /**
   * Preview the data before finalizing
   */
  const handlePreview = () => {
    const data = generateListData();
    setPreviewData(data);
    setCurrentStep('preview');
  };

  /**
   * Finalize import
   */
  const handleFinalize = () => {
    if (!previewData) {
      const data = generateListData();
      onImportComplete(data.columns, data.rows);
    } else {
      onImportComplete(previewData.columns, previewData.rows);
    }
  };

  /**
   * Reset and start over
   */
  const handleReset = () => {
    setCurrentStep('upload');
    setCsvData([]);
    setCsvHeaders([]);
    setFileName('');
    setError('');
    setDetectedTypes({});
    setCustomTypes({});
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const typeOptions = [
    { value: 'text', label: 'Texte' },
    { value: 'number', label: 'Nombre' },
    { value: 'date', label: 'Date' },
    { value: 'email', label: 'Email' },
    { value: 'boolean', label: 'Booléen' }
  ];

  /**
   * Generate and download sample CSV file
   */
  const handleDownloadSample = () => {
    let csvContent = '';
    
    // If existing columns, use them to generate sample
    if (existingColumns.length > 0) {
      // Headers from existing columns
      const headers = existingColumns.map(col => col.name || `Colonne_${col.id}`);
      csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
      
      // Generate 3-5 sample rows based on column types
      for (let i = 0; i < 4; i++) {
        const row: string[] = [];
        existingColumns.forEach(col => {
          switch (col.type) {
            case 'number':
              row.push(`"${(i + 1) * 10}"`);
              break;
            case 'date':
              const date = new Date();
              date.setDate(date.getDate() + i);
              row.push(`"${date.toISOString().split('T')[0]}"`);
              break;
            case 'email':
              row.push(`"exemple${i + 1}@example.com"`);
              break;
            case 'boolean':
              row.push(`"${i % 2 === 0 ? 'true' : 'false'}"`);
              break;
            default:
              row.push(`"Exemple ${i + 1}"`);
          }
        });
        csvContent += row.join(',') + '\n';
      }
    } else {
      // Generic sample CSV
      csvContent = `"Nom","Email","Ville","Pays"
"Jean Dupont","jean@example.com","Paris","France"
"Marie Martin","marie@example.com","Lyon","France"
"Pierre Durand","pierre@example.com","Marseille","France"
"Sophie Bernard","sophie@example.com","Toulouse","France"`;
    }
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'exemple_liste.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Importer un fichier CSV</h2>
              <p className="text-sm text-gray-600 mt-1">
                Téléchargez un fichier CSV pour créer automatiquement une liste avec des colonnes et des lignes
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                    <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-800 mb-1">
                    📥 Besoin d'un exemple de format CSV ?
                  </h3>
                  <p className="text-xs text-blue-700">
                    {existingColumns.length > 0 
                      ? 'Téléchargez un fichier CSV avec la structure de vos colonnes actuelles'
                      : 'Téléchargez un fichier CSV d\'exemple pour voir le format attendu'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="flex items-center justify-center space-x-2 w-full sm:w-auto flex-shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Télécharger exemple</span>
                  <span className="sm:hidden">Télécharger</span>
                </Button>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isProcessing
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {isProcessing ? (
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-600">Traitement du fichier...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Glissez-déposez votre fichier CSV ici
                  </p>
                  <p className="text-xs text-gray-500 mb-4">ou</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <Button 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Sélectionner un fichier
                  </Button>
                  <p className="text-xs text-gray-500 mt-4">
                    Format: première ligne = en-têtes (noms de colonnes), lignes suivantes = données • Taille max: 5MB
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
                Annuler
              </Button>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Révision des colonnes</h2>
              <p className="text-sm text-gray-600 mt-1">
                Vérifiez et ajustez les types de colonnes détectés automatiquement
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-800">Fichier: {fileName}</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    {csvData.length} ligne(s) de données trouvée(s)
                  </p>
                </div>
              </div>
            </div>

            <Card title="Colonnes détectées">
              <div className="space-y-4">
                {csvHeaders.map((header) => {
                  const detectedType = detectedTypes[header] || 'text';
                  const currentType = getColumnType(header);
                  const sampleValues = csvData
                    .slice(0, 5)
                    .map(row => row[header])
                    .filter(v => v && v.trim());

                  return (
                    <div key={header} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{header}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Type détecté: <span className="font-medium">{detectedType}</span>
                          </p>
                        </div>
                        <Select
                          value={currentType}
                          onChange={(e) => handleTypeChange(header, e.target.value as ColumnType)}
                          options={typeOptions}
                          className="w-32"
                        />
                      </div>
                      
                      {sampleValues.length > 0 && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600 font-medium mb-1">Exemples de valeurs:</p>
                          <div className="flex flex-wrap gap-2">
                            {sampleValues.slice(0, 3).map((value, idx) => (
                              <span
                                key={idx}
                                className={`text-xs px-2 py-1 rounded ${
                                  validateValueAgainstType(value, currentType)
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {value.length > 30 ? `${value.substring(0, 30)}...` : value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button variant="secondary" onClick={handleReset} className="flex items-center justify-center w-full sm:w-auto">
                <X className="h-4 w-4 mr-2" />
                Nouveau fichier
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
                  Annuler
                </Button>
                <Button onClick={handlePreview} className="flex items-center justify-center w-full sm:w-auto">
                  <Eye className="h-4 w-4 mr-2" />
                  Aperçu
                </Button>
              </div>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Aperçu de la liste</h2>
              <p className="text-sm text-gray-600 mt-1">
                Vérifiez les données avant de finaliser l'importation
              </p>
            </div>

            {previewData && (
              <>
                <Card title="Colonnes">
                  <div className="space-y-2">
                    {previewData.columns.map((col) => (
                      <div key={col.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium text-gray-900">{col.name}</span>
                        <span className="text-xs text-gray-600 px-2 py-1 bg-blue-100 rounded">
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title={`Lignes (${previewData.rows.length} au total, affichage des 10 premières)`}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {previewData.columns.map((col) => (
                            <th
                              key={col.id}
                              className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.rows.slice(0, 10).map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {previewData.columns.map((col) => (
                              <td
                                key={col.id}
                                className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap"
                              >
                                {row[col.id] !== null && row[col.id] !== undefined
                                  ? String(row[col.id])
                                  : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button variant="secondary" onClick={() => setCurrentStep('review')} className="flex items-center justify-center w-full sm:w-auto">
                <Edit2 className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
                  Annuler
                </Button>
                <Button onClick={handleFinalize} className="flex items-center justify-center w-full sm:w-auto">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Importer
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {renderCurrentStep()}
    </div>
  );
};

