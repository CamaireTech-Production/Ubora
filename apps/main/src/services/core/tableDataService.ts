import { logger } from '@ubora/shared/utils/logger';
import { 
  DashboardMetric, 
  TableConfig, 
  TableRowSource, 
  AggregateColumn, 
  DerivedColumn, 
  LabelColumn,
  TableColumnConfig,
  FormEntry,
  List
} from '../../types';
import { listsService } from '@ubora/shared/services';
import { TableRowData } from '../utils/forms/MetricCalculator';

/**
 * Period configuration for filtering form entries
 */
export interface Period {
  start?: Date;
  end?: Date;
  timezone?: string;
}

/**
 * Service for calculating table metric data
 * Handles list-based rows, aggregation, derived columns, and period filtering
 */
class TableDataService {
  /**
   * Get rows for a table metric
   * @param metric - The table metric configuration
   * @param formEntries - All form entries (will be filtered by period)
   * @param period - Period to filter entries by (from dashboard viewer)
   * @returns Array of table rows with column values
   */
  async getRowsForTableMetric(
    metric: DashboardMetric,
    formEntries: FormEntry[],
    period?: Period
  ): Promise<TableRowData[]> {
    // Validate table configuration
    if (metric.metricType !== 'table' || !metric.tableConfig) {
      logger.warn('Metric is not a table metric or missing tableConfig', undefined, 'TableDataService');
      return [];
    }

    const tableConfig = metric.tableConfig;
    
    // Validate rowSource exists
    if (!tableConfig.rowSource) {
      logger.warn('tableConfig.rowSource is missing', undefined, 'TableDataService');
      return [];
    }
    
    // Get period to use (from config or parameter)
    const effectivePeriod = this.getEffectivePeriod(tableConfig.period, period);

    // Filter form entries by period
    const periodEntries = this.filterEntriesByPeriod(formEntries, effectivePeriod);

    // Handle different row sources
    if (tableConfig.rowSource.type === 'list') {
      return await this.getRowsFromList(tableConfig, periodEntries, effectivePeriod);
    } else {
      // Legacy: entries-based rows (keep for backward compatibility)
      return this.getRowsFromEntries(tableConfig, periodEntries);
    }
  }

  /**
   * Get effective period from config or parameter
   */
  private getEffectivePeriod(
    configPeriod?: { useDashboardPeriod: boolean; start?: Date; end?: Date; timezone?: string },
    dashboardPeriod?: Period
  ): Period {
    if (configPeriod && !configPeriod.useDashboardPeriod && configPeriod.start && configPeriod.end) {
      return {
        start: configPeriod.start,
        end: configPeriod.end,
        timezone: configPeriod.timezone
      };
    }
    return dashboardPeriod || {};
  }

  /**
   * Filter form entries by period
   */
  private filterEntriesByPeriod(entries: FormEntry[], period: Period): FormEntry[] {
    if (!period.start && !period.end) {
      return entries; // No period filter
    }

    return entries.filter(entry => {
      const entryDate = this.getEntryDate(entry, period.timezone);
      if (!entryDate) return false;

      if (period.start && entryDate < period.start) return false;
      if (period.end && entryDate > period.end) return false;

      return true;
    });
  }

  /**
   * Get entry date (from explicit date field or submittedAt)
   */
  private getEntryDate(entry: FormEntry, timezone?: string): Date | null {
    // For now, use submittedAt (we'll add support for explicit dateFieldId later)
    if (entry.submittedAt) {
      if (entry.submittedAt instanceof Date) {
        return entry.submittedAt;
      }
      if (typeof entry.submittedAt === 'object' && 'toDate' in entry.submittedAt) {
        return (entry.submittedAt as any).toDate();
      }
      if (typeof entry.submittedAt === 'string' || typeof entry.submittedAt === 'number') {
        return new Date(entry.submittedAt);
      }
    }
    return null;
  }

