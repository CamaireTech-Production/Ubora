import { FormField } from '../types';

export class ExpressionCalculator {
  /**
   * Evaluate a mathematical expression with field values
   * @param formula - The formula to evaluate (e.g., "field1 + field2 * 0.2")
   * @param values - Object containing field values
   * @param fields - Array of form fields for reference
   * @returns The calculated result
   */
  static evaluate(formula: string, values: Record<string, any>, fields: FormField[]): number {
    if (!formula || !formula.trim()) {
      return 0;
    }

    try {
      // Replace field references with actual values
      let processedFormula = formula;
      
      // Replace field IDs with their values
      fields.forEach(field => {
        const fieldValue = values[field.id];
        const numericValue = this.getNumericValue(fieldValue);
        processedFormula = processedFormula.replace(new RegExp(field.id, 'g'), numericValue.toString());
      });

      // Replace common mathematical functions
      processedFormula = this.replaceMathematicalFunctions(processedFormula);

      // Evaluate the expression safely
      return this.safeEvaluate(processedFormula);
    } catch (error) {
      console.error('Error evaluating expression:', error);
      return 0;
    }
  }

  /**
   * Calculate based on calculation type
   * @param field - The calculated field
   * @param values - Current form values
   * @param fields - All form fields
   * @returns The calculated result
   */
  static calculateByType(field: FormField, values: Record<string, any>, fields: FormField[]): number {
    if (!field.calculationType || !field.dependsOn) {
      return 0;
    }

    const dependentValues = field.dependsOn
      .map(fieldId => this.getNumericValue(values[fieldId]))
      .filter(value => !isNaN(value));

    if (dependentValues.length === 0) {
      return 0;
    }

    switch (field.calculationType) {
      case 'sum':
        return dependentValues.reduce((sum, value) => sum + value, 0);

      case 'average':
        return dependentValues.reduce((sum, value) => sum + value, 0) / dependentValues.length;

      case 'multiply':
        return dependentValues.reduce((product, value) => product * value, 1);

      case 'percentage':
        if (field.constantValue && dependentValues.length >= 1) {
          return (dependentValues[0] * field.constantValue) / 100;
        }
        return 0;

      case 'simple':
        if (field.calculationFormula) {
          return this.evaluate(field.calculationFormula, values, fields);
        }
        return 0;

      case 'custom':
        if (field.calculationFormula) {
          return this.evaluate(field.calculationFormula, values, fields);
        }
        return 0;

      default:
        return 0;
    }
  }

  /**
   * Get numeric value from any field value
   * @param value - The field value
   * @returns Numeric value or 0 if not numeric
   */
  private static getNumericValue(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    return 0;
  }

  /**
   * Replace mathematical functions in formula
   * @param formula - The formula string
   * @returns Processed formula
   */
  private static replaceMathematicalFunctions(formula: string): string {
    // Replace SUM function
    formula = formula.replace(/SUM\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      return values.reduce((sum: number, val: number) => sum + val, 0).toString();
    });

    // Replace AVG function
    formula = formula.replace(/AVG\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      const sum = values.reduce((sum: number, val: number) => sum + val, 0);
      return (sum / values.length).toString();
    });

    // Replace MAX function
    formula = formula.replace(/MAX\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      return Math.max(...values).toString();
    });

    // Replace MIN function
    formula = formula.replace(/MIN\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      return Math.min(...values).toString();
    });

    return formula;
  }

  /**
   * Safely evaluate mathematical expression
   * @param expression - The expression to evaluate
   * @returns The result
   */
  private static safeEvaluate(expression: string): number {
    try {
      // Remove any potentially dangerous characters
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      
      // Use Function constructor for safe evaluation
      const result = new Function('return ' + sanitized)();
      
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (error) {
      console.error('Error in safe evaluation:', error);
      return 0;
    }
  }

  /**
   * Validate a calculation formula
   * @param formula - The formula to validate
   * @param fields - Available form fields
   * @returns Validation result
   */
  static validateFormula(formula: string, fields: FormField[]): { isValid: boolean; error?: string } {
    if (!formula || !formula.trim()) {
      return { isValid: false, error: 'La formule ne peut pas être vide' };
    }

    try {
      // Check for valid field references (ignore numbers and mathematical operators)
      const fieldIds = fields.map(f => f.id);
      const fieldReferences = formula.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
      
      for (const reference of fieldReferences) {
        if (!fieldIds.includes(reference) && !this.isMathematicalFunction(reference)) {
          return { isValid: false, error: `Référence de champ invalide: ${reference}` };
        }
      }

      // Test the formula with dummy values
      const dummyValues: Record<string, any> = {};
      fields.forEach(field => {
        dummyValues[field.id] = 1; // Use 1 as dummy value
      });

      const result = this.evaluate(formula, dummyValues, fields);
      
      if (isNaN(result)) {
        return { isValid: false, error: 'La formule produit un résultat invalide' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Formule invalide' };
    }
  }

  /**
   * Check if a string is a mathematical function
   * @param str - String to check
   * @returns True if it's a mathematical function
   */
  private static isMathematicalFunction(str: string): boolean {
    const functions = ['SUM', 'AVG', 'MAX', 'MIN', 'Math', 'Math.abs', 'Math.round', 'Math.floor', 'Math.ceil'];
    return functions.includes(str);
  }

  /**
   * Get available field references for formula building
   * @param fields - Available form fields
   * @returns Array of field references with their types
   */
  static getFieldReferences(fields: FormField[]): Array<{ id: string; label: string; type: string }> {
    return fields
      .filter(field => field.type === 'number' || field.type === 'calculated')
      .map(field => ({
        id: field.id,
        label: field.label,
        type: field.type
      }));
  }

  /**
   * Generate formula suggestions based on calculation type
   * @param calculationType - The type of calculation
   * @param fieldReferences - Available field references
   * @returns Suggested formula
   */
  static getFormulaSuggestion(calculationType: string, fieldReferences: Array<{ id: string; label: string }>): string {
    if (fieldReferences.length === 0) {
      return '';
    }

    switch (calculationType) {
      case 'sum':
        return fieldReferences.map(f => f.id).join(' + ');
      
      case 'average':
        return `AVG(${fieldReferences.map(f => f.id).join(', ')})`;
      
      case 'multiply':
        return fieldReferences.map(f => f.id).join(' * ');
      
      case 'percentage':
        if (fieldReferences.length >= 1) {
          return `${fieldReferences[0].id} * 0.1`; // 10% example
        }
        return '';
      
      case 'custom':
        return fieldReferences.length >= 2 
          ? `${fieldReferences[0].id} + ${fieldReferences[1].id} * 0.2`
          : fieldReferences[0]?.id || '';
      
      default:
        return fieldReferences[0]?.id || '';
    }
  }
}
