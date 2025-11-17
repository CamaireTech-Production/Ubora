import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { List, ListColumn, ListRow } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, Plus, Save, Edit, Trash2 } from 'lucide-react';
import { listsService } from '@ubora/shared/services/listsService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { validateValueAgainstType } from '@ubora/shared/utils/csvTypeDetector';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface ListViewModalProps {
  list: List;
  isOpen: boolean;
  onClose: () => void;
  onListUpdated?: () => void;
}

export const ListViewModal: React.FC<ListViewModalProps> = ({
  list,
  isOpen,
  onClose,
  onListUpdated
}) => {
  const { showSuccess, showError } = useToast();
  const [currentList, setCurrentList] = useState<List>(list);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRowData, setNewRowData] = useState<ListRow>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<ListRow | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);

  // Update current list when list prop changes or modal opens
  useEffect(() => {
    if (list && isOpen) {
      // Reload list from server to ensure we have the latest data
      const loadList = async () => {
        try {
          const updatedList = await listsService.getById(list.id);
          if (updatedList) {
            setCurrentList(updatedList);
          } else {
            setCurrentList(list);
          }
        } catch (error) {
          console.error('Erreur lors du chargement de la liste:', error);
          setCurrentList(list);
        }
      };
      loadList();
    }
  }, [list, isOpen]);

  // Initialize new row data with empty values for all columns
  const initializeNewRow = () => {
    const emptyRow: ListRow = {};
    currentList.columns.forEach(col => {
      emptyRow[col.id] = '';
    });
    return emptyRow;
  };

  // Validate a row value against column type
  const validateRowValue = (columnId: string, value: any): string | null => {
    const column = currentList.columns.find(col => col.id === columnId);
    if (!column) return null;

    // Empty values are allowed
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
    
    currentList.columns.forEach(col => {
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
  const handleSaveNewRow = async () => {
    const errors = validateRow(newRowData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      showError('Veuillez corriger les erreurs avant de sauvegarder');
      return;
    }

    setIsSaving(true);
    try {
      const updatedRows = [...currentList.rows, { ...newRowData }];
      await listsService.update(currentList.id, {
        name: currentList.name,
        description: currentList.description,
        columns: currentList.columns,
        rows: updatedRows,
        updatedAt: new Date()
      });

      setCurrentList({ ...currentList, rows: updatedRows });
      setShowAddForm(false);
      setNewRowData(initializeNewRow());
      setFormErrors({});
      showSuccess('Ligne ajoutée avec succès');
      if (onListUpdated) {
        onListUpdated();
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la ligne:', error);
      showError('Erreur lors de l\'ajout de la ligne');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel add
  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewRowData(initializeNewRow());
    setFormErrors({});
  };

  // Handle start edit
  const handleStartEdit = (rowIndex: number) => {
    setEditingRowIndex(rowIndex);
    setEditingRowData({ ...currentList.rows[rowIndex] });
    setFormErrors({});
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (editingRowIndex === null || !editingRowData) return;

    const errors = validateRow(editingRowData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      showError('Veuillez corriger les erreurs avant de sauvegarder');
      return;
    }

    setIsSaving(true);
    try {
      const updatedRows = [...currentList.rows];
      updatedRows[editingRowIndex] = { ...editingRowData };
      
      await listsService.update(currentList.id, {
        name: currentList.name,
        description: currentList.description,
        columns: currentList.columns,
        rows: updatedRows,
        updatedAt: new Date()
      });

      setCurrentList({ ...currentList, rows: updatedRows });
      setEditingRowIndex(null);
      setEditingRowData(null);
      setFormErrors({});
      showSuccess('Ligne modifiée avec succès');
      if (onListUpdated) {
        onListUpdated();
      }
    } catch (error) {
      console.error('Erreur lors de la modification de la ligne:', error);
      showError('Erreur lors de la modification de la ligne');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingRowIndex(null);
    setEditingRowData(null);
    setFormErrors({});
  };

  // Handle delete row
  const handleDeleteRow = (rowIndex: number) => {
    setRowToDelete(rowIndex);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (rowToDelete === null) return;

    setIsSaving(true);
    try {
      const updatedRows = currentList.rows.filter((_, idx) => idx !== rowToDelete);
      
      await listsService.update(currentList.id, {
        name: currentList.name,
        description: currentList.description,
        columns: currentList.columns,
        rows: updatedRows,
        updatedAt: new Date()
      });

      setCurrentList({ ...currentList, rows: updatedRows });
      setShowDeleteModal(false);
      setRowToDelete(null);
      showSuccess('Ligne supprimée avec succès');
      if (onListUpdated) {
        onListUpdated();
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la ligne:', error);
      showError('Erreur lors de la suppression de la ligne');
    } finally {
      setIsSaving(false);
    }
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

  if (!isOpen) return null;

  return createPortal(
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]" 
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSaving) {
            onClose();
          }
        }}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-full md:max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between z-10">
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">{currentList.name}</h3>
              {currentList.description && (
                <p className="text-sm text-gray-600 mt-1">{currentList.description}</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="p-1.5 h-8 w-8 flex items-center justify-center ml-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="space-y-4">
              {/* Add Row Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleAddRow}
                  disabled={isSaving || showAddForm}
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
                        disabled={isSaving}
                        className="flex items-center"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        <span>Enregistrer</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelAdd}
                        disabled={isSaving}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentList.columns.map(column => (
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
              {currentList.rows.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Aucune ligne dans cette liste. Cliquez sur "Ajouter une ligne" pour commencer.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {currentList.columns.map(column => (
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
                          {currentList.rows.map((row, rowIndex) => {
                            const isEditing = editingRowIndex === rowIndex;
                            const rowData = isEditing && editingRowData ? editingRowData : row;

                            return (
                              <tr key={rowIndex} className={isEditing ? 'bg-blue-50' : ''}>
                                {currentList.columns.map(column => (
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
                                        disabled={isSaving}
                                        className="flex items-center"
                                      >
                                        <Save className="h-4 w-4 mr-1" />
                                        <span>Enregistrer</span>
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        disabled={isSaving}
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
                                        disabled={isSaving}
                                        className="p-1"
                                        title="Modifier"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleDeleteRow(rowIndex)}
                                        disabled={isSaving}
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
              )}
            </div>
          </div>
        </div>
      </div>

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
        isLoading={isSaving}
      />
    </>,
    document.body
  );
};

