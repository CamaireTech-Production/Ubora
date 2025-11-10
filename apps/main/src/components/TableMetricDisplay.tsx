import React from 'react';
import { DashboardMetric, TableColumnConfig } from '../types';
import { TableRowData } from '../utils/MetricCalculator';
import { Table, AlertCircle, Maximize2 } from 'lucide-react';
import { Button } from './Button';

interface TableMetricDisplayProps {
  metric: DashboardMetric;
  rows: TableRowData[];
  compact?: boolean;
  maxRows?: number; // Maximum number of rows to display (for previews)
  onExpand?: () => void; // Callback when expand button is clicked
}

export const TableMetricDisplay: React.FC<TableMetricDisplayProps> = ({
  metric,
  rows,
  compact = false,
  maxRows,
  onExpand
}) => {
  // Get column configurations
  const columns = metric.tableConfig?.columns || [];

  if (columns.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune colonne configurée</p>
      </div>
    );
  }

  // Handle empty data - show table structure with empty rows instead of message
  const isEmpty = !rows || rows.length === 0;
  
  // Create empty rows for preview when no data (show 2-3 empty rows to demonstrate structure)
  const emptyRowsForPreview: TableRowData[] = isEmpty ? Array(2).fill(null).map(() => {
    const emptyRow: TableRowData = {};
    columns.forEach(column => {
      emptyRow[column.id] = '';
    });
    return emptyRow;
  }) : [];

  // Use empty rows for preview if no data, otherwise use actual rows
  const rowsToDisplay = isEmpty ? emptyRowsForPreview : rows;
  
  // Limit rows for previews (default to 10 for previews)
  const previewLimit = maxRows || (compact ? 10 : undefined);
  const displayRows = previewLimit ? rowsToDisplay.slice(0, previewLimit) : rowsToDisplay;
  const hasMoreRows = previewLimit && rowsToDisplay.length > previewLimit && !isEmpty;

  return (
    <div className="w-full relative group">
      {/* Scrollable container for mobile - responsive horizontal scroll */}
      <div className="overflow-x-auto -mx-2 sm:mx-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              {/* Table header */}
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((column: TableColumnConfig) => (
                    <th
                      key={column.id}
                      scope="col"
                      className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        compact ? 'px-2 py-1.5 text-xs' : ''
                      }`}
                    >
                      {column.name || `Colonne ${column.id}`}
                    </th>
                  ))}
                </tr>
              </thead>
              {/* Table body */}
              <tbody className="bg-white divide-y divide-gray-200">
                {displayRows.length === 0 ? (
                  // Show at least one empty row to demonstrate structure
                  <tr>
                    {columns.map((column: TableColumnConfig) => (
                      <td
                        key={column.id}
                        className={`px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-400 ${
                          compact ? 'px-2 py-1.5 text-xs' : ''
                        } ${compact ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}
                      >
                        <span className="text-gray-300">-</span>
                      </td>
                    ))}
                  </tr>
                ) : (
                  displayRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={`transition-colors ${isEmpty ? '' : 'hover:bg-gray-50'}`}>
                      {columns.map((column: TableColumnConfig) => {
                        const cellValue = row[column.id];
                        
                        // Handle mixed data types: convert to string for display
                        // Supports: numbers, strings, booleans, dates, arrays, objects
                        let displayValue = '';
                        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                          if (typeof cellValue === 'boolean') {
                            displayValue = cellValue ? 'Oui' : 'Non';
                          } else if (cellValue instanceof Date) {
                            displayValue = cellValue.toLocaleDateString('fr-FR');
                          } else if (Array.isArray(cellValue)) {
                            displayValue = cellValue.join(', ');
                          } else if (typeof cellValue === 'object') {
                            displayValue = JSON.stringify(cellValue);
                          } else {
                            displayValue = String(cellValue);
                          }
                        }

                        return (
                          <td
                            key={column.id}
                            className={`px-3 sm:px-4 py-2 sm:py-3 text-sm ${
                              isEmpty ? 'text-gray-300' : 'text-gray-900'
                            } ${
                              compact ? 'px-2 py-1.5 text-xs' : ''
                            } ${
                              // Allow wrapping for long text on mobile, but keep nowrap on larger screens
                              compact ? 'whitespace-normal break-words' : 'whitespace-nowrap'
                            }`}
                          >
                            {displayValue || (
                              <span className={isEmpty ? 'text-gray-300' : 'text-gray-400'}>-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Floating expand button - shows on hover (desktop) or always (mobile) */}
      {hasMoreRows && onExpand && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="p-1 h-8 w-8 sm:h-9 sm:w-9 bg-white/90 hover:bg-white shadow-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
            title="Voir tout le tableau"
          >
            <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      )}

      {/* Row count info */}
      {hasMoreRows && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          {rows.length - (previewLimit || 0)} ligne{rows.length - (previewLimit || 0) > 1 ? 's' : ''} supplémentaire{rows.length - (previewLimit || 0) > 1 ? 's' : ''}
        </div>
      )}

      {/* Row count info (when no expand button) */}
      {!hasMoreRows && !compact && !isEmpty && rows.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          {rows.length} ligne{rows.length > 1 ? 's' : ''} au total
        </div>
      )}
      
      {/* Empty data indicator */}
      {isEmpty && (
        <div className="mt-2 text-xs text-gray-400 text-center italic">
          Aperçu de la structure - Aucune donnée disponible
        </div>
      )}
    </div>
  );
};

