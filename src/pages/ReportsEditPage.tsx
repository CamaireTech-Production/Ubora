import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { ReportEditor } from '../components/ReportEditor';
import { Report } from '../types';
import { reportService } from '../services/reportService';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { WireframeLoader } from '../components/loading/WireframeLoader';

export const ReportsEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast, showSuccess, showError } = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasEditPermission, setHasEditPermission] = useState(false);

  useEffect(() => {
    if (id && user?.id && user?.agencyId) {
      loadReport();
    }
  }, [id, user]);

  const loadReport = async () => {
    if (!id || !user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const reportData = await reportService.getById(id);
      
      if (!reportData) {
        showError('Rapport non trouvé');
        navigate('/reports');
        return;
      }

      setReport(reportData);

      // Check edit permissions (only creator can edit)
      const canEdit = reportData.createdBy === user.id || user.role === 'admin';
      setHasEditPermission(canEdit);
      
      if (!canEdit) {
        showError('Vous n\'avez pas la permission de modifier ce rapport');
        setTimeout(() => navigate('/reports'), 2000);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du rapport:', error);
      showError('Erreur lors du chargement du rapport');
      navigate('/reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (updatedReport: Report) => {
    showSuccess('Rapport mis à jour avec succès');
    
    // Reload to get updated data
    await loadReport();
    
    // Optionally navigate back to reports page
    // navigate('/reports');
  };

  const handleCancel = () => {
    navigate('/reports');
  };

  if (isLoading) {
    return (
      <Layout title="Modifier le rapport">
        <WireframeLoader type="form" />
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout title="Rapport non trouvé">
        <div className="text-center py-12">
          <p className="text-gray-600">Rapport non trouvé</p>
          <button
            onClick={() => navigate('/reports')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Retour à la liste
          </button>
        </div>
      </Layout>
    );
  }

  if (!hasEditPermission) {
    return (
      <Layout title="Accès refusé">
        <div className="text-center py-12">
          <p className="text-gray-600">Vous n'avez pas la permission de modifier ce rapport</p>
          <button
            onClick={() => navigate('/reports')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Retour à la liste
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout title={`Modifier: ${report.name}`}>
        <ReportEditor
          report={report}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </Layout>

      {toast && <Toast {...toast} />}
    </>
  );
};
