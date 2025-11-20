import { FormField } from '../../../types';
import { FormulaParser } from '@ubora/shared/utils/FormulaParser';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationContext {
  title: string;
  description: string;
  fields: FormField[];
  assignedTo: string[];
  canUseFileUploads: boolean;
  userRole?: string;
  hasDirectorDashboardAccess?: boolean;
}

export class ValidationRules {
  static validateForm(context: ValidationContext): ValidationResult {
    const errors: string[] = [];

    // Package-based restriction: block file fields for packages without uploads
    if (!context.canUseFileUploads) {
      const hasFileFields = context.fields.some(f => f.type === 'file');
      if (hasFileFields) {
        if (context.userRole === 'directeur') {
          errors.push('Votre package actuel ne permet pas les champs de type Fichier. Supprimez-les ou mettez à niveau votre package vers Starter.');
        } else if (context.userRole === 'employe' && context.hasDirectorDashboardAccess) {
          errors.push('Votre package actuel ne permet pas les champs de type Fichier. Contactez votre directeur pour mettre à niveau le package.');
        } else {
          errors.push('Les champs de type Fichier ne sont pas disponibles pour votre rôle. Contactez votre directeur.');
        }
      }
    }

    // Title validation
    if (!context.title.trim()) {
      errors.push('Le titre du formulaire est obligatoire');
    }

    // Assignment validation
    if (context.assignedTo.length === 0) {
      errors.push('Veuillez sélectionner au moins un employé');
    }

    // Fields validation
    if (context.fields.length === 0) {
      errors.push('Veuillez ajouter au moins un champ au formulaire');
    }

    // Validate that all fields have a label
    const invalidFields = context.fields.filter(field => !field.label.trim());
    if (invalidFields.length > 0) {
      errors.push(`${invalidFields.length} champ(s) n'ont pas de libellé`);
    }

    // Validate that select fields have at least one option OR a listId
    const selectFieldsWithoutOptions = context.fields.filter(field => {
      if (field.type !== 'select') return false;
      // If using a list, check listId and displayColumnId
      if (field.listId !== undefined) {
        // Empty string means list mode selected but no list chosen yet - invalid
        if (field.listId === '') return true;
        // Valid listId but missing displayColumnId - invalid
        if (!field.displayColumnId) return true;
        return false; // Valid list configuration
      }
      // If using manual options, check options array
      return !field.options || field.options.length === 0 || field.options.every(opt => !opt.trim());
    });
    if (selectFieldsWithoutOptions.length > 0) {
      errors.push(`${selectFieldsWithoutOptions.length} liste(s) déroulante(s) n'ont pas d'options ou de liste configurée`);
    }

    // Validate that calculated fields have a formula
    const calculatedFieldsWithoutFormula = context.fields.filter(field => 
      field.type === 'calculated' && !field.calculationFormula?.trim()
    );
    if (calculatedFieldsWithoutFormula.length > 0) {
      errors.push(`${calculatedFieldsWithoutFormula.length} champ(s) calculé(s) n'ont pas de formule`);
    }

    // Validate field dependencies
    const dependencyErrors = FormulaParser.validateFieldDependencies(context.fields);
    errors.push(...dependencyErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

