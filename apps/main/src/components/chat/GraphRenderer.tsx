import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  ScatterChart,
  Scatter,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useCurrentPng } from 'recharts-to-png';
import { Maximize2, Download, Loader2 } from 'lucide-react';
import { Button } from '../Button';
import { GraphData } from '../../types';

interface GraphRendererProps {
  data: GraphData;
  isPreview?: boolean;
  onExpand?: () => void;
}

interface GraphModalProps {
  data: GraphData;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const GraphModal: React.FC<GraphModalProps> = ({ data, isOpen, onClose }) => {
  const [getPng, { ref, isLoading }] = useCurrentPng();
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Lock body scroll when modal is open
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    } else {
      // Restore body scroll when modal is closed
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const handleDownloadImage = async () => {
    try {
      setIsDownloading(true);
      const png = await getPng();
      
      if (png) {
        // Create a download link
        const link = document.createElement('a');
        link.href = png;
        link.download = `${data.title.replace(/[^a-zA-Z0-9]/g, '_')}_graph.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading chart image:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed bg-black bg-opacity-50 flex items-center justify-center p-4" 
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        width: '100vw', 
        height: '100vh',
        position: 'fixed',
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{data.title}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {data.data.length} points de données • Type: {data.type}
              </p>
            </div>
            <div className="flex items-center space-x-3 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadImage}
                disabled={isDownloading || isLoading}
                className="flex items-center space-x-2 bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400"
              >
                {isDownloading || isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isDownloading || isLoading ? 'Génération...' : 'Télécharger'}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
                className="p-2 bg-white hover:bg-gray-50"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-auto max-h-[calc(95vh-120px)] bg-gray-50">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div ref={ref} className="w-full h-[700px] min-w-[800px]">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart(data, false)}
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Data Summary */}
          <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Résumé des données</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data.data.length}</div>
                <div className="text-sm text-gray-600">
                  {data.data.length > 0 && data.data[0].employee 
                    ? 'Employés' 
                    : data.data.length > 0 && data.data[0].date
                    ? 'Jours'
                    : 'Points de données'
                  }
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 capitalize">{data.type}</div>
                <div className="text-sm text-gray-600">Type de graphique</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {data.data.length > 0 && data.data[0].submissions 
                    ? data.data.reduce((sum, item) => sum + (item.submissions || 0), 0)
                    : data.data.length > 0 ? Object.keys(data.data[0]).length : 0
                  }
                </div>
                <div className="text-sm text-gray-600">
                  {data.data.length > 0 && data.data[0].submissions 
                    ? 'Soumissions totales' 
                    : data.data.length > 0 && data.data[0].date
                    ? 'Soumissions totales'
                    : 'Colonnes'
                  }
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {data.options?.showLegend ? 'Oui' : 'Non'}
                </div>
                <div className="text-sm text-gray-600">Légende</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// Custom tooltip for employee data
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{label}</p>
        {data.email && (
          <p className="text-sm text-gray-600 mb-1">{data.email}</p>
        )}
        <p className="text-blue-600 font-medium">
          {payload[0].dataKey}: {payload[0].value}
        </p>
        {data.submissions && (
          <p className="text-sm text-gray-500">
            {data.submissions} soumission{data.submissions > 1 ? 's' : ''}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Custom tooltip for timeline data
const TimelineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-blue-600 font-medium">
          Soumissions: {payload[0].value}
        </p>
        {data.employees && Array.isArray(data.employees) && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-1">Employés actifs:</p>
            <div className="text-xs text-gray-500">
              {data.employees.slice(0, 3).map((emp: string, index: number) => (
                <div key={index}>• {emp}</div>
              ))}
              {data.employees.length > 3 && (
                <div>• +{data.employees.length - 3} autres</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const renderChart = (data: GraphData, isPreview: boolean) => {
  // Validate data structure
  if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        <div className="text-center">
          <div className="text-lg mb-2">📊</div>
          <div>Aucune donnée disponible</div>
        </div>
      </div>
    );
  }

  const commonProps = {
    data: data.data,
    margin: isPreview ? { top: 2, right: 2, left: 2, bottom: 2 } : { top: 20, right: 30, left: 20, bottom: 5 },
  };

  const chartProps = {
    ...commonProps,
    width: isPreview ? 180 : undefined,
    height: isPreview ? 80 : undefined,
  };

  // Check if this is employee data
  const isEmployeeData = data.data.length > 0 && data.data[0]?.employee;
  // Check if this is timeline data
  const isTimelineData = data.data.length > 0 && data.data[0]?.date;

  switch (data.type) {
    case 'line':
      return (
        <LineChart {...chartProps}>
          {!isPreview && <CartesianGrid strokeDasharray="3 3" />}
          {!isPreview && (
            <XAxis 
              dataKey={data.xAxisKey} 
              angle={isTimelineData ? -45 : 0}
              textAnchor={isTimelineData ? 'end' : 'middle'}
              height={isTimelineData ? 80 : 30}
              interval={isTimelineData ? 'preserveStartEnd' : 0}
            />
          )}
          {!isPreview && <YAxis />}
          {!isPreview && <Tooltip content={isTimelineData ? <TimelineTooltip /> : undefined} />}
          {!isPreview && data.options?.showLegend && <Legend />}
          <Line 
            type="monotone" 
            dataKey={data.yAxisKey || data.dataKey} 
            stroke={data.colors?.[0] || COLORS[0]} 
            strokeWidth={isPreview ? 2 : 3}
            dot={!isPreview}
            activeDot={{ r: isPreview ? 3 : 6 }}
          />
        </LineChart>
      );

    case 'bar':
      return (
        <BarChart {...chartProps}>
          {!isPreview && <CartesianGrid strokeDasharray="3 3" />}
          {!isPreview && (
            <XAxis 
              dataKey={data.xAxisKey} 
              angle={isEmployeeData ? -45 : 0}
              textAnchor={isEmployeeData ? 'end' : 'middle'}
              height={isEmployeeData ? 80 : 30}
              interval={0}
            />
          )}
          {!isPreview && <YAxis />}
          {!isPreview && <Tooltip content={isEmployeeData ? <CustomTooltip /> : undefined} />}
          {!isPreview && data.options?.showLegend && <Legend />}
          <Bar 
            dataKey={data.yAxisKey || data.dataKey} 
            fill={data.colors?.[0] || COLORS[0]}
            radius={isPreview ? [2, 2, 0, 0] : [4, 4, 0, 0]}
          />
        </BarChart>
      );

    case 'pie':
      return (
        <PieChart {...chartProps}>
          {!isPreview && <Tooltip />}
          {!isPreview && data.options?.showLegend && <Legend />}
          <Pie
            data={data.data}
            cx="50%"
            cy="50%"
            innerRadius={isPreview ? 20 : 40}
            outerRadius={isPreview ? 50 : 80}
            paddingAngle={2}
            dataKey={data.dataKey || 'value'}
          >
            {data.data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={data.colors?.[index] || COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );

    case 'area':
      return (
        <AreaChart {...chartProps}>
          {!isPreview && <CartesianGrid strokeDasharray="3 3" />}
          {!isPreview && (
            <XAxis 
              dataKey={data.xAxisKey} 
              angle={isTimelineData ? -45 : 0}
              textAnchor={isTimelineData ? 'end' : 'middle'}
              height={isTimelineData ? 80 : 30}
              interval={isTimelineData ? 'preserveStartEnd' : 0}
            />
          )}
          {!isPreview && <YAxis />}
          {!isPreview && <Tooltip content={isTimelineData ? <TimelineTooltip /> : undefined} />}
          {!isPreview && data.options?.showLegend && <Legend />}
          <Area 
            type="monotone" 
            dataKey={data.yAxisKey || data.dataKey || 'value'} 
            stroke={data.colors?.[0] || COLORS[0]} 
            fill={data.colors?.[0] || COLORS[0]}
            fillOpacity={0.3}
            strokeWidth={isPreview ? 2 : 3}
          />
        </AreaChart>
      );

    case 'scatter':
      return (
        <ScatterChart {...chartProps}>
          {!isPreview && <CartesianGrid strokeDasharray="3 3" />}
          {!isPreview && <XAxis dataKey={data.xAxisKey} />}
          {!isPreview && <YAxis />}
          {!isPreview && <Tooltip />}
          {!isPreview && data.options?.showLegend && <Legend />}
          <Scatter 
            dataKey={data.yAxisKey || data.dataKey} 
            fill={data.colors?.[0] || COLORS[0]}
          />
        </ScatterChart>
      );

    default:
      return <div className="flex items-center justify-center h-full text-gray-500">Type de graphique non supporté</div>;
  }
};

export const GraphRenderer: React.FC<GraphRendererProps> = ({ data, isPreview = true, onExpand }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 🔍 DEBUG: Log the received data in GraphRenderer

  // Transform data to ensure it's in the correct format
  const transformData = (rawData: any) => {
    if (!rawData || !rawData.data || !Array.isArray(rawData.data) || rawData.data.length === 0) {
      return null;
    }

    // Check if data is already in the correct format (x, y)
    const firstItem = rawData.data[0];
    if (firstItem && 'x' in firstItem && 'y' in firstItem) {
      return rawData;
    }

    // Transform from old format (label, value) to new format (x, y)
    if (firstItem && 'label' in firstItem && 'value' in firstItem) {
      const transformedData = {
        ...rawData,
        data: rawData.data.map((item: any) => ({
          x: item.label || item.employee || 'Unknown',
          y: item.value || 0
        })),
        xAxisKey: 'x',
        yAxisKey: 'y',
        dataKey: 'y'
      };
      return transformedData;
    }

    return null;
  };

  const transformedData = transformData(data);

  // Validate data structure early
  if (!transformedData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
          <div className="text-center">
            <div className="text-lg mb-2">📊</div>
            <div>Aucune donnée disponible</div>
            <div className="text-xs text-gray-400 mt-1">
              Format de données non supporté
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use transformed data for rendering
  const finalData = transformedData;

  const handleExpand = () => {
    if (onExpand) {
      onExpand();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              finalData.type === 'bar' ? 'bg-blue-500' :
              finalData.type === 'line' ? 'bg-green-500' :
              finalData.type === 'pie' ? 'bg-purple-500' :
              finalData.type === 'area' ? 'bg-orange-500' : 'bg-gray-500'
            }`}></div>
            <h3 className="text-xs font-semibold text-gray-900 truncate">{finalData.title}</h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExpand}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="w-full h-24 bg-gray-50 rounded-lg p-1">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(finalData, isPreview)}
          </ResponsiveContainer>
        </div>
        
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center space-x-1">
            <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
            <span>
              {finalData.data.length > 0 && finalData.data[0].employee 
                ? `${finalData.data.length} employé${finalData.data.length > 1 ? 's' : ''}`
                : finalData.data.length > 0 && finalData.data[0].date
                ? `${finalData.data.length} jour${finalData.data.length > 1 ? 's' : ''}`
                : `${finalData.data.length} points`
              }
            </span>
          </span>
          <span className="capitalize text-xs">{finalData.type}</span>
        </div>
      </div>

      <GraphModal
        data={finalData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
