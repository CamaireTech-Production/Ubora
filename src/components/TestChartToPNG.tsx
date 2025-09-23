import React, { useState } from 'react';
import { Button } from './Button';
import { RechartsToPNG } from '../utils/RechartsToPNG';
import { GraphData } from '../types';

// Test data for chart conversion
const testChartData: GraphData = {
  type: 'bar',
  title: 'Test Chart - Employee Performance',
  subtitle: 'Monthly Performance Metrics',
  data: [
    { x: 'Jan', y: 85 },
    { x: 'Feb', y: 92 },
    { x: 'Mar', y: 78 },
    { x: 'Apr', y: 96 },
    { x: 'May', y: 88 },
    { x: 'Jun', y: 94 }
  ],
  xAxisKey: 'x',
  yAxisKey: 'y',
  dataKey: 'y',
  colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  options: {
    showLegend: true,
    showGrid: true,
    showTooltip: true
  },
  insights: [
    'Peak performance in April with 96%',
    'Consistent performance above 85%'
  ],
  recommendations: [
    'Maintain current performance levels',
    'Focus on consistency across all months'
  ]
};

export const TestChartToPNG: React.FC = () => {
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestConversion = async () => {
    setIsConverting(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing chart to PNG conversion...');
      const pngData = await RechartsToPNG.convertChartDataToPNG(testChartData, 800, 500);
      
      if (pngData) {
        setResult('Chart successfully converted to PNG!');
        console.log('PNG data length:', pngData.length);
        
        // Create a download link for testing
        const link = document.createElement('a');
        link.href = pngData;
        link.download = 'test-chart.png';
        link.click();
      } else {
        setError('Failed to convert chart to PNG');
      }
    } catch (err) {
      console.error('Error during conversion:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Test Chart to PNG Conversion</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Test Data:</h3>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(testChartData, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <Button
          onClick={handleTestConversion}
          disabled={isConverting}
          className="w-full"
        >
          {isConverting ? 'Converting...' : 'Test Chart to PNG Conversion'}
        </Button>
      </div>

      {result && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-800 font-medium">✅ {result}</div>
          <div className="text-green-600 text-sm mt-1">
            Check your downloads folder for the generated PNG file.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-medium">❌ {error}</div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        <p><strong>What this test does:</strong></p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Creates a test chart with sample data</li>
          <li>Converts the chart to PNG using recharts-to-png</li>
          <li>Downloads the generated PNG file</li>
          <li>Shows success/error messages</li>
        </ul>
      </div>
    </div>
  );
};
