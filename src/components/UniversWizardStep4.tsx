import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { DashboardBuilder } from './DashboardBuilder';
import { DashboardMetric, Form } from '../types';
import { UniversWizardStepProps } from './UniversWizard';
import { Plus, Trash2, Edit, BarChart3, CheckCircle, AlertCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

// DashboardDefinition interface for Univers
interface DashboardDefinition {
  id: string;
  name: string;
  description?: string;
  metrics: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[];
}

export const UniversWizardStep4: React.FC<UniversWizardStepProps> = ({
  wizardData,
  updateWizardData,
  markStepCompleted
}) => {
  const { formEntries } = useApp();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [dashboards, setDashboards] = useState<DashboardDefinition[]>(
    (wizardData.definitions.dashboards as DashboardDefinition[]) || []
  );
  const [showDashboardBuilder, setShowDashboardBuilder] = useState(false);
  const [editingDashboardId, setEditingDashboardId] = useState<string | null>(null);
  const [expandedDashboards, setExpandedDashboards] = useState<Set<string>>(new Set());

  // Convert Form definitions to Form objects for DashboardBuilder
  const universForms = useMemo<Form[]>(() => {
    const formDefinitions = (wizardData.definitions.forms || []) as any[];
    return formDefinitions.map((formDef): Form => ({
      id: formDef.id,
      title: formDef.title,
      description: formDef.description,
      createdBy: user?.id || '',
      createdByRole: 'directeur',
      assignedTo: [],
      fields: formDef.fields || [],
      createdAt: new Date(),
      agencyId: user?.agencyId || ''
    }));
  }, [wizardData.definitions.forms, user]);

  // Check if forms exist
  const hasForms = universForms.length > 0;
  const hasDashboards = dashboards.length > 0;

  // Update wizard data when dashboards change
  useEffect(() => {
    updateWizardData({
      definitions: {
        ...wizardData.definitions,
        dashboards: dashboards
      }
    });

    // Mark step as completed if dashboards exist (dashboards are optional but if created, mark as completed)
    if (dashboards.length > 0) {
      markStepCompleted(4);
    }
  }, [dashboards, updateWizardData, wizardData.definitions, markStepCompleted]);

  const handleAddDashboard = () => {
    if (!hasForms) {
      showError('Vous devez créer au moins un formulaire avant de créer un tableau de bord');
      return;
    }
    setEditingDashboardId(null);
    setShowDashboardBuilder(true);
  };

  const handleEditDashboard = (dashboardId: string) => {
    setEditingDashboardId(dashboardId);
    setShowDashboardBuilder(true);
  };

  const handleDeleteDashboard = (dashboardId: string) => {
    setDashboards(dashboards.filter(d => d.id !== dashboardId));
    showSuccess('Tableau de bord supprimé');
  };

  const handleDashboardSave = (dashboardData: {
    name: string;
    description: string;
    metrics: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[];
  }) => {
    if (editingDashboardId) {
      // Update existing dashboard
      setDashboards(dashboards.map(d => 
        d.id === editingDashboardId 
          ? { 
              ...d, 
              name: dashboardData.name,
              description: dashboardData.description,
              metrics: dashboardData.metrics
            }
          : d
      ));
      showSuccess('Tableau de bord modifié');
    } else {
      // Create new dashboard
      const newDashboard: DashboardDefinition = {
        id: `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: dashboardData.name,
        description: dashboardData.description,
        metrics: dashboardData.metrics
      };
      setDashboards([...dashboards, newDashboard]);
      showSuccess('Tableau de bord ajouté');
    }

    setShowDashboardBuilder(false);
    setEditingDashboardId(null);
  };

  const handleDashboardCancel = () => {
    setShowDashboardBuilder(false);
    setEditingDashboardId(null);
  };

  const editingDashboard = editingDashboardId ? dashboards.find(d => d.id === editingDashboardId) : null;

  if (showDashboardBuilder) {
    if (!hasForms) {
      return (
        <div className="space-y-6">
          <div>
            <Button
              variant="secondary"
              onClick={handleDashboardCancel}
              className="flex items-center space-x-2 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour à la liste</span>
            </Button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Tableaux de bord
            </h2>
          </div>
          <Card className="border-yellow-200 bg-yellow-50">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                  Formulaire requis
                </h3>
                <p className="text-sm text-yellow-800 mb-4">
                  Vous devez créer au moins un formulaire avant de pouvoir créer un tableau de bord.
                </p>
                <Button
                  variant="secondary"
                  onClick={handleDashboardCancel}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Retour à l'étape Formulaires</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <Button
            variant="secondary"
            onClick={handleDashboardCancel}
            className="flex items-center space-x-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour à la liste</span>
          </Button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {editingDashboardId ? 'Modifier le tableau de bord' : 'Créer un tableau de bord'}
          </h2>
          <p className="text-gray-600">
            {editingDashboardId 
              ? 'Modifiez les informations du tableau de bord' 
              : 'Créez un nouveau tableau de bord pour votre Univers'}
          </p>
        </div>

        <DashboardBuilder
          onSave={handleDashboardSave}
          onCancel={handleDashboardCancel}
          forms={universForms}
          formEntries={formEntries}
          currentUserId={user?.id || ''}
          agencyId={user?.agencyId || ''}
          isLoading={false}
          initialDashboard={editingDashboard ? {
            name: editingDashboard.name,
            description: editingDashboard.description,
            metrics: editingDashboard.metrics
          } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Tableaux de bord
        </h2>
        <p className="text-gray-600">
          Créez et gérez les tableaux de bord de votre Univers. Les tableaux de bord sont optionnels mais recommandés.
        </p>
      </div>

      {/* Warning if no forms */}
      {!hasForms && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                Formulaire requis
              </h3>
              <p className="text-sm text-yellow-800">
                Vous devez créer au moins un formulaire avant de pouvoir créer un tableau de bord. 
                Les tableaux de bord analysent les données des formulaires.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Warning if dashboards exist but no forms */}
      {hasDashboards && !hasForms && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                Formulaire requis pour les tableaux de bord
              </h3>
              <p className="text-sm text-red-800">
                Les tableaux de bord que vous avez créés nécessitent des formulaires pour fonctionner. 
                Veuillez créer au moins un formulaire à l'étape précédente.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Add Dashboard Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleAddDashboard}
          disabled={!hasForms}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter un tableau de bord</span>
        </Button>
      </div>

      {/* Dashboards List */}
      {dashboards.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun tableau de bord
            </h3>
            <p className="text-gray-600 mb-4">
              {hasForms 
                ? 'Commencez par créer votre premier tableau de bord'
                : 'Créez d\'abord un formulaire pour pouvoir créer des tableaux de bord'}
            </p>
            {hasForms ? (
              <Button 
                onClick={handleAddDashboard} 
                className="flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Créer un tableau de bord</span>
              </Button>
            ) : (
              <p className="text-sm text-gray-500">
                Retournez à l'étape précédente pour créer un formulaire
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.id} className="relative hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <BarChart3 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {dashboard.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {dashboard.metrics.length} métrique{dashboard.metrics.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEditDashboard(dashboard.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Modifier"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDashboard(dashboard.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {dashboard.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {dashboard.description}
                </p>
              )}

              {/* Minimal preview of metrics */}
              {dashboard.metrics.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    Métriques ({dashboard.metrics.length}):
                  </div>
                  {(() => {
                    const isExpanded = expandedDashboards.has(dashboard.id);
                    const maxDefault = 2;
                    const maxExpanded = 3;
                    const displayedCount = isExpanded ? Math.min(maxExpanded, dashboard.metrics.length) : Math.min(maxDefault, dashboard.metrics.length);
                    const hasMore = dashboard.metrics.length > displayedCount;
                    const needsScroll = isExpanded && dashboard.metrics.length > maxExpanded;

                    return (
                      <>
                        <div 
                          className={`space-y-1 metrics-preview-container ${needsScroll ? 'max-h-32 overflow-y-auto thin-scrollbar' : ''}`}
                        >
                          {dashboard.metrics.slice(0, displayedCount).map((metric, idx) => {
                            // Get form name
                            const form = universForms.find(f => f.id === metric.formId);
                            const formTitle = form?.title || 'Formulaire inconnu';
                            
                            // Get field label
                            const field = form?.fields.find(f => f.id === metric.fieldId);
                            const fieldLabel = field?.label || metric.fieldId || 'Champ';

                            const getMetricTypeLabel = () => {
                              if (metric.metricType === 'graph') return '📊 Graphique';
                              const calcLabels: Record<string, string> = {
                                'sum': 'Somme',
                                'average': 'Moyenne',
                                'count': 'Nombre',
                                'min': 'Minimum',
                                'max': 'Maximum',
                                'unique': 'Uniques'
                              };
                              return calcLabels[metric.calculationType] || metric.calculationType;
                            };

                            return (
                              <div key={idx} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                                <div className="font-medium text-gray-700 truncate">{metric.name}</div>
                                <div className="text-xs text-gray-500 truncate">
                                  {getMetricTypeLabel()} • {formTitle} • {fieldLabel}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {hasMore && (
                          <button
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedDashboards(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(dashboard.id);
                                  return newSet;
                                });
                              } else {
                                setExpandedDashboards(prev => new Set([...prev, dashboard.id]));
                              }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                          >
                            {isExpanded ? 'Afficher moins' : `Afficher plus (+${dashboard.metrics.length - displayedCount} autre${dashboard.metrics.length - displayedCount > 1 ? 's' : ''})`}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Tableau configuré</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {dashboards.length > 0 && hasForms && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {dashboards.length} tableau{dashboards.length > 1 ? 'x' : ''} de bord {dashboards.length === 1 ? 'configuré' : 'configurés'}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Les tableaux de bord sont prêts à être utilisés
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

