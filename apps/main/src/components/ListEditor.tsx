import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { List, ListColumn, ListRow } from '../types';
import { Plus, Trash2, Save, X, Upload, Minus } from 'lucide-react';
import { ListsCSVImport } from './ListsCSVImport';
import { ListRowsEditor } from './ListRowsEditor';
import { useToast } from '@ubora/shared/hooks/useToast';
import { validateValueAgainstType as validateTypeUtil } from '@ubora/shared/utils/csvTypeDetector';

interface ListEditorProps {
  list?: List; // If provided, we're editing an existing list
  onSave: (list: {
    name: string;
    description?: string;
    columns: ListColumn[];
    rows: ListRow[];
  }) => void;
  onCancel: () => void;
}

export const ListEditor: React.FC<ListEditorProps> = ({
  list,
  onSave,
  onCancel
}) => {
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(list?.name || '');
  const [description, setDescription] = useState(list?.description || '');
  const [columns, setColumns] = useState<ListColumn[]>(list?.columns || []);
  const [rows, setRows] = useState<ListRow[]>(list?.rows || []);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [editingColumn, setEditingColumn] = useState<string | null>(null); // Column ID being edited
  const [editingColumnName, setEditingColumnName] = useState('');

  const typeOptions = [
    { value: 'text', label: 'Texte' },
    { value: 'number', label: 'Nombre' },
    { value: 'date', label: 'Date' },
    { value: 'email', label: 'Email' },
    { value: 'boolean', label: 'Booléen' }
  ];

  // Add a new column
  const handleAddColumn = () => {
    const newColumn: ListColumn = {
      id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Nouvelle colonne',
      type: 'text'
    };
    setColumns([...columns, newColumn]);
    
    // Add empty values for this column to all existing rows
    if (rows.length > 0) {
      setRows(rows.map(row => ({
        ...row,
        [newColumn.id]: ''
      })));
    }
    
    // Start editing the new column immediately
    setEditingColumn(newColumn.id);
    setEditingColumnName(newColumn.name);
  };

  // Update a column
  const handleUpdateColumn = (columnId: string, updates: Partial<ListColumn>) => {
    setColumns(columns.map(col => 
      col.id === columnId ? { ...col, ...updates } : col
    ));
  };

  // Delete a column
  const handleDeleteColumn = (columnId: string) => {
    if (columns.length <= 1) {
      showError('Une liste doit avoir au moins une colonne');
      return;
    }

    setColumns(columns.filter(col => col.id !== columnId));
    
    // Remove this column's values from all rows
    setRows(rows.map(row => {
      const newRow = { ...row };
      delete newRow[columnId];
      return newRow;
    }));
    
    showSuccess('Colonne supprimée');
  };

  // Start editing column name
  const handleStartEditColumn = (column: ListColumn) => {
    setEditingColumn(column.id);
    setEditingColumnName(column.name);
  };

  // Save column name edit
  const handleSaveColumnName = (columnId: string) => {
    if (editingColumnName.trim()) {
      handleUpdateColumn(columnId, { name: editingColumnName.trim() });
    }
    setEditingColumn(null);
    setEditingColumnName('');
  };

  // Cancel column name edit
  const handleCancelColumnNameEdit = () => {
    setEditingColumn(null);
    setEditingColumnName('');
  };

  // Row management is now handled by ListRowsEditor component

  // Handle CSV import completion
  const handleCSVImportComplete = (importedColumns: ListColumn[], importedRows: ListRow[]) => {
    setColumns(importedColumns);
    setRows(importedRows);
    setShowCSVImport(false);
    showSuccess('Données CSV importées avec succès');
  };

  // Validate before saving
  const validate = (): boolean => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Le nom de la liste est requis');
    }

    if (columns.length === 0) {
      newErrors.push('Au moins une colonne est requise');
    } else {
      // Validate columns
      const columnNames = new Set<string>();
      columns.forEach((col, index) => {
        if (!col.name.trim()) {
          newErrors.push(`La colonne ${index + 1} doit avoir un nom`);
        } else {
          // Check for duplicate column names
          const normalizedName = col.name.trim().toLowerCase();
          if (columnNames.has(normalizedName)) {
            newErrors.push(`Le nom de colonne "${col.name}" est déjà utilisé`);
          } else {
            columnNames.add(normalizedName);
          }
        }
        
        // Validate column ID exists
        if (!col.id || !col.id.trim()) {
          newErrors.push(`La colonne ${index + 1} doit avoir un identifiant valide`);
        }
        
        // Validate column type
        if (!['text', 'number', 'date', 'email', 'boolean'].includes(col.type)) {
          newErrors.push(`Type invalide pour la colonne "${col.name}": ${col.type}`);
        }
      });
      
      // Validate rows match column types (only check first 10 rows for performance)
      const rowsToValidate = rows.slice(0, 10);
      rowsToValidate.forEach((row, rowIndex) => {
        columns.forEach(col => {
          const value = row[col.id];
          if (value !== null && value !== undefined && value !== '') {
            // Type validation for non-empty values
            const stringValue = String(value);
            if (!validateTypeUtil(stringValue, col.type)) {
              // Convert to string for display
              const displayValue = stringValue.substring(0, 50);
              newErrors.push(`Ligne ${rowIndex + 1}, colonne "${col.name}": valeur "${displayValue}${displayValue.length === 50 ? '...' : ''}" ne correspond pas au type ${col.type}`);
            }
          }
        });
      });
      
      // Warn if there are more rows that weren't validated
      if (rows.length > 10) {
        console.warn(`Validation effectuée sur les 10 premières lignes uniquement. ${rows.length - 10} lignes supplémentaires non validées.`);
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Check if save button should be disabled
  const isSaveDisabled = () => {
    // Disable if name is empty or no columns are defined
    const hasValidName = name.trim().length > 0;
    const hasValidColumns = columns.length > 0 && columns.some(col => col.name.trim());
    return !hasValidName || !hasValidColumns;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) {
      if (errors.length > 0) {
        showError(errors[0]);
      }
      return;
    }

    // Clean up columns (remove columns with no name)
    const validColumns = columns.filter(col => col.name.trim());
    
    // Clean up rows (only keep rows that have at least one value)
    const validRows = rows.filter(row => {
      return validColumns.some(col => {
        const value = row[col.id];
        return value !== null && value !== undefined && value !== '';
      });
    });

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      columns: validColumns,
      rows: validRows
    });
  };

  return (
    <div className="space-y-6">
      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">Erreurs de validation</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <Card title="Informations générales">
        <div className="space-y-4">
          <Input
            label="Nom de la liste *"
            placeholder="Ex: Liste des produits"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Description"
            placeholder="Description de la liste..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </Card>

      {/* CSV Import Action */}
      <Card title="Import CSV">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Importer depuis un fichier CSV</h4>
            <p className="text-sm text-gray-600">
              Importez des colonnes et des lignes depuis un fichier CSV. La première ligne doit contenir les noms des colonnes.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowCSVImport(true)}
            className="flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>Importer CSV</span>
          </Button>
        </div>
      </Card>

      {/* Columns Configuration */}
      <Card title={`Colonnes (${columns.length} colonne${columns.length > 1 ? 's' : ''})`}>
        {columns.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-gray-900 font-medium mb-2">Aucune colonne définie</p>
            <p className="text-sm text-gray-600 mb-4">
              Commencez par ajouter une colonne ou importez un fichier CSV pour créer votre liste.
            </p>
            <div className="flex items-center justify-center space-x-3">
              <Button
                onClick={handleAddColumn}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Ajouter une colonne</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowCSVImport(true)}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Importer CSV</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider min-w-[120px] md:min-w-[150px]"
                    >
                      <div className="flex items-center space-x-2 group">
                        {editingColumn === col.id ? (
                          <div className="flex-1 flex items-center space-x-2">
                            <Input
                              value={editingColumnName}
                              onChange={(e) => setEditingColumnName(e.target.value)}
                              onBlur={() => handleSaveColumnName(col.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveColumnName(col.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelColumnNameEdit();
                                }
                              }}
                              className="text-sm font-medium"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center space-x-2">
                            <button
                              onClick={() => handleStartEditColumn(col)}
                              className="text-sm font-medium text-gray-900 hover:text-blue-600 cursor-text"
                              title="Cliquer pour modifier"
                            >
                              {col.name || 'Colonne sans nom'}
                            </button>
                            <div className="relative">
                              <Select
                                value={col.type}
                                onChange={(e) => handleUpdateColumn(col.id, { type: e.target.value as ListColumn['type'] })}
                                options={typeOptions}
                                className="text-xs w-24"
                              />
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteColumn(col.id)}
                          disabled={columns.length <= 1}
                          className="p-1 h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          title="Supprimer la colonne"
                        >
                          <Minus className="h-3 w-3" strokeWidth={3} style={{ color: 'white' }} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-20 md:w-auto">
                    <div className="flex items-center space-x-1 md:space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAddColumn}
                        className="flex items-center space-x-1"
                        title="Ajouter une colonne"
                      >
                        <Plus className="h-3 w-3" />
                        <span className="text-xs hidden sm:inline">Colonne</span>
                      </Button>
                    </div>
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        )}
      </Card>

      {/* Rows Editor - Using the new ListRowsEditor component */}
      {columns.length > 0 && (
        <ListRowsEditor
          columns={columns}
          rows={rows}
          onRowsChange={setRows}
          onValidationError={(errors) => {
            if (errors.length > 0) {
              showError(errors[0]);
            }
          }}
        />
      )}

      {/* CSV Import Modal */}
      {showCSVImport && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]" 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '1rem',
            boxSizing: 'border-box',
            zIndex: 9999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCSVImport(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-full md:max-w-6xl w-full max-h-[90vh] overflow-y-auto mx-2 md:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between z-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-900">Importer depuis CSV</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCSVImport(false)}
                className="p-1.5 h-8 w-8 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 md:p-6">
              <ListsCSVImport
                onImportComplete={handleCSVImportComplete}
                onCancel={() => setShowCSVImport(false)}
                existingColumns={columns}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Save/Cancel buttons at bottom */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
          Annuler
        </Button>
        <Button 
          onClick={handleSave} 
          className="flex items-center justify-center space-x-2 w-full sm:w-auto"
          disabled={isSaveDisabled()}
        >
          <Save className="h-4 w-4" />
          <span>Enregistrer</span>
        </Button>
      </div>
    </div>
  );
};
