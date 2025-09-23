import React, { useState } from 'react';
import { Button } from '../Button';
import { ChatMessage, GraphData } from '../../types';
import { PDFGenerator } from '../../utils/PDFGenerator';
import { MultiFormatToPDF } from '../../utils/MultiFormatToPDF';
import { RechartsToPNG } from '../../utils/RechartsToPNG';
import { Download, FileText, Loader2 } from 'lucide-react';

interface MultiFormatPDFGeneratorProps {
  message: ChatMessage;
  className?: string;
}

export const MultiFormatPDFGenerator: React.FC<MultiFormatPDFGeneratorProps> = ({
  message,
  className = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGeneratePDF = MultiFormatToPDF.canConvertToPDF(message);
  const pdfDescription = MultiFormatToPDF.getPDFDescription(message);

  const handleGeneratePDF = async () => {
    if (!canGeneratePDF) {
      setError('Ce message ne peut pas être converti en PDF');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Convert the message to PDFData
      const pdfData = MultiFormatToPDF.convertToPDFData(message);

      // If there are charts, convert them to PNG using recharts-to-png
      if (pdfData.charts && pdfData.charts.length > 0) {
        
        // Create a new PDFData with converted chart images
        const updatedPdfData = {
          ...pdfData,
          charts: await Promise.all(
            pdfData.charts.map(async (chart: GraphData) => {
              try {
                // Convert chart to PNG using recharts-to-png
                const chartImage = await RechartsToPNG.convertChartDataToPNG(chart, 800, 500);
                
                // Return the chart with the image data
                return {
                  ...chart,
                  imageData: chartImage
                };
              } catch (error) {
                console.error('Error converting chart to PNG:', error);
                // Return the original chart if conversion fails
                return chart;
              }
            })
          )
        };

        // Generate PDF with the updated data
        const generator = new PDFGenerator();
        await generator.generateReport(updatedPdfData);
      } else {
        // Generate PDF without charts
        const generator = new PDFGenerator();
        await generator.generateReport(pdfData);
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!canGeneratePDF) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <div className="text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Aucun contenu à inclure dans le PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm text-gray-600">
        <p className="font-medium">Génération PDF</p>
        <p className="text-xs">{pdfDescription}</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Génération en cours...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Générer le PDF
          </>
        )}
      </button>
    </div>
  );
};

/**
 * Hook to generate PDF from multi-format message
 * This can be used in other components that need PDF generation functionality
 */
export const useMultiFormatPDFGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePDF = async (message: ChatMessage): Promise<boolean> => {
    if (!MultiFormatToPDF.canConvertToPDF(message)) {
      setError('Ce message ne peut pas être converti en PDF');
      return false;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Convert the message to PDFData
      const pdfData = MultiFormatToPDF.convertToPDFData(message);

      // If there are charts, convert them to PNG using recharts-to-png
      if (pdfData.charts && pdfData.charts.length > 0) {
        
        // Create a new PDFData with converted chart images
        const updatedPdfData = {
          ...pdfData,
          charts: await Promise.all(
            pdfData.charts.map(async (chart: GraphData) => {
              try {
                // Convert chart to PNG using recharts-to-png
                const chartImage = await RechartsToPNG.convertChartDataToPNG(chart, 800, 500);
                
                // Return the chart with the image data
                return {
                  ...chart,
                  imageData: chartImage
                };
              } catch (error) {
                console.error('Error converting chart to PNG:', error);
                // Return the original chart if conversion fails
                return chart;
              }
            })
          )
        };

        // Generate PDF with the updated data
        const generator = new PDFGenerator();
        await generator.generateReport(updatedPdfData);
      } else {
        // Generate PDF without charts
        const generator = new PDFGenerator();
        await generator.generateReport(pdfData);
      }

      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Erreur lors de la génération du PDF');
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePDF,
    isGenerating,
    error,
    canGeneratePDF: (message: ChatMessage) => MultiFormatToPDF.canConvertToPDF(message),
    getPDFDescription: (message: ChatMessage) => MultiFormatToPDF.getPDFDescription(message)
  };
};

