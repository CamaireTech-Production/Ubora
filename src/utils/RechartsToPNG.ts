import * as React from 'react';
import { GraphData } from '../types';

/**
 * Utility class to convert Recharts components to PNG images using recharts-to-png
 * This replaces the custom ChartToImage implementation with a more reliable solution
 */
export class RechartsToPNG {
  /**
   * Convert a chart component to a base64 PNG string
   * This method should be used within a React component that has access to the chart ref
   */
  static async chartToBase64(
    chartRef: React.RefObject<any>,
    _width: number = 800,
    _height: number = 400
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!chartRef.current) {
          reject(new Error('Chart reference is not available'));
          return;
        }

        // Use the recharts-to-png hook functionality
        // Note: This is a simplified approach - in practice, you'd use the hook in the component
        const canvas = chartRef.current.getCanvas();
        if (canvas) {
          const base64 = canvas.toDataURL('image/png', 1.0);
          resolve(base64);
        } else {
          reject(new Error('Could not get canvas from chart'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create a chart component with PNG export capability
   * This is a helper method to create chart components that can be converted to PNG
   */
  static createChartWithPNGExport(
    chartData: GraphData,
    width: number = 800,
    height: number = 400
  ): {
    component: React.ReactElement;
    getPNG: () => Promise<string>;
  } {
    // This would be implemented in the actual component using the useCurrentPng hook
    // For now, we'll return a placeholder that shows the structure
    return {
      component: React.createElement('div', null, 'Chart component placeholder'),
      getPNG: async () => {
        throw new Error('This method should be implemented in the actual chart component');
      }
    };
  }

  /**
   * Convert chart data to a PNG image using a temporary chart component
   * This method creates a temporary chart, renders it, and captures it as PNG
   */
  static async convertChartDataToPNG(
    chartData: GraphData,
    width: number = 800,
    height: number = 400
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('RechartsToPNG: Starting conversion for chart:', chartData.title, chartData.type);
        console.log('RechartsToPNG: Chart data:', chartData.data?.length, 'data points');
        
        // Use html2canvas approach with a temporary chart
        const { default: html2canvas } = await import('html2canvas');
        
        // Create a temporary container
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        container.style.backgroundColor = '#ffffff';
        container.style.padding = '20px';
        container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        document.body.appendChild(container);

        // Create React root and render the chart
        const { createRoot } = await import('react-dom/client');
        const root = createRoot(container);

        // Create a simple chart component
        const ChartComponent = () => {
          const [chartComponent, setChartComponent] = React.useState<React.ReactElement | null>(null);
          
          React.useEffect(() => {
            // Create the chart component asynchronously
            this.createRechartsComponent(chartData, width, height, null).then(setChartComponent);
          }, []);

          React.useEffect(() => {
            if (chartComponent) {
              // Wait for chart to render, then capture
              setTimeout(async () => {
                try {
                  const canvas = await html2canvas(container, {
                    backgroundColor: '#ffffff',
                    scale: 2, // Higher resolution
                    useCORS: true,
                    allowTaint: true,
                    width: width,
                    height: height
                  });
                  
                  const base64 = canvas.toDataURL('image/png', 0.9);
                  console.log('RechartsToPNG: html2canvas conversion successful, length:', base64.length);
                  resolve(base64);
                } catch (error) {
                  console.error('RechartsToPNG: html2canvas conversion failed:', error);
                  reject(error);
                } finally {
                  // Cleanup
                  root.unmount();
                  if (document.body.contains(container)) {
                    document.body.removeChild(container);
                  }
                }
              }, 1500); // Wait 1.5 seconds for chart to render
            }
          }, [chartComponent]);

          return chartComponent || React.createElement('div', { style: { textAlign: 'center', padding: '20px' } }, 'Loading chart...');
        };

        // Render the component
        root.render(React.createElement(ChartComponent));

      } catch (error) {
        console.error('RechartsToPNG: Error in convertChartDataToPNG:', error);
        console.log('RechartsToPNG: Falling back to enhanced canvas approach...');
        
        // Fallback to enhanced canvas approach
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Set up canvas background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          // Add title
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(chartData.title, width / 2, 30);

          // Draw enhanced chart
          const margin = 60;
          const chartWidth = width - 2 * margin;
          const chartHeight = height - 2 * margin - 40;

          switch (chartData.type) {
            case 'bar':
              this.drawCanvasBarChart(ctx, chartData, margin, chartWidth, chartHeight);
              break;
            case 'line':
              this.drawCanvasLineChart(ctx, chartData, margin, chartWidth, chartHeight);
              break;
            case 'pie':
              this.drawCanvasPieChart(ctx, chartData, width / 2, height / 2 + 20, Math.min(chartWidth, chartHeight) / 2 - 30);
              break;
            case 'area':
              this.drawCanvasAreaChart(ctx, chartData, margin, chartWidth, chartHeight);
              break;
            case 'scatter':
              this.drawCanvasScatterChart(ctx, chartData, margin, chartWidth, chartHeight);
              break;
            default:
              this.drawCanvasBarChart(ctx, chartData, margin, chartWidth, chartHeight);
          }

          const base64 = canvas.toDataURL('image/png', 0.8);
          console.log('RechartsToPNG: Enhanced canvas image generated, length:', base64.length);
          resolve(base64);
        } catch (fallbackError) {
          console.error('RechartsToPNG: Fallback also failed:', fallbackError);
          reject(fallbackError);
        }
      }
    });
  }

  /**
   * Create a Recharts component for PNG conversion
   */
  private static async createRechartsComponent(
    chartData: GraphData,
    width: number,
    height: number,
    ref: React.RefObject<any> | null
  ): Promise<React.ReactElement> {
    const { 
      BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
      AreaChart, Area, ScatterChart, Scatter,
      XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
    } = await import('recharts');

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    const renderChart = () => {
      const commonProps = {
        data: chartData.data,
        margin: { top: 20, right: 30, left: 20, bottom: 20 },
        width: width,
        height: height - 40
      };

      const xAxisProps = {
        dataKey: chartData.xAxisKey,
        angle: chartData.data.length > 8 ? -45 : 0,
        textAnchor: (chartData.data.length > 8 ? 'end' : 'middle') as 'end' | 'middle',
        height: chartData.data.length > 8 ? 80 : 30,
        interval: 0,
      };

      const yAxisKey = chartData.yAxisKey || chartData.dataKey || 'value';

      switch (chartData.type) {
        case 'bar':
          return React.createElement(BarChart, commonProps,
            React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
            React.createElement(XAxis, xAxisProps),
            React.createElement(YAxis, { dataKey: yAxisKey }),
            React.createElement(Tooltip),
            React.createElement(Legend as any),
            React.createElement(Bar, { dataKey: yAxisKey, fill: chartData.colors?.[0] || COLORS[0] })
          );
        case 'line':
          return React.createElement(LineChart, commonProps,
            React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
            React.createElement(XAxis, xAxisProps),
            React.createElement(YAxis, { dataKey: yAxisKey }),
            React.createElement(Tooltip),
            React.createElement(Legend as any),
            React.createElement(Line, { type: "monotone", dataKey: yAxisKey, stroke: chartData.colors?.[0] || COLORS[0] })
          );
        case 'area':
          return React.createElement(AreaChart, commonProps,
            React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
            React.createElement(XAxis, xAxisProps),
            React.createElement(YAxis, { dataKey: yAxisKey }),
            React.createElement(Tooltip),
            React.createElement(Legend as any),
            React.createElement(Area, { 
              type: "monotone", 
              dataKey: yAxisKey, 
              stroke: chartData.colors?.[0] || COLORS[0], 
              fill: chartData.colors?.[0] || COLORS[0], 
              fillOpacity: 0.3 
            })
          );
        case 'pie':
          return React.createElement(PieChart, commonProps,
            React.createElement(Pie,
              {
                data: chartData.data,
                dataKey: chartData.dataKey,
                nameKey: chartData.xAxisKey,
                cx: "50%",
                cy: "50%",
                outerRadius: 120,
                fill: "#8884d8",
                label: true
              },
              chartData.data.map((entry, index) =>
                React.createElement(Cell, { 
                  key: `cell-${index}`, 
                  fill: chartData.colors?.[index % chartData.colors.length] || COLORS[index % COLORS.length] 
                })
              )
            ),
            React.createElement(Legend as any),
            React.createElement(Tooltip)
          );
        case 'scatter':
          return React.createElement(ScatterChart, commonProps,
            React.createElement(CartesianGrid),
            React.createElement(XAxis, { type: "number", dataKey: chartData.xAxisKey, name: chartData.xAxisKey }),
            React.createElement(YAxis, { type: "number", dataKey: yAxisKey, name: yAxisKey }),
            React.createElement(Tooltip, { cursor: { strokeDasharray: '3 3' } }),
            React.createElement(Legend as any),
            React.createElement(Scatter, { name: chartData.title, data: chartData.data, fill: chartData.colors?.[0] || COLORS[0] })
          );
        default:
          return React.createElement('div', { style: { textAlign: 'center', color: '#666' } }, 'Type de graphique non pris en charge');
      }
    };

    return React.createElement('div', { 
      ref: ref || undefined,
      style: { 
        width: `${width}px`, 
        height: `${height}px`,
        backgroundColor: '#ffffff',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }
    },
      React.createElement('h3', { 
        style: { 
          margin: '0 0 20px 0', 
          fontSize: '18px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          textAlign: 'center' 
        } 
      }, chartData.title),
      renderChart()
    );
  }

  /**
   * Draw a bar chart on canvas
   */
  private static drawCanvasBarChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;
    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw grid lines
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = margin + 40 + (i / gridSteps) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(margin + chartWidth, y);
      ctx.stroke();
    }

    // Draw vertical grid lines
    for (let i = 0; i <= data.length; i++) {
      const x = margin + (i / data.length) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin + 40);
      ctx.lineTo(x, margin + 40 + chartHeight);
      ctx.stroke();
    }

    // Draw main axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin + 40);
    ctx.lineTo(margin, margin + 40 + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + 40 + chartHeight);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridSteps; i++) {
      const value = minValue + (i / gridSteps) * valueRange;
      const y = margin + 40 + (i / gridSteps) * chartHeight;
      ctx.fillText(Math.round(value).toString(), margin - 10, y + 4);
    }

    // Draw bars
    const colors = chartData.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const barHeight = ((value - minValue) / valueRange) * chartHeight;
      const x = margin + index * (barWidth + barSpacing) + barSpacing / 2;
      const y = margin + 40 + chartHeight - barHeight;

      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(x, y, barWidth, barHeight);

      // Add value label on top of bar
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value.toString(), x + barWidth / 2, y - 8);
    });

    // Draw X-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    data.forEach((item, index) => {
      const x = margin + index * (barWidth + barSpacing) + barSpacing / 2 + barWidth / 2;
      const y = margin + 40 + chartHeight + 20;
      const label = item[chartData.xAxisKey || 'label'] || `Item ${index + 1}`;
      ctx.fillText(label, x, y);
    });

    // Draw legend if multiple series
    if (data.length > 0) {
      const legendY = margin + 40 + chartHeight + 50;
      ctx.fillStyle = '#374151';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      
      // Draw legend item
      const legendX = margin;
      ctx.fillStyle = colors[0];
      ctx.fillRect(legendX, legendY - 8, 12, 12);
      ctx.fillStyle = '#374151';
      ctx.fillText(chartData.yAxisKey || 'value', legendX + 16, legendY);
    }
  }

  /**
   * Draw a line chart on canvas
   */
  private static drawCanvasLineChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw grid lines
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = margin + 40 + (i / gridSteps) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(margin + chartWidth, y);
      ctx.stroke();
    }

    // Draw vertical grid lines
    for (let i = 0; i <= data.length; i++) {
      const x = margin + (i / data.length) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin + 40);
      ctx.lineTo(x, margin + 40 + chartHeight);
      ctx.stroke();
    }

    // Draw main axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin + 40);
    ctx.lineTo(margin, margin + 40 + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + 40 + chartHeight);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridSteps; i++) {
      const value = minValue + (i / gridSteps) * valueRange;
      const y = margin + 40 + (i / gridSteps) * chartHeight;
      ctx.fillText(Math.round(value).toString(), margin - 10, y + 4);
    }

    // Draw line
    const colors = chartData.colors || ['#3B82F6'];
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + 40 + chartHeight - ((value - minValue) / valueRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = colors[0];
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + 40 + chartHeight - ((value - minValue) / valueRange) * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw X-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    data.forEach((item, index) => {
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + 40 + chartHeight + 20;
      const label = item[chartData.xAxisKey || 'label'] || `Item ${index + 1}`;
      ctx.fillText(label, x, y);
    });

    // Draw legend
    const legendY = margin + 40 + chartHeight + 50;
    ctx.fillStyle = '#374151';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    
    // Draw legend item
    const legendX = margin;
    ctx.fillStyle = colors[0];
    ctx.fillRect(legendX, legendY - 8, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText(chartData.yAxisKey || 'value', legendX + 16, legendY);
  }

  /**
   * Draw a pie chart on canvas
   */
  private static drawCanvasPieChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    centerX: number,
    centerY: number,
    radius: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const total = data.reduce((sum, item) => sum + (item[chartData.dataKey || 'value'] || 0), 0);
    let currentAngle = -Math.PI / 2;
    const colors = chartData.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    data.forEach((item, index) => {
      const value = item[chartData.dataKey || 'value'] || 0;
      const sliceAngle = (value / total) * 2 * Math.PI;
      const midAngle = currentAngle + sliceAngle / 2;

      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      // Draw label
      const labelRadius = radius + 20;
      const labelX = centerX + Math.cos(midAngle) * labelRadius;
      const labelY = centerY + Math.sin(midAngle) * labelRadius;
      
      ctx.fillStyle = '#374151';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      const label = item[chartData.xAxisKey || 'label'] || `Item ${index + 1}`;
      const percentage = Math.round((value / total) * 100);
      ctx.fillText(`${label} (${percentage}%)`, labelX, labelY);

      currentAngle += sliceAngle;
    });

    // Draw legend
    const legendY = centerY + radius + 60;
    ctx.fillStyle = '#374151';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    
    data.forEach((item, index) => {
      const legendX = centerX - radius + (index % 2) * (radius * 2);
      const legendItemY = legendY + Math.floor(index / 2) * 20;
      
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(legendX, legendItemY - 8, 12, 12);
      ctx.fillStyle = '#374151';
      const label = item[chartData.xAxisKey || 'label'] || `Item ${index + 1}`;
      ctx.fillText(label, legendX + 16, legendItemY);
    });
  }

  /**
   * Draw an area chart on canvas
   */
  private static drawCanvasAreaChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin + 40);
    ctx.lineTo(margin, margin + 40 + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + 40 + chartHeight);
    ctx.stroke();

    // Draw area
    const colors = chartData.colors || ['#3B82F6'];
    ctx.fillStyle = colors[0] + '4D'; // Add transparency
    ctx.beginPath();
    ctx.moveTo(margin, margin + 40 + chartHeight);

    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + 40 + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(margin + chartWidth, margin + 40 + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + 40 + chartHeight - ((value - minValue) / valueRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }

  /**
   * Draw a scatter chart on canvas
   */
  private static drawCanvasScatterChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const xValues = data.map(d => d[chartData.xAxisKey || 'x'] || 0);
    const yValues = data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'y'] || 0);

    const maxX = Math.max(...xValues);
    const minX = Math.min(...xValues);
    const maxY = Math.max(...yValues);
    const minY = Math.min(...yValues);

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin + 40);
    ctx.lineTo(margin, margin + 40 + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + 40 + chartHeight);
    ctx.stroke();

    // Draw points
    const colors = chartData.colors || ['#3B82F6'];
    ctx.fillStyle = colors[0];
    data.forEach((item, index) => {
      const x = margin + ((xValues[index] - minX) / xRange) * chartWidth;
      const y = margin + 40 + chartHeight - ((yValues[index] - minY) / yRange) * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * Create a temporary Recharts chart element for PNG conversion
   */
  private static createTemporaryRechartsChart(
    chartData: GraphData,
    width: number,
    height: number
  ): HTMLElement {
    const chartDiv = document.createElement('div');
    chartDiv.style.width = `${width}px`;
    chartDiv.style.height = `${height}px`;
    chartDiv.style.backgroundColor = '#ffffff';
    chartDiv.style.border = '1px solid #e5e7eb';
    chartDiv.style.padding = '20px';
    chartDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    chartDiv.style.boxSizing = 'border-box';
    chartDiv.style.position = 'relative';

    // Add title
    const title = document.createElement('h3');
    title.textContent = chartData.title;
    title.style.margin = '0 0 20px 0';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.color = '#1f2937';
    title.style.textAlign = 'center';
    chartDiv.appendChild(title);

    // Create a chart container that will hold the SVG
    const chartContainer = document.createElement('div');
    chartContainer.style.width = '100%';
    chartContainer.style.height = 'calc(100% - 60px)';
    chartContainer.style.position = 'relative';
    chartContainer.style.overflow = 'hidden';
    chartDiv.appendChild(chartContainer);

    // Create SVG element for the chart
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width - 40} ${height - 80}`);
    chartContainer.appendChild(svg);

    // Render the chart using SVG
    this.renderChartAsSVG(svg, chartData, width - 40, height - 80);

    return chartDiv;
  }

  /**
   * Create a temporary chart element for PNG conversion (fallback method)
   */
  private static createTemporaryChart(
    chartData: GraphData,
    width: number,
    height: number
  ): HTMLElement {
    const chartDiv = document.createElement('div');
    chartDiv.style.width = `${width}px`;
    chartDiv.style.height = `${height}px`;
    chartDiv.style.backgroundColor = '#ffffff';
    chartDiv.style.border = '1px solid #e5e7eb';
    chartDiv.style.padding = '20px';
    chartDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    chartDiv.style.boxSizing = 'border-box';
    chartDiv.style.position = 'relative';

    // Add title
    const title = document.createElement('h3');
    title.textContent = chartData.title;
    title.style.margin = '0 0 20px 0';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.color = '#1f2937';
    title.style.textAlign = 'center';
    chartDiv.appendChild(title);

    // Create a simple chart representation
    const chartContainer = document.createElement('div');
    chartContainer.style.width = '100%';
    chartContainer.style.height = 'calc(100% - 60px)';
    chartContainer.style.position = 'relative';
    chartContainer.style.overflow = 'hidden';
    chartDiv.appendChild(chartContainer);

    // Draw a simple chart based on type
    this.drawSimpleChart(chartContainer, chartData, width - 40, height - 80);

    return chartDiv;
  }

  /**
   * Render chart as SVG elements
   */
  private static renderChartAsSVG(
    svg: SVGElement,
    chartData: GraphData,
    width: number,
    height: number
  ): void {
    const margin = 60;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;

    // Draw chart based on type
    switch (chartData.type) {
      case 'bar':
        this.drawSVGBarChart(svg, chartData, margin, chartWidth, chartHeight);
        break;
      case 'line':
        this.drawSVGLineChart(svg, chartData, margin, chartWidth, chartHeight);
        break;
      case 'pie':
        this.drawSVGPieChart(svg, chartData, width / 2, height / 2, Math.min(chartWidth, chartHeight) / 2 - 30);
        break;
      case 'area':
        this.drawSVGAreaChart(svg, chartData, margin, chartWidth, chartHeight);
        break;
      case 'scatter':
        this.drawSVGScatterChart(svg, chartData, margin, chartWidth, chartHeight);
        break;
      default:
        this.drawSVGBarChart(svg, chartData, margin, chartWidth, chartHeight);
    }
  }

  /**
   * Draw a simple chart representation
   */
  private static drawSimpleChart(
    container: HTMLElement,
    chartData: GraphData,
    width: number,
    height: number
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const margin = 60;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;

    // Draw chart based on type
    switch (chartData.type) {
      case 'bar':
        this.drawSimpleBarChart(ctx, chartData, margin, chartWidth, chartHeight);
        break;
      case 'line':
        this.drawSimpleLineChart(ctx, chartData, margin, chartWidth, chartHeight);
        break;
      case 'pie':
        this.drawSimplePieChart(ctx, chartData, width / 2, height / 2, Math.min(chartWidth, chartHeight) / 2 - 30);
        break;
      case 'area':
        this.drawSimpleAreaChart(ctx, chartData, margin, chartWidth, chartHeight);
        break;
      case 'scatter':
        this.drawSimpleScatterChart(ctx, chartData, margin, chartWidth, chartHeight);
        break;
      default:
        this.drawSimpleBarChart(ctx, chartData, margin, chartWidth, chartHeight);
    }
  }

  /**
   * Draw a simple bar chart
   */
  private static drawSimpleBarChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;
    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw bars
    const colors = chartData.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x = margin + index * (barWidth + barSpacing) + barSpacing / 2;
      const y = margin + chartHeight - barHeight;

      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(x, y, barWidth, barHeight);

      // Add value label
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
    });

    // Draw X-axis labels
    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    data.forEach((item, index) => {
      const x = margin + index * (barWidth + barSpacing) + barWidth / 2;
      const label = item[chartData.xAxisKey || 'label'] || `Item ${index + 1}`;
      ctx.fillText(label, x, margin + chartHeight + 20);
    });
  }

  /**
   * Draw a simple line chart
   */
  private static drawSimpleLineChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw line
    const colors = chartData.colors || ['#3B82F6'];
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = colors[0];
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * Draw a simple pie chart
   */
  private static drawSimplePieChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    centerX: number,
    centerY: number,
    radius: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const total = data.reduce((sum, item) => sum + (item[chartData.dataKey || 'value'] || 0), 0);
    let currentAngle = -Math.PI / 2;
    const colors = chartData.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    data.forEach((item, index) => {
      const value = item[chartData.dataKey || 'value'] || 0;
      const sliceAngle = (value / total) * 2 * Math.PI;

      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      currentAngle += sliceAngle;
    });
  }

  /**
   * Draw a simple area chart
   */
  private static drawSimpleAreaChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw area
    const colors = chartData.colors || ['#3B82F6'];
    ctx.fillStyle = colors[0] + '4D'; // Add transparency
    ctx.beginPath();
    ctx.moveTo(margin, margin + chartHeight);

    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }

  /**
   * Draw a simple scatter chart
   */
  private static drawSimpleScatterChart(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const xValues = data.map(d => d[chartData.xAxisKey || 'x'] || 0);
    const yValues = data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'y'] || 0);

    const maxX = Math.max(...xValues);
    const minX = Math.min(...xValues);
    const maxY = Math.max(...yValues);
    const minY = Math.min(...yValues);

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw points
    const colors = chartData.colors || ['#3B82F6'];
    ctx.fillStyle = colors[0];
    data.forEach((item, index) => {
      const x = margin + ((xValues[index] - minX) / xRange) * chartWidth;
      const y = margin + chartHeight - ((yValues[index] - minY) / yRange) * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * Draw SVG bar chart
   */
  private static drawSVGBarChart(
    svg: SVGElement,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;
    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));

    // Draw axes
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', margin.toString());
    line.setAttribute('y1', margin.toString());
    line.setAttribute('x2', margin.toString());
    line.setAttribute('y2', (margin + chartHeight).toString());
    line.setAttribute('stroke', '#e5e7eb');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);

    const bottomLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bottomLine.setAttribute('x1', margin.toString());
    bottomLine.setAttribute('y1', (margin + chartHeight).toString());
    bottomLine.setAttribute('x2', (margin + chartWidth).toString());
    bottomLine.setAttribute('y2', (margin + chartHeight).toString());
    bottomLine.setAttribute('stroke', '#e5e7eb');
    bottomLine.setAttribute('stroke-width', '2');
    svg.appendChild(bottomLine);

    // Draw bars
    const colors = chartData.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x = margin + index * (barWidth + barSpacing) + barSpacing / 2;
      const y = margin + chartHeight - barHeight;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', y.toString());
      rect.setAttribute('width', barWidth.toString());
      rect.setAttribute('height', barHeight.toString());
      rect.setAttribute('fill', colors[index % colors.length]);
      svg.appendChild(rect);

      // Add value label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', (x + barWidth / 2).toString());
      text.setAttribute('y', (y - 5).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', '#374151');
      text.textContent = value.toString();
      svg.appendChild(text);
    });
  }

  /**
   * Draw SVG line chart
   */
  private static drawSVGLineChart(
    svg: SVGElement,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw axes
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', margin.toString());
    line.setAttribute('y1', margin.toString());
    line.setAttribute('x2', margin.toString());
    line.setAttribute('y2', (margin + chartHeight).toString());
    line.setAttribute('stroke', '#e5e7eb');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);

    const bottomLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bottomLine.setAttribute('x1', margin.toString());
    bottomLine.setAttribute('y1', (margin + chartHeight).toString());
    bottomLine.setAttribute('x2', (margin + chartWidth).toString());
    bottomLine.setAttribute('y2', (margin + chartHeight).toString());
    bottomLine.setAttribute('stroke', '#e5e7eb');
    bottomLine.setAttribute('stroke-width', '2');
    svg.appendChild(bottomLine);

    // Draw line
    const colors = chartData.colors || ['#3B82F6'];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData = '';
    
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
    });
    
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', colors[0]);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);

    // Draw points
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', colors[0]);
      svg.appendChild(circle);
    });
  }

  /**
   * Draw SVG pie chart
   */
  private static drawSVGPieChart(
    svg: SVGElement,
    chartData: GraphData,
    centerX: number,
    centerY: number,
    radius: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const total = data.reduce((sum, item) => sum + (item[chartData.dataKey || 'value'] || 0), 0);
    let currentAngle = -Math.PI / 2;
    const colors = chartData.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    data.forEach((item, index) => {
      const value = item[chartData.dataKey || 'value'] || 0;
      const sliceAngle = (value / total) * 2 * Math.PI;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const endAngle = currentAngle + sliceAngle;
      
      const x1 = centerX + radius * Math.cos(currentAngle);
      const y1 = centerY + radius * Math.sin(currentAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);
      
      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
      
      const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
      
      path.setAttribute('d', pathData);
      path.setAttribute('fill', colors[index % colors.length]);
      svg.appendChild(path);

      currentAngle += sliceAngle;
    });
  }

  /**
   * Draw SVG area chart
   */
  private static drawSVGAreaChart(
    svg: SVGElement,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw axes
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', margin.toString());
    line.setAttribute('y1', margin.toString());
    line.setAttribute('x2', margin.toString());
    line.setAttribute('y2', (margin + chartHeight).toString());
    line.setAttribute('stroke', '#e5e7eb');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);

    const bottomLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bottomLine.setAttribute('x1', margin.toString());
    bottomLine.setAttribute('y1', (margin + chartHeight).toString());
    bottomLine.setAttribute('x2', (margin + chartWidth).toString());
    bottomLine.setAttribute('y2', (margin + chartHeight).toString());
    bottomLine.setAttribute('stroke', '#e5e7eb');
    bottomLine.setAttribute('stroke-width', '2');
    svg.appendChild(bottomLine);

    // Draw area
    const colors = chartData.colors || ['#3B82F6'];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData = `M ${margin} ${margin + chartHeight}`;
    
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      pathData += ` L ${x} ${y}`;
    });
    
    pathData += ` L ${margin + chartWidth} ${margin + chartHeight} Z`;
    
    path.setAttribute('d', pathData);
    path.setAttribute('fill', colors[0] + '4D'); // Add transparency
    svg.appendChild(path);

    // Draw line
    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let linePathData = '';
    
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        linePathData += `M ${x} ${y}`;
      } else {
        linePathData += ` L ${x} ${y}`;
      }
    });
    
    linePath.setAttribute('d', linePathData);
    linePath.setAttribute('stroke', colors[0]);
    linePath.setAttribute('stroke-width', '3');
    linePath.setAttribute('fill', 'none');
    svg.appendChild(linePath);
  }

  /**
   * Draw SVG scatter chart
   */
  private static drawSVGScatterChart(
    svg: SVGElement,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const xValues = data.map(d => d[chartData.xAxisKey || 'x'] || 0);
    const yValues = data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'y'] || 0);

    const maxX = Math.max(...xValues);
    const minX = Math.min(...xValues);
    const maxY = Math.max(...yValues);
    const minY = Math.min(...yValues);

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    // Draw axes
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', margin.toString());
    line.setAttribute('y1', margin.toString());
    line.setAttribute('x2', margin.toString());
    line.setAttribute('y2', (margin + chartHeight).toString());
    line.setAttribute('stroke', '#e5e7eb');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);

    const bottomLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bottomLine.setAttribute('x1', margin.toString());
    bottomLine.setAttribute('y1', (margin + chartHeight).toString());
    bottomLine.setAttribute('x2', (margin + chartWidth).toString());
    bottomLine.setAttribute('y2', (margin + chartHeight).toString());
    bottomLine.setAttribute('stroke', '#e5e7eb');
    bottomLine.setAttribute('stroke-width', '2');
    svg.appendChild(bottomLine);

    // Draw points
    const colors = chartData.colors || ['#3B82F6'];
    data.forEach((item, index) => {
      const x = margin + ((xValues[index] - minX) / xRange) * chartWidth;
      const y = margin + chartHeight - ((yValues[index] - minY) / yRange) * chartHeight;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', colors[0]);
      svg.appendChild(circle);
    });
  }
}