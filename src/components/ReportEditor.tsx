import React, { useState, useEffect } from 'react';
import { Report } from '../types';
import { ReportBuilder } from './ReportBuilder';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { reportService } from '../services/reportService';

interface ReportEditorProps {
  report: Report;
  onSave: (report: Report) => void;
  onCancel: () => void;
}

export const ReportEditor: React.FC<ReportEditorProps> = ({
  report,
  onSave,
  onCancel
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async (reportData: {
    name: string;
    description?: string;
    templateType: 'pdf' | 'word' | 'text';
    templateContent?: string;
    templateFileUrl?: string;
    templateFileStoragePath?: string;
    templateFileName?: string;
    placeholders: any[];
    mappings: any[];
  }) => {
    if (!user?.id || !user?.agencyId) {
      showError('Données utilisateur manquantes');
      return;
    }

    setIsLoading(true);
    try {
      // Update the report in Firestore
      await reportService.update(report.id, {
        name: reportData.name,
        description: reportData.description,
        templateType: reportData.templateType,
        templateContent: reportData.templateContent,
        templateFileUrl: reportData.templateFileUrl,
        templateFileStoragePath: reportData.templateFileStoragePath,
        templateFileName: reportData.templateFileName,
        placeholders: reportData.placeholders,
        mappings: reportData.mappings
      });

      // Fetch updated report
      const updatedReport = await reportService.getById(report.id);
      
      if (updatedReport) {
        onSave(updatedReport);
        showSuccess('Rapport mis à jour avec succès');
      } else {
        throw new Error('Erreur lors de la récupération du rapport mis à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rapport:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du rapport');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ReportBuilder
      initialReport={report}
      onSave={handleSave}
      onCancel={onCancel}
      isLoading={isLoading}
    />
  );
};
