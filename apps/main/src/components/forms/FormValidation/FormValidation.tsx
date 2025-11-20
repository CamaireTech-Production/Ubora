import React from 'react';
import { FormField } from '../../../types';
import { ValidationRules, ValidationContext } from './ValidationRules';

interface FormValidationProps {
  title: string;
  description: string;
  fields: FormField[];
  assignedTo: string[];
  canUseFileUploads: boolean;
  userRole?: string;
  hasDirectorDashboardAccess?: boolean;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

export const useFormValidation = (props: FormValidationProps) => {
  const validate = React.useCallback((): { isValid: boolean; errors: string[] } => {
    const context: ValidationContext = {
      title: props.title,
      description: props.description,
      fields: props.fields,
      assignedTo: props.assignedTo,
      canUseFileUploads: props.canUseFileUploads,
      userRole: props.userRole,
      hasDirectorDashboardAccess: props.hasDirectorDashboardAccess
    };

    return ValidationRules.validateForm(context);
  }, [props.title, props.description, props.fields, props.assignedTo, props.canUseFileUploads, props.userRole, props.hasDirectorDashboardAccess]);

  React.useEffect(() => {
    if (props.onValidationChange) {
      const result = validate();
      props.onValidationChange(result.isValid, result.errors);
    }
  }, [validate, props.onValidationChange]);

  return { validate };
};

export const FormValidation: React.FC<FormValidationProps> = (props) => {
  const { validate } = useFormValidation(props);
  
  // This component is mainly for hook usage, but can be extended for UI display
  return null;
};

