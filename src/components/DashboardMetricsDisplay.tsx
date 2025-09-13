import React from 'react';
import { Dashboard, FormEntry, Form } from '../types';
import { Card } from './Card';
import { MetricCalculator } from '../utils/MetricCalculator';
import { BarChart3, TrendingUp, TrendingDown, Minus, Hash, Type, Mail, Calendar, CheckSquare, Upload } from 'lucide-react';

interface DashboardMetricsDisplayProps {
  dashboard: Dashboard | null;
  formEntries: FormEntry[];
  forms: Form[];
  className?: string;
}

export const DashboardMetricsDisplay: React.FC<DashboardMetricsDisplayProps> = ({
  dashboard,
  formEntries,
  forms,
  className = ''
}) => {
  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text': return <Type className="h-6 w-6" />;
      case 'number': return <Hash className="h-6 w-6" />;
      case 'email': return <Mail className="h-6 w-6" />;
      case 'textarea': return <Type className="h-6 w-6" />;
      case 'select': return <CheckSquare className="h-6 w-6" />;
      case 'checkbox': return <CheckSquare className="h-6 w-6" />;
      case 'date': return <Calendar className="h-6 w-6" />;
      case 'file': return <Upload className="h-6 w-6" />;
      default: return <Type className="h-6 w-6" />;
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

  const getGradientClass = (index: number) => {
    const gradients = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-yellow-500 to-yellow-600',
      'from-purple-500 to-purple-600',
      'from-red-500 to-red-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600'
    ];
    return gradients[index % gradients.length];
  };

  const getTextColor = (index: number) => {
    const colors = [
      'text-blue-100',
      'text-green-100',
      'text-yellow-100',
      'text-purple-100',
      'text-red-100',
      'text-indigo-100',
      'text-pink-100',
      'text-teal-100'
    ];
    return colors[index % colors.length];
  };

  if (!dashboard || dashboard.metrics.length === 0) {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${className}`}>
        <Card className="bg-gradient-to-r from-gray-400 to-gray-500 text-white">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 opacity-80" />
            <div>
              <p className="text-gray-100">Aucune métrique</p>
              <p className="text-xl sm:text-2xl font-bold">-</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${className}`}>
      {dashboard.metrics.map((metric, index) => {
        const result = MetricCalculator.calculateMetric(metric, formEntries);
        const gradientClass = getGradientClass(index);
        const textColor = getTextColor(index);
        
        return (
          <Card key={metric.id || index} className={`bg-gradient-to-r ${gradientClass} text-white`}>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                {getFieldIcon(metric.fieldType)}
                {getCalculationIcon(metric.calculationType)}
              </div>
              <div className="flex-1">
                <p className={`${textColor} text-sm`}>{metric.name}</p>
                <p className="text-xl sm:text-2xl font-bold">{result.displayValue}</p>
                <p className={`${textColor} text-xs mt-1`}>{result.description}</p>
              </div>
            </div>
            
            {/* Additional info on hover or in a tooltip-like format */}
            <div className="mt-2 pt-2 border-t border-white border-opacity-20">
              <div className="flex items-center justify-between text-xs">
                <span className={`${textColor} truncate`}>
                  {getFormTitle(metric.formId)}
                </span>
                <span className={`${textColor} bg-white bg-opacity-20 px-2 py-0.5 rounded text-xs`}>
                  {getCalculationLabel(metric.calculationType)}
                </span>
              </div>
              <div className={`${textColor} text-xs mt-1 truncate`}>
                {getFieldLabel(metric.formId, metric.fieldId)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
