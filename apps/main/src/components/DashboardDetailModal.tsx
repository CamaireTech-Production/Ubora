import React from 'react';
import { Dashboard, FormEntry, Form } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { MetricCalculator } from '../utils/MetricCalculator';
import { X, BarChart3, TrendingUp, TrendingDown, Minus, Hash, Type, Mail, Calendar, CheckSquare, Upload, Eye, Edit, Trash2 } from 'lucide-react';

interface DashboardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: Dashboard | null;
  formEntries: FormEntry[];
  forms: Form[];
  onEditDashboard?: (dashboard: Dashboard) => void;
  onDeleteDashboard?: (dashboardId: string) => void;
  onEditMetric?: (dashboard: Dashboard, metricIndex: number) => void;
  onDeleteMetric?: (dashboard: Dashboard, metricIndex: number) => void;
}

export const DashboardDetailModal: React.FC<DashboardDetailModalProps> = ({
  isOpen,
  onClose,
  dashboard,
  formEntries,
  forms,
  onEditDashboard,
  onDeleteDashboard,
  onEditMetric,
  onDeleteMetric
}) => {
  if (!isOpen || !dashboard) return null;

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

  const getFormTitle = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    return form?.title || 'Formulaire inconnu';
  };

  const getFieldLabel = (formId: string, fieldId: string) => {
    const form = forms.find(f => f.id === formId);
    const field = form?.fields.find(f => f.id === fieldId);
    return field?.label || 'Champ inconnu';
  };

  const handleDeleteDashboard = () => {
    if (onDeleteDashboard && window.confirm(`Êtes-vous sûr de vouloir supprimer le tableau de bord "${dashboard.name}" ?`)) {
      onDeleteDashboard(dashboard.id);
      onClose();
    }
  };

  const handleDeleteMetric = (metricIndex: number) => {
    const metric = dashboard.metrics[metricIndex];
    if (onDeleteMetric && window.confirm(`Êtes-vous sûr de vouloir supprimer la métrique "${metric.name}" ?`)) {
      onDeleteMetric(dashboard, metricIndex);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{dashboard.name}</h2>
              {dashboard.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{dashboard.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {onEditDashboard && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEditDashboard(dashboard)}
                className="p-1.5 sm:p-2"
                title="Modifier le tableau de bord"
              >
                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )}
            {onDeleteDashboard && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteDashboard}
                className="p-1.5 sm:p-2"
                title="Supprimer le tableau de bord"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="p-1.5 sm:p-2"
              title="Fermer"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Dashboard Info */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Créé le:</span>
                <p className="text-gray-600">{dashboard.createdAt.toLocaleDateString()}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Métriques:</span>
                <p className="text-gray-600">{dashboard.metrics.length} métrique{dashboard.metrics.length > 1 ? 's' : ''}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Formulaires utilisés:</span>
                <p className="text-gray-600">
                  {new Set(dashboard.metrics.map(m => m.formId)).size} formulaire{new Set(dashboard.metrics.map(m => m.formId)).size > 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Données disponibles:</span>
                <p className="text-gray-600">
                  {formEntries.filter(entry => dashboard.metrics.some(m => m.formId === entry.formId)).length} entrée{formEntries.filter(entry => dashboard.metrics.some(m => m.formId === entry.formId)).length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          {dashboard.metrics.length === 0 ? (
            <Card className="p-8 text-center">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune métrique configurée
              </h3>
              <p className="text-gray-600">
                Ce tableau de bord ne contient aucune métrique pour le moment.
              </p>
            </Card>
          ) : (
            // Always horizontal scrollable like dashboard list
            <div className="relative">
              {/* Scroll indicators */}
              <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
              <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
              
              <div className="flex gap-3 sm:gap-4 lg:gap-6 overflow-x-auto pb-4 scrollbar-hide horizontal-scroll-metrics scroll-smooth">
              {dashboard.metrics.map((metric, index) => {
                const result = MetricCalculator.calculateMetric(metric, formEntries);
                
                return (
                  <div key={metric.id || index} className="flex-shrink-0 w-64 sm:w-72 lg:w-80">
                    <Card className="hover:shadow-lg transition-shadow h-full">
                    {/* Header with icons and actions */}
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        {getFieldIcon(metric.fieldType)}
                        {getCalculationIcon(metric.calculationType)}
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                          {getCalculationLabel(metric.calculationType)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {onEditMetric && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onEditMetric(dashboard, index)}
                            className="p-1"
                            title="Modifier la métrique"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        {onDeleteMetric && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteMetric(index)}
                            className="p-1"
                            title="Supprimer la métrique"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Metric name and description */}
                    <div className="mb-2 sm:mb-3">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg mb-1">
                        {metric.name}
                      </h4>
                      {metric.description && (
                        <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2 hidden sm:block">
                          {metric.description}
                        </p>
                      )}
                    </div>

                    {/* Metric value and result */}
                    <div className="mb-2 sm:mb-3">
                      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 mb-1">
                        {result.displayValue}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {result.description}
                      </p>
                      {result.value === 0 && (
                        <p className="text-xs text-orange-500 mt-1">
                          Vérifiez que des données existent pour ce formulaire
                        </p>
                      )}
                    </div>

                    {/* Source information */}
                    <div className="text-xs text-gray-500 border-t border-gray-200 pt-1.5 sm:pt-2">
                      <div className="flex items-center space-x-1 mb-0.5 sm:mb-1">
                        <Eye className="h-2 w-2 sm:h-3 sm:w-3" />
                        <span className="truncate">{getFormTitle(metric.formId)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getFieldIcon(metric.fieldType)}
                        <span className="truncate">{getFieldLabel(metric.formId, metric.fieldId)}</span>
                      </div>
                    </div>
                    </Card>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 sm:space-x-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="secondary"
            onClick={onClose}
            className="text-sm sm:text-base"
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
