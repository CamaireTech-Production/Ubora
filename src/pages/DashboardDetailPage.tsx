import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardMetric } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { MetricCalculator } from '../utils/MetricCalculator';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Hash, 
  Type, 
  Mail, 
  Calendar, 
  CheckSquare, 
  Upload, 
  Eye, 
  Edit, 
  Trash2, 
  Plus,
  FileText,
  X
} from 'lucide-react';

export const DashboardDetailPage: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { 
    forms,
    formEntries,
    dashboards,
    updateDashboard,
    deleteDashboard,
    isLoading: appLoading
  } = useApp();
  const { toast, showSuccess, showError } = useToast();

  const [showMetricModal, setShowMetricModal] = useState(false);
  const [newMetric, setNewMetric] = useState<Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>({
    name: '',
    description: '',
    formId: '',
    fieldId: '',
    fieldType: 'text',
    calculationType: 'count'
  });
  const [errors, setErrors] = useState<string[]>([]);

  // Find the dashboard
  const dashboard = dashboards.find(d => d.id === dashboardId) || null;

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'textarea': return <Type className="h-4 w-4" />;
      case 'select': return <CheckSquare className="h-4 w-4" />;
      case 'checkbox': return <CheckSquare className="h-4 w-4" />;
      case 'date': return <Calendar className="h-4 w-4" />;
      case 'file': return <Upload className="h-4 w-4" />;
      default: return <Type className="h-4 w-4" />;
    }
  };

  const getCalculationIcon = (calculationType: string) => {
    switch (calculationType) {
      case 'sum': return <TrendingUp className="h-4 w-4" />;
      case 'average': return <Minus className="h-4 w-4" />;
      case 'min': return <TrendingDown className="h-4 w-4" />;
      case 'max': return <TrendingUp className="h-4 w-4" />;
      case 'count': return <Hash className="h-4 w-4" />;
      case 'unique': return <BarChart3 className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getCalculationLabel = (calculationType: string) => {
    switch (calculationType) {
      case 'sum': return 'Somme';
      case 'average': return 'Moyenne';
      case 'min': return 'Minimum';
      case 'max': return 'Maximum';
      case 'count': return 'Nombre';
      case 'unique': return 'Valeurs uniques';
      default: return calculationType;
    }
  };

  const getFormTitle = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    return form?.title || 'Formulaire inconnu';
  };

  const getFieldLabel = (formId: string, fieldId: string) => {
    const form = forms.find(f => f.id === formId);
    const field = form?.fields.find(f => f.id === fieldId);
    return field?.label || 'Champ inconnu';
  };

  const getCalculationOptions = (fieldType: string) => {
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'textarea':
      case 'select':
      case 'checkbox':
      case 'date':
      case 'file':
        return [
          { value: 'count', label: 'Nombre de soumissions' },
          { value: 'unique', label: 'Valeurs uniques' }
        ];
      case 'number':
        return [
          { value: 'count', label: 'Nombre de soumissions' },
          { value: 'sum', label: 'Somme' },
          { value: 'average', label: 'Moyenne' },
          { value: 'min', label: 'Minimum' },
          { value: 'max', label: 'Maximum' },
          { value: 'unique', label: 'Valeurs uniques' }
        ];
      default:
        return [{ value: 'count', label: 'Nombre de soumissions' }];
    }
  };

  const handleDeleteDashboard = async () => {
    if (!dashboard || !window.confirm(`Êtes-vous sûr de vouloir supprimer le tableau de bord "${dashboard.name}" ?`)) {
      return;
    }

    try {
      await deleteDashboard(dashboard.id);
      showSuccess('Tableau de bord supprimé avec succès !');
      navigate('/directeur/dashboards');
    } catch (error) {
      console.error('Erreur lors de la suppression du tableau de bord:', error);
      showError('Erreur lors de la suppression du tableau de bord. Veuillez réessayer.');
    }
  };

  const handleDeleteMetric = async (metricIndex: number) => {
    if (!dashboard) return;
    
    const metric = dashboard.metrics[metricIndex];
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la métrique "${metric.name}" ?`)) {
      return;
    }

    try {
      const updatedMetrics = dashboard.metrics.filter((_, index) => index !== metricIndex);
      await updateDashboard(dashboard.id, {
        metrics: updatedMetrics
      });
      showSuccess('Métrique supprimée avec succès !');
    } catch (error) {
      console.error('Erreur lors de la suppression de la métrique:', error);
      showError('Erreur lors de la suppression de la métrique. Veuillez réessayer.');
    }
  };

  const handleAddMetric = () => {
    setNewMetric({
      name: '',
      description: '',
      formId: '',
      fieldId: '',
      fieldType: 'text',
      calculationType: 'count'
    });
    setErrors([]);
    setShowMetricModal(true);
  };

  const handleSaveMetric = async () => {
    if (!dashboard) return;

    const newErrors: string[] = [];

    if (!newMetric.name.trim()) {
      newErrors.push('Le nom de la métrique est requis');
    }
    if (!newMetric.fieldId) {
      newErrors.push('Le champ de la métrique est requis');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const metricToAdd: DashboardMetric = {
        ...newMetric,
        id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        createdBy: user?.id || '',
        agencyId: user?.agencyId || ''
      };

      const updatedMetrics = [...dashboard.metrics, metricToAdd];
      await updateDashboard(dashboard.id, {
        metrics: updatedMetrics
      });

      setShowMetricModal(false);
      showSuccess('Métrique ajoutée avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la métrique:', error);
      showError('Erreur lors de l\'ajout de la métrique. Veuillez réessayer.');
    }
  };

  const selectedForm = forms.find(form => form.id === newMetric.formId);

  if (isLoading || appLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <Layout title="Tableau de bord introuvable">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Tableau de bord introuvable</h1>
            <p className="text-gray-600 mb-4">Le tableau de bord demandé n'existe pas ou vous n'avez pas l'autorisation d'y accéder.</p>
            <Button onClick={() => navigate('/directeur/dashboard')}>
              Retour au dashboard
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={dashboard.name}>
      <div className="space-y-6">
        {/* Header with back button and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/directeur/dashboard')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // TODO: Implement edit dashboard functionality
                showError('Fonctionnalité d\'édition bientôt disponible');
              }}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Modifier</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteDashboard}
              className="flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Supprimer</span>
            </Button>
          </div>
        </div>

        {/* Dashboard Info */}
        <Card>
          <div className="flex items-center space-x-3 mb-4">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-gray-600 mt-1">{dashboard.description}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Créé le:</span>
              <p className="text-gray-600">{dashboard.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Métriques:</span>
              <p className="text-gray-600">{dashboard.metrics.length} métrique{dashboard.metrics.length > 1 ? 's' : ''}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Formulaires utilisés:</span>
              <p className="text-gray-600">
                {new Set(dashboard.metrics.map(m => m.formId)).size} formulaire{new Set(dashboard.metrics.map(m => m.formId)).size > 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Données disponibles:</span>
              <p className="text-gray-600">
                {formEntries.filter(entry => dashboard.metrics.some(m => m.formId === entry.formId)).length} entrée{formEntries.filter(entry => dashboard.metrics.some(m => m.formId === entry.formId)).length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </Card>

        {/* Add Metric Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleAddMetric}
            className="flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Ajouter une nouvelle métrique</span>
          </Button>
        </div>

        {/* Metrics Grid */}
        {dashboard.metrics.length === 0 ? (
          <Card className="p-8 text-center">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune métrique configurée
            </h3>
            <p className="text-gray-600 mb-4">
              Ce tableau de bord ne contient aucune métrique pour le moment.
            </p>
            <Button onClick={handleAddMetric}>
              Ajouter votre première métrique
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {dashboard.metrics.map((metric, index) => {
              const result = MetricCalculator.calculateMetric(metric, formEntries);
              
              return (
                <Card key={metric.id || index} className="hover:shadow-lg transition-shadow h-full">
                  {/* Header with icons and badge */}
                  <div className="flex items-center space-x-2 mb-2">
                    {getFieldIcon(metric.fieldType)}
                    {getCalculationIcon(metric.calculationType)}
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {getCalculationLabel(metric.calculationType)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end space-x-1 mb-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        // TODO: Implement edit metric functionality
                        showError('Fonctionnalité d\'édition bientôt disponible');
                      }}
                      className="p-1"
                      title="Modifier la métrique"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteMetric(index)}
                      className="p-1"
                      title="Supprimer la métrique"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Metric name and description */}
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-900 text-base lg:text-lg mb-1">
                      {metric.name}
                    </h4>
                    {metric.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {metric.description}
                      </p>
                    )}
                  </div>

                  {/* Metric value and result */}
                  <div className="mb-3">
                    <div className="text-xl lg:text-2xl font-bold text-blue-600 mb-1">
                      {result.displayValue}
                    </div>
                    <p className="text-sm text-gray-500">
                      {result.description}
                    </p>
                    {result.value === 0 && (
                      <p className="text-xs text-orange-500 mt-1">
                        Vérifiez que des données existent pour ce formulaire
                      </p>
                    )}
                  </div>

                  {/* Source information */}
                  <div className="text-xs text-gray-500 border-t border-gray-200 pt-2">
                    <div className="flex items-center space-x-1 mb-1">
                      <Eye className="h-3 w-3" />
                      <span className="truncate">{getFormTitle(metric.formId)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {getFieldIcon(metric.fieldType)}
                      <span className="truncate">{getFieldLabel(metric.formId, metric.fieldId)}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Metric Modal */}
      {showMetricModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Plus className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Ajouter une métrique</h2>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowMetricModal(false)}
                className="p-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Errors */}
              {errors.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="text-sm font-medium text-red-800 mb-2">Erreurs à corriger :</h3>
                  <ul className="text-sm text-red-700 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Selection */}
              <div className="mb-6">
                <Select
                  label="Sélectionner un formulaire *"
                  value={newMetric.formId}
                  onChange={(e) => {
                    setNewMetric(prev => ({
                      ...prev,
                      formId: e.target.value,
                      fieldId: '',
                      fieldType: 'text'
                    }));
                  }}
                  options={[
                    { value: '', label: 'Choisir un formulaire...' },
                    ...forms.map(form => ({
                      value: form.id,
                      label: form.title
                    }))
                  ]}
                />
              </div>

              {/* Metric Configuration */}
              {selectedForm && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Nom de la métrique *"
                      value={newMetric.name}
                      onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Nombre de ventes"
                    />

                    <Select
                      label="Champ du formulaire *"
                      value={newMetric.fieldId}
                      onChange={(e) => {
                        const field = selectedForm.fields.find(f => f.id === e.target.value);
                        setNewMetric(prev => ({ 
                          ...prev,
                          fieldId: e.target.value,
                          fieldType: field?.type || 'text'
                        }));
                      }}
                      options={[
                        { value: '', label: 'Choisir un champ...' },
                        ...selectedForm.fields.map(field => ({
                          value: field.id,
                          label: `${field.label} (${field.type})`
                        }))
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type de calcul
                      </label>
                      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                        {getFieldIcon(newMetric.fieldType)}
                        <Select
                          value={newMetric.calculationType}
                          onChange={(e) => setNewMetric(prev => ({ ...prev, calculationType: e.target.value as any }))}
                          options={getCalculationOptions(newMetric.fieldType)}
                        />
                      </div>
                    </div>

                    <Input
                      label="Description (optionnel)"
                      value={newMetric.description || ''}
                      onChange={(e) => setNewMetric(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description de la métrique..."
                    />
                  </div>

                  {/* Field Preview */}
                  {newMetric.fieldId && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Aperçu du champ</span>
                      </div>
                      {(() => {
                        const field = selectedForm.fields.find(f => f.id === newMetric.fieldId);
                        return field ? (
                          <div className="text-sm text-blue-800">
                            <p><strong>Label:</strong> {field.label}</p>
                            <p><strong>Type:</strong> {field.type}</p>
                            {field.required && <p><strong>Requis:</strong> Oui</p>}
                            {field.options && field.options.length > 0 && (
                              <p><strong>Options:</strong> {field.options.join(', ')}</p>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <Button
                variant="secondary"
                onClick={() => setShowMetricModal(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveMetric}
                disabled={!newMetric.name.trim() || !newMetric.fieldId}
              >
                Ajouter la métrique
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
      />
    </Layout>
  );
};
