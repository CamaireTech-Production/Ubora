import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DashboardMetric, Form, FormField, TableColumnConfig, TableRowSource, AggregateColumn, DerivedColumn, LabelColumn, List, TableFilter } from '../types';
import { ColumnFormulaInput } from './ColumnFormulaInput';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { Plus, Trash2, AlertCircle, FileText, Hash, Type, Mail, Calendar, CheckSquare, Upload, AlertTriangle, ArrowLeft, Calculator, Table, ArrowUp, ArrowDown, Package } from 'lucide-react';
import { GraphPreview } from './charts/GraphPreview';
import { getValidYAxisFields, validateYAxisField } from '@ubora/shared/utils/GraphFieldValidator';
import { MetricFormulaInput } from './MetricFormulaInput';
import { MetricFormulaParser } from '../utils/MetricFormulaParser';
import { listsService } from '@ubora/shared/services';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useAuth } from '@ubora/shared/contexts/AuthContext';

interface DashboardBuilderProps {
  onSave: (dashboard: {
    name: string;
    description: string;
    metrics: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[];
  }) => void;
  onCancel: () => void;
  forms: Form[];
  formEntries: any[];
  currentUserId: string;
  agencyId: string;
  isLoading?: boolean;
  initialDashboard?: {
    name: string;
    description?: string;
    metrics: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[];
  };
  universLists?: List[]; // Optional Univers lists (for Univers edit context)
}

