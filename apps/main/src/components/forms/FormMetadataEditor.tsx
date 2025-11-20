import React from 'react';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

interface FormMetadataEditorProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  titleError?: string;
  descriptionError?: string;
}

export const FormMetadataEditor: React.FC<FormMetadataEditorProps> = ({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  titleError,
  descriptionError
}) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Input
        label="Titre du formulaire *"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Ex: Rapport de ventes mensuel"
        required
        error={titleError}
      />

      <Textarea
        label="Description"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Décrivez l'objectif de ce formulaire..."
        error={descriptionError}
      />
    </div>
  );
};

