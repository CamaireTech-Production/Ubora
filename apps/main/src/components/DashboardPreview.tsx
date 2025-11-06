import React from 'react';
import { DashboardDefinition, DashboardMetric } from '@ubora/shared/types';
import { BarChart3, Hash, TrendingUp, TrendingDown, Minus, Table } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';

interface DashboardPreviewProps {
  dashboard: DashboardDefinition;
}

/**
 * DashboardPreview component - displays a preview of dashboard metrics
 * Shows placeholder values for numerique, placeholder graphs for graphique, and placeholder tables for table type
 */
export const DashboardPreview: React.FC<DashboardPreviewProps> = ({ dashboard }) => {
  if (!dashboard.metrics || dashboard.metrics.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p>Aucune métrique configurée</p>
      </div>
    );
  }

  const getCalculationLabel = (calculationType: string) => {
    switch (calculationType) {
      case 'sum': return 'Somme';
      case 'average': return 'Moyenne';
      case 'min': return 'Minimum';
      case 'max': return 'Maximum';
      case 'count': return 'Nombre';
      case 'unique': return 'Valeurs uniques';
      default: return calculationType;
    }
  };

  const getPlaceholderValue = (metric: DashboardMetric) => {
    // Return placeholder value based on calculation type
    switch (metric.calculationType) {
      case 'sum':
        return '0';
      case 'average':
        return '0.0';
      case 'count':
        return '0';
      case 'min':
        return '-';
      case 'max':
        return '-';
      case 'unique':
        return '0';
      default:
        return 'N/A';
    }
  };

  const renderPlaceholderGraph = (metric: DashboardMetric) => {
    // Generate placeholder chart data
    const placeholderData = [
      { x: 'Jan', y: 0 },
      { x: 'Fév', y: 0 },
      { x: 'Mar', y: 0 },
      { x: 'Avr', y: 0 },
      { x: 'Mai', y: 0 },
      { x: 'Jun', y: 0 },
    ];

    const chartType = (metric as any).graphConfig?.chartType || 'line';

    const commonProps = {
      data: placeholderData,
      margin: { top: 5, right: 5, left: 5, bottom: 5 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
            <Tooltip />
            <Bar dataKey="y" fill="#d1d5db" radius={[2, 2, 0, 0]} />
          </BarChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
            <Tooltip />
            <Area type="monotone" dataKey="y" stroke="#d1d5db" fill="#d1d5db" fillOpacity={0.3} strokeWidth={1.5} />
          </AreaChart>
        );
      
      case 'line':
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
            <Tooltip />
            <Line type="monotone" dataKey="y" stroke="#d1d5db" strokeWidth={1.5} dot={false} />
          </LineChart>
        );
    }
  };

  const renderPlaceholderTable = (metric: DashboardMetric) => {
    // Generate placeholder table structure
    return (
      <div className="w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Colonne 1
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Colonne 2
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Colonne 3
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
              <td className="px-4 py-2 text-sm text-gray-500">-</td>
            </tr>
          </tbody>
        </table>
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center">
          Aperçu du tableau - Aucune donnée disponible
        </div>
      </div>
    );
  };

  const renderMetric = (metric: DashboardMetric, index: number) => {
    const metricType = (metric as any).metricType || 'value'; // Default to 'value' if not specified

    return (
      <div
        key={metric.id || index}
        className={`bg-gray-50 rounded-lg p-4 border border-gray-200 ${
          metricType === 'graph' ? 'col-span-1 sm:col-span-2' : ''
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {metricType === 'graph' ? (
              <BarChart3 className="h-4 w-4 text-blue-600" />
            ) : metricType === 'table' ? (
              <Table className="h-4 w-4 text-blue-600" />
            ) : (
              <Hash className="h-4 w-4 text-blue-600" />
            )}
            <h4 className="font-medium text-gray-900 text-sm">
              {metric.name}
            </h4>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${
            metricType === 'graph' 
              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
              : metricType === 'table'
              ? 'bg-purple-100 text-purple-700 border border-purple-200'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {metricType === 'graph' ? '📊 Graphique' : metricType === 'table' ? '📋 Tableau' : getCalculationLabel(metric.calculationType)}
          </span>
        </div>

        {metric.description && (
          <p className="text-xs text-gray-600 mb-3">
            {metric.description}
          </p>
        )}

        {metricType === 'graph' ? (
          <div className="mb-2">
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                  {renderPlaceholderGraph(metric)}
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Aperçu du graphique - Aucune donnée disponible
            </p>
          </div>
        ) : metricType === 'table' ? (
          <div className="mb-2">
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              <TableMetricDisplay
                metric={metric}
                rows={[]}
                compact={true}
                maxRows={3}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Aperçu du tableau - Aucune donnée disponible
            </p>
          </div>
        ) : (
          <div className="mb-2">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {getPlaceholderValue(metric)}
            </div>
            <p className="text-xs text-gray-500">
              Aperçu - Aucune donnée disponible
            </p>
          </div>
        )}

        <div className="text-xs text-gray-500 border-t border-gray-200 pt-2 mt-2">
          <div className="flex items-center space-x-1">
            <span>Type: {metric.fieldType}</span>
            <span className="mx-1">•</span>
            <span>Calcul: {getCalculationLabel(metric.calculationType)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboard.metrics.map((metric, index) => renderMetric(metric, index))}
      </div>
    </div>
  );
};

