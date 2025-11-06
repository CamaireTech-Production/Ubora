import { FormEntry, DashboardMetric, Dashboard, AggregateColumn, LabelColumn, DerivedColumn, TableRowSource } from '../types';

export interface MetricResult {
  value: number | string | TableRowData[];
  displayValue: string;
  description: string;
}

export interface TableRowData {
  [columnId: string]: any; // Key is column ID, value is the cell data
}

export class MetricCalculator {
  /**
   * Calculate metric value based on form entries and metric configuration
   * Supports both field-based and computed metrics
   */
  static calculateMetric(
    metric: DashboardMetric,
    formEntries: FormEntry[],
    dashboard?: Dashboard
  ): MetricResult {
    // Check if this is a table metric
    if (metric.metricType === 'table') {
      return this.calculateTableMetric(metric, formEntries, dashboard);
    }

    // Check if this is a computed metric
    if (metric.sourceType === 'computed') {
      return this.calculateComputedMetric(metric, formEntries, dashboard);
    }

    // Default behavior: field-based metric
    // Check if this is actually a field-based metric that's missing required fields
    const sourceType = metric.sourceType || 'field';
    if (sourceType === 'field' && (!metric.formId || !metric.fieldId)) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Configuration de métrique invalide'
      };
    }
    
    // If sourceType is not 'computed' and not 'field', or if it's 'field' but missing formId/fieldId
    // This shouldn't happen, but handle gracefully
    if (sourceType !== 'computed' && sourceType !== 'field') {
      return {
        value: 0,
        displayValue: '0',
        description: 'Type de métrique non supporté'
      };
    }
    // Filter entries for the specific form
    const relevantEntries = formEntries.filter(entry => entry.formId === metric.formId);
    
    if (relevantEntries.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune donnée disponible'
      };
    }

    // Extract values for the specific field
    const fieldValues = relevantEntries
      .map(entry => entry.answers[metric.fieldId])
      .filter(value => value !== null && value !== undefined && value !== '');

    if (fieldValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur pour ce champ'
      };
    }

    switch (metric.calculationType) {
      case 'count':
        return this.calculateCount(fieldValues, relevantEntries.length);
      
      case 'sum':
        return this.calculateSum(fieldValues);
      
      case 'average':
        return this.calculateAverage(fieldValues);
      
      case 'min':
        return this.calculateMin(fieldValues);
      
      case 'max':
        return this.calculateMax(fieldValues);
      
      case 'unique':
        return this.calculateUnique(fieldValues);
      
      default:
        return {
          value: 0,
          displayValue: '0',
          description: 'Type de calcul non supporté'
        };
    }
  }

  /**
   * Calculate computed metric value from other metrics
   */
  private static calculateComputedMetric(
    metric: DashboardMetric,
    formEntries: FormEntry[],
    dashboard?: Dashboard
  ): MetricResult {
    if (!metric.calculationFormula || !dashboard) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Formule de calcul manquante'
      };
    }

    try {
      // Calculate all source metrics first
      const metricValues: Record<string, number> = {};
      
      if (metric.dependsOn) {
        for (const depMetricId of metric.dependsOn) {
          const depMetric = dashboard.metrics.find(m => m.id === depMetricId);
          if (!depMetric) {
            return {
              value: 0,
              displayValue: '0',
              description: `Métrique source manquante (ID: ${depMetricId})`
            };
          }

          // Recursively calculate the dependent metric
          const depResult = this.calculateMetric(depMetric, formEntries, dashboard);
          const numericValue = this.getNumericValue(depResult.value);
          metricValues[depMetricId] = numericValue;
        }
      }

      // Evaluate the formula
      const formula = metric.calculationFormula;
      let processedFormula = formula;

      // Replace metric IDs with their calculated values
      Object.keys(metricValues).forEach(metricId => {
        const regex = new RegExp(`\\b${metricId}\\b`, 'g');
        processedFormula = processedFormula.replace(regex, metricValues[metricId].toString());
      });

      // Replace mathematical functions and evaluate
      processedFormula = this.replaceMathematicalFunctions(processedFormula);
      const result = this.safeEvaluate(processedFormula);

      if (isNaN(result)) {
        return {
          value: 0,
          displayValue: '0',
          description: 'Erreur dans le calcul de la formule'
        };
      }

      return {
        value: result,
        displayValue: this.formatNumber(result),
        description: `Calculé à partir de ${metric.dependsOn?.length || 0} métrique(s)`
      };
    } catch (error) {
      console.error('Error calculating computed metric:', error);
      return {
        value: 0,
        displayValue: '0',
        description: 'Erreur lors du calcul'
      };
    }
  }

  /**
   * Get numeric value from any metric result value
   */
  private static getNumericValue(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }

  /**
   * Replace mathematical functions in formula
   */
  private static replaceMathematicalFunctions(formula: string): string {
    // Replace SUM function
    formula = formula.replace(/SUM\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      return values.reduce((sum: number, val: number) => sum + val, 0).toString();
    });

    // Replace AVG function
    formula = formula.replace(/AVG\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      const sum = values.reduce((sum: number, val: number) => sum + val, 0);
      return (sum / values.length).toString();
    });

    // Replace MAX function
    formula = formula.replace(/MAX\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      return Math.max(...values).toString();
    });

    // Replace MIN function
    formula = formula.replace(/MIN\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      return Math.min(...values).toString();
    });

    return formula;
  }

  /**
   * Safely evaluate mathematical expression
   */
  private static safeEvaluate(expression: string): number {
    try {
      // Remove any potentially dangerous characters
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');

      // Use Function constructor for safe evaluation
      const result = new Function('return ' + sanitized)();

      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (error) {
      console.error('Error in safe evaluation:', error);
      return 0;
    }
  }

  private static calculateCount(fieldValues: any[], totalEntries: number): MetricResult {
    const count = fieldValues.length;
    return {
      value: count,
      displayValue: count.toString(),
      description: `${count} soumission${count > 1 ? 's' : ''} sur ${totalEntries} total`
    };
  }

  private static calculateSum(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num !== 0);

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    return {
      value: sum,
      displayValue: this.formatNumber(sum),
      description: `Somme de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateAverage(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num !== 0);

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const average = sum / numericValues.length;
    
    return {
      value: average,
      displayValue: this.formatNumber(average),
      description: `Moyenne de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateMin(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? null : num;
      })
      .filter(num => num !== null) as number[];

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const min = Math.min(...numericValues);
    return {
      value: min,
      displayValue: this.formatNumber(min),
      description: `Minimum de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateMax(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? null : num;
      })
      .filter(num => num !== null) as number[];

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const max = Math.max(...numericValues);
    return {
      value: max,
      displayValue: this.formatNumber(max),
      description: `Maximum de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateUnique(fieldValues: any[]): MetricResult {
    const uniqueValues = [...new Set(fieldValues.map(value => String(value)))];
    return {
      value: uniqueValues.length,
      displayValue: uniqueValues.length.toString(),
      description: `${uniqueValues.length} valeur${uniqueValues.length > 1 ? 's' : ''} unique${uniqueValues.length > 1 ? 's' : ''}`
    };
  }

  private static formatNumber(num: number): string {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2);
  }

  /**
   * Calculate table metric data from form entries
   * Returns an array of rows, where each row contains values for each column
   * Supports aggregate, label, derived, and legacy field/metric columns
   */
  static calculateTableMetric(
    metric: DashboardMetric,
    formEntries: FormEntry[],
    dashboard?: Dashboard
  ): MetricResult {
    // Validate table configuration
    if (!metric.tableConfig || !metric.tableConfig.columns || metric.tableConfig.columns.length === 0) {
      return {
        value: [],
        displayValue: '0',
        description: 'Configuration de tableau invalide : aucune colonne configurée'
      };
    }

    try {
      const columns = metric.tableConfig.columns;
      const rowSource = metric.tableConfig.rowSource;

      // Determine row keys based on rowSource type
      let rowKeys: string[] = [];
      let rowKeyToLabel: Record<string, string> = {};

      if (rowSource.type === 'list') {
        // For list-based rows, we need to get the list data
        // Since we don't have direct access to lists here, we'll extract row keys from form entries
        // that reference the list via aggregate columns
        const aggregateColumns = columns.filter(col => (col as any).type === 'aggregate') as AggregateColumn[];
        if (aggregateColumns.length > 0) {
          const firstAggCol = aggregateColumns[0];
          if (firstAggCol.formId && firstAggCol.rowKeyFieldId) {
            // Get unique row keys from form entries
            const uniqueKeys = new Set<string>();
            formEntries
              .filter(entry => entry.formId === firstAggCol.formId)
              .forEach(entry => {
                const key = entry.answers[firstAggCol.rowKeyFieldId];
                if (key !== null && key !== undefined && key !== '') {
                  uniqueKeys.add(String(key));
                }
              });
            rowKeys = Array.from(uniqueKeys);
          }
        }
      } else if (rowSource.type === 'entries') {
        // For entry-based rows, create one row per entry
        const uniqueEntryIds = new Set<string>();
        formEntries
          .filter(entry => entry.formId === rowSource.formId)
          .forEach(entry => {
            if (entry.id) {
              uniqueEntryIds.add(entry.id);
            }
          });
        rowKeys = Array.from(uniqueEntryIds);
      }

      if (rowKeys.length === 0) {
        return {
          value: [],
          displayValue: '0',
          description: 'Aucune donnée disponible'
        };
      }

      // Pre-calculate metrics for metric-based columns (they have the same value for all rows)
      const metricValues: Record<string, string> = {};
      if (dashboard) {
        for (const column of columns) {
          if ((column as any).source === 'metric' && (column as any).metricId) {
            const depMetric = dashboard.metrics.find(m => m.id === (column as any).metricId);
            if (!depMetric) {
              console.warn(`Table metric: Dependent metric ${(column as any).metricId} not found in dashboard`);
              metricValues[column.id] = '';
              continue;
            }
            
            if (depMetric.metricType === 'table' && depMetric.id === metric.id) {
              console.error(`Table metric: Circular dependency detected - metric ${metric.id} depends on itself`);
              metricValues[column.id] = '[Erreur: dépendance circulaire]';
              continue;
            }
            
            try {
              const metricResult = this.calculateMetric(depMetric, formEntries, dashboard);
              metricValues[column.id] = metricResult.displayValue || String(metricResult.value) || '';
            } catch (error) {
              console.error(`Table metric: Error calculating dependent metric ${(column as any).metricId}:`, error);
              metricValues[column.id] = '[Erreur de calcul]';
            }
          }
        }
      }

      // Calculate aggregate columns for each row key
      const aggregateValues: Record<string, Record<string, any>> = {};
      for (const rowKey of rowKeys) {
        aggregateValues[rowKey] = {};
        
        for (const column of columns) {
          if ((column as any).type === 'aggregate') {
            const aggCol = column as AggregateColumn;
            const value = this.calculateAggregateColumn(aggCol, formEntries, rowKey);
            aggregateValues[rowKey][column.id] = value;
          }
        }
      }

      // Build rows
      const rows: TableRowData[] = [];
      for (const rowKey of rowKeys) {
        const row: TableRowData = { _rowKey: rowKey };

        for (const column of columns) {
          const columnType = (column as any).type || (column as any).source;

          if (columnType === 'label') {
            // Label column: display from list
            const labelCol = column as LabelColumn;
            // For now, use rowKey as label (in real implementation, fetch from list)
            row[column.id] = rowKeyToLabel[rowKey] || rowKey;
          } else if (columnType === 'aggregate') {
            // Aggregate column: use pre-calculated value
            row[column.id] = aggregateValues[rowKey][column.id] ?? '';
          } else if (columnType === 'derived') {
            // Derived column: calculate from formula (will be calculated after all other columns)
            row[column.id] = null; // Placeholder, will be calculated below
          } else if ((column as any).source === 'field') {
            // Legacy field-based column
            const formId = (column as any).formId;
            const fieldId = (column as any).fieldId;
            if (formId && fieldId) {
              // Find entry matching this row key
              const matchingEntry = formEntries.find(entry => {
                if (entry.formId !== formId) return false;
                if (rowSource.type === 'entries') {
                  return entry.id === rowKey;
                } else {
                  // For list-based rows, match by rowKeyFieldId
                  const aggregateCol = columns.find(c => (c as any).type === 'aggregate') as AggregateColumn | undefined;
                  if (aggregateCol && aggregateCol.rowKeyFieldId) {
                    return String(entry.answers[aggregateCol.rowKeyFieldId]) === rowKey;
                  }
                }
                return false;
              });
              if (matchingEntry) {
                const fieldValue = matchingEntry.answers[fieldId];
                row[column.id] = fieldValue !== null && fieldValue !== undefined ? fieldValue : '';
              } else {
                row[column.id] = '';
              }
            } else {
              row[column.id] = '';
            }
          } else if ((column as any).source === 'metric') {
            // Legacy metric-based column
            row[column.id] = metricValues[column.id] || '';
          }
        }

        // Calculate derived columns after all other columns are set
        for (const column of columns) {
          if ((column as any).type === 'derived') {
            const derivedCol = column as DerivedColumn;
            if (derivedCol.formula) {
              try {
                const value = this.calculateDerivedColumn(derivedCol, row);
                row[column.id] = value;
              } catch (error) {
                console.error(`Error calculating derived column ${column.id}:`, error);
                row[column.id] = '[Erreur de calcul]';
              }
            } else {
              row[column.id] = '';
            }
          }
        }

        rows.push(row);
      }

      return {
        value: rows,
        displayValue: rows.length.toString(),
        description: `${rows.length} ligne${rows.length > 1 ? 's' : ''} dans le tableau`
      };
    } catch (error) {
      console.error('Error calculating table metric:', error);
      return {
        value: [],
        displayValue: '0',
        description: 'Erreur lors du calcul du tableau'
      };
    }
  }

  /**
   * Calculate aggregate column value for a specific row key
   */
  private static calculateAggregateColumn(
    column: AggregateColumn,
    formEntries: FormEntry[],
    rowKey: string
  ): any {
    if (!column.formId || !column.rowKeyFieldId || !column.valueFieldId) {
      return '';
    }

    // Filter entries matching the form and row key
    const matchingEntries = formEntries.filter(entry => {
      if (entry.formId !== column.formId) return false;
      
      // Apply filters if any
      if (column.filters && column.filters.length > 0) {
        for (const filter of column.filters) {
          const fieldValue = entry.answers[filter.fieldId];
          let matches = false;
          
          switch (filter.op) {
            case 'eq':
              matches = String(fieldValue) === String(filter.value);
              break;
            case 'neq':
              matches = String(fieldValue) !== String(filter.value);
              break;
            case 'in':
              const filterValues = Array.isArray(filter.value) ? filter.value : [filter.value];
              matches = filterValues.some(v => String(fieldValue) === String(v));
              break;
            case 'nin':
              const filterValuesNot = Array.isArray(filter.value) ? filter.value : [filter.value];
              matches = !filterValuesNot.some(v => String(fieldValue) === String(v));
              break;
          }
          
          if (!matches) return false;
        }
      }
      
      // Match row key
      const entryRowKey = entry.answers[column.rowKeyFieldId];
      return String(entryRowKey) === rowKey;
    });

    if (matchingEntries.length === 0) {
      return column.display?.blankAsZero ? 0 : '';
    }

    // Extract values for aggregation
    const values = matchingEntries
      .map(entry => entry.answers[column.valueFieldId])
      .filter(value => value !== null && value !== undefined && value !== '');

    if (values.length === 0) {
      return column.display?.blankAsZero ? 0 : '';
    }

    // Apply aggregation function
    switch (column.agg) {
      case 'sum':
        return values.reduce((sum: number, val: any) => {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return sum + (isNaN(num) ? 0 : num);
        }, 0);
      
      case 'average':
        const numericValues = values.map(val => {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return isNaN(num) ? null : num;
        }).filter((v): v is number => v !== null);
        if (numericValues.length === 0) return column.display?.blankAsZero ? 0 : '';
        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        return sum / numericValues.length;
      
      case 'min':
        const minValues = values.map(val => {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return isNaN(num) ? null : num;
        }).filter((v): v is number => v !== null);
        if (minValues.length === 0) return column.display?.blankAsZero ? 0 : '';
        return Math.min(...minValues);
      
      case 'max':
        const maxValues = values.map(val => {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          return isNaN(num) ? null : num;
        }).filter((v): v is number => v !== null);
        if (maxValues.length === 0) return column.display?.blankAsZero ? 0 : '';
        return Math.max(...maxValues);
      
      case 'count':
        return values.length;
      
      case 'latest':
        // Get the most recent entry (by submission date)
        const sortedByDate = [...matchingEntries].sort((a, b) => {
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return dateB - dateA; // Most recent first
        });
        const latestValue = sortedByDate[0]?.answers[column.valueFieldId];
        return latestValue !== null && latestValue !== undefined ? latestValue : '';
      
      case 'oldest':
        // Get the oldest entry (by submission date)
        const sortedByDateOldest = [...matchingEntries].sort((a, b) => {
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return dateA - dateB; // Oldest first
        });
        const oldestValue = sortedByDateOldest[0]?.answers[column.valueFieldId];
        return oldestValue !== null && oldestValue !== undefined ? oldestValue : '';
      
      default:
        return '';
    }
  }

  /**
   * Calculate derived column value from formula
   */
  private static calculateDerivedColumn(
    column: DerivedColumn,
    row: TableRowData
  ): any {
    if (!column.formula) {
      return '';
    }

    try {
      // Replace column IDs with their values from the row
      let formula = column.formula;
      const columnIdPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
      
      formula = formula.replace(columnIdPattern, (match, columnId) => {
        // Check if this is a column ID in the row
        if (row.hasOwnProperty(columnId)) {
          const value = row[columnId];
          // Convert to number if possible, otherwise use as string
          if (value === null || value === undefined || value === '') {
            return '0';
          }
          const num = typeof value === 'number' ? value : parseFloat(String(value));
          return isNaN(num) ? '0' : num.toString();
        }
        // If not found, return 0
        return '0';
      });

      // Evaluate the formula
      const result = this.safeEvaluate(formula);
      return isNaN(result) ? '' : result;
    } catch (error) {
      console.error(`Error calculating derived column ${column.id}:`, error);
      return '[Erreur]';
    }
  }

  /**
   * Get calculation options for a field type
   */
  static getCalculationOptions(fieldType: string): Array<{ value: string; label: string }> {
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
  }
}

