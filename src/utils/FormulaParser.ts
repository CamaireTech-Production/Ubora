import { FormField } from '../types';

export interface FormulaParseResult {
  isValid: boolean;
  error?: string;
  fieldIds: string[];
  formulaWithIds: string;
  userFormula: string;
}

export class FormulaParser {
  /**
   * Parse user-friendly formula and convert to field IDs
   * @param userFormula - User input formula (e.g., "prix * quantité + frais")
   * @param fields - Available form fields
   * @param currentFieldId - ID of the current calculated field (to exclude from dependencies)
   * @returns Parse result with validation and converted formula
   */
  static parseUserFormula(
    userFormula: string, 
    fields: FormField[], 
    currentFieldId: string
  ): FormulaParseResult {
    if (!userFormula || !userFormula.trim()) {
      return {
        isValid: false,
        error: 'La formule ne peut pas être vide',
        fieldIds: [],
        formulaWithIds: '',
        userFormula: ''
      };
    }

    try {
      // Get available fields for calculation (exclude current field and non-calculable types)
      const availableFields = fields.filter(field => 
        field.id !== currentFieldId && 
        ['number', 'calculated'].includes(field.type)
      );

      const fieldIds: string[] = [];
      let formulaWithIds = userFormula.trim();

      // Find and replace field references
      availableFields.forEach(field => {
        const fieldName = this.normalizeFieldName(field.label);
        const regex = new RegExp(`\\b${fieldName}\\b`, 'gi');
        
        if (regex.test(formulaWithIds)) {
          fieldIds.push(field.id);
          formulaWithIds = formulaWithIds.replace(regex, field.id);
        }
      });

      // Validate that all field references are valid
      // Extract words that are not numbers or operators (only field names and functions)
      const words = userFormula.toLowerCase().match(/\b[a-z][a-z0-9]*\b/g) || [];
      const fieldNames = availableFields.map(f => this.normalizeFieldName(f.label));
      const invalidWords = words.filter(word => 
        !fieldNames.includes(word) && 
        !this.isMathematicalFunction(word)
      );

      if (invalidWords.length > 0) {
        return {
          isValid: false,
          error: `Champ(s) non trouvé(s): ${invalidWords.join(', ')}`,
          fieldIds: [],
          formulaWithIds: '',
          userFormula
        };
      }

      // Validate that the formula has at least one operation
      const hasOperation = this.hasMathematicalOperation(userFormula);
      if (!hasOperation) {
        return {
          isValid: false,
          error: 'La formule doit contenir au moins une opération (+, -, *, /)',
          fieldIds: [],
          formulaWithIds: '',
          userFormula
        };
      }

      // Test the formula with dummy values
      const testResult = this.testFormula(formulaWithIds, fieldIds);
      if (!testResult.isValid) {
        return {
          isValid: false,
          error: testResult.error || 'Formule invalide',
          fieldIds: [],
          formulaWithIds: '',
          userFormula
        };
      }

      return {
        isValid: true,
        fieldIds,
        formulaWithIds,
        userFormula
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Erreur lors de l\'analyse de la formule',
        fieldIds: [],
        formulaWithIds: '',
        userFormula
      };
    }
  }

  /**
   * Convert formula with field IDs back to user-friendly format
   * @param formulaWithIds - Formula with field IDs
   * @param fields - Available form fields
   * @returns User-friendly formula
   */
  static convertToUserFormula(formulaWithIds: string, fields: FormField[]): string {
    if (!formulaWithIds) return '';

    let userFormula = formulaWithIds;

    // Replace field IDs with field names
    fields.forEach(field => {
      const fieldName = this.normalizeFieldName(field.label);
      const regex = new RegExp(`\\b${field.id}\\b`, 'g');
      userFormula = userFormula.replace(regex, fieldName);
    });

    return userFormula;
  }

