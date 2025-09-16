import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { DashboardMetric, FormEntry, Form } from '../../types';
import { Button } from '../Button';
import { Maximize2, BarChart3 } from 'lucide-react';

interface GraphPreviewProps {
  metric: DashboardMetric;
  formEntries: FormEntry[];
  forms: Form[];
  onExpand?: () => void;
  compact?: boolean;
}

export const GraphPreview: React.FC<GraphPreviewProps> = ({ 
  metric, 
  formEntries, 
  forms, 
  onExpand,
  compact = true 
}) => {
  if (!metric.graphConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-24 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
        <BarChart3 className="h-6 w-6 mb-2 text-gray-400" />
        <span>Configuration manquante</span>
      </div>
    );
  }

  const { graphConfig } = metric;
  const form = forms.find(f => f.id === metric.formId);
  
  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center h-24 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
        <BarChart3 className="h-6 w-6 mb-2 text-gray-400" />
        <span>Formulaire non trouvé</span>
      </div>
    );
  }

  // Filter entries for the specific form
  const relevantEntries = formEntries.filter(entry => entry.formId === metric.formId);
  
  if (relevantEntries.length === 0) {
    return (
      <div className="relative">
        <div className="flex flex-col items-center justify-center h-24 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
          <BarChart3 className="h-6 w-6 mb-2 text-gray-400" />
          <span>Aucune donnée disponible</span>
          <span className="text-xs text-gray-400 mt-1">Soumettez des formulaires pour voir le graphique</span>
        </div>
        {compact && onExpand && (
          <div className="absolute top-2 right-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="p-1 h-7 w-7 bg-white/90 hover:bg-white shadow-md border border-gray-200 hover:border-gray-300 transition-all"
              title="Agrandir le graphique"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Prepare chart data
  const chartData = prepareChartData(relevantEntries, form, graphConfig);

  if (chartData.length === 0) {
    return (
      <div className="relative">
        <div className="flex flex-col items-center justify-center h-24 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
          <BarChart3 className="h-6 w-6 mb-2 text-gray-400" />
          <span>Aucune donnée valide</span>
          <span className="text-xs text-gray-400 mt-1">Vérifiez la configuration des axes</span>
        </div>
        {compact && onExpand && (
          <div className="absolute top-2 right-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="p-1 h-7 w-7 bg-white/90 hover:bg-white shadow-md border border-gray-200 hover:border-gray-300 transition-all"
              title="Agrandir le graphique"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: compact ? { top: 5, right: 10, left: 5, bottom: 5 } : { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (graphConfig.chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="x" 
              tick={{ fontSize: compact ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: compact ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip />
            <Bar dataKey="y" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="x" 
              tick={{ fontSize: compact ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: compact ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip />
            <Area 
              type="monotone" 
              dataKey="y" 
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3}
              strokeWidth={compact ? 1.5 : 2}
            />
          </AreaChart>
        );
      
      case 'line':
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="x" 
              tick={{ fontSize: compact ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: compact ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="y" 
              stroke="#3b82f6" 
              strokeWidth={compact ? 1.5 : 2}
              dot={!compact}
              activeDot={{ r: compact ? 3 : 4 }}
            />
          </LineChart>
        );
    }
  };

  return (
    <div className="relative">
      <div className={`w-full ${compact ? 'h-24' : 'h-48'}`}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
      
      {compact && onExpand && (
        <div className="absolute top-2 right-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="p-1 h-7 w-7 bg-white/90 hover:bg-white shadow-md border border-gray-200 hover:border-gray-300 transition-all"
            title="Agrandir le graphique"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

// Helper function to prepare chart data (same as in MetricChart)
function prepareChartData(entries: FormEntry[], form: Form, graphConfig: NonNullable<DashboardMetric['graphConfig']>) {
  const data: Array<{ x: string | number; y: number }> = [];

  if (graphConfig.xAxisType === 'time' || graphConfig.xAxisType === 'date') {
    // Group by time/date
    const groupedByTime = new Map<string, FormEntry[]>();
    
    entries.forEach(entry => {
      const date = new Date(entry.submittedAt);
      let timeKey: string;
      
      if (graphConfig.xAxisType === 'date') {
        timeKey = date.toLocaleDateString();
      } else {
        // Group by hour for time
        timeKey = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      
      if (!groupedByTime.has(timeKey)) {
        groupedByTime.set(timeKey, []);
      }
      groupedByTime.get(timeKey)!.push(entry);
    });

    // Calculate Y values for each time group
    groupedByTime.forEach((timeEntries, timeKey) => {
      let yValue = 0;
      
      if (graphConfig.yAxisType === 'count') {
        yValue = timeEntries.length;
      } else if (graphConfig.yAxisType === 'field' && graphConfig.yAxisFieldId) {
        const fieldValues = timeEntries
          .map(entry => entry.answers[graphConfig.yAxisFieldId!])
          .filter(value => value !== null && value !== undefined && value !== '');
        
        if (fieldValues.length > 0) {
          if (graphConfig.yAxisType === 'sum') {
            yValue = fieldValues.reduce((sum, val) => sum + (Number(val) || 0), 0);
          } else if (graphConfig.yAxisType === 'average') {
            yValue = fieldValues.reduce((sum, val) => sum + (Number(val) || 0), 0) / fieldValues.length;
          } else {
            yValue = fieldValues.length;
          }
        }
      }
      
      data.push({ x: timeKey, y: yValue });
    });
  } else if (graphConfig.xAxisType === 'field' && graphConfig.xAxisFieldId) {
    // Group by field value
    const xField = form.fields.find(f => f.id === graphConfig.xAxisFieldId);
    if (!xField) return data;

    const groupedByField = new Map<string, FormEntry[]>();
    
    entries.forEach(entry => {
      const fieldValue = entry.answers[graphConfig.xAxisFieldId!];
      const displayValue = formatFieldValue(fieldValue, xField.type);
      
      if (!groupedByField.has(displayValue)) {
        groupedByField.set(displayValue, []);
      }
      groupedByField.get(displayValue)!.push(entry);
    });

    // Calculate Y values for each field group
    groupedByField.forEach((fieldEntries, fieldValue) => {
      let yValue = 0;
      
      if (graphConfig.yAxisType === 'count') {
        yValue = fieldEntries.length;
      } else if (graphConfig.yAxisType === 'field' && graphConfig.yAxisFieldId) {
        const yFieldValues = fieldEntries
          .map(entry => entry.answers[graphConfig.yAxisFieldId!])
          .filter(value => value !== null && value !== undefined && value !== '');
        
        if (yFieldValues.length > 0) {
          if (graphConfig.yAxisType === 'sum') {
            yValue = yFieldValues.reduce((sum, val) => sum + (Number(val) || 0), 0);
          } else if (graphConfig.yAxisType === 'average') {
            yValue = yFieldValues.reduce((sum, val) => sum + (Number(val) || 0), 0) / yFieldValues.length;
          } else {
            yValue = yFieldValues.length;
          }
        }
      }
      
      data.push({ x: fieldValue, y: yValue });
    });
  }

  // Sort data by X value for better visualization
  return data.sort((a, b) => {
    if (typeof a.x === 'string' && typeof b.x === 'string') {
      return a.x.localeCompare(b.x);
    }
    return (a.x as number) - (b.x as number);
  });
}

// Helper function to format field values for display
function formatFieldValue(value: any, fieldType: string): string {
  if (value === null || value === undefined || value === '') {
    return 'Non renseigné';
  }

  switch (fieldType) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'number':
      return Number(value).toString();
    case 'checkbox':
      return value ? 'Oui' : 'Non';
    case 'file':
      return 'Fichier';
    default:
      return String(value);
  }
}
