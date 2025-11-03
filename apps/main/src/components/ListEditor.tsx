import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { List, ListColumn, ListRow } from '../types';
import { Plus, Trash2, Save, X, Upload, Edit2 } from 'lucide-react';
import { ListsCSVImport } from './ListsCSVImport';
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
      name: '',
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

  // Add a new row
  const handleAddRow = () => {
    const newRow: ListRow = {};
    columns.forEach(col => {
      newRow[col.id] = '';
    });
    setRows([...rows, newRow]);
  };

  // Update a row value
  const handleUpdateRowValue = (rowIndex: number, columnId: string, value: any) => {
    const updatedRows = [...rows];
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      [columnId]: value
    };
    setRows(updatedRows);
  };

  // Delete a row
  const handleDeleteRow = (rowIndex: number) => {
    setRows(rows.filter((_, index) => index !== rowIndex));
    showSuccess('Ligne supprimée');
  };

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

      {/* Columns Management */}
      <Card 
        title="Colonnes" 
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddColumn}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter une colonne</span>
          </Button>
        }
      >
        {columns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucune colonne définie. Ajoutez au moins une colonne pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {columns.map((column, index) => (
              <div key={column.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Nom de la colonne"
                    value={column.name}
                    onChange={(e) => handleUpdateColumn(column.id, { name: e.target.value })}
                    className="w-full"
                  />
                  <Select
                    value={column.type}
                    onChange={(e) => handleUpdateColumn(column.id, { type: e.target.value as ListColumn['type'] })}
                    options={typeOptions}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteColumn(column.id)}
                  disabled={columns.length <= 1}
                  className="p-1.5 h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* CSV Import */}
      <Card title="Import CSV">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Importer depuis un fichier CSV</h4>
            <p className="text-sm text-gray-600">
              Importez automatiquement des colonnes et des lignes depuis un fichier CSV
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

      {/* Rows Management */}
      <Card 
        title={`Lignes (${rows.length})`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddRow}
            disabled={columns.length === 0}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter une ligne</span>
          </Button>
        }
      >
        {columns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Définissez d'abord au moins une colonne avant d'ajouter des lignes.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucune ligne. Ajoutez des lignes pour remplir votre liste.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                    >
                      {col.name || 'Colonne sans nom'}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((col) => (
                      <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                        <Input
                          value={row[col.id] !== null && row[col.id] !== undefined ? String(row[col.id]) : ''}
                          onChange={(e) => {
                            const column = columns.find(c => c.id === col.id);
                            if (column) {
                              let value: any = e.target.value;
                              // Convert based on type
                              if (column.type === 'number') {
                                value = value ? parseFloat(value) || 0 : '';
                              } else if (column.type === 'boolean') {
                                value = value === 'true' || value === '1' || value.toLowerCase() === 'oui';
                              }
                              handleUpdateRowValue(rowIndex, col.id, value);
                            }
                          }}
                          placeholder={`${col.name} (${col.type})`}
                          className="w-full"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteRow(rowIndex)}
                        className="p-1.5 h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900">Importer depuis CSV</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCSVImport(false)}
                className="p-1.5 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6">
              <ListsCSVImport
                onImportComplete={handleCSVImportComplete}
                onCancel={() => setShowCSVImport(false)}
                existingColumns={columns}
              />
            </div>
          </div>
        </div>
      )}

      {/* Save/Cancel buttons at bottom */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={handleSave} className="flex items-center space-x-2">
          <Save className="h-4 w-4" />
          <span>Enregistrer</span>
        </Button>
      </div>
    </div>
  );
};

