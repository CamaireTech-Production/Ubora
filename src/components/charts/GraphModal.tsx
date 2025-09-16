import React from 'react';
import { DashboardMetric, FormEntry, Form } from '../../types';
import { GraphPreview } from './GraphPreview';
import { Button } from '../Button';
import { X, Download, BarChart3 } from 'lucide-react';

interface GraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: DashboardMetric;
  formEntries: FormEntry[];
  forms: Form[];
}

export const GraphModal: React.FC<GraphModalProps> = ({
  isOpen,
  onClose,
  metric,
  formEntries,
  forms
}) => {
  if (!isOpen) return null;

  const form = forms.find(f => f.id === metric.formId);
  const relevantEntries = formEntries.filter(entry => entry.formId === metric.formId);

  const getAxisLabel = (axisType: string, fieldId?: string) => {
    if (axisType === 'time') return 'Heure de soumission';
    if (axisType === 'date') return 'Date de soumission';
    if (axisType === 'field' && fieldId) {
      const field = form?.fields.find(f => f.id === fieldId);
      return field ? field.label : 'Champ inconnu';
    }
    return axisType;
  };

  const getYAxisLabel = (yAxisType: string, fieldId?: string) => {
    switch (yAxisType) {
      case 'count': return 'Nombre de soumissions';
      case 'sum': return 'Somme des valeurs';
      case 'average': return 'Moyenne des valeurs';
      case 'field': 
        if (fieldId) {
          const field = form?.fields.find(f => f.id === fieldId);
          return field ? field.label : 'Champ inconnu';
        }
        return 'Valeur du champ';
      default: return yAxisType;
    }
  };

  const getChartTypeLabel = (chartType: string) => {
    switch (chartType) {
      case 'line': return 'Graphique en ligne';
      case 'bar': return 'Graphique en barres';
      case 'area': return 'Graphique en aires';
      default: return chartType;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{metric.name}</h2>
              {metric.description && (
                <p className="text-sm text-gray-600 mt-1">{metric.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // TODO: Implement download functionality
                console.log('Download chart');
              }}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Télécharger</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chart Configuration Info */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Axe X:</span>
              <span className="ml-2 text-gray-600">
                {getAxisLabel(metric.graphConfig?.xAxisType || '', metric.graphConfig?.xAxisFieldId)}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Axe Y:</span>
              <span className="ml-2 text-gray-600">
                {getYAxisLabel(metric.graphConfig?.yAxisType || '', metric.graphConfig?.yAxisFieldId)}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Type:</span>
              <span className="ml-2 text-gray-600">
                {getChartTypeLabel(metric.graphConfig?.chartType || 'line')}
              </span>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Données:</span>
            <span className="ml-2">{relevantEntries.length} soumission{relevantEntries.length > 1 ? 's' : ''}</span>
            <span className="mx-2">•</span>
            <span>Formulaire: {form?.title || 'Inconnu'}</span>
          </div>
        </div>

        {/* Chart */}
        <div className="p-6">
          <div className="h-96">
            <GraphPreview
              metric={metric}
              formEntries={formEntries}
              forms={forms}
              compact={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
