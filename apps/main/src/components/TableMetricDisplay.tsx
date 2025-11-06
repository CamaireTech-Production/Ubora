import React from 'react';
import { DashboardMetric, TableColumnConfig } from '../types';
import { TableRowData } from '../utils/MetricCalculator';
import { Table, AlertCircle } from 'lucide-react';

interface TableMetricDisplayProps {
  metric: DashboardMetric;
  rows: TableRowData[];
  compact?: boolean;
  maxRows?: number; // Maximum number of rows to display (for previews)
}

export const TableMetricDisplay: React.FC<TableMetricDisplayProps> = ({
  metric,
  rows,
  compact = false,
  maxRows
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

  // Handle empty data
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune donnée disponible</p>
        <p className="text-xs text-gray-400 mt-1">Aucune soumission de formulaire trouvée</p>
      </div>
    );
  }

  // Limit rows for previews
  const displayRows = maxRows ? rows.slice(0, maxRows) : rows;
  const hasMoreRows = maxRows && rows.length > maxRows;

  return (
    <div className="w-full">
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
                {displayRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                    {columns.map((column: TableColumnConfig) => {
                      const cellValue = row[column.id];
                      const displayValue = cellValue !== null && cellValue !== undefined && cellValue !== ''
                        ? String(cellValue) 
                        : '';

                      return (
                        <td
                          key={column.id}
                          className={`px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-900 ${
                            compact ? 'px-2 py-1.5 text-xs' : ''
                          } ${
                            // Allow wrapping for long text on mobile, but keep nowrap on larger screens
                            compact ? 'whitespace-normal break-words' : 'whitespace-nowrap'
                          }`}
                        >
                          {displayValue || (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Show more rows indicator */}
      {hasMoreRows && (
        <div className="mt-2 text-center text-xs text-gray-500">
          {rows.length - (maxRows || 0)} ligne{rows.length - (maxRows || 0) > 1 ? 's' : ''} supplémentaire{rows.length - (maxRows || 0) > 1 ? 's' : ''}
        </div>
      )}

      {/* Row count info */}
      {!compact && rows.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          {rows.length} ligne{rows.length > 1 ? 's' : ''} au total
        </div>
      )}
    </div>
  );
};

