/**
 * CSV Type Detector Utility
 * Automatically detects column types from CSV values
 * Supports: text, number, date, email, boolean
 */

export type ColumnType = 'text' | 'number' | 'date' | 'email' | 'boolean';

/**
 * Detect the type of a column based on sample values
 * 
 * @param values - Array of string values from the column
 * @param sampleSize - Number of values to analyze (default: 20, max: all values)
 * @returns Detected column type
 */
export function detectColumnType(
  values: string[],
  sampleSize: number = 20
): ColumnType {
  if (!values || values.length === 0) {
    return 'text'; // Default to text if no values
  }

  // Optimize: Use a smart sample strategy for large datasets
  // Take evenly distributed samples, not just first N values
  const totalValues = values.length;
  const effectiveSampleSize = Math.min(sampleSize, totalValues);
  
  let sample: string[];
  if (totalValues <= effectiveSampleSize) {
    // Small dataset: analyze all
    sample = values
      .filter(v => v !== null && v !== undefined && v.trim() !== '')
      .map(v => v.trim());
  } else {
    // Large dataset: sample evenly distributed values
    const step = Math.floor(totalValues / effectiveSampleSize);
    sample = [];
    for (let i = 0; i < totalValues && sample.length < effectiveSampleSize; i += step) {
      const value = values[i];
      if (value !== null && value !== undefined && value.trim() !== '') {
        sample.push(value.trim());
      }
    }
    // Also include last few values (often different patterns)
    const lastStart = Math.max(0, totalValues - 3);
    for (let i = lastStart; i < totalValues && sample.length < effectiveSampleSize; i++) {
      const value = values[i];
      if (value !== null && value !== undefined && value.trim() !== '') {
        sample.push(value.trim());
      }
    }
  }

  if (sample.length === 0) {
    return 'text'; // Default if all values are empty
  }

  // Count matches for each type
  let emailCount = 0;
  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;

  // Email regex pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

  // Boolean patterns (case insensitive)
  const booleanPatterns = {
    true: /^(true|1|yes|oui|vrai|si)$/i,
    false: /^(false|0|no|non|faux|non)$/i
  };

  // Date patterns (common formats)
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD (ISO)
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY or MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY or MM-DD-YYYY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // D/M/YY or D/M/YYYY
    /^\d{1,2}-\d{1,2}-\d{2,4}$/, // D-M-YY or D-M-YYYY
    /^\d{2}\.\d{2}\.\d{4}$/, // DD.MM.YYYY
  ];

  for (const value of sample) {
    // Check email
    if (emailPattern.test(value)) {
      emailCount++;
      continue;
    }

    // Check boolean
    if (booleanPatterns.true.test(value) || booleanPatterns.false.test(value)) {
      booleanCount++;
      continue;
    }

    // Check number (integer or float)
    // Try to parse as number
    const numValue = parseFloat(value.replace(/[,\s]/g, '')); // Remove commas and spaces
    if (!isNaN(numValue) && isFinite(numValue)) {
      // Additional check: the value should be mostly numeric characters
      const cleanValue = value.replace(/[,\s\-+]/g, '');
      if (/^\d*\.?\d*$/.test(cleanValue)) {
        numberCount++;
        continue;
      }
    }

    // Check date
    let isDate = false;
    for (const pattern of datePatterns) {
      if (pattern.test(value)) {
        // Additional validation: try to parse as date
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) {
          isDate = true;
          dateCount++;
          break;
        }
      }
    }
  }

  // Calculate percentages
  const total = sample.length;
  const emailPercent = emailCount / total;
  const numberPercent = numberCount / total;
  const datePercent = dateCount / total;
  const booleanPercent = booleanCount / total;

  // Threshold for type detection (at least 80% match)
  const threshold = 0.8;

  // Priority order: email > boolean > number > date > text
  // (Email and boolean are most specific, so check them first)
  if (emailPercent >= threshold) {
    return 'email';
  }

  if (booleanPercent >= threshold) {
    return 'boolean';
  }

  if (numberPercent >= threshold) {
    return 'number';
  }

  if (datePercent >= threshold) {
    return 'date';
  }

  // If number is close to threshold but not quite, prefer it over text
  if (numberPercent >= 0.6 && numberPercent > datePercent) {
    return 'number';
  }

  // Default to text
  return 'text';
}

/**
 * Detect types for multiple columns from CSV data
 * 
 * @param csvData - Array of objects with column names as keys and values as strings
 * @param headers - Array of column headers/names
 * @param sampleSize - Number of rows to analyze per column (default: 20)
 * @returns Object mapping column names to detected types
 */
export function detectColumnTypes(
  csvData: Record<string, string>[],
  headers: string[],
  sampleSize: number = 20
): Record<string, ColumnType> {
  const detectedTypes: Record<string, ColumnType> = {};

  for (const header of headers) {
    // Extract values for this column
    const columnValues = csvData
      .map(row => row[header] || '')
      .filter(val => val !== null && val !== undefined);

    // Detect type for this column
    detectedTypes[header] = detectColumnType(columnValues, sampleSize);
  }

  return detectedTypes;
}

/**
 * Validate a value against a column type
 * 
 * @param value - Value to validate
 * @param type - Expected column type
 * @returns True if value matches the type, false otherwise
 */
export function validateValueAgainstType(value: string, type: ColumnType): boolean {
  if (!value || value.trim() === '') {
    return true; // Empty values are allowed
  }

  const trimmed = value.trim();

  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed);

    case 'boolean':
      return /^(true|false|1|0|yes|no|oui|non|vrai|faux|si|non)$/i.test(trimmed);

    case 'number':
      const num = parseFloat(trimmed.replace(/[,\s]/g, ''));
      return !isNaN(num) && isFinite(num);

    case 'date':
      const date = new Date(trimmed);
      return !isNaN(date.getTime());

    case 'text':
    default:
      return true; // Text accepts any value
  }
}

/**
 * Convert a value to the appropriate type
 * 
 * @param value - String value to convert
 * @param type - Target type
 * @returns Converted value
 */
export function convertValueToType(value: string, type: ColumnType): any {
  if (!value || value.trim() === '') {
    return type === 'number' ? 0 : type === 'boolean' ? false : '';
  }

  const trimmed = value.trim();

  switch (type) {
    case 'number':
      return parseFloat(trimmed.replace(/[,\s]/g, '')) || 0;

    case 'boolean':
      return /^(true|1|yes|oui|vrai|si)$/i.test(trimmed);

    case 'date':
      return new Date(trimmed).toISOString().split('T')[0]; // Return ISO date string

    case 'email':
      return trimmed.toLowerCase();

    case 'text':
    default:
      return trimmed;
  }
}

