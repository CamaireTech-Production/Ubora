import { DashboardMetric } from '../types';

export interface MetricFormulaParseResult {
  isValid: boolean;
  error?: string;
  metricIds: string[];
  formulaWithIds: string;
  userFormula: string;
}

export class MetricFormulaParser {
  /**
   * Parse user-friendly formula and convert to metric IDs
   * @param userFormula - User input formula (e.g., "Ventes + Frais * 0.15")
   * @param metrics - Available dashboard metrics
   * @param currentMetricId - ID of the current computed metric (to exclude from dependencies)
   * @returns Parse result with validation and converted formula
   */
  static parseUserFormula(
    userFormula: string,
    metrics: DashboardMetric[],
    currentMetricId: string
  ): MetricFormulaParseResult {
    if (!userFormula || !userFormula.trim()) {
      return {
        isValid: false,
        error: 'La formule ne peut pas être vide',
        metricIds: [],
        formulaWithIds: '',
        userFormula: ''
      };
    }

    try {
      // Get available numeric metrics for calculation (exclude current metric and non-numeric types)
      // Computed metrics can now be used as dependencies (circular dependencies are detected and prevented)
      const availableMetrics = metrics.filter(metric =>
        metric.id !== currentMetricId &&
        metric.name && metric.name.trim() && // Exclude metrics without names
        this.isNumericMetric(metric)
      );

      const metricIds: string[] = [];
      let formulaWithIds = userFormula.trim();

      // Find and replace metric references
      availableMetrics.forEach(metric => {
        const metricName = this.normalizeMetricName(metric.name);
        const regex = new RegExp(`\\b${metricName}\\b`, 'gi');

        if (regex.test(formulaWithIds)) {
          metricIds.push(metric.id);
          formulaWithIds = formulaWithIds.replace(regex, metric.id);
        }
      });

      // Validate that all metric references are valid
      // Extract words that are not numbers or operators (only metric names and functions)
      const words = userFormula.toLowerCase().match(/\b[a-z][a-z0-9]*\b/g) || [];
      const metricNames = availableMetrics.map(m => this.normalizeMetricName(m.name));
      const invalidWords = words.filter(word =>
        !metricNames.includes(word) &&
        !this.isMathematicalFunction(word)
      );

      if (invalidWords.length > 0) {
        return {
          isValid: false,
          error: `Métrique(s) non trouvée(s): ${invalidWords.join(', ')}`,
          metricIds: [],
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
          metricIds: [],
          formulaWithIds: '',
          userFormula
        };
      }

      // Test the formula with dummy values
      const testResult = this.testFormula(formulaWithIds, metricIds);
      if (!testResult.isValid) {
        return {
          isValid: false,
          error: testResult.error || 'Formule invalide',
          metricIds: [],
          formulaWithIds: '',
          userFormula
        };
      }

      return {
        isValid: true,
        metricIds,
        formulaWithIds,
        userFormula
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Erreur lors de l\'analyse de la formule',
        metricIds: [],
        formulaWithIds: '',
        userFormula
      };
    }
  }

  /**
   * Convert formula with metric IDs back to user-friendly format
   * @param formulaWithIds - Formula with metric IDs
   * @param metrics - Available dashboard metrics
   * @returns User-friendly formula
   */
  static convertToUserFormula(formulaWithIds: string, metrics: DashboardMetric[]): string {
    if (!formulaWithIds) return '';

    let userFormula = formulaWithIds;

    // Replace metric IDs with metric names
    metrics.forEach(metric => {
      const metricName = this.normalizeMetricName(metric.name);
      const regex = new RegExp(`\\b${metric.id}\\b`, 'g');
      userFormula = userFormula.replace(regex, metricName);
    });

    return userFormula;
  }

  /**
   * Check if a metric is numeric (can be used in calculations)
   * Only metrics with numeric calculation types and metricType 'value' are considered numeric
   * @param metric - The metric to check
   * @returns True if metric is numeric
   */
  static isNumericMetric(metric: DashboardMetric): boolean {
    // Computed metrics always produce numeric values, so they can be used in calculations
    if (metric.sourceType === 'computed') {
      return true;
    }
    
    // Only metrics with numeric calculation types can be used in computed metrics
    // count is included because it produces a numeric value (a number)
    // unique is excluded as it's about distinct values, not numeric aggregation
    const numericCalculationTypes = ['count', 'sum', 'average', 'min', 'max'];
    
    // Metric must have metricType 'value' (not graph) to be usable in calculations
    const hasValidMetricType = metric.metricType === 'value' || !metric.metricType;
    
    return numericCalculationTypes.includes(metric.calculationType) && hasValidMetricType;
  }

