import React, { useState, useEffect } from 'react';
import { Dashboard, FormEntry, Form, DashboardMetric, User } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MetricCalculator } from '@ubora/shared/utils/MetricCalculator';
import { GraphPreview } from '../charts/GraphPreview';
import { GraphModal } from '../charts/GraphModal';
import { TableMetricDisplay } from './TableMetricDisplay';
import { tableDataService } from '../../services/core/tableDataService';
import { BarChart3, TrendingUp, TrendingDown, Minus, Hash, Type, Mail, Calendar, CheckSquare, Upload, Eye, Edit, Trash2, Crown, User as UserIcon, FileBarChart, Table } from 'lucide-react';
import { UniversBadge } from '../univers/UniversBadge';
import type { Dashboard as SharedDashboard, DashboardMetric as SharedDashboardMetric } from '@ubora/shared/types';

interface DashboardDisplayProps {
  dashboard: Dashboard;
  formEntries: FormEntry[];
  forms: Form[];
  employees?: User[];
  onEdit?: (dashboard: Dashboard) => void;
  onDelete?: (dashboardId: string) => void;
  onView?: (dashboard: Dashboard) => void;
  showActions?: boolean;
  minimal?: boolean;
  universName?: string; // Optional Univers name for badge
}

export const DashboardDisplay: React.FC<DashboardDisplayProps> = ({
  dashboard,
  formEntries,
  forms,
  employees = [],
  onEdit,
  onDelete,
  onView,
  showActions = true,
  minimal = false,
  universName
}) => {
  const [expandedGraph, setExpandedGraph] = useState<DashboardMetric | null>(null);
  const [tableRows, setTableRows] = useState<Record<string, any[]>>({});
  const [isLoadingTableRows, setIsLoadingTableRows] = useState<Record<string, boolean>>({});

  // Calculate table metric rows using the new service
  useEffect(() => {
    const calculateTableRows = async () => {
      const tableMetrics = dashboard.metrics.filter(m => m.metricType === 'table');
      if (tableMetrics.length === 0) return;

      const newTableRows: Record<string, any[]> = {};
      const newLoadingState: Record<string, boolean> = {};

      for (const metric of tableMetrics) {
        const metricId = metric.id || `temp_${dashboard.metrics.indexOf(metric)}`;
        newLoadingState[metricId] = true;
        
        try {
          // No period filter for DashboardDisplay (shows all time)
          const rows = await tableDataService.getRowsForTableMetric(metric, formEntries, undefined);
          newTableRows[metricId] = rows;
        } catch (error) {
          console.error(`Error calculating table rows for metric ${metricId}:`, error);
          newTableRows[metricId] = [];
        } finally {
          newLoadingState[metricId] = false;
        }
      }

      setTableRows(newTableRows);
      setIsLoadingTableRows(newLoadingState);
    };

    calculateTableRows();
  }, [dashboard, formEntries]);
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

  const getCalculationIcon = (calculationType: string) => {
    switch (calculationType) {
      case 'sum': return <TrendingUp className="h-4 w-4" />;
      case 'average': return <Minus className="h-4 w-4" />;
      case 'min': return <TrendingDown className="h-4 w-4" />;
      case 'max': return <TrendingUp className="h-4 w-4" />;
      case 'count': return <Hash className="h-4 w-4" />;
      case 'unique': return <BarChart3 className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

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

  // Function to get dashboard icon based on dashboard metrics
  const getDashboardIcon = (dashboard: Dashboard) => {
    const hasGraphMetrics = dashboard.metrics.some(metric => metric.metricType === 'graph');
    const hasCalculatedMetrics = dashboard.metrics.some(metric => metric.sourceType === 'computed');
    const metricCount = dashboard.metrics.length;
    
    // Determine icon based on dashboard characteristics
    if (hasGraphMetrics) return <BarChart3 className="h-5 w-5 text-blue-600" />;
    if (hasCalculatedMetrics && metricCount > 3) return <FileBarChart className="h-5 w-5 text-green-600" />;
    if (metricCount > 5) return <BarChart3 className="h-5 w-5 text-purple-600" />;
    
    // Default dashboard icon
    return <BarChart3 className="h-5 w-5 text-indigo-600" />;
  };

  const getFormTitle = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    return form?.title || 'Formulaire inconnu';
  };

  const getFieldLabel = (formId: string, fieldId: string) => {
    const form = forms.find(f => f.id === formId);
    const field = form?.fields.find(f => f.id === fieldId);
    return field?.label || 'Champ inconnu';
  };

  const toSharedMetric = (metric: DashboardMetric): SharedDashboardMetric => ({
    ...metric,
    metricType: metric.metricType || 'value',
    tableConfig: undefined
  }) as SharedDashboardMetric;

  const toSharedDashboard = (dashboard: Dashboard): SharedDashboard => ({
    ...dashboard,
    metrics: dashboard.metrics.map(toSharedMetric)
  }) as SharedDashboard;

  const handleDelete = () => {
    if (onDelete) {
      onDelete(dashboard.id);
    }
  };

  // Minimal view for list display
  if (minimal) {
    return (
      <div 
        className="cursor-pointer hover:shadow-md transition-shadow w-80 sm:w-96 h-64"
        onClick={() => onView?.(dashboard)}
      >
        <Card className="relative group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
          {/* Delete button in top-right corner */}
          {showActions && onDelete && (
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="p-1.5 h-8 w-8 shadow-lg"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {/* Edit button in top-right corner (below delete if both exist) */}
          {showActions && onEdit && (
            <div className="absolute top-2 right-12 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(dashboard);
                }}
                className="p-1.5 h-8 w-8 shadow-lg"
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {/* Main content with padding to avoid overlap with buttons */}
          <div className={`${showActions ? 'pr-20' : ''} flex-1 flex flex-col`}>
            {/* Header with icon and title */}
            <div className="flex items-start space-x-3 mb-3">
              <div className="flex-shrink-0 mt-1">
                {getDashboardIcon(dashboard)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-1 leading-tight" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.3'
                }}>
                  {dashboard.name}
                </h3>
                {dashboard.fromUnivers && dashboard.universId && (
                  <div className="mt-2">
                    <UniversBadge
                      universId={dashboard.universId}
                      universName={universName}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Creation date and creator info */}
            <div className="text-sm text-gray-500 space-y-1 mb-4 flex-1">
              <div className="flex items-center space-x-2">
                <span>Créé le {dashboard.createdAt.toLocaleDateString()}</span>
              </div>
              {dashboard.createdByRole === 'directeur' ? (
                <div className="flex items-center space-x-1">
                  <Crown className="h-3 w-3 text-yellow-500" />
                  <span className="text-yellow-600 font-medium">Créé par le Directeur</span>
                </div>
              ) : dashboard.createdByRole === 'employe' && dashboard.createdByEmployeeId ? (
                <div className="flex items-center space-x-1">
                  <UserIcon className="h-3 w-3 text-blue-500" />
                  <span className="text-blue-600">Créé par: {employees.find(emp => emp.id === dashboard.createdByEmployeeId)?.name || 'Employé inconnu'}</span>
                </div>
              ) : null}
            </div>

            {/* Metric count in large square box */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 text-center border border-indigo-200 mt-auto">
              <div className="text-3xl font-bold text-indigo-700 mb-1">
                {dashboard.metrics.length}
              </div>
              <div className="text-sm text-indigo-600 font-medium">
                métrique{dashboard.metrics.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Full view for detailed display
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-start space-x-3 mb-3">
            <div className="flex-shrink-0 mt-1">
              {getDashboardIcon(dashboard)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {dashboard.name}
              </h3>
              {dashboard.fromUnivers && dashboard.universId && (
                <div className="mt-2">
                  <UniversBadge
                    universId={dashboard.universId}
                    size="sm"
                  />
                </div>
              )}
            </div>
          </div>
          {dashboard.description && (
            <p className="text-sm text-gray-600 mb-3">
              {dashboard.description}
            </p>
          )}
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <span>Créé le {dashboard.createdAt.toLocaleDateString()}</span>
            <span>•</span>
            <span>{dashboard.metrics.length} métrique{dashboard.metrics.length > 1 ? 's' : ''}</span>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center space-x-2">
            {onView && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onView(dashboard)}
                className="p-2"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(dashboard)}
                className="p-2"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                className="p-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {dashboard.metrics.length === 0 ? (
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Aucune métrique configurée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {dashboard.metrics.map((metric, index) => {
            const metricId = metric.id || `temp_${index}`;
            
            // For table metrics, use the new service; for others, use MetricCalculator
            let result;
            let tableRowsData: any[] = [];
            
            if (metric.metricType === 'table') {
              // Use table data service results
              tableRowsData = tableRows[metricId] || [];
              result = {
                value: tableRowsData,
                displayValue: `${tableRowsData.length} ligne${tableRowsData.length > 1 ? 's' : ''}`,
                description: isLoadingTableRows[metricId] ? 'Calcul en cours...' : `${tableRowsData.length} ligne${tableRowsData.length > 1 ? 's' : ''} dans le tableau`
              };
            } else {
              // Use MetricCalculator for non-table metrics
              result = MetricCalculator.calculateMetric(
                toSharedMetric(metric),
                formEntries,
                toSharedDashboard(dashboard)
              );
            }
            
            return (
              <div
                key={metric.id || index}
                className={`bg-gray-50 rounded-lg p-2 sm:p-4 border border-gray-200 hover:border-gray-300 transition-colors ${
                  metric.metricType === 'graph' ? 'col-span-1 sm:col-span-2 lg:col-span-2' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    {getFieldIcon(metric.fieldType)}
                    {metric.metricType === 'table' ? (
                      <Table className="h-4 w-4 text-purple-600" />
                    ) : metric.metricType === 'graph' ? (
                      <BarChart3 className="h-4 w-4" />
                    ) : (
                      getCalculationIcon(metric.calculationType)
                    )}
                  </div>
                  <span className={`text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs ${
                    metric.metricType === 'table'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : metric.metricType === 'graph' 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'bg-white text-gray-500'
                  }`}>
                    {metric.metricType === 'table' ? '📋 Tableau' : metric.metricType === 'graph' ? '📊 Graphique' : getCalculationLabel(metric.calculationType)}
                  </span>
                </div>

                <div className="mb-1 sm:mb-2">
                  <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-0.5 sm:mb-1">
                    {metric.name}
                  </h4>
                  {metric.description && (
                    <p className="text-xs text-gray-600 mb-1 sm:mb-2 hidden sm:block">
                      {metric.description}
                    </p>
                  )}
                </div>

                {metric.metricType === 'graph' ? (
                  <div className="mb-2 sm:mb-3">
                    <div className="bg-white rounded-lg border border-gray-200 p-2">
                      <GraphPreview
                        metric={toSharedMetric(metric)}
                        formEntries={formEntries}
                        forms={forms}
                        onExpand={() => setExpandedGraph(metric)}
                        compact={true}
                      />
                    </div>
                  </div>
                ) : metric.metricType === 'table' ? (
                  <div className="mb-2 sm:mb-3">
                    <div className="bg-white rounded-lg border border-gray-200 p-2">
                      {isLoadingTableRows[metricId] ? (
                        <div className="text-center py-6 text-gray-500">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                          <p className="text-sm">Calcul en cours...</p>
                        </div>
                      ) : (
                        <TableMetricDisplay
                          metric={metric}
                          rows={tableRowsData}
                          compact={true}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 sm:mb-3">
                    <div className="text-lg sm:text-2xl font-bold text-blue-600 mb-0.5 sm:mb-1">
                      {result.displayValue}
                    </div>
                    <p className="text-xs text-gray-500">
                      {result.description}
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-500 border-t border-gray-200 pt-1 sm:pt-2">
                  {metric.metricType === 'table' ? (
                    <div className="flex items-center space-x-1">
                      <Table className="h-2 w-2 sm:h-3 sm:w-3" />
                      <span className="truncate">Tableau avec {metric.tableConfig?.columns?.length || 0} colonne{(metric.tableConfig?.columns?.length || 0) > 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-1 mb-0.5 sm:mb-1">
                        <Eye className="h-2 w-2 sm:h-3 sm:w-3" />
                        <span className="truncate">{getFormTitle(metric.formId || '')}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getFieldIcon(metric.fieldType)}
                        <span className="truncate">{getFieldLabel(metric.formId || '', metric.fieldId || '')}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Graph Modal */}
      {expandedGraph && (
        <GraphModal
          isOpen={!!expandedGraph}
          onClose={() => setExpandedGraph(null)}
          metric={toSharedMetric(expandedGraph)}
          formEntries={formEntries}
          forms={forms}
        />
      )}

    </Card>
  );
};

