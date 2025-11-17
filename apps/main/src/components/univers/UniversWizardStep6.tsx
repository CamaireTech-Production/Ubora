import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ReportBuilder } from '../reports/ReportBuilder';
import { ReportDefinition, Dashboard, ReportPlaceholder, ReportMapping } from '../../types';
import { UniversWizardStepProps } from './UniversWizard';
import { Plus, Trash2, Edit, FileBarChart, CheckCircle, AlertCircle, ArrowLeft, FileText } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';

export const UniversWizardStep6: React.FC<UniversWizardStepProps> = ({
  wizardData,
  updateWizardData,
  markStepCompleted,
  markStepSkipped,
  step,
  readOnly = false,
  templateData
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // En mode lecture seule, utiliser les données du template
  const initialReports = readOnly && templateData 
    ? (templateData.definitions.reports || [])
    : ((wizardData.definitions.reports as ReportDefinition[]) || []);

  const [reports, setReports] = useState<ReportDefinition[]>(initialReports);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

  // Sync local state with wizardData when it changes (e.g., after loading from localStorage)
  useEffect(() => {
    const savedReports = (wizardData.definitions.reports as ReportDefinition[]) || [];
    // Only update if the saved reports are different from current reports
    // Check by length first, then by deep comparison if needed
    if (savedReports.length !== reports.length) {
      setReports(savedReports);
    } else if (savedReports.length > 0) {
      // Deep comparison only if arrays have items
      const savedStr = JSON.stringify(savedReports);
      const currentStr = JSON.stringify(reports);
      if (savedStr !== currentStr) {
        setReports(savedReports);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.definitions.reports]);
  
  const universDashboards = useMemo<Dashboard[]>(() => {
    const dashboardDefinitions = (wizardData.definitions.dashboards || []) as any[];
    return dashboardDefinitions.map((dashboardDef): Dashboard => ({
      id: dashboardDef.id,
      name: dashboardDef.name,
      description: dashboardDef.description,
      metrics: dashboardDef.metrics || [],
      createdAt: new Date(),
      createdBy: user?.id || '',
      createdByRole: 'directeur' as const,
      agencyId: user?.agencyId || ''
    }));
  }, [wizardData.definitions.dashboards, user]);

  // Check if dashboards exist (required for reports)
  const hasDashboards = universDashboards.length > 0;
  const hasReports = reports.length > 0;

  // Update wizard data when reports change (seulement si pas en lecture seule)
  useEffect(() => {
    if (!readOnly) {
      updateWizardData({
        definitions: {
          reports: reports
        }
      });

      // Mark step as completed if reports exist (reports are optional but if created, mark as completed)
      if (reports.length > 0) {
        markStepCompleted(step);
      } else {
        markStepSkipped(step);
      }
    } else {
      // En mode lecture seule, marquer comme complété automatiquement
      markStepCompleted(step);
    }
  }, [reports, updateWizardData, markStepCompleted, markStepSkipped, step, readOnly]);

  const handleAddReport = () => {
    if (!hasDashboards) {
      showError('Vous devez créer au moins un tableau de bord avant de créer un rapport');
      return;
    }
    setEditingReportId(null);
    setShowReportBuilder(true);
  };

  const handleEditReport = (reportId: string) => {
    setEditingReportId(reportId);
    setShowReportBuilder(true);
  };

  const handleDeleteReport = (reportId: string) => {
    setReports(reports.filter(r => r.id !== reportId));
    showSuccess('Rapport supprimé');
  };

  const handleSaveReport = (reportData: {
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
    if (editingReportId) {
      // Update existing report
      setReports(reports.map(r => 
        r.id === editingReportId 
          ? {
              ...r,
              name: reportData.name,
              description: reportData.description,
              templateType: reportData.templateType,
              templateContent: reportData.templateContent,
              templateFileUrl: reportData.templateFileUrl,
              templateFileStoragePath: reportData.templateFileStoragePath,
              templateFileName: reportData.templateFileName,
              placeholders: reportData.placeholders,
              mappings: reportData.mappings
            }
          : r
      ));
      showSuccess('Rapport mis à jour');
    } else {
      // Create new report
      const newReport: ReportDefinition = {
        id: `report_${Date.now()}`,
        name: reportData.name,
        description: reportData.description,
        templateType: reportData.templateType,
        templateContent: reportData.templateContent,
        templateFileUrl: reportData.templateFileUrl,
        templateFileStoragePath: reportData.templateFileStoragePath,
        templateFileName: reportData.templateFileName,
        placeholders: reportData.placeholders,
        mappings: reportData.mappings
      };
      setReports([...reports, newReport]);
      showSuccess('Rapport ajouté');
    }
    
    setShowReportBuilder(false);
    setEditingReportId(null);
  };

  const handleCancelReport = () => {
    setShowReportBuilder(false);
    setEditingReportId(null);
  };

  const toggleExpandReport = (reportId: string) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const getEditingReport = (): ReportDefinition | undefined => {
    if (!editingReportId) return undefined;
    return reports.find(r => r.id === editingReportId);
  };

  // En mode lecture seule, afficher une vue en lecture seule
  if (readOnly) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Rapports
          </h2>
          <p className="text-gray-600">
            Aperçu des rapports du Univers template.
          </p>
        </div>

        {/* Reports Display (Read-only) avec détails complets */}
        {reports.length > 0 ? (
          <div className="space-y-4">
            {reports.map(report => (
              <Card key={report.id} className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileBarChart className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
                    </div>
                    {report.description && (
                      <p className="text-sm text-gray-600 mb-3">{report.description}</p>
                    )}
                    {report.templateType && (
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                        {report.templateType.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  {report.placeholders && report.placeholders.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Placeholders ({report.placeholders.length}):</h5>
                      <div className="flex flex-wrap gap-2">
                        {report.placeholders.map((placeholder, phIndex) => (
                          <span key={phIndex} className="px-3 py-1 bg-white border border-indigo-100 rounded-md text-xs">
                            {placeholder.placeholder}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {report.mappings && report.mappings.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Mappings ({report.mappings.length}):</h5>
                      <div className="space-y-2">
                        {report.mappings.map((mapping, mapIndex) => (
                          <div key={mapIndex} className="p-3 bg-white rounded-md border border-indigo-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-900">
                                {mapping.placeholderId} → {mapping.sourceType}: {mapping.sourceId}
                              </span>
                              {mapping.calculationType && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {mapping.calculationType}
                                </span>
                              )}
                            </div>
                            {mapping.fieldId && (
                              <p className="text-xs text-gray-500 mt-1">Champ: {mapping.fieldId}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun rapport dans ce Univers</p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (showReportBuilder) {
    const editingReport = getEditingReport();
    // Convert ReportDefinition to Report for ReportBuilder
    const reportForBuilder = editingReport ? {
      id: editingReport.id,
      name: editingReport.name,
      description: editingReport.description,
      templateType: editingReport.templateType,
      templateContent: editingReport.templateContent,
      templateFileUrl: editingReport.templateFileUrl,
      templateFileStoragePath: editingReport.templateFileStoragePath,
      templateFileName: editingReport.templateFileName,
      placeholders: editingReport.placeholders,
      mappings: editingReport.mappings,
      createdAt: new Date(),
      createdBy: user?.id || '',
      createdByRole: 'directeur' as const,
      agencyId: user?.agencyId || ''
    } : undefined;

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="secondary"
            onClick={handleCancelReport}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            {editingReport ? 'Modifier le rapport' : 'Ajouter un rapport'}
          </h2>
        </div>

        <ReportBuilder
          initialReport={reportForBuilder}
          onSave={handleSaveReport}
          onCancel={handleCancelReport}
          isLoading={false}
          dashboards={universDashboards}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Rapports du Univers">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-full">
          <p className="text-gray-600 mb-4">
                Créez des rapports personnalisés avec des templates PDF, Word ou texte.
                Utilisez des placeholders <code className="bg-gray-100 px-1 rounded">{"{{placeholder}}"}</code> et mappez-les aux données de vos formulaires ou métriques de tableaux de bord.
              </p>
              
              {!hasDashboards && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-700">
                      <p className="font-medium mb-1">Attention</p>
                      <p>Vous devez créer au moins un tableau de bord avant de créer un rapport.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Features list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="flex items-start space-x-3 text-sm text-gray-700">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Templates PDF, Word ou texte</span>
            </div>
            <div className="flex items-start space-x-3 text-sm text-gray-700">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Placeholders <code className="bg-gray-100 px-1 rounded">{"{{placeholder}}"}</code> personnalisables</span>
            </div>
            <div className="flex items-start space-x-3 text-sm text-gray-700">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Mapping automatique aux formulaires et métriques</span>
            </div>
            <div className="flex items-start space-x-3 text-sm text-gray-700">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Génération de rapports dynamiques</span>
            </div>
          </div>

          {/* Add button */}
          <div className="flex items-center justify-between">
            <Button
              onClick={handleAddReport}
              disabled={!hasDashboards}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Ajouter un rapport</span>
            </Button>

            {hasReports && (
              <span className="text-sm text-gray-600">
                {reports.length} rapport{reports.length > 1 ? 's' : ''} créé{reports.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Reports list */}
          {hasReports ? (
            <div className="space-y-3 mt-6">
              {reports.map(report => {
                const isExpanded = expandedReports.has(report.id);
                const mappedPlaceholdersCount = report.mappings.filter(
                  (m: ReportMapping) => report.placeholders.some((p: ReportPlaceholder) => p.id === m.placeholderId)
                ).length;

                return (
                  <div
                    key={report.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex-shrink-0">
                              {report.templateType === 'pdf' ? (
                                <FileText className="h-5 w-5 text-red-500" />
                              ) : report.templateType === 'word' ? (
                                <FileBarChart className="h-5 w-5 text-blue-500" />
                              ) : (
                                <FileBarChart className="h-5 w-5 text-gray-500" />
                              )}
                            </div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">{report.name}</h3>
                          </div>
                          {report.description && (
                            <p className="text-sm text-gray-600 sm:mt-1">{report.description}</p>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">Type:</span>{' '}
                                <span className="text-gray-600">
                                  {report.templateType === 'pdf' ? 'PDF' :
                                   report.templateType === 'word' ? 'Word' : 'Texte'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Placeholders:</span>{' '}
                                <span className="text-gray-600">{report.placeholders.length}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Mappés:</span>{' '}
                                <span className={`font-medium ${
                                  mappedPlaceholdersCount === report.placeholders.length 
                                    ? 'text-green-600' 
                                    : mappedPlaceholdersCount > 0 
                                      ? 'text-yellow-600' 
                                      : 'text-red-600'
                                }`}>
                                  {mappedPlaceholdersCount} / {report.placeholders.length}
                                </span>
                              </div>
                            </div>

                            {report.placeholders.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-700 mb-2">Placeholders:</p>
                                <div className="flex flex-wrap gap-2">
                                  {report.placeholders.slice(0, 10).map((placeholder: ReportPlaceholder) => (
                                    <code
                                      key={placeholder.id}
                                      className="bg-gray-100 text-xs px-2 py-1 rounded"
                                    >
                                      {placeholder.placeholder}
                                    </code>
                                  ))}
                                  {report.placeholders.length > 10 && (
                                    <span className="text-xs text-gray-500">
                                      +{report.placeholders.length - 10} autres
                                    </span>
                                  )}
                                </div>
            </div>
                            )}
            </div>
                        )}
            </div>

                      <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0 sm:ml-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleExpandReport(report.id)}
                          className="flex items-center space-x-1"
                        >
                          {isExpanded ? (
                            <>
                              <span className="hidden sm:inline">Masquer</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">Détails</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditReport(report.id)}
                          className="flex items-center space-x-1"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="hidden sm:inline">Modifier</span>
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteReport(report.id)}
                          className="flex items-center space-x-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
            </div>
            </div>
          </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <FileBarChart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">
                Aucun rapport créé pour le moment
              </p>
              <p className="text-sm text-gray-500">
                Les rapports sont optionnels. Vous pouvez les ajouter plus tard.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
