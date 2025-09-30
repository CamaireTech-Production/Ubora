import { FormField, ConditionalRule } from '../types';

export class ConditionalLogicEvaluator {
  /**
   * Evaluates whether a field should be visible based on its conditional logic
   * @param field The field to evaluate
   * @param formValues Current form values
   * @param allFields All form fields for reference
   * @returns true if field should be visible, false otherwise
   */
  static evaluateFieldVisibility(
    field: FormField,
    formValues: Record<string, unknown>,
    allFields: FormField[]
  ): boolean {
    // If no conditional logic is defined, field is always visible
    if (!field.conditionalLogic || !field.conditionalLogic.isEnabled) {
      console.log(`✅ Field "${field.label}" (${field.id}) - No conditional logic, always visible`);
      return true;
    }

    const { conditions, operator, action } = field.conditionalLogic;

    // If no conditions, field is always visible
    if (!conditions || conditions.length === 0) {
      console.log(`✅ Field "${field.label}" (${field.id}) - No conditions, always visible`);
      return true;
    }

    console.log(`🔍 Evaluating field "${field.label}" (${field.id}):`, {
      conditions,
      operator,
      action,
      formValues
    });

    // Evaluate all conditions
    const conditionResults = conditions.map(condition => 
      this.evaluateCondition(condition, formValues, allFields)
    );

    console.log(`📊 Condition results for "${field.label}":`, conditionResults);

    // Combine results based on operator
    let combinedResult: boolean;
    if (operator === 'and') {
      combinedResult = conditionResults.every(result => result);
    } else {
      combinedResult = conditionResults.some(result => result);
    }

    // Return visibility based on action
    const finalResult = action === 'show' ? combinedResult : !combinedResult;
    console.log(`🎯 Final result for "${field.label}": ${finalResult} (action: ${action}, combined: ${combinedResult})`);
    
    return finalResult;
  }

  /**
   * Evaluates a single condition
   * @param condition The condition to evaluate
   * @param formValues Current form values
   * @param allFields All form fields for reference
   * @returns true if condition is met, false otherwise
   */
  private static evaluateCondition(
    condition: ConditionalRule,
    formValues: Record<string, unknown>,
    allFields: FormField[]
  ): boolean {
    const fieldValue = formValues[condition.fieldId];
    const field = allFields.find(f => f.id === condition.fieldId);

    console.log(`🔍 Evaluating condition:`, {
      condition,
      fieldValue,
      field: field ? { id: field.id, label: field.label, type: field.type } : null
    });

    if (!field) {
      console.warn(`Field with ID ${condition.fieldId} not found`);
      return false;
    }

    // Handle empty/not empty checks
    if (condition.operator === 'is_empty') {
      return this.isEmpty(fieldValue);
    }
    
    if (condition.operator === 'is_not_empty') {
      return !this.isEmpty(fieldValue);
    }

    // For other operators, we need a value to compare against
    if (condition.value === undefined || condition.value === null) {
      console.warn(`Condition value is undefined for operator ${condition.operator}`);
      return false;
    }

    // Convert field value to appropriate type for comparison
    const convertedFieldValue = this.convertValueForComparison(fieldValue, field.type);
    const convertedConditionValue = this.convertValueForComparison(condition.value, field.type);

    switch (condition.operator) {
      case 'equals':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'equals');
      
      case 'not_equals':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'not_equals');
      
