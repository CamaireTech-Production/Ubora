import React from 'react';
import { Dashboard, FormEntry, Form } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { MetricCalculator } from '../utils/MetricCalculator';
import { BarChart3, TrendingUp, TrendingDown, Minus, Hash, Type, Mail, Calendar, CheckSquare, Upload, Eye, Edit, Trash2 } from 'lucide-react';

interface DashboardDisplayProps {
  dashboard: Dashboard;
  formEntries: FormEntry[];
  forms: Form[];
  onEdit?: (dashboard: Dashboard) => void;
  onDelete?: (dashboardId: string) => void;
  onView?: (dashboard: Dashboard) => void;
  showActions?: boolean;
  minimal?: boolean;
}

export const DashboardDisplay: React.FC<DashboardDisplayProps> = ({
  dashboard,
  formEntries,
  forms,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  minimal = false
}) => {
  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
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

  const handleDelete = () => {
    if (onDelete && window.confirm(`Êtes-vous sûr de vouloir supprimer le tableau de bord "${dashboard.name}" ?`)) {
      onDelete(dashboard.id);
    }
  };

  // Minimal view for list display
  if (minimal) {
    return (
      <div 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onView?.(dashboard)}
      >
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {dashboard.name}
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Créé le {dashboard.createdAt.toLocaleDateString()}</span>
                <span>•</span>
                <span>{dashboard.metrics.length} métrique{dashboard.metrics.length > 1 ? 's' : ''}</span>
              </div>
            </div>
            
            {showActions && (
              <div className="flex items-center space-x-2">
                {onEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(dashboard);
                    }}
                    className="p-2"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Full view for detailed display
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {dashboard.name}
          </h3>
          {dashboard.description && (
            <p className="text-sm text-gray-600 mb-2">
              {dashboard.description}
            </p>
          )}
          <div className="flex items-center space-x-2 text-xs text-gray-500">
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {dashboard.metrics.map((metric, index) => {
            const result = MetricCalculator.calculateMetric(metric, formEntries);
            
            return (
              <div
                key={metric.id || index}
                className="bg-gray-50 rounded-lg p-2 sm:p-4 border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    {getFieldIcon(metric.fieldType)}
                    {getCalculationIcon(metric.calculationType)}
                  </div>
                  <span className="text-xs text-gray-500 bg-white px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs">
                    {getCalculationLabel(metric.calculationType)}
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

                <div className="mb-2 sm:mb-3">
                  <div className="text-lg sm:text-2xl font-bold text-blue-600 mb-0.5 sm:mb-1">
                    {result.displayValue}
                  </div>
                  <p className="text-xs text-gray-500">
                    {result.description}
                  </p>
                </div>

                <div className="text-xs text-gray-500 border-t border-gray-200 pt-1 sm:pt-2">
                  <div className="flex items-center space-x-1 mb-0.5 sm:mb-1">
                    <Eye className="h-2 w-2 sm:h-3 sm:w-3" />
                    <span className="truncate">{getFormTitle(metric.formId)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getFieldIcon(metric.fieldType)}
                    <span className="truncate">{getFieldLabel(metric.formId, metric.fieldId)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

