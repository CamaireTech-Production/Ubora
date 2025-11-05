import React from 'react';
import { ReportDefinition } from '@ubora/shared/types';

interface ReportPreviewProps {
  report: ReportDefinition;
}

/**
 * ReportPreview component - displays a preview of a report template
 * Shows the report template as a document with placeholders replaced with mock values
 */
export const ReportPreview: React.FC<ReportPreviewProps> = ({ report }) => {
  // Generate mock values for placeholders
  const getMockValue = (placeholder: string): string => {
    const placeholderName = placeholder.replace(/[{}]/g, '').toLowerCase();
    
    // Generate mock values based on placeholder name patterns
    if (placeholderName.includes('total') || placeholderName.includes('somme')) {
      return '1 250 000';
    }
    if (placeholderName.includes('moyenne') || placeholderName.includes('average')) {
      return '125 000';
    }
    if (placeholderName.includes('nombre') || placeholderName.includes('count')) {
      return '10';
    }
    if (placeholderName.includes('date')) {
      return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (placeholderName.includes('nom') || placeholderName.includes('name')) {
      return 'Exemple Nom';
    }
    if (placeholderName.includes('email')) {
      return 'exemple@email.com';
    }
    if (placeholderName.includes('montant') || placeholderName.includes('amount')) {
      return '500 000';
    }
    if (placeholderName.includes('pourcentage') || placeholderName.includes('percentage')) {
      return '75%';
    }
    // Default mock value
    return '[Valeur]';
  };

  // Replace placeholders in template content with mock values
  const renderTemplateContent = () => {
    if (!report.templateContent) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>Aucun contenu de template disponible</p>
        </div>
      );
    }

    let content = report.templateContent;

    // Replace placeholders with mock values
    if (report.placeholders && report.placeholders.length > 0) {
      report.placeholders.forEach((placeholder) => {
        const mockValue = getMockValue(placeholder.placeholder);
        // Replace placeholder with mock value, keeping the same format
        content = content.replace(
          new RegExp(placeholder.placeholder.replace(/[{}]/g, '\\$&'), 'g'),
          `<span class="bg-yellow-100 text-yellow-800 px-1 rounded">${mockValue}</span>`
        );
      });
    }

    // If it's HTML content (from ReactQuill), render it as HTML
    // Otherwise, treat it as plain text
    if (content.includes('<') && content.includes('>')) {
      return (
        <div 
          className="prose prose-sm max-w-none report-preview-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // Plain text - convert line breaks to <br>
    const lines = content.split('\n');
    return (
      <div className="prose prose-sm max-w-none report-preview-content">
        {lines.map((line, index) => (
          <p key={index} className="whitespace-pre-wrap">
            {line || <br />}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        {/* Report Header */}
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{report.name || 'Rapport'}</h3>
          {report.description && (
            <p className="text-sm text-gray-600 mt-1">{report.description}</p>
          )}
          {report.templateType && (
            <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
              {report.templateType.toUpperCase()}
            </span>
          )}
        </div>

        {/* Template Content Preview */}
        <div className="min-h-[200px]">
          {renderTemplateContent()}
        </div>

        {/* Placeholders Info */}
        {report.placeholders && report.placeholders.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">
              <strong>Note:</strong> Les valeurs affichées sont des exemples. Les placeholders sont remplacés par des valeurs fictives pour l'aperçu.
            </p>
            <div className="flex flex-wrap gap-2">
              {report.placeholders.slice(0, 5).map((placeholder, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                  {placeholder.placeholder}
                </span>
              ))}
              {report.placeholders.length > 5 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                  +{report.placeholders.length - 5} autres
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mappings Info */}
        {report.mappings && report.mappings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">
              Mappings configurés: {report.mappings.length}
            </p>
          </div>
        )}
      </div>

      {/* Custom styles for report preview */}
      <style>{`
        .report-preview-content {
          color: #374151;
          line-height: 1.6;
        }
        .report-preview-content h1,
        .report-preview-content h2,
        .report-preview-content h3 {
          color: #111827;
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .report-preview-content p {
          margin-bottom: 1em;
        }
        .report-preview-content ul,
        .report-preview-content ol {
          margin-left: 1.5em;
          margin-bottom: 1em;
        }
        .report-preview-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
        }
        .report-preview-content table th,
        .report-preview-content table td {
          border: 1px solid #e5e7eb;
          padding: 0.5em;
          text-align: left;
        }
        .report-preview-content table th {
          background-color: #f9fafb;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

