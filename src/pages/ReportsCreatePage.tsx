import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ReportBuilder } from '../components/ReportBuilder';
import { reportService } from '../services/reportService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { Report } from '../types';

export const ReportsCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showSuccess, showError } = useToast();
  const [isCreating, setIsCreating] = useState(false);

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

    setIsCreating(true);
    try {
      // Create report in Firestore
      const reportId = await reportService.create({
        name: reportData.name,
        description: reportData.description,
        templateType: reportData.templateType,
        templateContent: reportData.templateContent,
        templateFileUrl: reportData.templateFileUrl,
        templateFileStoragePath: reportData.templateFileStoragePath,
        templateFileName: reportData.templateFileName,
        placeholders: reportData.placeholders,
        mappings: reportData.mappings,
        createdBy: user.id,
        createdByRole: user.role === 'directeur' ? 'directeur' : 'employe',
        createdByEmployeeId: user.role === 'employe' ? user.id : undefined,
        agencyId: user.agencyId,
        universId: null,
        universInstanceId: null,
        fromUnivers: false
      });

      showSuccess('Rapport créé avec succès');
      
      // Navigate to reports list after a short delay
      setTimeout(() => {
        navigate('/reports', { replace: true });
      }, 500);
    } catch (error) {
      console.error('Erreur lors de la création du rapport:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors de la création du rapport');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    navigate('/reports', { replace: true });
  };

  return (
    <>
      <Layout title="Créer un rapport">
        <ReportBuilder
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isCreating}
        />
      </Layout>

      {toast && <Toast {...toast} />}
    </>
  );
};
