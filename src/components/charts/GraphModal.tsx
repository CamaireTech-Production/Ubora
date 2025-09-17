import React, { useState, useEffect } from 'react';
import { DashboardMetric, FormEntry, Form } from '../../types';
import { GraphPreview } from './GraphPreview';
import { Button } from '../Button';
import { X, BarChart3, Maximize2, Minimize2, RotateCcw, RotateCw } from 'lucide-react';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [chartHeight, setChartHeight] = useState(384); // 96 * 4 (h-96)

  // Screen rotation detection
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscapeMode = window.innerWidth > window.innerHeight;
      setIsLandscape(isLandscapeMode);
      
      if (isFullscreen) {
        // Adjust chart height based on orientation
        if (isLandscapeMode) {
          setChartHeight(Math.min(window.innerHeight * 0.6, 600));
        } else {
          setChartHeight(Math.min(window.innerHeight * 0.5, 500));
        }
      }
    };

    // Initial check
    handleOrientationChange();

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [isFullscreen]);

  // Fullscreen functionality
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
        // Adjust chart height for fullscreen
        const isLandscapeMode = window.innerWidth > window.innerHeight;
        if (isLandscapeMode) {
          setChartHeight(Math.min(window.innerHeight * 0.6, 600));
        } else {
          setChartHeight(Math.min(window.innerHeight * 0.5, 500));
        }
      }).catch(err => {
        console.log('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        setChartHeight(384); // Reset to default
      }).catch(err => {
        console.log('Error attempting to exit fullscreen:', err);
      });
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isFullscreen]);

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
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`bg-white shadow-xl w-full overflow-hidden ${
        isFullscreen 
          ? 'h-full rounded-none' 
          : 'rounded-lg max-w-6xl max-h-[95vh]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-gray-200 ${
          isFullscreen ? 'p-4' : 'p-6'
        }`}>
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className={`font-semibold text-gray-900 ${
                isFullscreen ? 'text-2xl' : 'text-xl'
              }`}>{metric.name}</h2>
              {metric.description && (
                <p className={`text-gray-600 mt-1 ${
                  isFullscreen ? 'text-base' : 'text-sm'
                }`}>{metric.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Fullscreen Toggle */}
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleFullscreen}
              className="flex items-center space-x-2"
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Quitter</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Plein écran</span>
                </>
              )}
            </Button>
            
            {/* Orientation Hint */}
            {isFullscreen && (
              <div className="flex items-center space-x-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {isLandscape ? (
                  <>
                    <RotateCw className="h-3 w-3" />
                    <span>Paysage</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3" />
                    <span>Portrait</span>
                  </>
                )}
              </div>
            )}
            
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
        <div className={`bg-gray-50 border-b border-gray-200 ${
          isFullscreen ? 'p-3' : 'p-4'
        }`}>
          <div className={`grid gap-4 ${
            isFullscreen 
              ? 'grid-cols-1 lg:grid-cols-3 text-sm' 
              : 'grid-cols-1 md:grid-cols-3 text-sm'
          }`}>
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
          <div className={`text-gray-600 ${
            isFullscreen ? 'mt-2 text-sm' : 'mt-2 text-sm'
          }`}>
            <span className="font-medium">Données:</span>
            <span className="ml-2">{relevantEntries.length} soumission{relevantEntries.length > 1 ? 's' : ''}</span>
            <span className="mx-2">•</span>
            <span>Formulaire: {form?.title || 'Inconnu'}</span>
          </div>
        </div>

        {/* Chart */}
        <div className={`flex-1 flex flex-col ${
          isFullscreen ? 'p-4' : 'p-6'
        }`}>
          <div 
            className="flex-1 w-full"
            style={{ height: `${chartHeight}px` }}
          >
            <GraphPreview
              metric={metric}
              formEntries={formEntries}
              forms={forms}
              compact={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between border-t border-gray-200 bg-gray-50 ${
          isFullscreen ? 'p-3' : 'p-6'
        }`}>
          <div className="text-xs text-gray-500">
            {isFullscreen ? (
              <div className="flex items-center space-x-4">
                <span>💡 Appuyez sur <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Échap</kbd> pour quitter le plein écran</span>
                <span>📱 Faites pivoter votre appareil pour une meilleure vue</span>
              </div>
            ) : (
              <span>💡 Cliquez sur "Plein écran" pour une vue agrandie</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Fermer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