      case 'contains':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'contains');
      
      case 'not_contains':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'not_contains');
      
      case 'greater_than':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'greater_than');
      
      case 'less_than':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'less_than');
      
      case 'greater_equal':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'greater_equal');
      
      case 'less_equal':
        return this.compareValues(convertedFieldValue, convertedConditionValue, 'less_equal');
      
      default:
        console.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Converts a value to the appropriate type for comparison
   */
  private static convertValueForComparison(value: unknown, fieldType: string): unknown {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    switch (fieldType) {
      case 'number':
        if (typeof value === 'number') return value;
        if (typeof value === 'string' && value.trim() !== '') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? null : parsed;
        }
        return null;

      case 'checkbox':
        // Accepts boolean, string 'true'/'false', 1/0, or '1'/'0'
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
          const lower = value.trim().toLowerCase();
          if (lower === 'true' || lower === '1') return true;
          if (lower === 'false' || lower === '0') return false;
        }
        return Boolean(value);
      case 'date':
        if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
          const date = new Date(value);
          return isNaN(date.getTime()) ? null : date;
        }
        return null;
      
      default:
        return String(value);
    }
  }

  /**
   * Compares two values based on the operator
   */
  private static compareValues(fieldValue: unknown, conditionValue: unknown, operator: string): boolean {
    console.log(`🔍 Comparing values:`, {
      fieldValue,
      conditionValue,
      operator,
      fieldValueType: typeof fieldValue,
      conditionValueType: typeof conditionValue
    });

    // Handle null/undefined values
    if (fieldValue === null || fieldValue === undefined) {
      const result = operator === 'equals' ? conditionValue === null : false;
      console.log(`📊 Null/undefined fieldValue result: ${result}`);
      return result;
    }

    if (conditionValue === null || conditionValue === undefined) {
      const result = operator === 'equals' ? fieldValue === null : false;
      console.log(`📊 Null/undefined conditionValue result: ${result}`);
      return result;
    }

    let result: boolean;
    switch (operator) {
      case 'equals':
        result = fieldValue === conditionValue;
        break;
      
      case 'not_equals':
        result = fieldValue !== conditionValue;
        break;
      
      case 'contains':
        result = String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        break;
      
      case 'not_contains':
        result = !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        break;
      
      case 'greater_than':
        result = Number(fieldValue) > Number(conditionValue);
        break;
      
      case 'less_than':
        result = Number(fieldValue) < Number(conditionValue);
        break;
      
      case 'greater_equal':
        result = Number(fieldValue) >= Number(conditionValue);
        break;
      
      case 'less_equal':
        result = Number(fieldValue) <= Number(conditionValue);
        break;
      
      default:
        result = false;
    }

    console.log(`📊 Comparison result: ${result}`);
    return result;
  }

  /**
   * Checks if a value is considered empty
   */
  private static isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    
    if (typeof value === 'string') {
      return value.trim() === '';
    }
    
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    
    if (typeof value === 'boolean') {
      return false; // Boolean false is not considered empty
    }
    
    return false;
  }

  /**
   * Gets all fields that should be visible based on current form values
   * @param fields All form fields
   * @param formValues Current form values
   * @returns Array of field IDs that should be visible
   */
  static getVisibleFields(fields: FormField[], formValues: Record<string, unknown>): string[] {
    return fields
      .filter(field => this.evaluateFieldVisibility(field, formValues, fields))
      .map(field => field.id);
  }

  /**
   * Gets all fields that a given field depends on for its conditional logic
   * @param field The field to analyze
   * @returns Array of field IDs that this field depends on
   */
  static getFieldDependencies(field: FormField): string[] {
    if (!field.conditionalLogic || !field.conditionalLogic.isEnabled) {
      return [];
    }

    return field.conditionalLogic.conditions.map(condition => condition.fieldId);
  }

  /**
   * Validates that all referenced fields in conditions exist
   * @param field The field to validate
   * @param allFields All available fields
   * @returns Array of validation errors
   */
  static validateConditionalLogic(field: FormField, allFields: FormField[]): string[] {
    const errors: string[] = [];

    if (!field.conditionalLogic || !field.conditionalLogic.isEnabled) {
      return errors;
    }

    const { conditions } = field.conditionalLogic;

    conditions.forEach((condition, index) => {
      const referencedField = allFields.find(f => f.id === condition.fieldId);
      
      if (!referencedField) {
        errors.push(`Condition ${index + 1}: Field "${condition.fieldId}" not found`);
        return;
      }

      // Validate that the operator is appropriate for the field type
      const validOperators = this.getValidOperatorsForFieldType(referencedField.type);
      if (!validOperators.includes(condition.operator)) {
        errors.push(`Condition ${index + 1}: Operator "${condition.operator}" is not valid for field type "${referencedField.type}"`);
      }

      // Validate that value is provided when needed
      if (!['is_empty', 'is_not_empty'].includes(condition.operator) && 
          (condition.value === undefined || condition.value === null)) {
        errors.push(`Condition ${index + 1}: Value is required for operator "${condition.operator}"`);
      }
    });

    return errors;
  }

  /**
   * Gets valid operators for a given field type
   */
  private static getValidOperatorsForFieldType(fieldType: string): string[] {
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'textarea':
        return ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'];
      
      case 'number':
        return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'is_empty', 'is_not_empty'];
      
      case 'select':
        return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
      
      case 'checkbox':
        return ['equals', 'not_equals'];
      
      case 'date':
        return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'is_empty', 'is_not_empty'];
      
      default:
        return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
    }
  }
}