  /**
   * Get rows from list-based source
   */
  private async getRowsFromList(
    tableConfig: TableConfig,
    periodEntries: FormEntry[],
    period: Period
  ): Promise<TableRowData[]> {
    const rowSource = tableConfig.rowSource as Extract<TableRowSource, { type: 'list' }>;
    
    // Load the list (getById now returns null instead of throwing for permission errors)
    const list = await listsService.getById(rowSource.listId);

    if (!list || !list.rows || list.rows.length === 0) {
      // Ne logger qu'en développement pour éviter le spam en production
      if (import.meta.env.DEV) {
        logger.debug('List not found or empty', { listId: rowSource.listId }, 'TableDataService');
      }
      return [];
    }

    // Create base rows from list items
    const rows: TableRowData[] = list.rows.map(listRow => {
      const rowKey = listRow[rowSource.keyFieldId];
      const rowLabel = listRow[rowSource.labelFieldId];
      
      const row: TableRowData = {
        _rowKey: rowKey, // Internal: used for aggregation
        _rowLabel: rowLabel // Internal: used for label column
      };

      // Process each column
      for (const column of tableConfig.columns) {
        if (column.type === 'label') {
          // Label column: display the list field value
          const labelCol = column as LabelColumn;
          row[column.id] = listRow[labelCol.labelFieldId] || '';
        } else if (column.type === 'aggregate') {
          // Aggregate column: will be calculated below
          row[column.id] = null; // Placeholder
        } else if (column.type === 'derived') {
          // Derived column: will be calculated after aggregates
          row[column.id] = null; // Placeholder
        }
        // Legacy columns are handled separately
      }

      return row;
    });

    // Calculate aggregate columns
    for (const column of tableConfig.columns) {
      if (column.type === 'aggregate') {
        const aggCol = column as AggregateColumn;
        this.calculateAggregateColumn(rows, aggCol, periodEntries, period);
      }
    }

    // Calculate derived columns
    for (const column of tableConfig.columns) {
      if (column.type === 'derived') {
        const derivedCol = column as DerivedColumn;
        this.calculateDerivedColumn(rows, derivedCol, tableConfig.columns);
      }
    }

    // Clean up internal fields and handle empty rows
    return this.finalizeRows(rows, tableConfig);
  }

  /**
   * Calculate aggregate column values
   */
  private calculateAggregateColumn(
    rows: TableRowData[],
    column: AggregateColumn,
    entries: FormEntry[],
    period: Period
  ): void {
    // Filter entries for this form
    const formEntries = entries.filter(e => e.formId === column.formId);

    // Group entries by row key (product)
    const entriesByRowKey = new Map<string, FormEntry[]>();
    
    for (const entry of formEntries) {
      const rowKey = entry.answers[column.rowKeyFieldId];
      if (rowKey === null || rowKey === undefined || rowKey === '') {
        continue; // Skip entries without row key
      }

      // Apply filters
      if (column.filters && column.filters.length > 0) {
        let passesFilter = true;
        for (const filter of column.filters) {
          const fieldValue = entry.answers[filter.fieldId];
          if (!this.matchesFilter(fieldValue, filter)) {
            passesFilter = false;
            break;
          }
        }
        if (!passesFilter) continue;
      }

      const key = String(rowKey);
      if (!entriesByRowKey.has(key)) {
        entriesByRowKey.set(key, []);
      }
      entriesByRowKey.get(key)!.push(entry);
    }

    // Calculate aggregate for each row
    for (const row of rows) {
      const rowKey = String(row._rowKey || '');
      const rowEntries = entriesByRowKey.get(rowKey) || [];

      let value: number | null = null;

      if (rowEntries.length === 0) {
        value = column.display?.blankAsZero ? 0 : null;
      } else {
        // Extract numeric values
        const numericValues = rowEntries
          .map(entry => {
            const val = entry.answers[column.valueFieldId];
            if (val === null || val === undefined || val === '') return null;
            const num = typeof val === 'number' ? val : parseFloat(String(val));
            return isNaN(num) ? null : num;
          })
          .filter((v): v is number => v !== null);

        if (numericValues.length === 0) {
          value = column.display?.blankAsZero ? 0 : null;
        } else {
          // Calculate aggregate
          switch (column.agg) {
            case 'sum':
              value = numericValues.reduce((acc, v) => acc + v, 0);
              break;
            case 'average':
              value = numericValues.reduce((acc, v) => acc + v, 0) / numericValues.length;
              break;
            case 'min':
              value = Math.min(...numericValues);
              break;
            case 'max':
              value = Math.max(...numericValues);
              break;
            case 'count':
              value = numericValues.length;
              break;
            case 'latest':
              // Get the most recent entry's value
              const latestEntry = rowEntries.sort((a, b) => {
                const dateA = this.getEntryDate(a);
                const dateB = this.getEntryDate(b);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB.getTime() - dateA.getTime();
              })[0];
              const latestVal = latestEntry.answers[column.valueFieldId];
              if (latestVal !== null && latestVal !== undefined && latestVal !== '') {
                const num = typeof latestVal === 'number' ? latestVal : parseFloat(String(latestVal));
                value = isNaN(num) ? null : num;
              }
              break;
            case 'oldest':
              // Get the oldest entry's value
              const oldestEntry = rowEntries.sort((a, b) => {
                const dateA = this.getEntryDate(a);
                const dateB = this.getEntryDate(b);
                if (!dateA && !dateB) return 0;
                if (!dateA) return -1;
                if (!dateB) return 1;
                return dateA.getTime() - dateB.getTime();
              })[0];
              const oldestVal = oldestEntry.answers[column.valueFieldId];
              if (oldestVal !== null && oldestVal !== undefined && oldestVal !== '') {
                const num = typeof oldestVal === 'number' ? oldestVal : parseFloat(String(oldestVal));
                value = isNaN(num) ? null : num;
              }
              break;
          }
        }
      }

      // Format value
      if (value !== null) {
        const precision = column.display?.precision ?? 2;
        const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(precision);
        const suffix = column.display?.suffix || '';
        row[column.id] = formatted + suffix;
      } else {
        row[column.id] = column.display?.blankAsZero ? '0' : '';
      }
    }
  }

