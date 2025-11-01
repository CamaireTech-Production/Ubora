import React from 'react';
import { Button } from '../Button';
import { GraphData, PDFData } from '../../types';
import { generatePDF } from '../../utils/PDFGenerator';

interface TestDataGeneratorProps {
  onTestData: (type: 'graph' | 'pdf', data: GraphData | PDFData) => void;
}

export const TestDataGenerator: React.FC<TestDataGeneratorProps> = ({ onTestData }) => {
  const generateSampleGraphData = (): GraphData => {
    return {
      type: 'bar',
      title: 'Ventes par mois - 2024',
      data: [
        { month: 'Jan', sales: 12000, target: 10000 },
        { month: 'Fév', sales: 15000, target: 12000 },
        { month: 'Mar', sales: 18000, target: 15000 },
        { month: 'Avr', sales: 16000, target: 16000 },
        { month: 'Mai', sales: 20000, target: 18000 },
        { month: 'Jun', sales: 22000, target: 20000 }
      ],
      xAxisKey: 'month',
      yAxisKey: 'sales',
      colors: ['#3B82F6', '#10B981'],
      options: {
        showLegend: true,
        showGrid: true,
        showTooltip: true,
        responsive: true
      }
    };
  };

  const generateSamplePDFData = (): PDFData => {
    return {
      title: 'Rapport de Performance Mensuel',
      subtitle: 'Analyse des données de formulaires - Janvier 2024',
      generatedAt: new Date(),
      metadata: {
        period: 'Janvier 2024',
        totalEntries: 156,
        totalUsers: 24,
        totalForms: 8
      },
      sections: [
        {
          title: 'Résumé Exécutif',
          content: 'Ce rapport présente une analyse complète des performances de l\'équipe pour le mois de janvier 2024. Les données montrent une amélioration significative des indicateurs clés par rapport au mois précédent.',
          type: 'text'
        },
        {
          title: 'Métriques Clés',
          content: '',
          type: 'list',
          data: [
            '156 formulaires soumis (+23% vs décembre)',
            '24 employés actifs (100% de participation)',
            '8 formulaires différents utilisés',
            'Temps moyen de soumission: 12 minutes',
            'Taux de complétion: 98.7%'
          ]
        },
        {
          title: 'Top Performers',
          content: '',
          type: 'table',
          data: [
            { employe: 'Marie Dubois', formulaires: 12, score: 95 },
            { employe: 'Jean Martin', formulaires: 11, score: 92 },
            { employe: 'Sophie Leroy', formulaires: 10, score: 89 },
            { employe: 'Pierre Moreau', formulaires: 9, score: 87 }
          ]
        }
      ],
      charts: [
        {
          type: 'line',
          title: 'Évolution des soumissions',
          data: [
            { week: 'Sem 1', submissions: 35 },
            { week: 'Sem 2', submissions: 42 },
            { week: 'Sem 3', submissions: 38 },
            { week: 'Sem 4', submissions: 41 }
          ],
          xAxisKey: 'week',
          yAxisKey: 'submissions'
        }
      ]
    };
  };

  const handleTestGraph = () => {
    const graphData = generateSampleGraphData();
    onTestData('graph', graphData);
  };

  const handleTestPDF = () => {
    const pdfData = generateSamplePDFData();
    onTestData('pdf', pdfData);
  };

  const handleDownloadSamplePDF = () => {
    const pdfData = generateSamplePDFData();
    generatePDF(pdfData);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Test des composants</h3>
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={handleTestGraph}
            className="flex items-center space-x-2"
          >
            📊 Tester Graphique
          </Button>
          <Button
            variant="secondary"
            onClick={handleTestPDF}
            className="flex items-center space-x-2"
          >
            📄 Tester PDF Preview
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadSamplePDF}
            className="flex items-center space-x-2"
          >
            💾 Télécharger PDF
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          Utilisez ces boutons pour tester les composants de graphique et PDF avec des données d'exemple.
        </p>
      </div>
    </div>
  );
};
