import { ReportPlaceholder } from '../../types';

/**
 * Service for handling report template operations
 */
export const reportService = {
  /**
   * Extract placeholders from a template string
   * Placeholders are in the format {{placeholderName}}
   * 
   * @param templateContent - The template content to extract placeholders from
   * @returns Array of ReportPlaceholder objects
   */
  extractPlaceholdersFromTemplate(templateContent: string): ReportPlaceholder[] {
    if (!templateContent) {
      return [];
    }

    // Regex to match placeholders in format {{placeholderName}}
    const placeholderRegex = /{{\s*([^}]+)\s*}}/g;
    const placeholders: ReportPlaceholder[] = [];
    const uniquePlaceholders = new Set<string>();
    let match;

    // Extract all placeholders
    while ((match = placeholderRegex.exec(templateContent)) !== null) {
      const placeholder = match[1].trim();
      
      // Avoid duplicates
      if (!uniquePlaceholders.has(placeholder)) {
        uniquePlaceholders.add(placeholder);
        
        // Determine placeholder type based on name patterns
        let type: 'form_field' | 'dashboard_metric' | 'calculated' | 'static' = 'static';
        if (placeholder.toLowerCase().includes('form')) {
          type = 'form_field';
        } else if (placeholder.toLowerCase().includes('metric') || placeholder.toLowerCase().includes('dashboard')) {
          type = 'dashboard_metric';
        } else if (placeholder.toLowerCase().includes('calc') || placeholder.toLowerCase().includes('sum') || placeholder.toLowerCase().includes('avg')) {
          type = 'calculated';
        }

        placeholders.push({
          id: `placeholder-${placeholders.length + 1}`,
          placeholder: `{{${placeholder}}}`,
          position: match.index,
          type,
          description: `Placeholder for ${placeholder}`
        });
      }
    }

    // Sort by position in template
    return placeholders.sort((a, b) => a.position - b.position);
  }
};

