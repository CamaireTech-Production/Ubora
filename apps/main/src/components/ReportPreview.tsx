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
  // All numeric/metric values should show 0 since there's no data (like dashboard preview)
  const getMockValue = (placeholder: string): string => {
    const placeholderName = placeholder.replace(/[{}]/g, '').trim().toLowerCase();
    
    // Generate mock values based on placeholder name patterns
    // For numeric/metric types, show 0 (no data available)
    if (placeholderName.includes('total') || placeholderName.includes('somme') || placeholderName.includes('revenus')) {
      return '0';
    }
    if (placeholderName.includes('moyenne') || placeholderName.includes('average')) {
      return '0';
    }
    if (placeholderName.includes('nombre') || placeholderName.includes('count') || placeholderName.includes('vente')) {
      return '0';
    }
    if (placeholderName.includes('montant') || placeholderName.includes('amount') || placeholderName.includes('prix')) {
      return '0';
    }
    if (placeholderName.includes('benefice') || placeholderName.includes('profit')) {
      return '0';
    }
    if (placeholderName.includes('depense') || placeholderName.includes('expense')) {
      return '0';
    }
    if (placeholderName.includes('pourcentage') || placeholderName.includes('percentage') || placeholderName.includes('%')) {
      return '0%';
    }
    // For date placeholders, show actual date
    if (placeholderName.includes('date')) {
      return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    // For text placeholders
    if (placeholderName.includes('nom') || placeholderName.includes('name')) {
      return 'Exemple Nom';
    }
    if (placeholderName.includes('email')) {
      return 'exemple@email.com';
    }
    // Default mock value - use 0 for numeric metrics (no data available)
    return '0';
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
    // First, try to replace using the placeholders array
    if (report.placeholders && report.placeholders.length > 0) {
      report.placeholders.forEach((placeholder) => {
        const mockValue = getMockValue(placeholder.placeholder);
        const placeholderText = placeholder.placeholder;
        
        // Escape special regex characters in placeholder, but handle curly braces properly
        // Replace { and } with escaped versions for regex
        const escapedPlaceholder = placeholderText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Replace all occurrences of the placeholder
        content = content.replace(
          new RegExp(escapedPlaceholder, 'gi'),
          mockValue
        );
      });
    }

    // Also replace any remaining placeholders that might be in the format {{placeholder}} 
    // This handles cases where placeholders might not be in the placeholders array
    const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    content = content.replace(placeholderRegex, (match) => {
      // Check if we already replaced this (shouldn't happen, but just in case)
      // If the match still contains {{, it means it wasn't replaced
      if (match.includes('{{')) {
        const mockValue = getMockValue(match);
        return mockValue;
      }
      return match;
    });

    // If it's HTML content (from ReactQuill), we need to handle HTML tags properly
    // First, check if content has HTML tags (but not just from our replacements)
    const hasHtmlTags = /<[^>]+>/g.test(content);
    
    if (hasHtmlTags) {
      // Content is HTML - render it as HTML
      return (
        <div 
          className="prose prose-sm max-w-none report-preview-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // Plain text - convert line breaks to <br> and preserve whitespace
    const lines = content.split('\n');
    return (
      <div className="prose prose-sm max-w-none report-preview-content">
        {lines.map((line, index) => (
          <p key={index} className="whitespace-pre-wrap mb-2">
            {line || '\u00A0'}
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

