import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { UniversWizardStepProps } from './UniversWizard';
import { ListDefinition, ListColumn, ListRow } from '../types';
import { Plus, Trash2, Edit, Database, CheckCircle, AlertCircle, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { ListEditor } from './ListEditor';
import { ListsCSVImport } from './ListsCSVImport';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';

export const UniversWizardStep2: React.FC<UniversWizardStepProps> = ({
  wizardData,
  updateWizardData,
  markStepCompleted,
  markStepSkipped,
  step
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [lists, setLists] = useState<ListDefinition[]>(
    (wizardData.definitions.lists as ListDefinition[]) || []
  );
  const [showListEditor, setShowListEditor] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvImportListId, setCsvImportListId] = useState<string | null>(null);

  // Sync local state with wizardData when it changes (e.g., after loading from localStorage)
  useEffect(() => {
    const savedLists = (wizardData.definitions.lists as ListDefinition[]) || [];
    // Only update if the saved lists are different from current lists
    if (savedLists.length !== lists.length) {
      setLists(savedLists);
    } else if (savedLists.length > 0) {
      // Deep comparison only if arrays have items
      const savedStr = JSON.stringify(savedLists);
      const currentStr = JSON.stringify(lists);
      if (savedStr !== currentStr) {
        setLists(savedLists);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.definitions.lists]);

  // Update wizard data when lists change
  useEffect(() => {
    updateWizardData({
      definitions: {
        ...wizardData.definitions,
        lists: lists
      }
    });

    // Mark step as completed if lists exist (lists are optional but if created, mark as completed)
    if (lists.length > 0) {
      markStepCompleted(step);
    } else {
      markStepSkipped(step);
    }
  }, [lists, updateWizardData, wizardData.definitions, markStepCompleted, markStepSkipped, step]);

  const handleAddList = () => {
    setEditingListId(null);
    setShowListEditor(true);
  };

  const handleEditList = (listId: string) => {
    setEditingListId(listId);
    setShowListEditor(true);
  };

  const handleDeleteList = (listId: string) => {
    setLists(lists.filter(l => l.id !== listId));
    showSuccess('Liste supprimée');
  };

  const handleSaveList = (listData: {
    name: string;
    description?: string;
    columns: ListColumn[];
    rows: ListRow[];
  }) => {
    if (editingListId) {
      // Update existing list
      setLists(lists.map(l => 
        l.id === editingListId 
          ? {
              ...l,
              name: listData.name,
              description: listData.description,
              columns: listData.columns,
              rows: listData.rows
            }
          : l
      ));
      showSuccess('Liste mise à jour');
    } else {
      // Create new list
      const newList: ListDefinition = {
        id: `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: listData.name,
        description: listData.description,
        columns: listData.columns,
        rows: listData.rows
      };
      setLists([...lists, newList]);
      showSuccess('Liste créée');
    }
    setShowListEditor(false);
    setEditingListId(null);
  };

  const handleCancelList = () => {
    setShowListEditor(false);
    setEditingListId(null);
  };

  const handleToggleExpand = (listId: string) => {
    setExpandedLists(prev => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const handleCSVImport = (listId: string) => {
    setCsvImportListId(listId);
    setShowCSVImport(true);
  };

  const handleCSVImportComplete = (importedColumns: ListColumn[], importedRows: ListRow[]) => {
    if (!csvImportListId) return;

    const list = lists.find(l => l.id === csvImportListId);
    if (!list) return;

    // Update list with imported data
    setLists(lists.map(l =>
      l.id === csvImportListId
        ? {
            ...l,
            columns: importedColumns,
            rows: importedRows
          }
        : l
    ));
    
    setShowCSVImport(false);
    setCsvImportListId(null);
    showSuccess('Données CSV importées avec succès');
  };

  // Show ListEditor when creating/editing (replaces listing view)
  if (showListEditor) {
    const editingList = editingListId ? lists.find(l => l.id === editingListId) : null;
    const listEditorProps = editingList ? {
      name: editingList.name,
      description: editingList.description || '',
      columns: editingList.columns,
      rows: editingList.rows
    } : undefined;

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancelList}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {editingList ? 'Modifier la liste' : 'Créer une nouvelle liste'}
            </h2>
            <p className="text-gray-600">
              {editingList 
                ? 'Modifiez les colonnes et les lignes de votre liste'
                : 'Définissez les colonnes et ajoutez des lignes à votre liste'}
            </p>
          </div>
        </div>

        <ListEditor
          list={listEditorProps ? {
            id: editingList?.id || '',
            name: listEditorProps.name,
            description: listEditorProps.description,
            columns: listEditorProps.columns,
            rows: listEditorProps.rows,
            createdBy: user?.id || '',
            createdByRole: 'directeur',
            agencyId: user?.agencyId || '',
            createdAt: new Date(),
            updatedAt: new Date()
          } : undefined}
          onSave={handleSaveList}
          onCancel={handleCancelList}
        />
      </div>
    );
  }

  // Show listing view when not creating/editing
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Listes
        </h2>
        <p className="text-gray-600">
          Créez des listes d'options réutilisables pour vos formulaires. Les listes peuvent être utilisées dans les champs de type "liste déroulante" de vos formulaires.
        </p>
      </div>

      {/* Lists List */}
      {lists.length > 0 && (
        <div className="space-y-3">
          {lists.map(list => {
            const isExpanded = expandedLists.has(list.id);
            return (
              <Card key={list.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <Database className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{list.name}</h3>
                        </div>
                        {list.description && (
                          <span className="text-sm text-gray-500">— {list.description}</span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                        <span>{list.columns.length} colonne{list.columns.length > 1 ? 's' : ''}</span>
                        <span>{list.rows.length} ligne{list.rows.length > 1 ? 's' : ''}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          {/* Columns */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Colonnes:</h4>
                            <div className="space-y-2">
                              {list.columns.map(col => (
                                <div key={col.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                                  <span className="text-sm font-medium text-gray-900">{col.name}</span>
                                  <span className="text-xs text-gray-500 px-2 py-1 bg-gray-200 rounded">
                                    {col.type}
                                  </span>
                                </div>
                              ))}
                            </div>
          </div>
          
                          {/* Preview of rows (first 3) */}
                          {list.rows.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Aperçu des données (3 premières lignes):</h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      {list.columns.map(col => (
                                        <th key={col.id} className="px-2 py-1 text-left text-xs font-medium text-gray-700">
                                          {col.name}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {list.rows.slice(0, 3).map((row, rowIndex) => (
                                      <tr key={rowIndex}>
                                        {list.columns.map(col => (
                                          <td key={col.id} className="px-2 py-1 text-xs text-gray-600">
                                            {String(row[col.id] || '-')}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {list.rows.length > 3 && (
                                <p className="text-xs text-gray-500 mt-2">
                                  ... et {list.rows.length - 3} ligne{list.rows.length - 3 > 1 ? 's' : ''} supplémentaire{list.rows.length - 3 > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
          </div>

                    <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0 sm:ml-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleExpand(list.id)}
                        className="flex items-center space-x-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            <span className="hidden sm:inline">Réduire</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            <span className="hidden sm:inline">Développer</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCSVImport(list.id)}
                        className="flex items-center space-x-1"
                      >
                        <Database className="h-4 w-4" />
                        <span className="hidden sm:inline">Import CSV</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditList(list.id)}
                        className="flex items-center space-x-1"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline">Modifier</span>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteList(list.id)}
                        className="flex items-center space-x-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Supprimer</span>
                      </Button>
              </div>
            </div>
          </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {lists.length === 0 && !showListEditor && (
        <Card>
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Database className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune liste créée
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre première liste pour commencer à utiliser des options réutilisables dans vos formulaires.
            </p>
            <Button onClick={handleAddList} className="flex items-center space-x-2 mx-auto">
              <Plus className="h-4 w-4" />
              <span>Créer une liste</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Add List Button */}
      {lists.length > 0 && !showListEditor && (
        <div className="flex justify-end">
          <Button onClick={handleAddList} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Ajouter une liste</span>
          </Button>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVImport && csvImportListId && (
        <ListsCSVImport
          isOpen={showCSVImport}
          onClose={() => {
            setShowCSVImport(false);
            setCsvImportListId(null);
          }}
          onImportComplete={handleCSVImportComplete}
          initialColumns={lists.find(l => l.id === csvImportListId)?.columns || []}
          initialRows={lists.find(l => l.id === csvImportListId)?.rows || []}
        />
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">
              À propos des listes
            </h4>
            <p className="text-sm text-blue-700">
              Les listes permettent de créer des options réutilisables pour les champs de type "liste déroulante" dans vos formulaires. 
              Lorsqu'un utilisateur sélectionne une option, l'ensemble de la ligne de données sera stocké dans les réponses du formulaire.
            </p>
            {lists.length === 0 && (
              <p className="text-sm text-blue-600 mt-2">
                Cette étape est optionnelle. Vous pouvez ignorer cette étape et continuer avec les formulaires.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