  /**
   * Normalize metric name for matching (remove special characters, lowercase)
   * @param metricName - Metric name
   * @returns Normalized metric name
   */
  private static normalizeMetricName(metricName: string): string {
    return metricName.toLowerCase().replace(/[^a-z0-9]/g, '');
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
   * @param metricIds - Metric IDs used in the formula
   * @returns Test result
   */
  private static testFormula(formula: string, metricIds: string[]): { isValid: boolean; error?: string } {
    try {
      // Replace metric IDs with dummy values
      let testFormula = formula;
      metricIds.forEach(metricId => {
        const regex = new RegExp(`\\b${metricId}\\b`, 'g');
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
    // Replace SUM function - handle empty arguments
    formula = formula.replace(/SUM\(([^)]*)\)/g, (match, args) => {
      if (!args || !args.trim()) {
        return '0'; // Empty SUM() returns 0
      }
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      return values.reduce((sum: number, val: number) => sum + val, 0).toString();
    });

    // Replace AVG function - handle empty arguments
    formula = formula.replace(/AVG\(([^)]*)\)/g, (match, args) => {
      if (!args || !args.trim()) {
        return '0'; // Empty AVG() returns 0
      }
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      if (values.length === 0) {
        return '0';
      }
      const sum = values.reduce((sum: number, val: number) => sum + val, 0);
      return (sum / values.length).toString();
    });

    // Replace MAX function - handle empty arguments
    formula = formula.replace(/MAX\(([^)]*)\)/g, (match, args) => {
      if (!args || !args.trim()) {
        return '0'; // Empty MAX() returns 0
      }
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      if (values.length === 0) {
        return '0';
      }
      return Math.max(...values).toString();
    });

    // Replace MIN function - handle empty arguments
    formula = formula.replace(/MIN\(([^)]*)\)/g, (match, args) => {
      if (!args || !args.trim()) {
        return '0'; // Empty MIN() returns 0
      }
      const values = args.split(',').map((arg: string) => parseFloat(arg.trim()) || 0);
      if (values.length === 0) {
        return '0';
      }
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
      // First, handle empty or invalid expressions
      if (!expression || !expression.trim()) {
        return 0;
      }

      // Remove any potentially dangerous characters, but keep numbers, operators, parentheses, and decimal points
      // Also allow spaces and handle negative numbers
      const sanitized = expression
        .replace(/[^0-9+\-*/().\s]/g, '') // Remove invalid characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();

      // Check if expression is empty after sanitization
      if (!sanitized || sanitized.length === 0) {
        return 0;
      }

      // Validate that the expression has balanced parentheses
      const openParens = (sanitized.match(/\(/g) || []).length;
      const closeParens = (sanitized.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        console.warn('Unbalanced parentheses in formula:', sanitized);
        return 0;
      }

      // Check for invalid patterns like empty parentheses (), consecutive operators, etc.
      if (sanitized.includes('()') || sanitized.includes('( )')) {
        console.warn('Empty parentheses in formula:', sanitized);
        return 0;
      }

      // Check for invalid operator patterns
      if (/[+\-*/]{2,}/.test(sanitized) || /^[+*/]/.test(sanitized)) {
        console.warn('Invalid operator pattern in formula:', sanitized);
        return 0;
      }

      // Use Function constructor for safe evaluation
      const result = new Function('return ' + sanitized)();

      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (error) {
      console.error('Error in safe evaluation:', error);
      console.error('Expression that caused error:', expression);
      return 0;
    }
  }

  /**
   * Check for circular dependencies in computed metrics
   * @param metricId - The metric ID to check
   * @param metricIds - Dependencies of the metric
   * @param metrics - All dashboard metrics
   * @returns True if circular dependency exists
   */
  static hasCircularDependency(metricId: string, metricIds: string[], metrics: DashboardMetric[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (currentMetricId: string): boolean => {
      if (recursionStack.has(currentMetricId)) {
        return true; // Circular dependency found
      }

      if (visited.has(currentMetricId)) {
        return false; // Already processed
      }

      visited.add(currentMetricId);
      recursionStack.add(currentMetricId);

      const metric = metrics.find(m => m.id === currentMetricId);
      if (metric && metric.sourceType === 'computed' && metric.dependsOn) {
        for (const depId of metric.dependsOn) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(currentMetricId);
      return false;
    };

    // Check if any of the dependencies would create a cycle
    for (const depId of metricIds) {
      if (hasCycle(depId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate all metric dependencies in a dashboard
   * @param metrics - All dashboard metrics
   * @returns Array of validation errors
   */
  static validateMetricDependencies(metrics: DashboardMetric[]): string[] {
    const errors: string[] = [];

    metrics.forEach(metric => {
      if (metric.sourceType === 'computed' && metric.dependsOn) {
        metric.dependsOn.forEach(depId => {
          const depMetric = metrics.find(m => m.id === depId);
          if (!depMetric) {
            errors.push(`La métrique "${metric.name}" dépend d'une métrique supprimée (ID: ${depId})`);
          } else if (!this.isNumericMetric(depMetric)) {
            errors.push(`La métrique "${metric.name}" dépend d'une métrique non numérique ("${depMetric.name}")`);
          }
        });

        // Check for circular dependencies
        if (metric.dependsOn.length > 0 && this.hasCircularDependency(metric.id, metric.dependsOn, metrics)) {
          errors.push(`La métrique "${metric.name}" a une dépendance circulaire`);
        }
      }
    });

    return errors;
  }

  /**
   * Get metric suggestions for formula building
   * @param metrics - Available dashboard metrics
   * @param currentMetricId - Current metric ID to exclude
   * @returns Array of metric suggestions
   */
  static getMetricSuggestions(metrics: DashboardMetric[], currentMetricId: string): Array<{
    id: string;
    name: string;
    normalizedName: string;
    calculationType: string;
  }> {
    return metrics
      .filter(metric =>
        metric.id !== currentMetricId &&
        this.isNumericMetric(metric)
      )
      .map(metric => ({
        id: metric.id,
        name: metric.name,
        normalizedName: this.normalizeMetricName(metric.name),
        calculationType: metric.calculationType
      }));
  }
}