  /**
   * Check if field value matches filter
   */
  private matchesFilter(fieldValue: any, filter: { op: string; value: any | any[] }): boolean {
    switch (filter.op) {
      case 'eq':
        return fieldValue === filter.value;
      case 'neq':
        return fieldValue !== filter.value;
      case 'in':
        const filterValues = Array.isArray(filter.value) ? filter.value : [filter.value];
        return filterValues.includes(fieldValue);
      case 'nin':
        const filterValuesNot = Array.isArray(filter.value) ? filter.value : [filter.value];
        return !filterValuesNot.includes(fieldValue);
      default:
        return true;
    }
  }

  /**
   * Calculate derived column values
   */
  private calculateDerivedColumn(
    rows: TableRowData[],
    column: DerivedColumn,
    allColumns: TableColumnConfig[]
  ): void {
    for (const row of rows) {
      try {
        // Replace column IDs in formula with actual values
        let formula = column.formula;
        
        // Find all column IDs in the formula
        const columnIds = allColumns.map(c => c.id);
        for (const colId of columnIds) {
          const regex = new RegExp(`\\b${colId}\\b`, 'g');
          const cellValue = row[colId];
          
          // Convert cell value to number for calculation
          let numValue: number;
          if (cellValue === null || cellValue === undefined || cellValue === '') {
            numValue = 0;
          } else if (typeof cellValue === 'number') {
            numValue = cellValue;
          } else {
            // Remove suffix if present and parse
            const strValue = String(cellValue).replace(/[^\d.-]/g, '');
            numValue = parseFloat(strValue) || 0;
          }
          
          formula = formula.replace(regex, numValue.toString());
        }

        // Evaluate formula safely
        const result = this.safeEvaluate(formula);
        
        // Format result
        if (result !== null && !isNaN(result)) {
          const precision = column.display?.precision ?? 2;
          const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(precision);
          const suffix = column.display?.suffix || '';
          row[column.id] = formatted + suffix;
        } else {
          row[column.id] = column.display?.blankAsZero ? '0' : '—';
        }
      } catch (error) {
        logger.error(`Error calculating derived column ${column.id}`, error, 'TableDataService');
        row[column.id] = '—';
      }
    }
  }

  /**
   * Safely evaluate mathematical expression
   */
  private safeEvaluate(expression: string): number {
    try {
      // Remove any potentially dangerous characters (keep only math operators and numbers)
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      
      // Use Function constructor for safe evaluation
      const result = new Function('return ' + sanitized)();
      
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (error) {
      logger.error('Error evaluating formula', error, 'TableDataService');
      return 0;
    }
  }

  /**
   * Finalize rows: clean up internal fields and handle empty rows
   */
  private finalizeRows(rows: TableRowData[], tableConfig: TableConfig): TableRowData[] {
    const finalized = rows.map(row => {
      const cleaned: TableRowData = {};
      // Copy only column values (not internal _rowKey, _rowLabel)
      for (const column of tableConfig.columns) {
        cleaned[column.id] = row[column.id] ?? '';
      }
      return cleaned;
    });

    // Filter empty rows if configured
    if (tableConfig.emptyRows === 'hide') {
      return finalized.filter(row => {
        // Check if row has any non-empty values
        return Object.values(row).some(val => val !== null && val !== undefined && val !== '');
      });
    }

    return finalized;
  }

  /**
   * Get rows from entries-based source (legacy behavior)
   */
  private getRowsFromEntries(
    tableConfig: TableConfig,
    entries: FormEntry[]
  ): TableRowData[] {
    // This is the legacy behavior - one row per entry
    // For now, return empty array (we can implement later if needed)
    logger.warn('entries-based rows not yet implemented', undefined, 'TableDataService');
    return [];
  }
}

export const tableDataService = new TableDataService();

