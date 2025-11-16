/**
 * Utility functions for formatting list-based dropdown values
 * JavaScript version for Node.js API
 */

/**
 * Checks if a value is a list row value (dropdown based on a list)
 * @param {any} value - The value to check
 * @returns {boolean} - True if the value is a list row value
 */
function isListRowValue(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_listRow' in value &&
    value._listRow === true &&
    'listId' in value &&
    'rowData' in value &&
    typeof value.rowData === 'object'
  );
}

/**
 * Formats a list-based dropdown value for display
 * @param {any} value - The value to format
 * @param {Object} field - The form field (optional, to get displayColumnId)
 * @returns {string} - The formatted value for display
 */
function formatListValue(value, field = null) {
  // If not a list value, return the value as is
  if (!isListRowValue(value)) {
    return value !== null && value !== undefined ? String(value) : '';
  }

  const rowData = value.rowData;
  if (!rowData || typeof rowData !== 'object') {
    return '[Liste: données invalides]';
  }

  // If we have the field with displayColumnId, use this column
  if (field?.displayColumnId && rowData[field.displayColumnId] !== undefined) {
    return String(rowData[field.displayColumnId]);
  }

  // Otherwise, try to find a default display column
  // Priority: look for common columns like "name", "label", "title", "nom", "libellé"
  const commonDisplayColumns = ['name', 'label', 'title', 'nom', 'libellé', 'libelle', 'value', 'valeur'];
  for (const colName of commonDisplayColumns) {
    if (rowData[colName] !== undefined && rowData[colName] !== null && rowData[colName] !== '') {
      return String(rowData[colName]);
    }
  }

  // If no display column found, format all columns
  const entries = Object.entries(rowData)
    .filter(([_, val]) => val !== null && val !== undefined && val !== '')
    .map(([key, val]) => `${key}: ${String(val)}`);

  if (entries.length > 0) {
    // If only one column, return just its value
    if (entries.length === 1) {
      return entries[0].split(': ')[1];
    }
    // Otherwise, return all columns formatted
    return `{${entries.join(', ')}}`;
  }

  return '[Liste: aucune donnée]';
}

/**
 * Formats a value for AI (analysis)
 * Returns a complete textual representation of the list value
 * @param {any} value - The value to format
 * @param {Object} field - The form field (optional)
 * @returns {string} - The formatted value for AI
 */
function formatListValueForAI(value, field = null) {
  // If not a list value, return the value as is
  if (!isListRowValue(value)) {
    if (value === null || value === undefined) {
      return 'Non renseigné';
    }
    if (typeof value === 'boolean') {
      return value ? 'Oui' : 'Non';
    }
    return String(value);
  }

  const rowData = value.rowData;
  if (!rowData || typeof rowData !== 'object') {
    return '[Liste: données invalides]';
  }

  // For AI, we want all data from the row formatted in a readable way
  const entries = Object.entries(rowData)
    .filter(([_, val]) => val !== null && val !== undefined && val !== '')
    .map(([key, val]) => {
      const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `${key}: ${formattedVal}`;
    });

  if (entries.length > 0) {
    // If we have a display column, put it first
    if (field?.displayColumnId && rowData[field.displayColumnId] !== undefined) {
      const displayValue = String(rowData[field.displayColumnId]);
      const otherEntries = entries.filter(
        ([key]) => key !== field.displayColumnId
      );
      if (otherEntries.length > 0) {
        return `${displayValue} (${otherEntries.map(([k, v]) => `${k}=${v}`).join(', ')})`;
      }
      return displayValue;
    }

    // Otherwise, return all columns formatted
    return entries.map(([k, v]) => `${k}=${v}`).join(', ');
  }

  return '[Liste: aucune donnée]';
}

/**
 * Formats a generic field value (handles lists and other types)
 * @param {any} value - The value to format
 * @param {Object} field - The form field (optional)
 * @param {boolean} forAI - If true, uses formatListValueForAI, otherwise formatListValue
 * @returns {string} - The formatted value
 */
function formatFieldValue(value, field = null, forAI = false) {
  if (isListRowValue(value)) {
    return forAI ? formatListValueForAI(value, field) : formatListValue(value, field);
  }

  if (value === null || value === undefined) {
    return forAI ? 'Non renseigné' : '-';
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  if (typeof value === 'object') {
    // For other objects (files, etc.), return a representation
    if ('uploaded' in value && value.uploaded) {
      return value.fileName || '[Fichier]';
    }
    // For generic objects, try to format them
    try {
      return JSON.stringify(value);
    } catch {
      return '[Objet]';
    }
  }

  return String(value);
}

export {
  isListRowValue,
  formatListValue,
  formatListValueForAI,
  formatFieldValue
};

