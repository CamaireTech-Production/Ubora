import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { logger } from '@ubora/shared/utils/logger';
import { useEntries } from '@ubora/shared/contexts/EntriesContext';
import { useUnivers } from '@ubora/shared/contexts/UniversContext';
import { useDashboards } from '@ubora/shared/contexts/DashboardsContext';
import { Layout } from '../../components/layout/Layout';
import { Report, ReportDefinition, DashboardDefinition } from '../../types';
import { reportsService } from '@ubora/shared/services';
import { universService } from '@ubora/shared/services/universService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ReportPreview } from '../../components/reports/ReportPreview';
import { FileBarChart, Calendar, Download, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formEntries } = useEntries();
  const { activeUniversId } = useUnivers();
  const { dashboards } = useDashboards();
  const { toast, showSuccess, showError } = useToast();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Time filter state
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });

  useEffect(() => {
    if (user?.id && user?.agencyId) {
      loadReports();
    }
  }, [user, activeUniversId]);

  const loadReports = async () => {
    if (!user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const allReports: Report[] = [];

      // 1. Load reports from Firestore (reports collection)
      try {
        const userReports = await reportsService.getByUser(
          user.id,
          user.agencyId,
          user.role,
          activeUniversId || null
        );
        allReports.push(...userReports);
      } catch (error) {
        logger.error('Erreur lors du chargement des rapports Firestore', error, 'ReportsPage');
      }

      // 2. Load reports from active Univers definitions (like UniversViewPage does)
      if (activeUniversId) {
        try {
          const univers = await universService.getById(activeUniversId);
          if (univers && univers.definitions.reports && univers.definitions.reports.length > 0) {
            // Convert ReportDefinition[] to Report[]
            const universReports: Report[] = univers.definitions.reports.map((reportDef: ReportDefinition): Report => ({
              id: reportDef.id,
              name: reportDef.name,
              description: reportDef.description,
              templateType: reportDef.templateType,
              templateContent: reportDef.templateContent,
              templateFileUrl: reportDef.templateFileUrl,
              templateFileStoragePath: reportDef.templateFileStoragePath,
              templateFileName: reportDef.templateFileName,
              placeholders: reportDef.placeholders || [],
              mappings: reportDef.mappings || [],
              createdBy: user.id,
              createdByRole: user.role === 'employe' ? 'employe' : 'directeur',
              createdByEmployeeId: user.role === 'employe' ? user.id : undefined,
              agencyId: user.agencyId,
              universId: activeUniversId,
              universInstanceId: null,
              fromUnivers: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }));
            allReports.push(...universReports);
          }
        } catch (error) {
          logger.error('Erreur lors du chargement des rapports du Univers', error, 'ReportsPage');
        }
      }

      // Remove duplicates based on ID
      const uniqueReports = Array.from(
        new Map(allReports.map(report => [report.id, report])).values()
      );

      setReports(uniqueReports);
    } catch (error) {
      logger.error('Erreur lors du chargement des rapports', error, 'ReportsPage');
      const errorMessage = error instanceof Error 
        ? `Erreur lors du chargement: ${error.message}`
        : 'Erreur lors du chargement des rapports. Veuillez réessayer.';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Get date range based on time filter
  const getDateRange = (filter: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: today };
      case 'last7days':
        return { start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'last30days':
        return { start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'last90days':
        return { start: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'thisMonth':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      case 'lastMonth':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: startOfLastMonth, end: endOfLastMonth };
      case 'thisYear':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
        return { start: startOfYear, end: endOfYear };
      case 'custom':
        return {
          start: customDateRange.start ? new Date(customDateRange.start) : null,
          end: customDateRange.end ? new Date(customDateRange.end + 'T23:59:59') : null
        };
      default:
        return { start: null, end: null }; // All time
    }
  };

  // Get filtered form entries based on time filter
  const getFilteredFormEntries = () => {
    const { start, end } = getDateRange(timeFilter);
    
    if (!start && !end) {
      return formEntries; // All time
    }
    
    return formEntries.filter(entry => {
      const submitted = entry.submittedAt as any;
      if (!submitted) {
        return false;
      }
      const entryDate: Date =
        typeof submitted?.toDate === 'function' ? submitted.toDate() : new Date(submitted);
      
      if (start && end) {
        return entryDate >= start && entryDate <= end;
      } else if (start) {
        return entryDate >= start;
      } else if (end) {
        return entryDate <= end;
      }
      return true;
    });
  };

  const handlePreview = (report: Report) => {
    setSelectedReport(report);
    setShowPreview(true);
  };

  const handleEdit = (report: Report) => {
    // Navigate to report editor (to be implemented)
    navigate(`/reports/${report.id}/edit`);
  };

  const handleDelete = (report: Report) => {
    setReportToDelete(report);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!reportToDelete) return;

    setIsDeleting(true);
    try {
      await reportsService.delete(reportToDelete.id);
      showSuccess('Rapport supprimé avec succès');
      setReports(reports.filter(r => r.id !== reportToDelete.id));
      setShowDeleteModal(false);
      setReportToDelete(null);
    } catch (error) {
      logger.error('Erreur lors de la suppression du rapport', error, 'ReportsPage');
      showError('Erreur lors de la suppression du rapport. Veuillez réessayer.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerate = (report: Report) => {
    // Navigate to report generation page (to be implemented)
    navigate(`/reports/${report.id}/generate`);
  };

  const handleDownload = (report: Report) => {
    // Download generated report (to be implemented)
    if (report.templateFileUrl) {
      window.open(report.templateFileUrl, '_blank');
    } else {
      showError('Aucun fichier généré disponible pour ce rapport');
    }
  };

  // Convert Report to ReportDefinition for ReportPreview
  const convertToReportDefinition = (report: Report): ReportDefinition => {
    return {
      id: report.id,
      name: report.name,
      description: report.description,
      templateType: report.templateType,
      templateContent: report.templateContent,
      placeholders: report.placeholders || [],
      mappings: report.mappings || []
    };
  };

  // Convert dashboards to DashboardDefinition format
  const convertDashboards = (): DashboardDefinition[] => {
    return dashboards;
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
                Gérez et prévisualisez vos rapports de l'Univers actif
              </p>
            </div>
          </div>

          {/* Time Filter */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <label className="text-sm font-medium text-gray-700">Période:</label>
              </div>
              <Select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="w-full sm:w-auto min-w-[200px]"
                options={[
                  { value: 'all', label: 'Toutes les périodes' },
                  { value: 'today', label: "Aujourd'hui" },
                  { value: 'yesterday', label: 'Hier' },
                  { value: 'last7days', label: '7 derniers jours' },
                  { value: 'last30days', label: '30 derniers jours' },
                  { value: 'last90days', label: '90 derniers jours' },
                  { value: 'thisMonth', label: 'Ce mois' },
                  { value: 'lastMonth', label: 'Mois dernier' },
                  { value: 'thisYear', label: 'Cette année' },
                  { value: 'custom', label: 'Personnalisé' }
                ]}
              />
              {timeFilter === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <span className="text-gray-500">à</span>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Loading State */}
          {isLoading ? (
            <Card className="p-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement des rapports...</p>
              </div>
            </Card>
          ) : reports.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <FileBarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Aucun rapport
                </h3>
                <p className="text-gray-600 mb-4">
                  Vous n'avez pas encore de rapports pour cet Univers.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <Card key={report.id} className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {report.name}
                        </h3>
                        {report.fromUnivers && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            Univers
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {report.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {report.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="capitalize">{report.templateType}</span>
                    <span>
                      {new Date(report.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePreview(report)}
                      className="flex items-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Aperçu</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(report)}
                      className="flex items-center space-x-1"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Modifier</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerate(report)}
                      className="flex items-center space-x-1"
                    >
                      <FileBarChart className="h-4 w-4" />
                      <span>Générer</span>
                    </Button>
                    {report.templateFileUrl && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownload(report)}
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-4 w-4" />
                        <span>Télécharger</span>
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(report)}
                      className="flex items-center space-x-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Supprimer</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout>

      {/* Preview Modal */}
      {showPreview && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900">
                Aperçu: {selectedReport.name}
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowPreview(false);
                  setSelectedReport(null);
                }}
              >
                Fermer
              </Button>
            </div>
            <div className="p-6">
              <ReportPreview
                report={convertToReportDefinition(selectedReport)}
                dashboards={convertDashboards()}
                formEntries={getFilteredFormEntries()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setReportToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Supprimer le rapport"
        message={`Êtes-vous sûr de vouloir supprimer le rapport "${reportToDelete?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        isLoading={isDeleting}
      />

      {toast && <Toast {...toast} />}
    </>
  );
};

