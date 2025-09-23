import { useCallback, useRef } from 'react';
import { useCurrentPng } from 'recharts-to-png';
import { GraphData } from '../types';

/**
 * Custom hook to convert Recharts components to PNG images
 * This hook provides a clean interface for converting charts to PNG format
 */
export const useChartToPNG = () => {
  const chartRef = useRef<any>(null);
  const [getPng, { isLoading }] = useCurrentPng();

  /**
   * Convert the current chart to PNG
   */
  const convertToPNG = useCallback(async (): Promise<string | null> => {
    try {
      const png = await getPng();
      return png;
    } catch (error) {
      console.error('Error converting chart to PNG:', error);
      return null;
    }
  }, [getPng]);

  /**
   * Convert chart data to PNG using a temporary chart component
   * This is a fallback method when we don't have a direct chart reference
   */
  const convertChartDataToPNG = useCallback(async (
    chartData: GraphData,
    width: number = 800,
    height: number = 400
  ): Promise<string | null> => {
    try {
      // Import the RechartsToPNG utility
      const { RechartsToPNG } = await import('../utils/RechartsToPNG');
      const png = await RechartsToPNG.convertChartDataToPNG(chartData, width, height);
      return png;
    } catch (error) {
      console.error('Error converting chart data to PNG:', error);
      return null;
    }
  }, []);

  return {
    chartRef,
    convertToPNG,
    convertChartDataToPNG,
    isLoading
  };
};

/**
 * Hook specifically for PDF generation with charts
 * This hook provides methods to convert charts to PNG for PDF embedding
 */
export const useChartForPDF = () => {
  const { convertToPNG, convertChartDataToPNG, isLoading } = useChartToPNG();

  /**
   * Convert chart to PNG for PDF embedding
   */
  const getChartPNGForPDF = useCallback(async (
    chartData: GraphData,
    width: number = 600,
    height: number = 300
  ): Promise<string | null> => {
    try {
      // Try to convert using the chart data method
      const png = await convertChartDataToPNG(chartData, width, height);
      return png;
    } catch (error) {
      console.error('Error getting chart PNG for PDF:', error);
      return null;
    }
  }, [convertChartDataToPNG]);

  /**
   * Convert multiple charts to PNG for PDF embedding
   */
  const getMultipleChartsPNGForPDF = useCallback(async (
    chartsData: GraphData[],
    width: number = 600,
    height: number = 300
  ): Promise<(string | null)[]> => {
    try {
      const promises = chartsData.map(chartData => 
        getChartPNGForPDF(chartData, width, height)
      );
      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      console.error('Error getting multiple charts PNG for PDF:', error);
      return chartsData.map(() => null);
    }
  }, [getChartPNGForPDF]);

  return {
    getChartPNGForPDF,
    getMultipleChartsPNGForPDF,
    isLoading
  };
};

