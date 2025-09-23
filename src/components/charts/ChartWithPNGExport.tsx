import React, { forwardRef } from 'react';
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
import { GraphData } from '../../types';

interface ChartWithPNGExportProps {
  data: GraphData;
  width?: number;
  height?: number;
  className?: string;
}

// Define colors for charts
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#8B5CF6', '#06B6D4', '#84CC16'];

export const ChartWithPNGExport = forwardRef<any, ChartWithPNGExportProps>(
  ({ data, width = 600, height = 300, className = '' }, ref) => {
    // Validate data structure
    if (!data || !data.data || data.data.length === 0) {
      return (
        <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
          <div className="text-gray-500 text-center">
            <p>Aucune donnée disponible</p>
          </div>
        </div>
      );
    }

    const chartProps = {
      width,
      height,
      data: data.data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    const renderChart = () => {
      switch (data.type) {
        case 'line':
          return (
            <LineChart ref={ref} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={data.xAxisKey} 
                angle={data.data.length > 8 ? -45 : 0}
                textAnchor={data.data.length > 8 ? 'end' : 'middle'}
                height={data.data.length > 8 ? 80 : 30}
                interval={data.data.length > 8 ? 'preserveStartEnd' : 0}
              />
              <YAxis />
              <Tooltip />
              {data.options?.showLegend && <Legend />}
              <Line 
                type="monotone" 
                dataKey={data.yAxisKey || data.dataKey} 
                stroke={data.colors?.[0] || COLORS[0]} 
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          );

        case 'bar':
          return (
            <BarChart ref={ref} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={data.xAxisKey} 
                angle={data.data.length > 8 ? -45 : 0}
                textAnchor={data.data.length > 8 ? 'end' : 'middle'}
                height={data.data.length > 8 ? 80 : 30}
                interval={0}
              />
              <YAxis />
              <Tooltip />
              {data.options?.showLegend && <Legend />}
              <Bar 
                dataKey={data.yAxisKey || data.dataKey} 
                fill={data.colors?.[0] || COLORS[0]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          );

        case 'pie':
          return (
            <PieChart ref={ref} {...chartProps}>
              <Pie
                data={data.data}
                cx={width / 2}
                cy={height / 2}
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={Math.min(width, height) / 2 - 20}
                fill="#8884d8"
                dataKey={data.dataKey || 'value'}
              >
                {data.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={data.colors?.[index] || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              {data.options?.showLegend && <Legend />}
            </PieChart>
          );

        case 'area':
          return (
            <AreaChart ref={ref} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={data.xAxisKey} 
                angle={data.data.length > 8 ? -45 : 0}
                textAnchor={data.data.length > 8 ? 'end' : 'middle'}
                height={data.data.length > 8 ? 80 : 30}
                interval={data.data.length > 8 ? 'preserveStartEnd' : 0}
              />
              <YAxis />
              <Tooltip />
              {data.options?.showLegend && <Legend />}
              <Area 
                type="monotone" 
                dataKey={data.yAxisKey || data.dataKey} 
                stroke={data.colors?.[0] || COLORS[0]} 
                fill={data.colors?.[0] || COLORS[0]}
                fillOpacity={0.3}
                strokeWidth={3}
              />
            </AreaChart>
          );

        case 'scatter':
          return (
            <ScatterChart ref={ref} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={data.xAxisKey} 
                name={data.xAxisKey}
                type="number"
                scale="point"
              />
              <YAxis 
                dataKey={data.yAxisKey || data.dataKey} 
                name={data.yAxisKey || data.dataKey}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              {data.options?.showLegend && <Legend />}
              <Scatter 
                dataKey={data.yAxisKey || data.dataKey} 
                fill={data.colors?.[0] || COLORS[0]}
              />
            </ScatterChart>
          );

        default:
          return (
            <BarChart ref={ref} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={data.xAxisKey} />
              <YAxis />
              <Tooltip />
              <Bar dataKey={data.yAxisKey || data.dataKey} fill={data.colors?.[0] || COLORS[0]} />
            </BarChart>
          );
      }
    };

    return (
      <div className={`chart-container ${className}`} style={{ width, height }}>
        <div className="chart-title mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{data.title}</h3>
          {data.subtitle && (
            <p className="text-sm text-gray-600">{data.subtitle}</p>
          )}
        </div>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
        {data.insights && data.insights.length > 0 && (
          <div className="chart-insights mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Insights:</h4>
            <ul className="text-sm text-gray-600 list-disc list-inside">
              {data.insights.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ul>
          </div>
        )}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="chart-recommendations mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommandations:</h4>
            <ul className="text-sm text-gray-600 list-disc list-inside">
              {data.recommendations.map((recommendation, index) => (
                <li key={index}>{recommendation}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

ChartWithPNGExport.displayName = 'ChartWithPNGExport';

