import { GraphData } from '../types';

/**
 * Utility class to convert chart data to images for PDF generation
 */
export class ChartToImage {
  /**
   * Convert a chart to a base64 image string
   */
  static async chartToBase64(chartData: GraphData, width: number = 800, height: number = 400): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create a high-resolution canvas for crisp rendering
        const scale = 3; // Higher DPI scaling for better quality
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas size with scaling
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        // Scale the context for high DPI
        ctx.scale(scale, scale);
        
        // Enable text antialiasing and high quality rendering
        ctx.textRenderingOptimization = 'optimizeQuality';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Set background with subtle border
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Add subtle border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);

        // Draw chart based on type
        this.drawChart(ctx, chartData, width, height);

        // Convert to base64 with high quality
        const base64 = canvas.toDataURL('image/png', 1.0);
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Draw chart on canvas context
   */
  private static drawChart(ctx: CanvasRenderingContext2D, chartData: GraphData, width: number, height: number): void {
    const margin = 80; // Increased margin for better axis labels
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;

    // Set up colors
    const colors = chartData.colors || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    const primaryColor = colors[0];

    // Draw title with high quality text rendering
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chartData.title, width / 2, 25);

    // Draw chart based on type
    switch (chartData.type) {
      case 'bar':
        this.drawBarChart(ctx, chartData, margin, chartWidth, chartHeight, primaryColor);
        break;
      case 'line':
        this.drawLineChart(ctx, chartData, margin, chartWidth, chartHeight, primaryColor);
        break;
      case 'pie':
        this.drawPieChart(ctx, chartData, width / 2, height / 2, Math.min(chartWidth, chartHeight) / 2 - 30, colors);
        break;
      case 'area':
        this.drawAreaChart(ctx, chartData, margin, chartWidth, chartHeight, primaryColor);
        break;
      case 'scatter':
        this.drawScatterChart(ctx, chartData, margin, chartWidth, chartHeight, primaryColor);
        break;
      default:
        this.drawBarChart(ctx, chartData, margin, chartWidth, chartHeight, primaryColor);
    }

    // Add axis labels if available
    this.drawAxisLabels(ctx, chartData, margin, chartWidth, chartHeight, width, height);
  }

  /**
   * Draw bar chart
   */
  private static drawBarChart(
    ctx: CanvasRenderingContext2D, 
    chartData: GraphData, 
    margin: number, 
    chartWidth: number, 
    chartHeight: number, 
    color: string
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;
    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));

    // Draw axes with high quality
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = margin + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(margin + chartWidth, y);
      ctx.stroke();
    }

    // Draw bars with high quality
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x = margin + index * (barWidth + barSpacing) + barSpacing / 2;
      const y = margin + chartHeight - barHeight;

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, this.darkenColor(color, 0.2));
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Add subtle border
      ctx.strokeStyle = this.darkenColor(color, 0.3);
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, barWidth, barHeight);
    });

    // Draw Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const value = (maxValue / 5) * i;
      const y = margin + chartHeight - (i / 5) * chartHeight;
      ctx.fillText(Math.round(value).toString(), margin - 10, y);
    }

    // Draw X-axis labels with high quality
    ctx.fillStyle = '#374151';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    data.forEach((item, index) => {
      const x = margin + index * (barWidth + barSpacing) + barWidth / 2;
      const label = item[chartData.xAxisKey || 'label'] || `Item ${index + 1}`;
      // Truncate long labels
      const truncatedLabel = label.length > 12 ? label.substring(0, 12) + '...' : label;
      ctx.fillText(truncatedLabel, x, margin + chartHeight + 15);
    });
  }

  /**
   * Draw line chart
   */
  private static drawLineChart(
    ctx: CanvasRenderingContext2D, 
    chartData: GraphData, 
    margin: number, 
    chartWidth: number, 
    chartHeight: number, 
    color: string
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw axes with high quality
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw grid lines for better readability
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = margin + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(margin + chartWidth, y);
      ctx.stroke();
    }

    // Draw line with high quality
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

    // Draw points with high quality
    ctx.fillStyle = color;
    data.forEach((item, index) => {
      const value = item[chartData.yAxisKey || chartData.dataKey || 'value'] || 0;
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = margin + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      
      // Draw point with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });
  }

  /**
   * Draw pie chart
   */
  private static drawPieChart(
    ctx: CanvasRenderingContext2D, 
    chartData: GraphData, 
    centerX: number, 
    centerY: number, 
    radius: number, 
    colors: string[]
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const total = data.reduce((sum, item) => sum + (item[chartData.dataKey || 'value'] || 0), 0);
    let currentAngle = -Math.PI / 2;

    data.forEach((item, index) => {
      const value = item[chartData.dataKey || 'value'] || 0;
      const sliceAngle = (value / total) * 2 * Math.PI;

      // Draw slice
      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 20);
      
      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item[chartData.xAxisKey || 'label'] || `Item ${index + 1}`, labelX, labelY);

      currentAngle += sliceAngle;
    });
  }

  /**
   * Draw area chart
   */
  private static drawAreaChart(
    ctx: CanvasRenderingContext2D, 
    chartData: GraphData, 
    margin: number, 
    chartWidth: number, 
    chartHeight: number, 
    color: string
  ): void {
    const data = chartData.data;
    if (data.length === 0) return;

    const maxValue = Math.max(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const minValue = Math.min(...data.map(d => d[chartData.yAxisKey || chartData.dataKey || 'value'] || 0));
    const valueRange = maxValue - minValue || 1;

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw area
    ctx.fillStyle = color + '4D'; // Add transparency
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
    ctx.strokeStyle = color;
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
   * Draw scatter chart
   */
  private static drawScatterChart(
    ctx: CanvasRenderingContext2D, 
    chartData: GraphData, 
    margin: number, 
    chartWidth: number, 
    chartHeight: number, 
    color: string
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
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();

    // Draw points
    ctx.fillStyle = color;
    data.forEach((item, index) => {
      const x = margin + ((xValues[index] - minX) / xRange) * chartWidth;
      const y = margin + chartHeight - ((yValues[index] - minY) / yRange) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * Draw axis labels for charts
   */
  private static drawAxisLabels(
    ctx: CanvasRenderingContext2D,
    chartData: GraphData,
    margin: number,
    chartWidth: number,
    chartHeight: number,
    width: number,
    height: number
  ): void {
    // Only draw axis labels for non-pie charts
    if (chartData.type === 'pie') return;

    // Draw X-axis label
    if (chartData.xAxisKey) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(chartData.xAxisKey, width / 2, height - 20);
    }

    // Draw Y-axis label
    if (chartData.yAxisKey) {
      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chartData.yAxisKey, 0, 0);
      ctx.restore();
    }
  }

  /**
   * Helper method to darken a color
   */
  private static darkenColor(color: string, amount: number): string {
    // Simple color darkening for hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
      const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
      const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
      return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    }
    return color;
  }
}
