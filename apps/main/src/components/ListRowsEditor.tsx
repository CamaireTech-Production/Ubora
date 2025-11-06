import React, { useState, useMemo } from 'react';
import { ListColumn, ListRow } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { ConfirmationModal } from './ConfirmationModal';
import { Plus, Trash2, Edit, Copy, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { validateValueAgainstType } from '@ubora/shared/utils/csvTypeDetector';

interface ListRowsEditorProps {
  columns: ListColumn[];
  rows: ListRow[];
  onRowsChange: (rows: ListRow[]) => void;
  onValidationError?: (errors: string[]) => void;
}

export const ListRowsEditor: React.FC<ListRowsEditorProps> = ({
  columns,
  rows,
  onRowsChange,
  onValidationError
}) => {
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<ListRow | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRowData, setNewRowData] = useState<ListRow>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Initialize new row data with empty values for all columns
  const initializeNewRow = () => {
    const emptyRow: ListRow = {};
    columns.forEach(col => {
      emptyRow[col.id] = '';
    });
    return emptyRow;
  };

  // Filter rows based on search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) {
      return rows;
    }

    const query = searchQuery.toLowerCase();
    return rows.filter(row => {
      return columns.some(col => {
        const value = row[col.id];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(query);
      });
    });
  }, [rows, searchQuery, columns]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  // Reset pagination when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Validate a row value against column type
  const validateRowValue = (columnId: string, value: any): string | null => {
    const column = columns.find(col => col.id === columnId);
    if (!column) return null;

    // Empty values are allowed (unless column is required - to be implemented)
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const stringValue = String(value);
    if (!validateValueAgainstType(stringValue, column.type)) {
      return `La valeur ne correspond pas au type ${column.type}`;
    }

    return null;
  };

  // Validate all values in a row
  const validateRow = (rowData: ListRow): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    columns.forEach(col => {
      const error = validateRowValue(col.id, rowData[col.id]);
      if (error) {
        errors[col.id] = error;
      }
    });

    return errors;
  };

  // Handle add new row
  const handleAddRow = () => {
    setNewRowData(initializeNewRow());
    setFormErrors({});
    setShowAddForm(true);
  };

  // Handle save new row
  const handleSaveNewRow = () => {
    const errors = validateRow(newRowData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      if (onValidationError) {
        onValidationError(Object.values(errors));
      }
      return;
    }

    onRowsChange([...rows, { ...newRowData }]);
    setShowAddForm(false);
    setNewRowData(initializeNewRow());
    setFormErrors({});
  };

  // Handle cancel add
  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewRowData(initializeNewRow());
    setFormErrors({});
  };

  // Handle start edit
  const handleStartEdit = (rowIndex: number) => {
    const actualIndex = startIndex + rowIndex;
    setEditingRowIndex(actualIndex);
    setEditingRowData({ ...filteredRows[actualIndex] });
    setFormErrors({});
  };

  // Handle save edit
  const handleSaveEdit = () => {
    if (editingRowIndex === null || !editingRowData) return;

    const errors = validateRow(editingRowData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      if (onValidationError) {
        onValidationError(Object.values(errors));
      }
      return;
    }

    const updatedRows = [...rows];
    // Find the actual index in the original rows array
    const actualRow = filteredRows[editingRowIndex];
    const originalIndex = rows.findIndex((r, idx) => {
      // Compare row data to find the original index
      return columns.every(col => r[col.id] === actualRow[col.id]);
    });

    if (originalIndex !== -1) {
      updatedRows[originalIndex] = { ...editingRowData };
      onRowsChange(updatedRows);
    }

    setEditingRowIndex(null);
    setEditingRowData(null);
    setFormErrors({});
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingRowIndex(null);
    setEditingRowData(null);
    setFormErrors({});
  };

  // Handle delete row
  const handleDeleteRow = (rowIndex: number) => {
    const actualIndex = startIndex + rowIndex;
    setRowToDelete(actualIndex);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (rowToDelete === null) return;

    const actualRow = filteredRows[rowToDelete];
    const updatedRows = rows.filter((r, idx) => {
      // Find and remove the row by comparing data
      return !columns.every(col => r[col.id] === actualRow[col.id]);
    });

    onRowsChange(updatedRows);
    setShowDeleteModal(false);
    setRowToDelete(null);

    // Reset to first page if current page is empty
    if (paginatedRows.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Handle duplicate row
  const handleDuplicateRow = (rowIndex: number) => {
    const actualIndex = startIndex + rowIndex;
    const rowToDuplicate = filteredRows[actualIndex];
    onRowsChange([...rows, { ...rowToDuplicate }]);
  };

  // Render input field for a column value
  const renderFieldInput = (
    column: ListColumn,
    value: any,
    onChange: (value: any) => void,
    error?: string
  ) => {
    const fieldId = `field_${column.id}`;
    const hasError = !!error;

    switch (column.type) {
      case 'number':
        return (
          <Input
            id={fieldId}
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className={hasError ? 'border-red-500' : ''}
          />
        );
      case 'date':
        return (
          <Input
            id={fieldId}
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={hasError ? 'border-red-500' : ''}
          />
        );
      case 'email':
        return (
          <Input
            id={fieldId}
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={hasError ? 'border-red-500' : ''}
          />
        );
      case 'boolean':
        return (
          <select
            id={fieldId}
            value={value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value === 'true')}
            className={`w-full px-3 py-2 border rounded-md ${hasError ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">--</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        );
      default: // text
        return (
          <Input
            id={fieldId}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={hasError ? 'border-red-500' : ''}
          />
        );
    }
  };

  if (columns.length === 0) {
    return (
      <Card title="Lignes de la liste">
        <div className="text-center py-8 text-gray-500">
          <p>Veuillez d'abord configurer les colonnes de la liste</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card title={`Lignes de la liste (${rows.length} ligne${rows.length > 1 ? 's' : ''})`}>
        <div className="space-y-4">
          {/* Search and Add Row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher dans les lignes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Add Row Button */}
            <Button
              onClick={handleAddRow}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Ajouter une ligne</span>
            </Button>
          </div>

          {/* Add Row Form */}
          {showAddForm && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-blue-900">Nouvelle ligne</h4>
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveNewRow}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelAdd}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {columns.map(column => (
                  <div key={column.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {column.name}
                    </label>
                    {renderFieldInput(
                      column,
                      newRowData[column.id],
                      (value) => setNewRowData({ ...newRowData, [column.id]: value }),
                      formErrors[column.id]
                    )}
                    {formErrors[column.id] && (
                      <p className="mt-1 text-xs text-red-600">{formErrors[column.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rows Table */}
          {filteredRows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? (
                <p>Aucune ligne ne correspond à votre recherche</p>
              ) : (
                <p>Aucune ligne dans cette liste. Cliquez sur "Ajouter une ligne" pour commencer.</p>
              )}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {columns.map(column => (
                            <th
                              key={column.id}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {column.name}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedRows.map((row, rowIndex) => {
                          const isEditing = editingRowIndex === startIndex + rowIndex;
                          const rowData = isEditing && editingRowData ? editingRowData : row;

                          return (
                            <tr key={rowIndex} className={isEditing ? 'bg-blue-50' : ''}>
                              {columns.map(column => (
                                <td key={column.id} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {isEditing ? (
                                    <div>
                                      {renderFieldInput(
                                        column,
                                        rowData[column.id],
                                        (value) => setEditingRowData({ ...editingRowData!, [column.id]: value }),
                                        formErrors[column.id]
                                      )}
                                      {formErrors[column.id] && (
                                        <p className="mt-1 text-xs text-red-600">{formErrors[column.id]}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="truncate block max-w-xs">
                                      {rowData[column.id] !== null && rowData[column.id] !== undefined
                                        ? String(rowData[column.id])
                                        : '-'}
                                    </span>
                                  )}
                                </td>
                              ))}
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                {isEditing ? (
                                  <div className="flex justify-end space-x-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={handleSaveEdit}
                                    >
                                      Enregistrer
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={handleCancelEdit}
                                    >
                                      Annuler
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end space-x-1">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleStartEdit(rowIndex)}
                                      className="p-1"
                                      title="Modifier"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleDuplicateRow(rowIndex)}
                                      className="p-1"
                                      title="Dupliquer"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => handleDeleteRow(rowIndex)}
                                      className="p-1"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">
                      Affichage de {startIndex + 1} à {Math.min(endIndex, filteredRows.length)} sur {filteredRows.length} ligne{filteredRows.length > 1 ? 's' : ''}
                    </span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value={10}>10 par page</option>
                      <option value={25}>25 par page</option>
                      <option value={50}>50 par page</option>
                      <option value={100}>100 par page</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center space-x-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Précédent</span>
                    </Button>
                    <span className="text-sm text-gray-700">
                      Page {currentPage} sur {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center space-x-1"
                    >
                      <span>Suivant</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setRowToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Supprimer la ligne"
        message="Êtes-vous sûr de vouloir supprimer cette ligne ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
      />
    </>
  );
};