export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  onSave,
  onCancel,
  forms,
  formEntries,
  currentUserId,
  agencyId,
  isLoading = false,
  initialDashboard,
  universLists
}) => {
  const { user } = useAuth();
  const { activeUniversId, activeInstanceId } = useApp();
  const [name, setName] = useState(initialDashboard?.name || '');
  const [description, setDescription] = useState(initialDashboard?.description || '');
  const [metrics, setMetrics] = useState<Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[]>(initialDashboard?.metrics || []);
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const [showGraphPreviews, setShowGraphPreviews] = useState<Record<number, boolean>>({});
  const [lists, setLists] = useState<List[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  
  // Load lists for table metrics
  useEffect(() => {
    const loadLists = async () => {
      if (!user?.id || !user?.agencyId) return;
      
      setIsLoadingLists(true);
      try {
        // Load lists from database
        const dbLists = await listsService.getByUser(user.id, user.agencyId, user.role, activeUniversId || null, activeInstanceId || null);
        
        // Merge Univers lists with DB lists (Univers lists take precedence by ID)
        const mergedLists: List[] = universLists ? [...universLists] : [];
        dbLists.forEach(dbList => {
          if (!mergedLists.find(l => l.id === dbList.id)) {
            mergedLists.push(dbList);
          }
        });
        
        setLists(mergedLists);
      } catch (error) {
        console.error('Error loading lists:', error);
        // If DB load fails, still use Univers lists if available
        if (universLists) {
          setLists(universLists);
        }
      } finally {
        setIsLoadingLists(false);
      }
    };
    
    loadLists();
  }, [user, activeUniversId, universLists]);
  
  // Auto-scroll to errors when they appear (mobile-responsive)
  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      // Immediate scroll
      errorRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
      
      // Additional scroll after delay for mobile keyboard animations
      setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }
      }, 100);
    }
  }, [errors]);

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
      case 'calculated': return <Hash className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'textarea': return <Type className="h-4 w-4" />;
      case 'select': return <CheckSquare className="h-4 w-4" />;
      case 'checkbox': return <CheckSquare className="h-4 w-4" />;
      case 'date': return <Calendar className="h-4 w-4" />;
      case 'file': return <Upload className="h-4 w-4" />;
      default: return <Type className="h-4 w-4" />;
    }
  };

  const getCalculationOptions = (fieldType: string) => {
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'textarea':
      case 'select':
      case 'checkbox':
      case 'date':
      case 'file':
        return [
          { value: 'count', label: 'Nombre de soumissions' },
          { value: 'unique', label: 'Valeurs uniques' }
        ];
      case 'number':
      case 'calculated':
        return [
          { value: 'count', label: 'Nombre de soumissions' },
          { value: 'sum', label: 'Somme' },
          { value: 'average', label: 'Moyenne' },
          { value: 'min', label: 'Minimum' },
          { value: 'max', label: 'Maximum' },
          { value: 'unique', label: 'Valeurs uniques' }
        ];
      default:
        return [{ value: 'count', label: 'Nombre de soumissions' }];
    }
  };

  const addMetric = () => {
    const newMetric: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'> = {
      name: '',
      description: '',
      sourceType: 'field', // Default to field-based metric
      formId: '',
      fieldId: '',
      fieldType: 'text',
      calculationType: 'count',
      metricType: 'value', // Default to 'value'
      graphConfig: undefined,
      tableConfig: undefined
    };

    setMetrics([...metrics, newMetric]);
    setErrors([]);
  };

  // Stock management table preset
  const applyStockPreset = (metricIndex: number) => {
    // Find Products list (or first list if Products doesn't exist)
    const productsList = lists.find(l => l.name.toLowerCase().includes('produit')) || lists[0];
    if (!productsList) {
      // Don't show alert, just return silently - user can configure manually
      return;
    }

    // Find key and label fields (typically 'id' and 'name')
    const keyField = productsList.columns.find(c => c.id === 'id' || c.name.toLowerCase().includes('id')) || productsList.columns[0];
    const labelField = productsList.columns.find(c => c.name.toLowerCase().includes('nom') || c.name.toLowerCase().includes('name')) || productsList.columns.find(c => c.id !== keyField.id) || productsList.columns[0];

    // Find Physical Stock and Movement forms
    const physicalStockForm = forms.find(f => f.title.toLowerCase().includes('stock') && f.title.toLowerCase().includes('physique')) || forms.find(f => f.title.toLowerCase().includes('stock'));
    const movementForm = forms.find(f => f.title.toLowerCase().includes('mouvement')) || forms.find(f => f.title.toLowerCase().includes('entrée') || f.title.toLowerCase().includes('sortie'));

    if (!physicalStockForm || !movementForm) {
      alert('Veuillez d\'abord créer les formulaires "Stock Physique" et "Mouvement"');
      return;
    }

    // Find product select field in forms
    const productFieldPhysical = physicalStockForm.fields.find(f => f.type === 'select' && f.listId === productsList.id) || physicalStockForm.fields.find(f => f.type === 'select');
    const productFieldMovement = movementForm.fields.find(f => f.type === 'select' && f.listId === productsList.id) || movementForm.fields.find(f => f.type === 'select');
    const qtyFieldPhysical = physicalStockForm.fields.find(f => f.type === 'number' && (f.label.toLowerCase().includes('quantité') || f.label.toLowerCase().includes('qty'))) || physicalStockForm.fields.find(f => f.type === 'number');
    const qtyFieldMovement = movementForm.fields.find(f => f.type === 'number' && (f.label.toLowerCase().includes('quantité') || f.label.toLowerCase().includes('qty'))) || movementForm.fields.find(f => f.type === 'number');
    const movementTypeField = movementForm.fields.find(f => f.type === 'select' && (f.label.toLowerCase().includes('type') || f.label.toLowerCase().includes('mouvement')));

    if (!productFieldPhysical || !productFieldMovement || !qtyFieldPhysical || !qtyFieldMovement) {
      alert('Les formulaires doivent contenir des champs de sélection de produit et des champs numériques de quantité');
      return;
    }

    // Create stock preset columns
    const columns: TableColumnConfig[] = [
      {
        id: 'col_name',
        type: 'label',
        name: 'Produit',
        source: 'list',
        labelFieldId: labelField.id
      } as LabelColumn,
      {
        id: 'col_initial',
        type: 'aggregate',
        name: 'Stock initial',
        formId: physicalStockForm.id,
        rowKeyFieldId: productFieldPhysical.id,
        valueFieldId: qtyFieldPhysical.id,
        agg: 'latest'
      } as AggregateColumn,
      {
        id: 'col_in',
        type: 'aggregate',
        name: 'Entrées',
        formId: movementForm.id,
        rowKeyFieldId: productFieldMovement.id,
        valueFieldId: qtyFieldMovement.id,
        agg: 'sum',
        filters: movementTypeField ? [{
          fieldId: movementTypeField.id,
          op: 'eq',
          value: 'in'
        }] : undefined
      } as AggregateColumn,
      {
        id: 'col_out',
        type: 'aggregate',
        name: 'Sorties',
        formId: movementForm.id,
        rowKeyFieldId: productFieldMovement.id,
        valueFieldId: qtyFieldMovement.id,
        agg: 'sum',
        filters: movementTypeField ? [{
          fieldId: movementTypeField.id,
          op: 'eq',
          value: 'out'
        }] : undefined
      } as AggregateColumn,
      {
        id: 'col_end',
        type: 'derived',
        name: 'Stock théorique',
        formula: 'col_initial + col_in - col_out'
      } as DerivedColumn,
      {
        id: 'col_physical',
        type: 'aggregate',
        name: 'Physique',
        formId: physicalStockForm.id,
        rowKeyFieldId: productFieldPhysical.id,
        valueFieldId: qtyFieldPhysical.id,
        agg: 'latest'
      } as AggregateColumn,
      {
        id: 'col_variance',
        type: 'derived',
        name: 'Écart',
        formula: 'col_physical - col_end'
      } as DerivedColumn
    ];

    updateMetric(metricIndex, {
      name: 'Gestion des stocks',
      description: 'Tableau de gestion des stocks avec calculs automatiques',
      metricType: 'table',
      tableConfig: {
        rowSource: {
          type: 'list',
          listId: productsList.id,
          keyFieldId: keyField.id,
          labelFieldId: labelField.id
        },
        columns,
        emptyRows: 'show'
      }
    });
  };

  const removeMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  // Helper to ensure tableConfig has required structure
  const ensureTableConfig = (tableConfig: any): any => {
    if (!tableConfig) {
      return {
        rowSource: { type: 'entries' as const, formId: '' },
        columns: []
      };
    }
    return {
      ...tableConfig,
      rowSource: tableConfig.rowSource || { type: 'entries' as const, formId: '' },
      columns: tableConfig.columns || []
    };
  };

  const updateMetric = (index: number, updates: Partial<Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    setMetrics(metrics.map((metric, i) => {
      if (i === index) {
        const updated = { ...metric, ...updates };
        // Ensure tableConfig is properly structured if it exists
        if (updated.tableConfig) {
          updated.tableConfig = ensureTableConfig(updated.tableConfig);
        }
        return updated;
      }
      return metric;
    }));
  };

  const handleSave = useCallback(() => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Le nom du tableau de bord est requis');
    }
    
    if (metrics.length === 0) {
      newErrors.push('Au moins une métrique est requise');
    }

    metrics.forEach((metric, index) => {
      if (!metric.name.trim()) {
        newErrors.push(`Le nom de la métrique ${index + 1} est requis`);
      }
      
      const sourceType = metric.sourceType || 'field';
      
      if (sourceType === 'field') {
        // Field-based metrics require formId and fieldId (only for value and graph types)
        // Table metrics don't need formId/fieldId as they use columns configuration
        if (metric.metricType !== 'table') {
          if (!metric.formId) {
            newErrors.push(`Le formulaire de la métrique ${index + 1} est requis`);
          }
          // fieldId is only required for value type (not for graph)
          if (metric.metricType === 'value' && !metric.fieldId) {
            newErrors.push(`Le champ de la métrique ${index + 1} est requis`);
          }
        }
      } else if (sourceType === 'computed') {
        // Computed metrics must have metricType: 'value' (no graphs, no tables)
        if (metric.metricType !== 'value') {
          newErrors.push(`Les métriques calculées doivent être de type "Valeur numérique" (métrique ${index + 1})`);
        }
        
        // Computed metrics require a formula
        if (!metric.calculationFormula || !metric.calculationFormula.trim()) {
          newErrors.push(`La formule de calcul de la métrique ${index + 1} est requise`);
        }
        
        // Check for circular dependencies
        if (metric.dependsOn && metric.dependsOn.length > 0) {
          // Convert metrics to shared package format for validation
          const metricsForValidation = metrics.map((m, i) => {
            const baseMetric = {
              ...m,
              id: `metric_${i + 1}`, // Temporary IDs for validation
              createdAt: new Date(),
              createdBy: currentUserId,
              agencyId: agencyId
            };
            // Remove tableConfig if present to avoid type conflicts
            const { tableConfig, ...rest } = baseMetric as any;
            return rest;
          });
          const hasCircular = MetricFormulaParser.hasCircularDependency(
            `metric_${index + 1}`, // Temporary ID for validation
            metric.dependsOn,
            metricsForValidation as any
          );
          
          if (hasCircular) {
            newErrors.push(`La métrique ${index + 1} a une dépendance circulaire`);
          }
        }
      }

      // Table metrics validation
      if (metric.metricType === 'table') {
        // Table metrics require at least one column
        if (!metric.tableConfig || !metric.tableConfig.columns || metric.tableConfig.columns.length === 0) {
          newErrors.push(`La métrique tableau ${index + 1} doit avoir au moins une colonne`);
        } else {
          // Validate rowSource
          if (!metric.tableConfig.rowSource) {
            newErrors.push(`La source des lignes de la métrique tableau ${index + 1} est requise`);
          } else if (metric.tableConfig.rowSource.type === 'list') {
            if (!metric.tableConfig.rowSource.listId) {
              newErrors.push(`La liste de la métrique tableau ${index + 1} est requise`);
            }
          } else if (metric.tableConfig.rowSource.type === 'entries') {
            if (!metric.tableConfig.rowSource.formId) {
              newErrors.push(`Le formulaire de la métrique tableau ${index + 1} est requis`);
            }
          }
          
          // Validate each column
          metric.tableConfig.columns.forEach((column, colIndex) => {
            // Column name is required
            if (!column.name || !column.name.trim()) {
              newErrors.push(`Le nom de la colonne ${colIndex + 1} de la métrique tableau ${index + 1} est requis`);
            }

            // Validate based on column type
            if ((column as any).type === 'aggregate') {
              const aggCol = column as AggregateColumn;
              if (!aggCol.formId || !aggCol.formId.trim()) {
                newErrors.push(`Le formulaire de la colonne ${colIndex + 1} de la métrique tableau ${index + 1} est requis`);
              }
              if (!aggCol.rowKeyFieldId || !aggCol.rowKeyFieldId.trim()) {
                newErrors.push(`Le champ de référence de la colonne ${colIndex + 1} de la métrique tableau ${index + 1} est requis`);
              }
              if (!aggCol.valueFieldId || !aggCol.valueFieldId.trim()) {
                newErrors.push(`Le champ de valeur de la colonne ${colIndex + 1} de la métrique tableau ${index + 1} est requis`);
              }
              
              // Validate filters
              if (aggCol.filters && aggCol.filters.length > 0) {
                const columnForm = forms.find(f => f.id === aggCol.formId);
                if (columnForm) {
                  aggCol.filters.forEach((filter, filterIndex) => {
                    if (!filter.fieldId || !filter.fieldId.trim()) {
                      newErrors.push(`La métrique "${metric.name || `Métrique ${index + 1}`}" (tableau) - Colonne ${colIndex + 1} - Filtre ${filterIndex + 1} : Le champ est requis`);
                    } else {
                      const filterField = columnForm.fields.find(f => f.id === filter.fieldId);
                      if (!filterField) {
                        newErrors.push(`La métrique "${metric.name || `Métrique ${index + 1}`}" (tableau) - Colonne ${colIndex + 1} - Filtre ${filterIndex + 1} : Le champ sélectionné n'existe pas dans le formulaire`);
                      } else {
                        // Validate filter value based on operator
                        if (filter.op !== 'is_empty' && filter.op !== 'is_not_empty') {
                          if (filter.value === null || filter.value === undefined || filter.value === '') {
                            newErrors.push(`La métrique "${metric.name || `Métrique ${index + 1}`}" (tableau) - Colonne ${colIndex + 1} - Filtre ${filterIndex + 1} : La valeur est requise`);
                          } else if ((filter.op === 'in' || filter.op === 'nin') && (!Array.isArray(filter.value) || filter.value.length === 0)) {
                            newErrors.push(`La métrique "${metric.name || `Métrique ${index + 1}`}" (tableau) - Colonne ${colIndex + 1} - Filtre ${filterIndex + 1} : Au moins une valeur doit être sélectionnée`);
                          } else if ((filter.op === 'greater_than' || filter.op === 'less_than' || filter.op === 'greater_equal' || filter.op === 'less_equal') && 
                                    (filterField.type !== 'number' && filterField.type !== 'calculated' && filterField.type !== 'date')) {
                            newErrors.push(`La métrique "${metric.name || `Métrique ${index + 1}`}" (tableau) - Colonne ${colIndex + 1} - Filtre ${filterIndex + 1} : Les opérateurs de comparaison ne peuvent être utilisés qu'avec des champs numériques ou de date`);
                          }
                        }
                      }
                    }
                  });
                }
              }
            } else if ((column as any).type === 'derived') {
              const derivedCol = column as DerivedColumn;
              if (!derivedCol.formula || !derivedCol.formula.trim()) {
                newErrors.push(`La formule de la colonne ${colIndex + 1} de la métrique tableau ${index + 1} est requise`);
              }
            } else if ((column as any).type === 'label') {
              const labelCol = column as LabelColumn;
              if (!labelCol.labelFieldId || !labelCol.labelFieldId.trim()) {
                newErrors.push(`Le champ label de la colonne ${colIndex + 1} de la métrique tableau ${index + 1} est requis`);
              }
            }
          });
        }
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      metrics
    });
  }, [name, description, metrics, onSave]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Affichage des erreurs de validation */}
      {errors.length > 0 && (
        <Card ref={errorRef} className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                Veuillez corriger les erreurs suivantes :
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4 sm:space-y-6">
          <Input
            label="Nom du tableau de bord *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Tableau de bord des ventes"
            required
          />
          
          <Textarea
            label="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description du tableau de bord..."
            rows={3}
          />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-medium text-gray-900">Métriques du tableau de bord</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addMetric}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Ajouter une métrique</span>
                <span className="sm:hidden">Ajouter</span>
              </Button>
            </div>

            {metrics.length === 0 ? (
              <p className="text-gray-500 text-center py-6 sm:py-8 bg-gray-50 rounded-lg text-sm sm:text-base">
                Aucune métrique ajoutée. Cliquez sur "Ajouter une métrique" pour commencer.
              </p>
            ) : (
              <div className="space-y-4">
                {metrics.map((metric, index) => {
                  const selectedForm = forms.find(form => form.id === metric.formId);
                  
                  return (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">Métrique {index + 1}</h4>
                            <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                              ID: metric_{index + 1}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => removeMetric(index)}
                            className="flex items-center space-x-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="Nom de la métrique *"
                            value={metric.name}
                            onChange={(e) => updateMetric(index, { name: e.target.value })}
                            placeholder="Ex: Nombre de ventes"
                            required
                          />

                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type de métrique *
                            </label>
                            <Select
                              value={metric.sourceType || 'field'}
                              onChange={(e) => {
                                const sourceType = e.target.value as 'field' | 'computed';
                                updateMetric(index, { 
                                  sourceType,
                                  // Force metricType to 'value' for computed metrics
                                  metricType: sourceType === 'computed' ? 'value' : (metric.metricType || 'value'),
                                  // Reset graphConfig for computed metrics
                                  graphConfig: sourceType === 'computed' ? undefined : metric.graphConfig,
                                  // Reset form/field when switching to computed
                                  formId: sourceType === 'computed' ? undefined : metric.formId,
                                  fieldId: sourceType === 'computed' ? undefined : metric.fieldId,
                                  // Reset formula when switching to field
                                  calculationFormula: sourceType === 'field' ? undefined : metric.calculationFormula,
                                  userFormula: sourceType === 'field' ? undefined : metric.userFormula,
                                  dependsOn: sourceType === 'field' ? undefined : metric.dependsOn
                                });
                              }}
                              options={[
                                { value: 'field', label: 'Basée sur un champ' },
                                { value: 'computed', label: 'Calculée' }
                              ]}
                            />
                          </div>
                        </div>

                        {/* Field-based metric configuration */}
                        {(metric.sourceType || 'field') === 'field' && (
                          <>
                            {/* Type d'affichage - visible immédiatement */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Type d'affichage *
                              </label>
                              <Select
                                value={metric.metricType || 'value'}
                                onChange={(e) => {
                                  const metricType = e.target.value as 'value' | 'graph' | 'table';
                                  updateMetric(index, { 
                                    metricType,
                                    graphConfig: metricType === 'graph' ? {
                                      xAxisType: 'time',
                                      yAxisType: 'count',
                                      chartType: 'line'
                                    } : undefined,
                                    // Initialize tableConfig when switching to table
                                    tableConfig: metricType === 'table' ? (metric.tableConfig || {
                                      rowSource: { type: 'entries', formId: '' },
                                      columns: []
                                    }) : undefined,
                                    // Reset form/field when switching to table (not needed for table)
                                    formId: metricType === 'table' ? undefined : metric.formId,
                                    fieldId: metricType === 'table' ? undefined : metric.fieldId,
                                    fieldType: metricType === 'table' ? undefined : metric.fieldType
                                  });
                                }}
                                options={[
                                  { value: 'value', label: 'Valeur numérique' },
                                  { value: 'graph', label: 'Graphique' },
                                  { value: 'table', label: 'Tableau' }
                                ]}
                              />
                            </div>

                            {/* Formulaire et Champ - seulement pour Valeur numérique et Graphique */}
                            {(metric.metricType === 'value' || metric.metricType === 'graph' || !metric.metricType) && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select
                                  label="Formulaire *"
                                  value={metric.formId || ''}
                                  onChange={(e) => {
                                    updateMetric(index, { 
                                      formId: e.target.value,
                                      fieldId: '', // Reset field when form changes
                                      fieldType: 'text'
                                    });
                                  }}
                                  options={[
                                    { value: '', label: 'Choisir un formulaire...' },
                                    ...forms.map(form => ({
                                      value: form.id,
                                      label: form.title
                                    }))
                                  ]}
                                />

                                {/* Champ du formulaire - seulement pour Valeur numérique */}
                                {selectedForm && metric.metricType === 'value' && (
                                  <Select
                                    label="Champ du formulaire *"
                                    value={metric.fieldId || ''}
                                    onChange={(e) => {
                                      const field = selectedForm.fields.find((f: FormField) => f.id === e.target.value);
                                      updateMetric(index, { 
                                        fieldId: e.target.value,
                                        fieldType: field?.type || 'text'
                                      });
                                    }}
                                    options={[
                                      { value: '', label: 'Choisir un champ...' },
                                      ...selectedForm.fields.map((field: FormField) => ({
                                        value: field.id,
                                        label: `${field.label} (${field.type})`
                                      }))
                                    ]}
                                  />
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Computed metric configuration */}
                        {(metric.sourceType || 'field') === 'computed' && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-2 mb-3">
                              <Calculator className="h-5 w-5 text-blue-600" />
                              <h4 className="font-medium text-blue-900">Configuration de la métrique calculée</h4>
                            </div>
                            
                            <MetricFormulaInput
                              value={metric.userFormula || metric.calculationFormula || ''}
                              onChange={(formula) => {
                                // Create metrics with temporary IDs for parsing
                                const metricsWithTempIds = metrics.map((m, i) => ({
                                  ...m,
                                  id: `temp_${i}`, // Generate temp ID for parsing
                                  createdAt: new Date(),
                                  createdBy: currentUserId,
                                  agencyId: agencyId
                                })) as DashboardMetric[];
                                
                                const parseResult = MetricFormulaParser.parseUserFormula(
                                  formula,
                                  metricsWithTempIds as any,
                                  `temp_${index}`
                                );

                                updateMetric(index, {
                                  calculationFormula: parseResult.formulaWithIds,
                                  userFormula: parseResult.userFormula,
                                  dependsOn: parseResult.metricIds
                                });
                              }}
                              metrics={metrics.map((m, i) => ({
                                ...m,
                                id: `temp_${i}`, // Generate temp ID for parsing
                                createdAt: new Date(),
                                createdBy: currentUserId,
                                agencyId: agencyId
                              })) as any as DashboardMetric[]}
                              currentMetricId={`temp_${index}`}
                            />
                          </div>
                        )}

                        <Input
                          label="Description (optionnel)"
                          value={metric.description || ''}
                          onChange={(e) => updateMetric(index, { description: e.target.value })}
                          placeholder="Description de la métrique..."
                        />

                      {/* Value type configuration - only for field-based metrics */}
                      {metric.metricType === 'value' && (metric.sourceType || 'field') === 'field' && metric.fieldId && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type de calcul
                          </label>
                          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                            {getFieldIcon(metric.fieldType)}
                            <Select
                              value={metric.calculationType}
                              onChange={(e) => updateMetric(index, { calculationType: e.target.value as any })}
                              options={getCalculationOptions(metric.fieldType)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Graph type configuration */}
                      {metric.metricType === 'graph' && metric.graphConfig && (
                        <div className="mt-4 space-y-4 p-4 bg-blue-50 rounded-lg">
                          <h5 className="font-medium text-blue-900">Configuration du graphique</h5>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Axe X (horizontal)
                              </label>
                              <Select
                                value={metric.graphConfig.xAxisType || 'time'}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    xAxisType: e.target.value as 'field' | 'time' | 'date'
                                  }
                                })}
                                options={[
                                  { value: 'time', label: 'Heure de soumission' },
                                  { value: 'date', label: 'Date de soumission' },
                                  { value: 'field', label: 'Champ du formulaire' }
                                ]}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Axe Y (vertical)
                              </label>
                              <Select
                                value={metric.graphConfig.yAxisType || 'count'}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    yAxisType: e.target.value as 'field' | 'count' | 'sum' | 'average'
                                  }
                                })}
                                options={[
                                  { value: 'count', label: 'Nombre de soumissions' },
                                  { value: 'sum', label: 'Somme des valeurs' },
                                  { value: 'average', label: 'Moyenne des valeurs' },
                                  { value: 'field', label: 'Valeur du champ' }
                                ]}
                              />
                            </div>
                          </div>

                          {/* X Axis Field Selection */}
                          {metric.graphConfig.xAxisType === 'field' && selectedForm && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Champ pour l'axe X
                              </label>
                              <Select
                                value={metric.graphConfig.xAxisFieldId || ''}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    xAxisFieldId: e.target.value
                                  }
                                })}
                                options={[
                                  { value: '', label: 'Choisir un champ...' },
                                  ...selectedForm.fields.map((field: FormField) => ({
                                    value: field.id,
                                    label: `${field.label} (${field.type})`
                                  }))
                                ]}
                              />
                            </div>
                          )}

                          {/* Y Axis Field Selection */}
                          {metric.graphConfig.yAxisType === 'field' && selectedForm && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Champ pour l'axe Y
                              </label>
                              <Select
                                value={metric.graphConfig.yAxisFieldId || ''}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    yAxisFieldId: e.target.value
                                  }
                                })}
                                options={[
                                  { value: '', label: 'Choisir un champ...' },
                                  ...getValidYAxisFields(selectedForm.fields, metric.calculationType, 'field').map((field: FormField) => ({
                                    value: field.id,
                                    label: `${field.label} (${field.type})`
                                  }))
                                ]}
                              />
                              
                              {/* Field validation error message */}
                              {metric.graphConfig?.yAxisFieldId && (() => {
                                const selectedField = selectedForm.fields.find(f => f.id === metric.graphConfig?.yAxisFieldId);
                                if (selectedField) {
                                  const validation = validateYAxisField(selectedField, metric.calculationType, 'field');
                                  if (!validation.isValid) {
                                    return (
                                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                        <div className="flex items-start">
                                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                          <div className="text-sm">
                                            <p className="text-red-800 font-medium">
                                              {validation.errorMessage}
                                            </p>
                                            {validation.warningMessage && (
                                              <p className="text-red-700 mt-1">
                                                {validation.warningMessage}
                                              </p>
                                            )}
                                            {validation.suggestedAlternatives && validation.suggestedAlternatives.length > 0 && (
                                              <div className="mt-2">
                                                <p className="text-red-700 font-medium">Suggestions :</p>
                                                <ul className="list-disc list-inside text-red-600 mt-1">
                                                  {validation.suggestedAlternatives.map((suggestion, idx) => (
                                                    <li key={idx}>{suggestion}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })()}
                              
                              {/* Help text for field selection */}
                              <p className="mt-1 text-xs text-blue-600">
                                💡 Seuls les champs numériques (number, calculated) sont disponibles pour l'axe Y
                              </p>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type de graphique
                            </label>
                            <Select
                              value={metric.graphConfig.chartType || 'line'}
                              onChange={(e) => updateMetric(index, { 
                                graphConfig: {
                                  ...metric.graphConfig!,
                                  chartType: e.target.value as 'line' | 'bar' | 'area'
                                }
                              })}
                              options={[
                                { value: 'line', label: 'Ligne' },
                                { value: 'bar', label: 'Barres' },
                                { value: 'area', label: 'Aire' }
                              ]}
                            />
                          </div>
                        </div>
                      )}

                      {/* Table type configuration */}
                      {metric.metricType === 'table' && (
                        <div className="mt-4 space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <Table className="h-5 w-5 text-purple-600" />
                              <h5 className="font-medium text-purple-900">Configuration du tableau</h5>
                            </div>
                            <div className="flex items-center space-x-2">
                              {/* Stock preset button */}
                              {!metric.tableConfig?.rowSource || (metric.tableConfig.rowSource.type === 'list' && lists.length > 0) ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => applyStockPreset(index)}
                                  className="flex items-center space-x-1"
                                >
                                  <Package className="h-4 w-4" />
                                  <span>Préréglage Stocks</span>
                                </Button>
                              ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const newColumn: TableColumnConfig = {
                                  id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                  type: 'aggregate',
                                  name: '',
                                  formId: '',
                                  rowKeyFieldId: '',
                                  valueFieldId: '',
                                  agg: 'sum'
                                } as AggregateColumn;
                                const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                updateMetric(index, {
                                  tableConfig: {
                                    ...currentTableConfig,
                                    columns: [...currentTableConfig.columns, newColumn]
                                  }
                                });
                              }}
                              className="flex items-center space-x-1"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Ajouter une colonne</span>
                            </Button>
                            </div>
                          </div>

                          {/* Row source selection */}
                          <div className="p-3 bg-white rounded-lg border border-purple-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Source des lignes *
                            </label>
                            <div className="flex space-x-4">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`rowSource-${index}`}
                                  value="list"
                                  checked={metric.tableConfig?.rowSource?.type === 'list'}
                                  onChange={() => {
                                    // Allow selection even if lists are still loading or empty
                                    // User can select a list from dropdown once lists are loaded
                                    const firstList = lists[0];
                                    const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                    if (firstList) {
                                      const keyField = firstList.columns[0];
                                      const labelField = firstList.columns.find(c => c.id !== keyField.id) || firstList.columns[0];
                                      updateMetric(index, {
                                        tableConfig: {
                                          ...currentTableConfig,
                                          rowSource: {
                                            type: 'list',
                                            listId: firstList.id,
                                            keyFieldId: keyField.id,
                                            labelFieldId: labelField.id
                                          }
                                        }
                                      });
                                    } else {
                                      // Set rowSource to list type but without listId (user will select from dropdown)
                                      updateMetric(index, {
                                        tableConfig: {
                                          ...currentTableConfig,
                                          rowSource: {
                                            type: 'list',
                                            listId: '',
                                            keyFieldId: '',
                                            labelFieldId: ''
                                          }
                                        }
                                      });
                                    }
                                  }}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">Liste (ex: Produits)</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`rowSource-${index}`}
                                  value="entries"
                                  checked={metric.tableConfig?.rowSource?.type === 'entries' || !metric.tableConfig?.rowSource}
                                  onChange={() => {
                                    const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                    updateMetric(index, {
                                      tableConfig: {
                                        ...currentTableConfig,
                                        rowSource: {
                                          type: 'entries',
                                          formId: metric.formId || ''
                                        }
                                      }
                                    });
                                  }}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">Entrées de formulaire</span>
                              </label>
                            </div>

                            {/* List field selection when rowSource=list */}
                            {metric.tableConfig?.rowSource?.type === 'list' && (
                              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Select
                                  label="Liste *"
                                  value={(metric.tableConfig.rowSource as Extract<TableRowSource, { type: 'list' }>).listId || ''}
                                  onChange={(e) => {
                                    const selectedList = lists.find(l => l.id === e.target.value);
                                    if (!selectedList) return;
                                    const keyField = selectedList.columns[0];
                                    const labelField = selectedList.columns.find(c => c.id !== keyField.id) || selectedList.columns[0];
                                    const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                    updateMetric(index, {
                                      tableConfig: {
                                        ...currentTableConfig,
                                        rowSource: {
                                          type: 'list',
                                          listId: selectedList.id,
                                          keyFieldId: keyField.id,
                                          labelFieldId: labelField.id
                                        }
                                      }
                                    });
                                  }}
                                  disabled={isLoadingLists}
                                  options={[
                                    { value: '', label: isLoadingLists ? 'Chargement...' : 'Choisir une liste...' },
                                    ...(isLoadingLists ? [] : lists.map(list => ({
                                      value: list.id,
                                      label: list.name
                                    })))
                                  ]}
                                />
                                {(() => {
                                  const rowSource = metric.tableConfig?.rowSource as Extract<TableRowSource, { type: 'list' }> | undefined;
                                  const selectedList = lists.find(l => l.id === rowSource?.listId);
                                  if (!selectedList) return null;
                                  return (
                                    <>
                                      <Select
                                        label="Champ clé *"
                                        value={rowSource?.keyFieldId || ''}
                                        onChange={(e) => {
                                          const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                          updateMetric(index, {
                                            tableConfig: {
                                              ...currentTableConfig,
                                              rowSource: {
                                                ...rowSource!,
                                                keyFieldId: e.target.value
                                              }
                                            }
                                          });
                                        }}
                                        options={[
                                          { value: '', label: 'Choisir un champ...' },
                                          ...selectedList.columns.map(col => ({
                                            value: col.id,
                                            label: col.name
                                          }))
                                        ]}
                                      />
                                      <Select
                                        label="Champ label *"
                                        value={rowSource?.labelFieldId || ''}
                                        onChange={(e) => {
                                          const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                          updateMetric(index, {
                                            tableConfig: {
                                              ...currentTableConfig,
                                              rowSource: {
                                                ...rowSource!,
                                                labelFieldId: e.target.value
                                              }
                                            }
                                          });
                                        }}
                                        options={[
                                          { value: '', label: 'Choisir un champ...' },
                                          ...selectedList.columns.map(col => ({
                                            value: col.id,
                                            label: col.name
                                          }))
                                        ]}
                                      />
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {(!metric.tableConfig?.columns || metric.tableConfig.columns.length === 0) ? (
                            <div className="text-center py-6 text-purple-600">
                              <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">Aucune colonne configurée. Cliquez sur "Ajouter une colonne" pour commencer.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {metric.tableConfig.columns.map((column, colIndex) => (
                                <Card key={column.id} className="p-4 bg-white border border-purple-200">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                      <Table className="h-4 w-4 text-purple-600" />
                                      <span className="text-sm font-medium text-gray-700">
                                        Colonne {colIndex + 1}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      {/* Move up button */}
                                      {colIndex > 0 && (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => {
                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                            const columns = [...currentTableConfig.columns];
                                            [columns[colIndex - 1], columns[colIndex]] = [columns[colIndex], columns[colIndex - 1]];
                                            updateMetric(index, {
                                              tableConfig: {
                                                ...currentTableConfig,
                                                columns
                                              }
                                            });
                                          }}
                                          className="p-1"
                                        >
                                          <ArrowUp className="h-3 w-3" />
                                        </Button>
                                      )}
                                      {/* Move down button */}
                                      {colIndex < (metric.tableConfig?.columns.length || 0) - 1 && (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => {
                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                            const columns = [...currentTableConfig.columns];
                                            [columns[colIndex], columns[colIndex + 1]] = [columns[colIndex + 1], columns[colIndex]];
                                            updateMetric(index, {
                                              tableConfig: {
                                                ...currentTableConfig,
                                                columns
                                              }
                                            });
                                          }}
                                          className="p-1"
                                        >
                                          <ArrowDown className="h-3 w-3" />
                                        </Button>
                                      )}
                                      {/* Delete button */}
                                      <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        onClick={() => {
                                          const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                          const columns = currentTableConfig.columns.filter((_: any, i: number) => i !== colIndex);
                                          updateMetric(index, {
                                            tableConfig: {
                                              ...currentTableConfig,
                                              columns
                                            }
                                          });
                                        }}
                                        className="p-1"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    {/* Column name */}
                                    <Input
                                      label="Nom de la colonne *"
                                      value={column.name}
                                      onChange={(e) => {
                                        const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                        const columns = [...currentTableConfig.columns];
                                        columns[colIndex] = { ...columns[colIndex] as any, name: e.target.value };
                                        updateMetric(index, {
                                          tableConfig: {
                                            ...currentTableConfig,
                                            columns
                                          }
                                        });
                                      }}
                                      placeholder="Ex: Produit, Stock initial, etc."
                                      required
                                    />

                                    {/* Column type selection */}
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Type de colonne *
                                      </label>
                                      <Select
                                        value={(column as any).type || (column as any).source || 'aggregate'}
                                        onChange={(e) => {
                                        const columnType = e.target.value;
                                        const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                        const columns = [...currentTableConfig.columns];
                                        
                                        // Create new column based on type
                                        if (columnType === 'label') {
                                          const rowSource = currentTableConfig.rowSource as Extract<TableRowSource, { type: 'list' }> | undefined;
                                          const selectedList = lists.find(l => l.id === rowSource?.listId);
                                          const labelField = selectedList?.columns[0];
                                          columns[colIndex] = {
                                            id: column.id,
                                            type: 'label',
                                            name: column.name,
                                            source: 'list',
                                            labelFieldId: labelField?.id || ''
                                          } as LabelColumn;
                                        } else if (columnType === 'aggregate') {
                                          columns[colIndex] = {
                                            id: column.id,
                                            type: 'aggregate',
                                            name: column.name,
                                            formId: (column as any).formId || '',
                                            rowKeyFieldId: (column as any).rowKeyFieldId || '',
                                            valueFieldId: (column as any).valueFieldId || '',
                                            agg: (column as any).agg || 'sum'
                                          } as AggregateColumn;
                                        } else if (columnType === 'derived') {
                                          columns[colIndex] = {
                                            id: column.id,
                                            type: 'derived',
                                            name: column.name,
                                            formula: (column as any).formula || ''
                                          } as DerivedColumn;
                                        }
                                        
                                          updateMetric(index, {
                                          tableConfig: {
                                            ...currentTableConfig,
                                            columns
                                          }
                                          });
                                        }}
                                        options={[
                                          { value: 'label', label: 'Label (depuis liste)' },
                                          { value: 'aggregate', label: 'Agrégat (depuis formulaire)' },
                                          { value: 'derived', label: 'Calculé (formule)' }
                                        ]}
                                      />
                                    </div>

                                    {/* Label column configuration */}
                                    {(column as any).type === 'label' && (
                                      <div>
                                        <Select
                                          label="Champ de la liste à afficher *"
                                          value={(column as LabelColumn).labelFieldId || ''}
                                          onChange={(e) => {
                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                            const columns = [...currentTableConfig.columns];
                                            columns[colIndex] = {
                                              ...columns[colIndex],
                                              labelFieldId: e.target.value
                                            } as LabelColumn;
                                            updateMetric(index, {
                                              tableConfig: {
                                                ...currentTableConfig,
                                                columns
                                              }
                                            });
                                          }}
                                          options={(() => {
                                            const rowSource = metric.tableConfig?.rowSource as Extract<TableRowSource, { type: 'list' }> | undefined;
                                            const selectedList = lists.find(l => l.id === rowSource?.listId);
                                            if (!selectedList) return [{ value: '', label: 'Aucune liste sélectionnée' }];
                                            return [
                                              { value: '', label: 'Choisir un champ...' },
                                              ...selectedList.columns.map(col => ({
                                                value: col.id,
                                                label: col.name
                                              }))
                                            ];
                                          })()}
                                        />
                                        <p className="mt-1 text-xs text-purple-600">
                                          💡 Affiche un champ de la liste (ex: nom du produit)
                                        </p>
                                      </div>
                                    )}

                                    {/* Aggregate column configuration */}
                                    {(column as any).type === 'aggregate' && (
                                      <div className="space-y-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Select
                                          label="Formulaire *"
                                            value={(column as AggregateColumn).formId || ''}
                                          onChange={(e) => {
                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                            const columns = [...currentTableConfig.columns];
                                            columns[colIndex] = {
                                              ...columns[colIndex],
                                              formId: e.target.value,
                                              rowKeyFieldId: '',
                                              valueFieldId: ''
                                            } as AggregateColumn;
                                            updateMetric(index, {
                                              tableConfig: {
                                                ...currentTableConfig,
                                                columns
                                              }
                                            });
                                          }}
                                          options={[
                                            { value: '', label: 'Choisir un formulaire...' },
                                            ...forms.map(form => ({
                                              value: form.id,
                                              label: form.title
                                            }))
                                          ]}
                                        />
                                          <Select
                                            label="Fonction d'agrégation *"
                                            value={(column as AggregateColumn).agg || 'sum'}
                                            onChange={(e) => {
                                              const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                              const columns = [...currentTableConfig.columns];
                                              columns[colIndex] = {
                                                ...columns[colIndex],
                                                agg: e.target.value as any
                                              } as AggregateColumn;
                                              updateMetric(index, {
                                                tableConfig: {
                                                  ...currentTableConfig,
                                                  columns
                                                }
                                              });
                                            }}
                                            options={[
                                              { value: 'sum', label: 'Somme' },
                                              { value: 'average', label: 'Moyenne' },
                                              { value: 'min', label: 'Minimum' },
                                              { value: 'max', label: 'Maximum' },
                                              { value: 'count', label: 'Nombre' },
                                              { value: 'latest', label: 'Dernière valeur' },
                                              { value: 'oldest', label: 'Première valeur' }
                                            ]}
                                          />
                                        </div>
                                        {(() => {
                                          const aggCol = column as AggregateColumn;
                                          const columnForm = forms.find(f => f.id === aggCol.formId);
                                          if (!columnForm) return null;
                                          
                                          const rowSource = metric.tableConfig?.rowSource as Extract<TableRowSource, { type: 'list' }> | undefined;
                                          const selectedList = lists.find(l => l.id === rowSource?.listId);
                                          
                                          return (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Select
                                                label="Champ de référence (groupement) *"
                                                value={aggCol.rowKeyFieldId || ''}
                                              onChange={(e) => {
                                                const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                const columns = [...currentTableConfig.columns];
                                                columns[colIndex] = {
                                                  ...columns[colIndex],
                                                  rowKeyFieldId: e.target.value
                                                } as AggregateColumn;
                                                updateMetric(index, {
                                                  tableConfig: {
                                                    ...currentTableConfig,
                                                    columns
                                                  }
                                                });
                                              }}
                                              options={[
                                                { value: '', label: 'Choisir un champ...' },
                                                  ...columnForm.fields
                                                    // Accept text, select, number - any field that can serve as a key
                                                    .filter(f => {
                                                      // Only filter by list if rowSource is explicitly 'list' type AND a list is selected
                                                      if (rowSource?.type === 'list' && selectedList) {
                                                        // For list-based rows, only show select fields that use that list
                                                        return f.type === 'select' && f.listId === selectedList.id;
                                                      }
                                                      // Otherwise, show text, select, and number fields (all can serve as keys)
                                                      return f.type === 'text' || f.type === 'select' || f.type === 'number';
                                                    })
                                                    .map((field: FormField) => ({
                                                  value: field.id,
                                                  label: `${field.label} (${field.type})`
                                                }))
                                              ]}
                                            />
                                              <Select
                                                label="Champ de valeur (agrégation) *"
                                                value={aggCol.valueFieldId || ''}
                                                onChange={(e) => {
                                                  const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                  const columns = [...currentTableConfig.columns];
                                                  columns[colIndex] = {
                                                    ...columns[colIndex],
                                                    valueFieldId: e.target.value
                                                  } as AggregateColumn;
                                                  updateMetric(index, {
                                                    tableConfig: {
                                                      ...currentTableConfig,
                                                      columns
                                                    }
                                                  });
                                                }}
                                                options={[
                                                  { value: '', label: 'Choisir un champ...' },
                                                  ...columnForm.fields
                                                    // Accept number, calculated, and text fields
                                                    // Text fields can be used with latest/oldest aggregation functions
                                                    .filter(f => f.type === 'number' || f.type === 'calculated' || f.type === 'text')
                                                    .map((field: FormField) => ({
                                                      value: field.id,
                                                      label: `${field.label} (${field.type})`
                                                    }))
                                                ]}
                                              />
                                            </div>
                                          );
                                        })()}
                                        {/* Filters section */}
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                          <div className="flex items-center justify-between mb-3">
                                            <label className="block text-sm font-medium text-gray-700">
                                              Filtres (optionnel)
                                            </label>
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              size="sm"
                                              onClick={() => {
                                                const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                const columns = [...currentTableConfig.columns];
                                                const aggCol = columns[colIndex] as AggregateColumn;
                                                const newFilter: TableFilter = {
                                                  id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                                  fieldId: '',
                                                  op: 'eq',
                                                  value: ''
                                                };
                                                columns[colIndex] = {
                                                  ...aggCol,
                                                  filters: [...(aggCol.filters || []), newFilter]
                                                } as AggregateColumn;
                                                updateMetric(index, {
                                                  tableConfig: {
                                                    ...currentTableConfig,
                                                    columns
                                                  }
                                                });
                                              }}
                                              className="flex items-center space-x-1"
                                            >
                                              <Plus className="h-3 w-3" />
                                              <span className="text-xs">Ajouter un filtre</span>
                                            </Button>
                                          </div>
                                          
                                          {(() => {
                                            const aggCol = column as AggregateColumn;
                                            const filters = aggCol.filters || [];
                                            const columnForm = forms.find((f: Form) => f.id === aggCol.formId);
                                            
                                            if (filters.length === 0) {
                                              return (
                                                <p className="text-xs text-gray-500 italic">
                                                  Aucun filtre configuré. Toutes les données du formulaire seront utilisées.
                                                </p>
                                              );
                                            }
                                            
                                            if (!columnForm) {
                                              return (
                                                <p className="text-xs text-red-600">
                                                  ⚠️ Formulaire non trouvé
                                                </p>
                                              );
                                            }
                                            
                                            return (
                                              <div className="space-y-3">
                                                {filters.map((filter, filterIndex) => {
                                                  const filterField = columnForm.fields.find((f: FormField) => f.id === filter.fieldId);
                                                  
                                                  return (
                                                    <div key={filter.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                                      <div className="flex items-start justify-between mb-2">
                                                        <span className="text-xs font-medium text-gray-700">
                                                          Filtre {filterIndex + 1}
                                                        </span>
                                                        <Button
                                                          type="button"
                                                          variant="secondary"
                                                          size="sm"
                                                          onClick={() => {
                                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                            const columns = [...currentTableConfig.columns];
                                                            const aggCol = columns[colIndex] as AggregateColumn;
                                                            columns[colIndex] = {
                                                              ...aggCol,
                                                              filters: aggCol.filters?.filter(f => f.id !== filter.id) || []
                                                            } as AggregateColumn;
                                                            updateMetric(index, {
                                                              tableConfig: {
                                                                ...currentTableConfig,
                                                                columns
                                                              }
                                                            });
                                                          }}
                                                          className="p-1"
                                                        >
                                                          <Trash2 className="h-3 w-3 text-red-600" />
                                                        </Button>
                                                      </div>
                                                      
                                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                        <Select
                                                          label="Champ"
                                                          value={filter.fieldId}
                                                          onChange={(e) => {
                                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                            const columns = [...currentTableConfig.columns];
                                                            const aggCol = columns[colIndex] as AggregateColumn;
                                                            const updatedFilters = [...(aggCol.filters || [])];
                                                            updatedFilters[filterIndex] = {
                                                              ...filter,
                                                              fieldId: e.target.value,
                                                              value: '' // Reset value when field changes
                                                            };
                                                            columns[colIndex] = {
                                                              ...aggCol,
                                                              filters: updatedFilters
                                                            } as AggregateColumn;
                                                            updateMetric(index, {
                                                              tableConfig: {
                                                                ...currentTableConfig,
                                                                columns
                                                              }
                                                            });
                                                          }}
                                                          options={[
                                                            { value: '', label: 'Choisir un champ...' },
                                                            ...(columnForm ? columnForm.fields
                                                              .filter((f: FormField) => f.id !== aggCol.rowKeyFieldId && f.id !== aggCol.valueFieldId) // Don't allow filtering on the same fields used for aggregation
                                                              .map((field: FormField) => ({
                                                                value: field.id,
                                                                label: `${field.label} (${field.type})`
                                                              })) : [])
                                                          ]}
                                                        />
                                                        
                                                        <Select
                                                          label="Opérateur"
                                                          value={filter.op}
                                                          onChange={(e) => {
                                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                            const columns = [...currentTableConfig.columns];
                                                            const aggCol = columns[colIndex] as AggregateColumn;
                                                            const updatedFilters = [...(aggCol.filters || [])];
                                                            const newOp = e.target.value as TableFilter['op'];
                                                            updatedFilters[filterIndex] = {
                                                              ...filter,
                                                              op: newOp,
                                                              // Reset value for empty operators
                                                              value: (newOp === 'is_empty' || newOp === 'is_not_empty') ? undefined : filter.value
                                                            };
                                                            columns[colIndex] = {
                                                              ...aggCol,
                                                              filters: updatedFilters
                                                            } as AggregateColumn;
                                                            updateMetric(index, {
                                                              tableConfig: {
                                                                ...currentTableConfig,
                                                                columns
                                                              }
                                                            });
                                                          }}
                                                          options={(() => {
                                                            const fieldType = filterField?.type || 'text';
                                                            const baseOps = [
                                                              { value: 'eq', label: 'Égal à' },
                                                              { value: 'neq', label: 'Différent de' }
                                                            ];
                                                            
                                                            if (fieldType === 'text' || fieldType === 'textarea' || fieldType === 'email') {
                                                              return [
                                                                ...baseOps,
                                                                { value: 'contains', label: 'Contient' },
                                                                { value: 'not_contains', label: 'Ne contient pas' },
                                                                { value: 'is_empty', label: 'Est vide' },
                                                                { value: 'is_not_empty', label: 'N\'est pas vide' }
                                                              ];
                                                            } else if (fieldType === 'number' || fieldType === 'calculated') {
                                                              return [
                                                                ...baseOps,
                                                                { value: 'greater_than', label: 'Supérieur à' },
                                                                { value: 'less_than', label: 'Inférieur à' },
                                                                { value: 'greater_equal', label: 'Supérieur ou égal à' },
                                                                { value: 'less_equal', label: 'Inférieur ou égal à' },
                                                                { value: 'is_empty', label: 'Est vide' },
                                                                { value: 'is_not_empty', label: 'N\'est pas vide' }
                                                              ];
                                                            } else if (fieldType === 'select' || fieldType === 'checkbox') {
                                                              return [
                                                                ...baseOps,
                                                                { value: 'in', label: 'Dans la liste' },
                                                                { value: 'nin', label: 'Pas dans la liste' },
                                                                { value: 'is_empty', label: 'Est vide' },
                                                                { value: 'is_not_empty', label: 'N\'est pas vide' }
                                                              ];
                                                            } else if (fieldType === 'date') {
                                                              return [
                                                                ...baseOps,
                                                                { value: 'greater_than', label: 'Après' },
                                                                { value: 'less_than', label: 'Avant' },
                                                                { value: 'greater_equal', label: 'Après ou égal à' },
                                                                { value: 'less_equal', label: 'Avant ou égal à' },
                                                                { value: 'is_empty', label: 'Est vide' },
                                                                { value: 'is_not_empty', label: 'N\'est pas vide' }
                                                              ];
                                                            }
                                                            
                                                            return baseOps;
                                                          })()}
                                                        />
                                                        
                                                        {filter.op !== 'is_empty' && filter.op !== 'is_not_empty' && (
                                                          <div>
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                              Valeur
                                                            </label>
                                                            {(() => {
                                                              const fieldType = filterField?.type || 'text';
                                                              
                                                              // Helper function to get select field options
                                                              const getSelectOptions = (field: FormField) => {
                                                                // Check if field uses a list
                                                                if (field?.listId && lists.length > 0) {
                                                                  const list = lists.find(l => l.id === field.listId);
                                                                  if (list) {
                                                                    // Find display column (use displayColumnId or first column)
                                                                    const displayColumn = list.columns.find(c => c.id === field.displayColumnId) || list.columns[0];
                                                                    if (displayColumn) {
                                                                      // Extract options from list rows
                                                                      return list.rows.map((row, index) => {
                                                                        const displayValue = String(row[displayColumn.id] || '');
                                                                        return {
                                                                          value: displayValue,
                                                                          label: displayValue || `Ligne ${index + 1}`
                                                                        };
                                                                      });
                                                                    }
                                                                  }
                                                                }
                                                                
                                                                // Fallback: use manual options
                                                                return (field?.options || []).map(option => ({
                                                                  value: typeof option === 'string' ? option : String(option),
                                                                  label: typeof option === 'string' ? option : String(option)
                                                                }));
                                                              };
                                                              
                                                              if (fieldType === 'select' && (filter.op === 'eq' || filter.op === 'neq')) {
                                                                // Single select dropdown for 'eq' and 'neq' operators
                                                                const selectOptions = getSelectOptions(filterField!);
                                                                return (
                                                                  <Select
                                                                    value={typeof filter.value === 'string' ? filter.value : ''}
                                                                    onChange={(e) => {
                                                                      const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                                      const columns = [...currentTableConfig.columns];
                                                                      const aggCol = columns[colIndex] as AggregateColumn;
                                                                      const updatedFilters = [...(aggCol.filters || [])];
                                                                      updatedFilters[filterIndex] = {
                                                                        ...filter,
                                                                        value: e.target.value
                                                                      };
                                                                      columns[colIndex] = {
                                                                        ...aggCol,
                                                                        filters: updatedFilters
                                                                      } as AggregateColumn;
                                                                      updateMetric(index, {
                                                                        tableConfig: {
                                                                          ...currentTableConfig,
                                                                          columns
                                                                        }
                                                                      });
                                                                    }}
                                                                    options={[
                                                                      { value: '', label: 'Sélectionner...' },
                                                                      ...selectOptions
                                                                    ]}
                                                                  />
                                                                );
                                                              } else if (fieldType === 'select' && (filter.op === 'in' || filter.op === 'nin')) {
                                                                // Multi-select for 'in' and 'nin' operators
                                                                const selectOptions = getSelectOptions(filterField!);
                                                                return (
                                                                  <div className="space-y-1">
                                                                    {selectOptions.map((option, optIndex) => (
                                                                      <label key={optIndex} className="flex items-center space-x-2 text-xs">
                                                                        <input
                                                                          type="checkbox"
                                                                          checked={Array.isArray(filter.value) && filter.value.includes(option.value)}
                                                                          onChange={(e) => {
                                                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                                            const columns = [...currentTableConfig.columns];
                                                                            const aggCol = columns[colIndex] as AggregateColumn;
                                                                            const updatedFilters = [...(aggCol.filters || [])];
                                                                            const currentValues = Array.isArray(filter.value) ? filter.value : [];
                                                                            const newValues = e.target.checked
                                                                              ? [...currentValues, option.value]
                                                                              : currentValues.filter(v => v !== option.value);
                                                                            updatedFilters[filterIndex] = {
                                                                              ...filter,
                                                                              value: newValues
                                                                            };
                                                                            columns[colIndex] = {
                                                                              ...aggCol,
                                                                              filters: updatedFilters
                                                                            } as AggregateColumn;
                                                                            updateMetric(index, {
                                                                              tableConfig: {
                                                                                ...currentTableConfig,
                                                                                columns
                                                                              }
                                                                            });
                                                                          }}
                                                                          className="text-blue-600 focus:ring-blue-500"
                                                                        />
                                                                        <span>{option.label}</span>
                                                                      </label>
                                                                    ))}
                                                                  </div>
                                                                );
                                                              } else if (fieldType === 'checkbox') {
                                                                // Boolean checkbox
                                                                return (
                                                                  <select
                                                                    value={String(filter.value)}
                                                                    onChange={(e) => {
                                                                      const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                                      const columns = [...currentTableConfig.columns];
                                                                      const aggCol = columns[colIndex] as AggregateColumn;
                                                                      const updatedFilters = [...(aggCol.filters || [])];
                                                                      updatedFilters[filterIndex] = {
                                                                        ...filter,
                                                                        value: e.target.value === 'true'
                                                                      };
                                                                      columns[colIndex] = {
                                                                        ...aggCol,
                                                                        filters: updatedFilters
                                                                      } as AggregateColumn;
                                                                      updateMetric(index, {
                                                                        tableConfig: {
                                                                          ...currentTableConfig,
                                                                          columns
                                                                        }
                                                                      });
                                                                    }}
                                                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                  >
                                                                    <option value="true">Oui</option>
                                                                    <option value="false">Non</option>
                                                                  </select>
                                                                );
                                                              } else if (fieldType === 'date') {
                                                                // Date input
                                                                return (
                                                                  <input
                                                                    type="date"
                                                                    value={filter.value || ''}
                                                                    onChange={(e) => {
                                                                      const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                                      const columns = [...currentTableConfig.columns];
                                                                      const aggCol = columns[colIndex] as AggregateColumn;
                                                                      const updatedFilters = [...(aggCol.filters || [])];
                                                                      updatedFilters[filterIndex] = {
                                                                        ...filter,
                                                                        value: e.target.value
                                                                      };
                                                                      columns[colIndex] = {
                                                                        ...aggCol,
                                                                        filters: updatedFilters
                                                                      } as AggregateColumn;
                                                                      updateMetric(index, {
                                                                        tableConfig: {
                                                                          ...currentTableConfig,
                                                                          columns
                                                                        }
                                                                      });
                                                                    }}
                                                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                  />
                                                                );
                                                              } else if (fieldType === 'number' || fieldType === 'calculated') {
                                                                // Number input
                                                                return (
                                                                  <input
                                                                    type="number"
                                                                    value={filter.value || ''}
                                                                    onChange={(e) => {
                                                                      const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                                      const columns = [...currentTableConfig.columns];
                                                                      const aggCol = columns[colIndex] as AggregateColumn;
                                                                      const updatedFilters = [...(aggCol.filters || [])];
                                                                      updatedFilters[filterIndex] = {
                                                                        ...filter,
                                                                        value: e.target.value ? parseFloat(e.target.value) : ''
                                                                      };
                                                                      columns[colIndex] = {
                                                                        ...aggCol,
                                                                        filters: updatedFilters
                                                                      } as AggregateColumn;
                                                                      updateMetric(index, {
                                                                        tableConfig: {
                                                                          ...currentTableConfig,
                                                                          columns
                                                                        }
                                                                      });
                                                                    }}
                                                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                  />
                                                                );
                                                              } else {
                                                                // Text input (default)
                                                                return (
                                                                  <input
                                                                    type="text"
                                                                    value={filter.value || ''}
                                                                    onChange={(e) => {
                                                                      const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                                                      const columns = [...currentTableConfig.columns];
                                                                      const aggCol = columns[colIndex] as AggregateColumn;
                                                                      const updatedFilters = [...(aggCol.filters || [])];
                                                                      updatedFilters[filterIndex] = {
                                                                        ...filter,
                                                                        value: e.target.value
                                                                      };
                                                                      columns[colIndex] = {
                                                                        ...aggCol,
                                                                        filters: updatedFilters
                                                                      } as AggregateColumn;
                                                                      updateMetric(index, {
                                                                        tableConfig: {
                                                                          ...currentTableConfig,
                                                                          columns
                                                                        }
                                                                      });
                                                                    }}
                                                                    placeholder="Valeur du filtre"
                                                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                  />
                                                                );
                                                              }
                                                            })()}
                                                          </div>
                                                        )}
                                                      </div>
                                                      
                                                      {filter.fieldId && !filterField && (
                                                        <p className="text-xs text-red-600 mt-1">
                                                          ⚠️ Champ non trouvé dans le formulaire
                                                        </p>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                        
                                        <p className="text-xs text-purple-600 mt-3">
                                          💡 Agrège les valeurs du formulaire par le champ de référence sélectionné (ex: somme des montants par client)
                                        </p>
                                      </div>
                                    )}

                                    {/* Derived column configuration */}
                                    {(column as any).type === 'derived' && (
                                      <div>
                                        <ColumnFormulaInput
                                          value={(column as DerivedColumn).formula || ''}
                                          onChange={(formula: string, columnIds: string[]) => {
                                            const currentTableConfig = ensureTableConfig(metric.tableConfig);
                                            const columns = [...currentTableConfig.columns];
                                            columns[colIndex] = {
                                              ...columns[colIndex],
                                              formula: formula
                                            } as DerivedColumn;
                                            updateMetric(index, {
                                              tableConfig: {
                                                ...currentTableConfig,
                                                columns
                                              }
                                            });
                                          }}
                                          columns={metric.tableConfig?.columns || []}
                                          currentColumnId={column.id}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Graph Preview */}
                      {metric.metricType === 'graph' && metric.graphConfig && metric.formId && metric.fieldId && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-green-900">Aperçu du graphique</h5>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowGraphPreviews(prev => ({
                                ...prev,
                                [index]: !prev[index]
                              }))}
                              className="text-xs"
                            >
                              {showGraphPreviews[index] ? 'Masquer' : 'Aperçu'}
                            </Button>
                          </div>
                          
                          {showGraphPreviews[index] && (
                            <div className="h-32">
                              <GraphPreview
                                metric={{
                                  ...metric,
                                  id: `preview-${index}`,
                                  createdAt: new Date(),
                                  createdBy: currentUserId,
                                  agencyId: agencyId,
                                  // Remove tableConfig to avoid type conflicts with shared package
                                  tableConfig: undefined
                                } as any}
                                formEntries={formEntries.filter(entry => entry.formId === metric.formId)}
                                forms={forms}
                                compact={true}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Field Preview */}
                      {metric.fieldId && selectedForm && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Aperçu du champ</span>
                          </div>
                          {(() => {
                            const field = selectedForm.fields.find((f: FormField) => f.id === metric.fieldId);
                            return field ? (
                              <div className="text-sm text-blue-800">
                                <p><strong>Label:</strong> {field.label}</p>
                                <p><strong>Type:</strong> {field.type}</p>
                                {field.required && <p><strong>Requis:</strong> Oui</p>}
                                {field.options && field.options.length > 0 && (
                                  <p><strong>Options:</strong> {field.options.join(', ')}</p>
                                )}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with responsive buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6 border-t border-gray-200">
            <Button 
              type="submit" 
              className="w-full sm:flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {initialDashboard ? 'Modification...' : 'Création...'}
                </>
              ) : (
                initialDashboard ? 'Modifier le tableau de bord' : 'Créer le tableau de bord'
              )}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onCancel} 
              className="w-full sm:w-auto flex items-center justify-center space-x-2"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Annuler</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
