import { describe, test, expect } from 'vitest';
import { ExpressionCalculator } from '../ExpressionCalculator';
import { FormField } from '../../types';

describe('ExpressionCalculator', () => {
  const mockFields: FormField[] = [
    {
      id: 'field1',
      label: 'Prix',
      type: 'number',
      required: false
    },
    {
      id: 'field2',
      label: 'Quantité',
      type: 'number',
      required: false
    },
    {
      id: 'field3',
      label: 'Total',
      type: 'calculated',
      required: false
    }
  ];

  describe('evaluate', () => {
    test('should evaluate simple addition', () => {
      const formula = 'field1 + field2';
      const values = { field1: 10, field2: 20 };
      
      const result = ExpressionCalculator.evaluate(formula, values, mockFields);
      
      expect(result).toBe(30);
    });

    test('should evaluate multiplication', () => {
      const formula = 'field1 * field2';
      const values = { field1: 5, field2: 4 };
      
      const result = ExpressionCalculator.evaluate(formula, values, mockFields);
      
      expect(result).toBe(20);
    });

    test('should evaluate complex expression', () => {
      const formula = 'field1 * field2 + 10';
      const values = { field1: 3, field2: 4 };
      
      const result = ExpressionCalculator.evaluate(formula, values, mockFields);
      
      expect(result).toBe(22); // 3 * 4 + 10 = 22
    });

    test('should return 0 for empty formula', () => {
      const result = ExpressionCalculator.evaluate('', {}, mockFields);
      
      expect(result).toBe(0);
    });

    test('should handle missing field values', () => {
      const formula = 'field1 + field2';
      const values = { field1: 10 }; // field2 missing
      
      const result = ExpressionCalculator.evaluate(formula, values, mockFields);
      
      expect(result).toBe(10); // field2 treated as 0
    });

    test('should handle string numbers', () => {
      const formula = 'field1 + field2';
      const values = { field1: '10', field2: '20' };
      
      const result = ExpressionCalculator.evaluate(formula, values, mockFields);
      
      expect(result).toBe(30);
    });
  });

  describe('calculateByType', () => {
    test('should calculate sum', () => {
      const field: FormField = {
        id: 'field3',
        label: 'Total',
        type: 'calculated',
        required: false,
        calculationType: 'sum',
        dependsOn: ['field1', 'field2']
      };
      const values = { field1: 10, field2: 20, field3: 0 };
      
      const result = ExpressionCalculator.calculateByType(field, values, mockFields);
      
      expect(result).toBe(30);
    });

    test('should calculate average', () => {
      const field: FormField = {
        id: 'field3',
        label: 'Average',
        type: 'calculated',
        required: false,
        calculationType: 'average',
        dependsOn: ['field1', 'field2']
      };
      const values = { field1: 10, field2: 20, field3: 0 };
      
      const result = ExpressionCalculator.calculateByType(field, values, mockFields);
      
      expect(result).toBe(15); // (10 + 20) / 2
    });

    test('should calculate multiply', () => {
      const field: FormField = {
        id: 'field3',
        label: 'Product',
        type: 'calculated',
        required: false,
        calculationType: 'multiply',
        dependsOn: ['field1', 'field2']
      };
      const values = { field1: 5, field2: 4, field3: 0 };
      
      const result = ExpressionCalculator.calculateByType(field, values, mockFields);
      
      expect(result).toBe(20);
    });

    test('should calculate percentage', () => {
      const field: FormField = {
        id: 'field3',
        label: 'Percentage',
        type: 'calculated',
        required: false,
        calculationType: 'percentage',
        dependsOn: ['field1'],
        constantValue: 20
      };
      const values = { field1: 100, field3: 0 };
      
      const result = ExpressionCalculator.calculateByType(field, values, mockFields);
      
      expect(result).toBe(20); // 100 * 20 / 100
    });

    test('should calculate simple formula', () => {
      const field: FormField = {
        id: 'field3',
        label: 'Total',
        type: 'calculated',
        required: false,
        calculationType: 'simple',
        dependsOn: ['field1', 'field2'],
        calculationFormula: 'field1 + field2'
      };
      const values = { field1: 15, field2: 25, field3: 0 };
      
      const result = ExpressionCalculator.calculateByType(field, values, mockFields);
      
      expect(result).toBe(40);
    });

    test('should return 0 if no calculation type', () => {
      const field: FormField = {
        id: 'field3',
        label: 'Total',
        type: 'calculated',
        required: false
      };
      const values = { field1: 10, field2: 20 };
      
      const result = ExpressionCalculator.calculateByType(field, values, mockFields);
      
      expect(result).toBe(0);
    });

    test('should return 0 if no dependent values', () => {
      const field: FormField = {
        id: 'field3',
        label: 'Total',
        type: 'calculated',
        required: false,
        calculationType: 'sum',
        dependsOn: ['field1', 'field2']
      };
      const values = {}; // No values
      
      const result = ExpressionCalculator.calculateByType(field, values, mockFields);
      
      expect(result).toBe(0);
    });
  });
});