  /**
   * Normalize field name for matching (remove special characters, lowercase)
   * @param fieldLabel - Field label
   * @returns Normalized field name
   */
  private static normalizeFieldName(fieldLabel: string): string {
    return fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Check if a word is a mathematical function
   * @param word - Word to check
   * @returns True if it's a mathematical function
   */
  private static isMathematicalFunction(word: string): boolean {
    const functions = ['sum', 'avg', 'max', 'min', 'abs', 'round', 'floor', 'ceil'];
    return functions.includes(word.toLowerCase());
  }

  /**
   * Check if a word is a number (including decimals and negative numbers)
   * @param word - Word to check
   * @returns True if it's a number
   */
  private static isNumber(word: string): boolean {
    // Handle negative numbers, decimals, and scientific notation
    return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(word) && !isNaN(parseFloat(word)) && isFinite(parseFloat(word));
  }

  /**
   * Check if the formula contains at least one mathematical operation
   * @param formula - Formula to check
   * @returns True if it contains at least one operation
   */
  private static hasMathematicalOperation(formula: string): boolean {
    // Check for basic operators
    const hasBasicOperator = /[+\-*/]/.test(formula);
    
    // Check for mathematical functions
    const hasFunction = /(sum|avg|max|min|abs|round|floor|ceil)\s*\(/i.test(formula);
    
    return hasBasicOperator || hasFunction;
  }

  /**
   * Test formula with dummy values to ensure it's valid
   * @param formula - Formula to test
   * @param fieldIds - Field IDs used in the formula
   * @returns Test result
   */
  private static testFormula(formula: string, fieldIds: string[]): { isValid: boolean; error?: string } {
    try {
      // Create dummy values for all field IDs
      const dummyValues: Record<string, number> = {};
      fieldIds.forEach(fieldId => {
        dummyValues[fieldId] = 1; // Use 1 as dummy value
      });

      // Replace field IDs with dummy values
      let testFormula = formula;
      fieldIds.forEach(fieldId => {
        const regex = new RegExp(`\\b${fieldId}\\b`, 'g');
        testFormula = testFormula.replace(regex, '1');
      });

      // Replace mathematical functions
      testFormula = this.replaceMathematicalFunctions(testFormula);

      // Safely evaluate the expression
      const result = this.safeEvaluate(testFormula);
      
      if (isNaN(result)) {
        return { isValid: false, error: 'La formule produit un résultat invalide' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Formule invalide' };
    }
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
   * Get field suggestions for formula building
   * @param fields - Available form fields
   * @param currentFieldId - Current field ID to exclude
   * @returns Array of field suggestions
   */
  static getFieldSuggestions(fields: FormField[], currentFieldId: string): Array<{
    id: string;
    label: string;
    normalizedName: string;
    type: string;
  }> {
    return fields
      .filter(field => 
        field.id !== currentFieldId && 
        ['number', 'calculated'].includes(field.type)
      )
      .map(field => ({
        id: field.id,
        label: field.label,
        normalizedName: this.normalizeFieldName(field.label),
        type: field.type
      }));
  }

  /**
   * Generate formula suggestions based on common patterns
   * @param fieldSuggestions - Available field suggestions
   * @returns Array of formula suggestions
   */
  static getFormulaSuggestions(fieldSuggestions: Array<{ id: string; label: string; normalizedName: string }>): Array<{
    label: string;
    formula: string;
    description: string;
  }> {
    if (fieldSuggestions.length === 0) return [];

    const suggestions = [];

    // Simple addition
    if (fieldSuggestions.length >= 2) {
      suggestions.push({
        label: 'Addition simple',
        formula: `${fieldSuggestions[0].normalizedName} + ${fieldSuggestions[1].normalizedName}`,
        description: 'Addition de deux champs'
      });
    }

    // Multiplication
    if (fieldSuggestions.length >= 2) {
      suggestions.push({
        label: 'Multiplication',
        formula: `${fieldSuggestions[0].normalizedName} * ${fieldSuggestions[1].normalizedName}`,
        description: 'Multiplication de deux champs'
      });
    }

    // Percentage calculation
    if (fieldSuggestions.length >= 1) {
      suggestions.push({
        label: 'Pourcentage (10%)',
        formula: `${fieldSuggestions[0].normalizedName} * 0.1`,
        description: 'Calcul de 10% d\'un champ'
      });
    }

    // Addition with constant
    if (fieldSuggestions.length >= 1) {
      suggestions.push({
        label: 'Addition avec constante',
        formula: `${fieldSuggestions[0].normalizedName} + 100`,
        description: 'Ajouter une valeur fixe'
      });
    }

    // Multiplication with constant
    if (fieldSuggestions.length >= 1) {
      suggestions.push({
        label: 'Multiplication avec constante',
        formula: `${fieldSuggestions[0].normalizedName} * 1.2`,
        description: 'Multiplier par une valeur fixe'
      });
    }

    // Average calculation
    if (fieldSuggestions.length >= 2) {
      suggestions.push({
        label: 'Moyenne',
        formula: `(${fieldSuggestions[0].normalizedName} + ${fieldSuggestions[1].normalizedName}) / 2`,
        description: 'Moyenne de deux champs'
      });
    }

    return suggestions;
  }
}
