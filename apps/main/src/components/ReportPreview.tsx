import React from 'react';
import { ReportDefinition } from '@ubora/shared/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ReportPreviewProps {
  report: ReportDefinition;
}

/**
 * ReportPreview component - displays a preview of a report template
 * Shows the report template as a document with placeholders replaced with mock values
 */
export const ReportPreview: React.FC<ReportPreviewProps> = ({ report }) => {
  // Placeholder chart data (same as dashboard preview)
  const placeholderChartData = [
    { x: 'Jan', y: 0 },
    { x: 'Fév', y: 0 },
    { x: 'Mar', y: 0 },
    { x: 'Avr', y: 0 },
    { x: 'Mai', y: 0 },
    { x: 'Jun', y: 0 },
  ];

  // Generate mock values for placeholders
  // All numeric/metric values should show 0 since there's no data (like dashboard preview)
  const getMockValue = (placeholder: string): string => {
    const placeholderName = placeholder.replace(/[{}]/g, '').trim().toLowerCase();
    
    // Check for graph/chart placeholders - return special marker that we'll replace with React component
    if (placeholderName.includes('graph') || placeholderName.includes('graphe') || 
        placeholderName.includes('chart') || placeholderName.includes('graphique') ||
        placeholderName.includes('visualisation') || placeholderName.includes('visualization')) {
      // Return a unique marker that we'll detect and replace with actual React chart component
      return '__GRAPH_PLACEHOLDER__';
    }
    
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

  // Render placeholder graph component (same as dashboard preview)
  const renderPlaceholderGraph = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-2 my-4">
        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={placeholderChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} stroke="#9ca3af" />
              <Tooltip />
              <Line type="monotone" dataKey="y" stroke="#d1d5db" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
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
    const graphPlaceholderMarkers: Array<{ original: string; marker: string }> = [];
    let markerCounter = 0;

    // First pass: Find all graph placeholders and create unique markers
    if (report.placeholders && report.placeholders.length > 0) {
      report.placeholders.forEach((placeholder) => {
        const placeholderText = placeholder.placeholder;
        const mockValue = getMockValue(placeholderText);
        
        if (mockValue === '__GRAPH_PLACEHOLDER__') {
          const uniqueMarker = `__GRAPH_PLACEHOLDER_${markerCounter++}__`;
          graphPlaceholderMarkers.push({ original: placeholderText, marker: uniqueMarker });
          
          // Replace placeholder with unique marker
          const escapedPlaceholder = placeholderText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          content = content.replace(
            new RegExp(escapedPlaceholder, 'gi'),
            uniqueMarker
          );
        }
      });
    }

    // Also check for any remaining placeholders in {{placeholder}} format
    const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    content = content.replace(placeholderRegex, (match) => {
      if (match.includes('{{')) {
        const mockValue = getMockValue(match);
        if (mockValue === '__GRAPH_PLACEHOLDER__') {
          const uniqueMarker = `__GRAPH_PLACEHOLDER_${markerCounter++}__`;
          graphPlaceholderMarkers.push({ original: match, marker: uniqueMarker });
          return uniqueMarker;
        }
        return mockValue;
      }
      return match;
    });

    // Replace all other placeholders with their mock values
    if (report.placeholders && report.placeholders.length > 0) {
      report.placeholders.forEach((placeholder) => {
        const placeholderText = placeholder.placeholder;
        const mockValue = getMockValue(placeholderText);
        
        // Skip if already replaced (graph placeholder)
        if (mockValue !== '__GRAPH_PLACEHOLDER__') {
          const escapedPlaceholder = placeholderText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          content = content.replace(
            new RegExp(escapedPlaceholder, 'gi'),
            mockValue
          );
        }
      });
    }

    // Check if content has HTML tags
    const hasHtmlTags = /<[^>]+>/g.test(content);
    
    // Split content by graph placeholder markers and render mixed content
    if (graphPlaceholderMarkers.length > 0) {
      const parts: Array<{ type: 'html' | 'text' | 'graph'; content: string }> = [];
      let remainingContent = content;
      
      // Sort markers by position in content (process from end to start to preserve indices)
      const sortedMarkers = [...graphPlaceholderMarkers].sort((a, b) => {
        const indexA = remainingContent.indexOf(a.marker);
        const indexB = remainingContent.indexOf(b.marker);
        return indexA - indexB;
      });
      
      let lastIndex = 0;
      sortedMarkers.forEach((markerInfo) => {
        const markerIndex = remainingContent.indexOf(markerInfo.marker, lastIndex);
        if (markerIndex !== -1) {
          // Add content before marker
          if (markerIndex > lastIndex) {
            const beforeContent = remainingContent.substring(lastIndex, markerIndex);
            if (beforeContent.trim()) {
              parts.push({
                type: hasHtmlTags ? 'html' : 'text',
                content: beforeContent
              });
            }
          }
          // Add graph component
          parts.push({
            type: 'graph',
            content: markerInfo.marker
          });
          lastIndex = markerIndex + markerInfo.marker.length;
        }
      });
      
      // Add remaining content
      if (lastIndex < remainingContent.length) {
        const remaining = remainingContent.substring(lastIndex);
        if (remaining.trim()) {
          parts.push({
            type: hasHtmlTags ? 'html' : 'text',
            content: remaining
          });
        }
      }
      
      return (
        <div className="prose prose-sm max-w-none report-preview-content">
          {parts.map((part, index) => {
            if (part.type === 'graph') {
              return <React.Fragment key={index}>{renderPlaceholderGraph()}</React.Fragment>;
            }
            if (part.type === 'html') {
              return (
                <div
                  key={index}
                  dangerouslySetInnerHTML={{ __html: part.content }}
                />
              );
            }
            // Plain text
            const lines = part.content.split('\n');
            return (
              <React.Fragment key={index}>
                {lines.map((line, lineIndex) => (
                  <p key={lineIndex} className="whitespace-pre-wrap mb-2">
                    {line || '\u00A0'}
                  </p>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    // No graph placeholders, render normally
    if (hasHtmlTags) {
      return (
        <div 
          className="prose prose-sm max-w-none report-preview-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // Plain text
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
        .report-preview-content h3,
        .report-preview-content h4,
        .report-preview-content h5,
        .report-preview-content h6 {
          color: #111827;
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .report-preview-content h1 {
          font-size: 2em !important;
          font-weight: 700 !important;
          line-height: 1.2 !important;
        }
        .report-preview-content h2 {
          font-size: 1.5em !important;
          font-weight: 600 !important;
          line-height: 1.3 !important;
        }
        .report-preview-content h3 {
          font-size: 1.25em !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
        }
        .report-preview-content h4 {
          font-size: 1.125em !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
        }
        .report-preview-content h5 {
          font-size: 1em !important;
          font-weight: 600 !important;
          line-height: 1.5 !important;
        }
        .report-preview-content h6 {
          font-size: 0.875em !important;
          font-weight: 600 !important;
          line-height: 1.5 !important;
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
        
        /* Preserve ReactQuill alignment classes */
        .report-preview-content .ql-align-center,
        .report-preview-content [class*="ql-align-center"],
        .report-preview-content [style*="text-align: center"],
        .report-preview-content [style*="text-align:center"] {
          text-align: center !important;
        }
        .report-preview-content .ql-align-right,
        .report-preview-content [class*="ql-align-right"],
        .report-preview-content [style*="text-align: right"],
        .report-preview-content [style*="text-align:right"] {
          text-align: right !important;
        }
        .report-preview-content .ql-align-left,
        .report-preview-content [class*="ql-align-left"],
        .report-preview-content [style*="text-align: left"],
        .report-preview-content [style*="text-align:left"] {
          text-align: left !important;
        }
        .report-preview-content .ql-align-justify,
        .report-preview-content [class*="ql-align-justify"],
        .report-preview-content [style*="text-align: justify"],
        .report-preview-content [style*="text-align:justify"] {
          text-align: justify !important;
        }
        
        /* Ensure headings respect alignment */
        .report-preview-content h1.ql-align-center,
        .report-preview-content h1[style*="text-align: center"],
        .report-preview-content h1[style*="text-align:center"],
        .report-preview-content h2.ql-align-center,
        .report-preview-content h2[style*="text-align: center"],
        .report-preview-content h2[style*="text-align:center"],
        .report-preview-content h3.ql-align-center,
        .report-preview-content h3[style*="text-align: center"],
        .report-preview-content h3[style*="text-align:center"],
        .report-preview-content h4.ql-align-center,
        .report-preview-content h4[style*="text-align: center"],
        .report-preview-content h4[style*="text-align:center"],
        .report-preview-content h5.ql-align-center,
        .report-preview-content h5[style*="text-align: center"],
        .report-preview-content h5[style*="text-align:center"],
        .report-preview-content h6.ql-align-center,
        .report-preview-content h6[style*="text-align: center"],
        .report-preview-content h6[style*="text-align:center"] {
          text-align: center !important;
        }
        .report-preview-content h1.ql-align-right,
        .report-preview-content h1[style*="text-align: right"],
        .report-preview-content h1[style*="text-align:right"],
        .report-preview-content h2.ql-align-right,
        .report-preview-content h2[style*="text-align: right"],
        .report-preview-content h2[style*="text-align:right"],
        .report-preview-content h3.ql-align-right,
        .report-preview-content h3[style*="text-align: right"],
        .report-preview-content h3[style*="text-align:right"],
        .report-preview-content h4.ql-align-right,
        .report-preview-content h4[style*="text-align: right"],
        .report-preview-content h4[style*="text-align:right"],
        .report-preview-content h5.ql-align-right,
        .report-preview-content h5[style*="text-align: right"],
        .report-preview-content h5[style*="text-align:right"],
        .report-preview-content h6.ql-align-right,
        .report-preview-content h6[style*="text-align: right"],
        .report-preview-content h6[style*="text-align:right"] {
          text-align: right !important;
        }
        .report-preview-content h1.ql-align-justify,
        .report-preview-content h1[style*="text-align: justify"],
        .report-preview-content h1[style*="text-align:justify"],
        .report-preview-content h2.ql-align-justify,
        .report-preview-content h2[style*="text-align: justify"],
        .report-preview-content h2[style*="text-align:justify"],
        .report-preview-content h3.ql-align-justify,
        .report-preview-content h3[style*="text-align: justify"],
        .report-preview-content h3[style*="text-align:justify"],
        .report-preview-content h4.ql-align-justify,
        .report-preview-content h4[style*="text-align: justify"],
        .report-preview-content h4[style*="text-align:justify"],
        .report-preview-content h5.ql-align-justify,
        .report-preview-content h5[style*="text-align: justify"],
        .report-preview-content h5[style*="text-align:justify"],
        .report-preview-content h6.ql-align-justify,
        .report-preview-content h6[style*="text-align: justify"],
        .report-preview-content h6[style*="text-align:justify"] {
          text-align: justify !important;
        }
        
        /* Preserve other ReactQuill formatting */
        .report-preview-content strong,
        .report-preview-content b {
          font-weight: 700;
        }
        .report-preview-content em,
        .report-preview-content i {
          font-style: italic;
        }
        .report-preview-content u {
          text-decoration: underline;
        }
        .report-preview-content s,
        .report-preview-content strike {
          text-decoration: line-through;
        }
        .report-preview-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
        }
        .report-preview-content code {
          background-color: #f3f4f6;
          padding: 0.125em 0.25em;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875em;
        }
        .report-preview-content pre {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 1em;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1em 0;
        }
        .report-preview-content pre code {
          background-color: transparent;
          padding: 0;
          color: inherit;
        }
      `}</style>
    </div>
  );
};

