import { FormField } from '../types';

/**
 * Utility functions for validating field types in graph configurations
 */

export interface FieldValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
  suggestedAlternatives?: string[];
}

/**
 * Check if a field type supports mathematical operations (sum, average, min, max)
 */
export function isNumericFieldType(fieldType: string): boolean {
  return ['number', 'calculated'].includes(fieldType);
}

/**
 * Check if a field type supports count operations
 */
export function isCountableFieldType(fieldType: string): boolean {
  return true; // All field types can be counted
}

/**
 * Get available calculation types for a field type
 */
export function getAvailableCalculationTypes(fieldType: string): Array<{ value: string; label: string; description?: string }> {
  switch (fieldType) {
    case 'number':
    case 'calculated':
      return [
        { value: 'count', label: 'Nombre de soumissions', description: 'Compter le nombre de réponses' },
        { value: 'sum', label: 'Somme des valeurs', description: 'Additionner toutes les valeurs numériques' },
        { value: 'average', label: 'Moyenne des valeurs', description: 'Calculer la moyenne des valeurs numériques' },
        { value: 'min', label: 'Valeur minimale', description: 'Trouver la plus petite valeur' },
        { value: 'max', label: 'Valeur maximale', description: 'Trouver la plus grande valeur' },
        { value: 'unique', label: 'Valeurs uniques', description: 'Compter les valeurs distinctes' }
      ];
    case 'text':
    case 'email':
    case 'textarea':
    case 'select':
    case 'checkbox':
    case 'date':
    case 'file':
      return [
        { value: 'count', label: 'Nombre de soumissions', description: 'Compter le nombre de réponses' },
        { value: 'unique', label: 'Valeurs uniques', description: 'Compter les valeurs distinctes' }
      ];
    default:
      return [
        { value: 'count', label: 'Nombre de soumissions', description: 'Compter le nombre de réponses' }
      ];
  }
}

/**
 * Validate if a field can be used for Y-axis with a specific calculation type
 */
export function validateYAxisField(
  field: FormField, 
  calculationType: string, 
  yAxisType: string
): FieldValidationResult {
  // If Y-axis type is 'count', any field is valid
  if (yAxisType === 'count') {
    return { isValid: true };
  }

  // If Y-axis type is 'field', we need to check the calculation type
  if (yAxisType === 'field') {
    if (calculationType === 'sum' || calculationType === 'average' || 
        calculationType === 'min' || calculationType === 'max') {
      
      if (!isNumericFieldType(field.type)) {
        return {
          isValid: false,
          errorMessage: `Le champ "${field.label}" (${field.type}) ne peut pas être utilisé pour ${getCalculationTypeLabel(calculationType)}.`,
          warningMessage: `Seuls les champs numériques (number, calculated) supportent les opérations mathématiques.`,
          suggestedAlternatives: [
            'Utilisez "Nombre de soumissions" pour compter les réponses',
            'Sélectionnez un champ numérique pour effectuer des calculs',
            'Changez le type de calcul vers "count" ou "unique"'
          ]
        };
      }
    }
    
    return { isValid: true };
  }

  return { isValid: true };
}

/**
 * Get filtered fields for Y-axis selection based on calculation type
 */
export function getValidYAxisFields(
  fields: FormField[], 
  calculationType: string, 
  yAxisType: string
): FormField[] {
  if (yAxisType === 'count') {
    return fields; // All fields can be counted
  }

  if (yAxisType === 'field') {
    // For Y-axis field selection, only allow numeric fields
    // This ensures mathematical operations work correctly
    return fields.filter(field => isNumericFieldType(field.type));
  }

  return fields;
}

/**
 * Get human-readable label for calculation type
 */
function getCalculationTypeLabel(calculationType: string): string {
  switch (calculationType) {
    case 'sum': return 'la somme';
    case 'average': return 'la moyenne';
    case 'min': return 'le minimum';
    case 'max': return 'le maximum';
    case 'count': return 'le comptage';
    case 'unique': return 'les valeurs uniques';
    default: return calculationType;
  }
}

/**
 * Get comprehensive error message for invalid field selection
 */
export function getFieldValidationErrorMessage(
  field: FormField, 
  calculationType: string, 
  yAxisType: string
): string {
  const validation = validateYAxisField(field, calculationType, yAxisType);
  
  if (validation.isValid) {
    return '';
  }

  let message = validation.errorMessage || '';
  
  if (validation.warningMessage) {
    message += `\n\n${validation.warningMessage}`;
  }
  
  if (validation.suggestedAlternatives && validation.suggestedAlternatives.length > 0) {
    message += '\n\nSuggestions :';
    validation.suggestedAlternatives.forEach((suggestion, index) => {
      message += `\n${index + 1}. ${suggestion}`;
    });
  }
  
  return message;
}

/**
 * Check if a graph configuration is valid
 */
export function validateGraphConfiguration(
  graphConfig: any,
  selectedField: FormField | null,
  calculationType: string
): FieldValidationResult {
  if (!graphConfig) {
    return { isValid: true };
  }

  // Validate Y-axis field selection
  if (graphConfig.yAxisType === 'field' && graphConfig.yAxisFieldId && selectedField) {
    return validateYAxisField(selectedField, calculationType, graphConfig.yAxisType);
  }

  return { isValid: true };
}
