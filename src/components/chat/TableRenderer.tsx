import React from 'react';

interface TableRendererProps {
  markdownTable: string;
}

export const TableRenderer: React.FC<TableRendererProps> = ({ markdownTable }) => {
  // Parse markdown table to HTML
  const parseMarkdownTable = (markdown: string): JSX.Element | null => {
    const lines = markdown.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return null;
    
    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
    
    // Skip separator line (second line)
    const dataLines = lines.slice(2);
    
    // Parse data rows
    const rows = dataLines.map(line => {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      return cells;
    });
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mt-4 max-h-96 overflow-auto border border-gray-200 rounded-lg">
      {parseMarkdownTable(markdownTable)}
    </div>
  );
};
