import { FormEntry, DashboardMetric } from '../types';

export interface MetricResult {
  value: number | string;
  displayValue: string;
  description: string;
}

export class MetricCalculator {
  /**
   * Calculate metric value based on form entries and metric configuration
   */
  static calculateMetric(
    metric: DashboardMetric,
    formEntries: FormEntry[]
  ): MetricResult {
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

