import { describe, test, expect } from 'vitest';
import { FormulaParser } from '../FormulaParser';
import { FormField } from '../../types';

describe('FormulaParser', () => {
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
      label: 'Frais',
      type: 'number',
      required: false
    },
    {
      id: 'field4',
      label: 'Total',
      type: 'calculated',
      required: false
    }
  ];

  describe('parseUserFormula', () => {
    test('should parse valid formula with field names', () => {
      const result = FormulaParser.parseUserFormula(
        'prix * quantité + frais',
        mockFields,
        'field4'
      );

      expect(result.isValid).toBe(true);
      expect(result.fieldIds).toContain('field1');
      expect(result.fieldIds).toContain('field2');
      expect(result.fieldIds).toContain('field3');
      expect(result.formulaWithIds).toContain('field1');
      expect(result.formulaWithIds).toContain('field2');
      expect(result.formulaWithIds).toContain('field3');
    });

    test('should return error for empty formula', () => {
      const result = FormulaParser.parseUserFormula('', mockFields, 'field4');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('vide');
    });

    test('should return error for invalid field names', () => {
      const result = FormulaParser.parseUserFormula(
        'prix * invalidField',
        mockFields,
        'field4'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non trouvé');
    });

    test('should exclude current field from dependencies', () => {
      const result = FormulaParser.parseUserFormula(
        'prix * quantité',
        mockFields,
        'field4'
      );

      expect(result.fieldIds).not.toContain('field4');
    });

    test('should return error if formula has no operation', () => {
      const result = FormulaParser.parseUserFormula(
        'prix',
        mockFields,
        'field4'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('opération');
    });

    test('should handle case-insensitive field names', () => {
      const result = FormulaParser.parseUserFormula(
        'PRIX * quantité',
        mockFields,
        'field4'
      );

      expect(result.isValid).toBe(true);
      expect(result.fieldIds).toContain('field1');
    });
  });

  describe('normalizeFieldName', () => {
    test('should normalize field names correctly', () => {
      // Test through parseUserFormula
      const result = FormulaParser.parseUserFormula(
        'prix * quantité',
        mockFields,
        'field4'
      );

      expect(result.isValid).toBe(true);
    });
  });
});

