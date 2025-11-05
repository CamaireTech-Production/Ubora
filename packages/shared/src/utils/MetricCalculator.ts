import { FormEntry, DashboardMetric, Dashboard } from '../types';
import { ExpressionCalculator } from './ExpressionCalculator';

export interface MetricResult {
  value: number | string;
  displayValue: string;
  description: string;
}

export class MetricCalculator {
  /**
   * Calculate metric value based on form entries and metric configuration
   * Supports both field-based and computed metrics
   */
  static calculateMetric(
    metric: DashboardMetric,
    formEntries: FormEntry[],
    dashboard?: Dashboard
  ): MetricResult {
    // Check if this is a computed metric
    if (metric.sourceType === 'computed') {
      return this.calculateComputedMetric(metric, formEntries, dashboard);
    }

    // Default behavior: field-based metric
    if (!metric.formId || !metric.fieldId) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Configuration de métrique invalide'
      };
    }

    // Filter entries for the specific form
    const relevantEntries = formEntries.filter(entry => entry.formId === metric.formId);
    
    if (relevantEntries.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune donnée disponible'
      };
    }

    // Extract values for the specific field
    const fieldValues = relevantEntries
      .map(entry => entry.answers[metric.fieldId])
      .filter(value => value !== null && value !== undefined && value !== '');

    if (fieldValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur pour ce champ'
      };
    }

    switch (metric.calculationType) {
      case 'count':
        return this.calculateCount(fieldValues, relevantEntries.length);
      
      case 'sum':
        return this.calculateSum(fieldValues);
      
      case 'average':
        return this.calculateAverage(fieldValues);
      
      case 'min':
        return this.calculateMin(fieldValues);
      
      case 'max':
        return this.calculateMax(fieldValues);
      
      case 'unique':
        return this.calculateUnique(fieldValues);
      
      default:
        return {
          value: 0,
          displayValue: '0',
          description: 'Type de calcul non supporté'
        };
    }
  }

  /**
   * Calculate computed metric value from other metrics
   */
  private static calculateComputedMetric(
    metric: DashboardMetric,
    formEntries: FormEntry[],
    dashboard?: Dashboard
  ): MetricResult {
    if (!metric.calculationFormula || !dashboard) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Formule de calcul manquante'
      };
    }

    try {
      // Calculate all source metrics first
      const metricValues: Record<string, number> = {};
      
      if (metric.dependsOn) {
        for (const depMetricId of metric.dependsOn) {
          const depMetric = dashboard.metrics.find(m => m.id === depMetricId);
          if (!depMetric) {
            return {
              value: 0,
              displayValue: '0',
              description: `Métrique source manquante (ID: ${depMetricId})`
            };
          }

          // Recursively calculate the dependent metric
          const depResult = this.calculateMetric(depMetric, formEntries, dashboard);
          const numericValue = this.getNumericValue(depResult.value);
          metricValues[depMetricId] = numericValue;
        }
      }

      // Evaluate the formula using ExpressionCalculator
      // We need to create a mock form fields array for ExpressionCalculator
      // But we'll use the metric IDs directly as values
      const formula = metric.calculationFormula;
      let processedFormula = formula;

      // Replace metric IDs with their calculated values
      Object.keys(metricValues).forEach(metricId => {
        const regex = new RegExp(`\\b${metricId}\\b`, 'g');
        processedFormula = processedFormula.replace(regex, metricValues[metricId].toString());
      });

      // Replace mathematical functions and evaluate
      processedFormula = this.replaceMathematicalFunctions(processedFormula);
      const result = this.safeEvaluate(processedFormula);

      if (isNaN(result)) {
        return {
          value: 0,
          displayValue: '0',
          description: 'Erreur dans le calcul de la formule'
        };
      }

      return {
        value: result,
        displayValue: this.formatNumber(result),
        description: `Calculé à partir de ${metric.dependsOn?.length || 0} métrique(s)`
      };
    } catch (error) {
      console.error('Error calculating computed metric:', error);
      return {
        value: 0,
        displayValue: '0',
        description: 'Erreur lors du calcul'
      };
    }
  }

  /**
   * Get numeric value from any metric result value
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

    return 0;
  }

  /**
   * Replace mathematical functions in formula
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

  private static calculateCount(fieldValues: any[], totalEntries: number): MetricResult {
    const count = fieldValues.length;
    return {
      value: count,
      displayValue: count.toString(),
      description: `${count} soumission${count > 1 ? 's' : ''} sur ${totalEntries} total`
    };
  }

  private static calculateSum(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num !== 0);

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    return {
      value: sum,
      displayValue: this.formatNumber(sum),
      description: `Somme de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateAverage(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num !== 0);

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const average = sum / numericValues.length;
    
    return {
      value: average,
      displayValue: this.formatNumber(average),
      description: `Moyenne de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateMin(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? null : num;
      })
      .filter(num => num !== null) as number[];

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const min = Math.min(...numericValues);
    return {
      value: min,
      displayValue: this.formatNumber(min),
      description: `Minimum de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateMax(fieldValues: any[]): MetricResult {
    const numericValues = fieldValues
      .map(value => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? null : num;
      })
      .filter(num => num !== null) as number[];

    if (numericValues.length === 0) {
      return {
        value: 0,
        displayValue: '0',
        description: 'Aucune valeur numérique valide'
      };
    }

    const max = Math.max(...numericValues);
    return {
      value: max,
      displayValue: this.formatNumber(max),
      description: `Maximum de ${numericValues.length} valeur${numericValues.length > 1 ? 's' : ''}`
    };
  }

  private static calculateUnique(fieldValues: any[]): MetricResult {
    const uniqueValues = [...new Set(fieldValues.map(value => String(value)))];
    return {
      value: uniqueValues.length,
      displayValue: uniqueValues.length.toString(),
      description: `${uniqueValues.length} valeur${uniqueValues.length > 1 ? 's' : ''} unique${uniqueValues.length > 1 ? 's' : ''}`
    };
  }

  private static formatNumber(num: number): string {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2);
  }

  /**
   * Get calculation options for a field type
   */
  static getCalculationOptions(fieldType: string): Array<{ value: string; label: string }> {
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'textarea':
      case 'select':
      case 'checkbox':
      case 'date':
      case 'file':
        return [
          { value: 'count', label: 'Nombre de soumissions' },
          { value: 'unique', label: 'Valeurs uniques' }
        ];
      case 'number':
      case 'calculated':
        return [
          { value: 'count', label: 'Nombre de soumissions' },
          { value: 'sum', label: 'Somme' },
          { value: 'average', label: 'Moyenne' },
          { value: 'min', label: 'Minimum' },
          { value: 'max', label: 'Maximum' },
          { value: 'unique', label: 'Valeurs uniques' }
        ];
      default:
        return [{ value: 'count', label: 'Nombre de soumissions' }];
    }
  }
}

