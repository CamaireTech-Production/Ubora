import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { ReportsList } from '../components/ReportsList';
import { Report } from '../types';
import { reportService } from '../services/reportService';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showSuccess, showError } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user?.id && user?.agencyId) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    if (!user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      // Load all reports for the agency
      const agencyReports = await reportService.getByAgency(user.agencyId);
      setReports(agencyReports);
    } catch (error) {
      console.error('Erreur lors du chargement des rapports:', error);
      showError('Erreur lors du chargement des rapports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/reports/create');
  };

  const handleEdit = (report: Report) => {
    navigate(`/reports/${report.id}/edit`);
  };

  const handleView = (report: Report) => {
    navigate(`/reports/${report.id}`);
  };

  const handleDelete = (reportId: string) => {
    const reportToDeleteItem = reports.find(r => r.id === reportId);
    if (reportToDeleteItem) {
      setReportToDelete({
        id: reportId,
        name: reportToDeleteItem.name
      });
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!reportToDelete) return;

    setIsDeleting(true);
    try {
      await reportService.delete(reportToDelete.id);
      showSuccess('Rapport supprimé avec succès');
      setShowDeleteModal(false);
      setReportToDelete(null);
      await loadReports();
    } catch (error) {
      console.error('Erreur lors de la suppression du rapport:', error);
      showError('Erreur lors de la suppression du rapport');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user?.id || !user?.agencyId) {
    return (
      <Layout title="Rapports">
        <div className="text-center py-12">
          <p className="text-gray-600">Chargement...</p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout title="Rapports">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gérez vos rapports personnalisés avec templates PDF, Word ou texte
              </p>
            </div>
          </div>

          <ReportsList
            reports={reports}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            onCreate={handleCreate}
            currentUserId={user.id}
            isLoading={isLoading}
          />
        </div>
      </Layout>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setReportToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Supprimer le rapport"
        message={`Êtes-vous sûr de vouloir supprimer "${reportToDelete?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={isDeleting}
      />

      {toast && <Toast {...toast} />}
    </>
  );
};
