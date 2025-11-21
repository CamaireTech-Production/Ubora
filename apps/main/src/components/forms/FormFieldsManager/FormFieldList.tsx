import React from 'react';
import { FormField } from '../../../types';
import { Card } from '../../ui/Card';
import { FormFieldEditor } from './FormFieldEditor';

interface FormFieldListProps {
  fields: FormField[];
  onRemoveField: (fieldId: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<FormField>) => void;
  onMoveField?: (fieldId: string, direction: 'up' | 'down') => void;
  canUseFileUploads: boolean;
  isFileUploadAccessLoading?: boolean;
  availableLists: any[];
  loadingLists?: boolean;
}

export const FormFieldList: React.FC<FormFieldListProps> = ({
  fields,
  onRemoveField,
  onUpdateField,
  onMoveField,
  canUseFileUploads,
  isFileUploadAccessLoading = false,
  availableLists,
  loadingLists = false
}) => {
  if (fields.length === 0) {
    return (
      <p className="text-gray-500 text-center py-6 sm:py-8 bg-gray-50 rounded-lg text-sm sm:text-base">
        Aucun champ ajouté. Cliquez sur "Ajouter un champ" pour commencer.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <Card key={field.id} className="border-l-4 border-l-blue-500">
          <FormFieldEditor
            field={field}
            index={index}
            allFields={fields}
            onUpdate={onUpdateField}
            onRemove={onRemoveField}
            onMove={onMoveField}
            canUseFileUploads={canUseFileUploads}
            isFileUploadAccessLoading={isFileUploadAccessLoading}
            availableLists={availableLists}
            loadingLists={loadingLists}
            canMoveUp={index > 0}
            canMoveDown={index < fields.length - 1}
          />
        </Card>
      ))}
    </div>
  );
};

