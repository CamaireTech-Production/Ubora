import React from 'react';
import { FormField } from '../../../types';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Plus } from 'lucide-react';
import { DesktopRecommendationInfo } from '../../core/DesktopRecommendationInfo';
import { FormFieldList } from './FormFieldList';

interface FormFieldsManagerProps {
  fields: FormField[];
  onAddField: () => void;
  onRemoveField: (fieldId: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<FormField>) => void;
  onMoveField?: (fieldId: string, direction: 'up' | 'down') => void;
  canUseFileUploads: boolean;
  availableLists: any[];
  onFileUploadsUpgrade?: () => void;
  userRole?: string;
  hasDirectorDashboardAccess?: boolean;
}

export const FormFieldsManager: React.FC<FormFieldsManagerProps> = ({
  fields,
  onAddField,
  onRemoveField,
  onUpdateField,
  onMoveField,
  canUseFileUploads,
  availableLists,
  onFileUploadsUpgrade,
  userRole,
  hasDirectorDashboardAccess
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-medium text-gray-900">Champs du formulaire</h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddField}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Ajouter un champ</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </div>

      {/* Desktop Recommendation - Show when any field has conditional logic enabled */}
      {fields.some(field => field.conditionalLogic?.isEnabled) && (
        <DesktopRecommendationInfo className="mb-4" />
      )}

      {!canUseFileUploads && (
        <div className="mb-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          {/* Role-specific messages */}
          {userRole === 'directeur' ? (
            <>
              <strong>📁 Téléversements de fichiers indisponibles :</strong> Les téléchargements de fichiers (images/PDF) sont disponibles à partir du package Starter. 
              {onFileUploadsUpgrade && (
                <div className="mt-2">
                  <button 
                    onClick={onFileUploadsUpgrade}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Mettre à niveau vers Starter →
                  </button>
                </div>
              )}
            </>
          ) : userRole === 'employe' && hasDirectorDashboardAccess ? (
            <>
              <strong>💡 Contactez votre directeur :</strong> En tant qu'employé avec accès directeur, vous ne pouvez pas effectuer de paiements. 
              Veuillez contacter votre directeur pour mettre à niveau le package et activer les téléversements de fichiers.
            </>
          ) : (
            <>
              <strong>💡 Contactez votre directeur :</strong> Les téléversements de fichiers ne sont pas disponibles pour votre rôle. 
              Veuillez contacter votre directeur pour activer cette fonctionnalité.
            </>
          )}
        </div>
      )}

      <FormFieldList
        fields={fields}
        onRemoveField={onRemoveField}
        onUpdateField={onUpdateField}
        onMoveField={onMoveField}
        canUseFileUploads={canUseFileUploads}
        availableLists={availableLists}
        loadingLists={false}
      />
    </div>
  );
};

