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
import { ComingSoonModal } from '../components/ComingSoonModal';
import { DashboardEditModal } from '../components/DashboardEditModal';
import { MetricEditModal } from '../components/MetricEditModal';
import { GraphPreview } from '../components/charts/GraphPreview';
import { GraphModal } from '../components/charts/GraphModal';
import { getValidYAxisFields, validateYAxisField, getFieldValidationErrorMessage } from '../utils/GraphFieldValidator';
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
  X,
  ChevronDown
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
    calculationType: 'count',
    metricType: 'value',
    graphConfig: undefined
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showDeleteDashboardModal, setShowDeleteDashboardModal] = useState(false);
  const [showDeleteMetricModal, setShowDeleteMetricModal] = useState(false);
  const [metricToDelete, setMetricToDelete] = useState<{index: number, name: string} | null>(null);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [isDeletingDashboard, setIsDeletingDashboard] = useState(false);
  const [isDeletingMetric, setIsDeletingMetric] = useState(false);
  const [isAddingMetric, setIsAddingMetric] = useState(false);
  const [showGraphPreview, setShowGraphPreview] = useState(false);
  
  // Edit modals state
  const [showEditDashboardModal, setShowEditDashboardModal] = useState(false);
  const [showEditMetricModal, setShowEditMetricModal] = useState(false);
  const [editingMetricIndex, setEditingMetricIndex] = useState<number>(-1);
  
  // Graph modal state
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [expandedGraphMetric, setExpandedGraphMetric] = useState<DashboardMetric | null>(null);
  
  // États pour le filtrage temporel
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{
    start: string;
    end: string;
  }>({
    start: '',
    end: ''
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Find the dashboard
  const dashboard = dashboards.find(d => d.id === dashboardId) || null;

  // Fonctions pour le filtrage temporel
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

  const isDateInRange = (date: Date, start: Date | null, end: Date | null) => {
    if (!start && !end) return true; // All time
    if (!start) return date <= end!;
    if (!end) return date >= start;
    return date >= start && date <= end;
  };

  // Get filtered form entries based on time filter
  const getFilteredFormEntries = () => {
    const { start, end } = getDateRange(timeFilter);
    return formEntries.filter(entry => 
      isDateInRange(new Date(entry.submittedAt), start, end)
    );
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
      case 'calculated': return <Hash className="h-4 w-4" />;
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
      case 'calculated':
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

  const handleDeleteDashboard = () => {
    setShowDeleteDashboardModal(true);
  };

  const confirmDeleteDashboard = async () => {
    if (!dashboard) return;

    setIsDeletingDashboard(true);
    try {
      await deleteDashboard(dashboard.id);
      showSuccess('Tableau de bord supprimé avec succès !');
      setShowDeleteDashboardModal(false);
      navigate('/directeur/dashboard');
    } catch (error) {
      console.error('Erreur lors de la suppression du tableau de bord:', error);
      showError('Erreur lors de la suppression du tableau de bord. Veuillez réessayer.');
    } finally {
      setIsDeletingDashboard(false);
    }
  };

  const handleDeleteMetric = (metricIndex: number) => {
    if (!dashboard) return;
    
    const metric = dashboard.metrics[metricIndex];
    setMetricToDelete({ index: metricIndex, name: metric.name });
    setShowDeleteMetricModal(true);
  };

  const confirmDeleteMetric = async () => {
    if (!dashboard || !metricToDelete) return;

    setIsDeletingMetric(true);
    try {
      const updatedMetrics = dashboard.metrics.filter((_, index) => index !== metricToDelete.index);
      await updateDashboard(dashboard.id, {
        metrics: updatedMetrics
      });
      showSuccess('Métrique supprimée avec succès !');
      setShowDeleteMetricModal(false);
      setMetricToDelete(null);
    } catch (error) {
      console.error('Erreur lors de la suppression de la métrique:', error);
      showError('Erreur lors de la suppression de la métrique. Veuillez réessayer.');
    } finally {
      setIsDeletingMetric(false);
    }
  };

  const handleAddMetric = () => {
    setNewMetric({
      name: '',
      description: '',
      formId: '',
      fieldId: '',
      fieldType: 'text',
      calculationType: 'count',
      metricType: 'value',
      graphConfig: undefined
    });
    setShowGraphPreview(false);
    setErrors([]);
    setShowMetricModal(true);
  };

  const handleCloseMetricModal = () => {
    setShowMetricModal(false);
    setShowGraphPreview(false);
    setErrors([]);
  };

  const handleEditDashboard = () => {
    setShowEditDashboardModal(true);
  };

  const handleEditMetric = (metricIndex: number) => {
    setEditingMetricIndex(metricIndex);
    setShowEditMetricModal(true);
  };

  const handleSaveDashboardEdit = async (dashboardId: string, updates: any) => {
    try {
      await updateDashboard(dashboardId, updates);
      showSuccess('Tableau de bord modifié avec succès !');
    } catch (error) {
      console.error('Erreur lors de la modification du tableau de bord:', error);
      showError('Erreur lors de la modification du tableau de bord. Veuillez réessayer.');
      throw error;
    }
  };

  const handleSaveMetricEdit = async (metricIndex: number, updatedMetric: any) => {
    if (!dashboard) return;

    try {
      const updatedMetrics = [...dashboard.metrics];
      updatedMetrics[metricIndex] = {
        ...updatedMetrics[metricIndex],
        ...updatedMetric
      };
      
      await updateDashboard(dashboard.id, {
        metrics: updatedMetrics
      });
      
      showSuccess('Métrique modifiée avec succès !');
    } catch (error) {
      console.error('Erreur lors de la modification de la métrique:', error);
      showError('Erreur lors de la modification de la métrique. Veuillez réessayer.');
      throw error;
    }
  };

  const handleExpandGraph = (metric: DashboardMetric) => {
    setExpandedGraphMetric(metric);
    setShowGraphModal(true);
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

    setIsAddingMetric(true);
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
    } finally {
      setIsAddingMetric(false);
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
              onClick={handleEditDashboard}
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
                {getFilteredFormEntries().filter(entry => dashboard.metrics.some(m => m.formId === entry.formId)).length} entrée{getFilteredFormEntries().filter(entry => dashboard.metrics.some(m => m.formId === entry.formId)).length > 1 ? 's' : ''}
                {timeFilter !== 'all' && (
                  <span className="text-xs text-gray-500 ml-1">
                    (filtrées)
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Time Filter */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtrer par période:</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Dropdown des périodes prédéfinies */}
              <div className="relative">
                <select
                  value={timeFilter}
                  onChange={(e) => {
                    setTimeFilter(e.target.value);
                    if (e.target.value !== 'custom') {
                      setShowCustomDatePicker(false);
                    }
                  }}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full max-w-[160px] min-w-[120px] sm:min-w-[140px]"
                >
                  <option value="all">Toutes les périodes</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="yesterday">Hier</option>
                  <option value="last7days">7 derniers jours</option>
                  <option value="last30days">30 derniers jours</option>
                  <option value="last90days">90 derniers jours</option>
                  <option value="thisMonth">Ce mois</option>
                  <option value="lastMonth">Mois dernier</option>
                  <option value="thisYear">Cette année</option>
                  <option value="custom">Période personnalisée</option>
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              
              {/* Bouton pour ouvrir le sélecteur de dates personnalisées */}
              {timeFilter === 'custom' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                  className="text-xs sm:text-sm"
                >
                  {showCustomDatePicker ? 'Masquer' : 'Dates'}
                </Button>
              )}
            </div>
          </div>
            
          {/* Sélecteur de dates personnalisées */}
          {showCustomDatePicker && timeFilter === 'custom' && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    max={customDateRange.end || undefined}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      // If start date is after end date, clear the end date
                      if (customDateRange.end && startDate && new Date(startDate) > new Date(customDateRange.end)) {
                        setCustomDateRange(prev => ({ ...prev, start: startDate, end: '' }));
                        showError('La date de début ne peut pas être postérieure à la date de fin');
                        return;
                      }
                      setCustomDateRange(prev => ({ ...prev, start: startDate }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    min={customDateRange.start || undefined}
                    onChange={(e) => {
                      const endDate = e.target.value;
                      // If end date is before start date, clear it
                      if (customDateRange.start && endDate && new Date(endDate) < new Date(customDateRange.start)) {
                        setCustomDateRange(prev => ({ ...prev, end: '' }));
                        showError('La date de fin ne peut pas être antérieure à la date de début');
                        return;
                      }
                      setCustomDateRange(prev => ({ ...prev, end: endDate }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Validation message */}
              {customDateRange.start && customDateRange.end && new Date(customDateRange.end) < new Date(customDateRange.start) && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">
                    ⚠️ La date de fin doit être postérieure ou égale à la date de début
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

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
              const filteredEntries = getFilteredFormEntries();
              const result = MetricCalculator.calculateMetric(metric, filteredEntries);
              
              return (
                <Card key={metric.id || index} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  {/* Header with icons, badge and action buttons */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getFieldIcon(metric.fieldType)}
                      {getCalculationIcon(metric.calculationType)}
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {getCalculationLabel(metric.calculationType)}
                      </span>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditMetric(index)}
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
                  <div className="flex-1 mb-3">
                    {metric.metricType === 'graph' ? (
                      <div className="w-full bg-white rounded-lg border border-gray-200 p-2 h-32">
                        <GraphPreview
                          metric={metric}
                          formEntries={filteredEntries}
                          forms={forms}
                          onExpand={() => handleExpandGraph(metric)}
                          compact={true}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col justify-center h-32">
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
                onClick={handleCloseMetricModal}
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type d'affichage *
                      </label>
                      <Select
                        value={newMetric.metricType || 'value'}
                        onChange={(e) => {
                          const metricType = e.target.value as 'value' | 'graph';
                          setNewMetric(prev => ({ 
                            ...prev,
                            metricType,
                            graphConfig: metricType === 'graph' ? {
                              xAxisType: 'time',
                              yAxisType: 'count',
                              chartType: 'line'
                            } : undefined
                          }));
                        }}
                        options={[
                          { value: 'value', label: 'Valeur numérique' },
                          { value: 'graph', label: 'Graphique' }
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <Input
                      label="Description (optionnel)"
                      value={newMetric.description || ''}
                      onChange={(e) => setNewMetric(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description de la métrique..."
                    />
                  </div>

                  {/* Graph type configuration */}
                  {newMetric.metricType === 'graph' && newMetric.graphConfig && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                      <h5 className="font-medium text-blue-900">Configuration du graphique</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Axe X (horizontal)
                          </label>
                          <select
                            value={newMetric.graphConfig.xAxisType || 'time'}
                            onChange={(e) => setNewMetric(prev => ({
                              ...prev,
                              graphConfig: {
                                ...prev.graphConfig!,
                                xAxisType: e.target.value as 'field' | 'time' | 'date'
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="time">Heure de soumission</option>
                            <option value="date">Date de soumission</option>
                            <option value="field">Champ du formulaire</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Axe Y (vertical)
                          </label>
                          <select
                            value={newMetric.graphConfig.yAxisType || 'count'}
                            onChange={(e) => setNewMetric(prev => ({
                              ...prev,
                              graphConfig: {
                                ...prev.graphConfig!,
                                yAxisType: e.target.value as 'field' | 'count' | 'sum' | 'average'
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="count">Nombre de soumissions</option>
                            <option value="sum">Somme des valeurs</option>
                            <option value="average">Moyenne des valeurs</option>
                            <option value="field">Valeur du champ</option>
                          </select>
                        </div>
                      </div>

                      {/* X Axis Field Selection */}
                      {newMetric.graphConfig.xAxisType === 'field' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Champ pour l'axe X
                          </label>
                          <select
                            value={newMetric.graphConfig.xAxisFieldId || ''}
                            onChange={(e) => setNewMetric(prev => ({
                              ...prev,
                              graphConfig: {
                                ...prev.graphConfig!,
                                xAxisFieldId: e.target.value
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Choisir un champ...</option>
                            {selectedForm.fields.map(field => (
                              <option key={field.id} value={field.id}>
                                {field.label} ({field.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Y Axis Field Selection */}
                      {newMetric.graphConfig.yAxisType === 'field' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Champ pour l'axe Y
                          </label>
                          <select
                            value={newMetric.graphConfig.yAxisFieldId || ''}
                            onChange={(e) => setNewMetric(prev => ({
                              ...prev,
                              graphConfig: {
                                ...prev.graphConfig!,
                                yAxisFieldId: e.target.value
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Choisir un champ...</option>
                            {getValidYAxisFields(selectedForm.fields, newMetric.calculationType, 'field').map(field => (
                              <option key={field.id} value={field.id}>
                                {field.label} ({field.type})
                              </option>
                            ))}
                          </select>
                          
                          {/* Field validation error message */}
                          {newMetric.graphConfig.yAxisFieldId && (() => {
                            const selectedField = selectedForm.fields.find(f => f.id === newMetric.graphConfig.yAxisFieldId);
                            if (selectedField) {
                              const validation = validateYAxisField(selectedField, newMetric.calculationType, 'field');
                              if (!validation.isValid) {
                                return (
                                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <div className="flex items-start">
                                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                      <div className="text-sm">
                                        <p className="text-red-800 font-medium">
                                          {validation.errorMessage}
                                        </p>
                                        {validation.warningMessage && (
                                          <p className="text-red-700 mt-1">
                                            {validation.warningMessage}
                                          </p>
                                        )}
                                        {validation.suggestedAlternatives && validation.suggestedAlternatives.length > 0 && (
                                          <div className="mt-2">
                                            <p className="text-red-700 font-medium">Suggestions :</p>
                                            <ul className="list-disc list-inside text-red-600 mt-1">
                                              {validation.suggestedAlternatives.map((suggestion, idx) => (
                                                <li key={idx}>{suggestion}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}
                          
                          {/* Help text for field selection */}
                          <p className="mt-1 text-xs text-blue-600">
                            💡 Seuls les champs numériques (number, calculated) sont disponibles pour l'axe Y
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Type de graphique
                        </label>
                        <select
                          value={newMetric.graphConfig.chartType || 'line'}
                          onChange={(e) => setNewMetric(prev => ({
                            ...prev,
                            graphConfig: {
                              ...prev.graphConfig!,
                              chartType: e.target.value as 'line' | 'bar' | 'area'
                            }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="line">Ligne</option>
                          <option value="bar">Barres</option>
                          <option value="area">Aire</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Graph Preview */}
                  {newMetric.metricType === 'graph' && newMetric.graphConfig && newMetric.formId && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-green-900">Aperçu du graphique</h5>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowGraphPreview(!showGraphPreview)}
                          className="text-xs"
                        >
                          {showGraphPreview ? 'Masquer' : 'Aperçu'}
                        </Button>
                      </div>
                      
                      {showGraphPreview && (
                        <div className="h-32">
                          <GraphPreview
                            metric={{
                              ...newMetric,
                              id: 'preview-new-metric',
                              createdAt: new Date(),
                              createdBy: user?.id || '',
                              agencyId: user?.agencyId || ''
                            }}
                            formEntries={formEntries.filter(entry => entry.formId === newMetric.formId)}
                            forms={forms}
                            compact={true}
                          />
                        </div>
                      )}
                    </div>
                  )}

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
                onClick={handleCloseMetricModal}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveMetric}
                disabled={!newMetric.name.trim() || !newMetric.fieldId || isAddingMetric}
                className={isAddingMetric ? 'opacity-75 cursor-not-allowed' : ''}
              >
                {isAddingMetric ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Ajout...
                  </>
                ) : (
                  'Ajouter la métrique'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dashboard Confirmation Modal */}
      {showDeleteDashboardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Supprimer le tableau de bord</h3>
                  <p className="text-sm text-gray-500">Cette action est irréversible</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Êtes-vous sûr de vouloir supprimer le tableau de bord <strong>"{dashboard?.name}"</strong> ? 
                Toutes les métriques associées seront également supprimées.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteDashboardModal(false)}
                >
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmDeleteDashboard}
                  disabled={isDeletingDashboard}
                  className={isDeletingDashboard ? 'opacity-75 cursor-not-allowed' : ''}
                >
                  {isDeletingDashboard ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Suppression...
                    </>
                  ) : (
                    'Supprimer'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Metric Confirmation Modal */}
      {showDeleteMetricModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Supprimer la métrique</h3>
                  <p className="text-sm text-gray-500">Cette action est irréversible</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Êtes-vous sûr de vouloir supprimer la métrique <strong>"{metricToDelete?.name}"</strong> ?
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteMetricModal(false);
                    setMetricToDelete(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmDeleteMetric}
                  disabled={isDeletingMetric}
                  className={isDeletingMetric ? 'opacity-75 cursor-not-allowed' : ''}
                >
                  {isDeletingMetric ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Suppression...
                    </>
                  ) : (
                    'Supprimer'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Modal */}
      <ComingSoonModal
        isOpen={showComingSoonModal}
        onClose={() => setShowComingSoonModal(false)}
        title="Fonctionnalité bientôt disponible"
        description="Cette fonctionnalité sera bientôt disponible."
      />

      {/* Edit Dashboard Modal */}
      <DashboardEditModal
        isOpen={showEditDashboardModal}
        onClose={() => setShowEditDashboardModal(false)}
        onSave={handleSaveDashboardEdit}
        dashboard={dashboard}
      />

      {/* Edit Metric Modal */}
      <MetricEditModal
        isOpen={showEditMetricModal}
        onClose={() => {
          setShowEditMetricModal(false);
          setEditingMetricIndex(-1);
        }}
        onSave={handleSaveMetricEdit}
        metric={dashboard && editingMetricIndex >= 0 ? dashboard.metrics[editingMetricIndex] : null}
        metricIndex={editingMetricIndex}
        forms={forms}
        formEntries={formEntries}
        currentUserId={user?.id || ''}
        agencyId={user?.agencyId || ''}
      />

      {/* Graph Modal */}
      {expandedGraphMetric && (
        <GraphModal
          isOpen={showGraphModal}
          onClose={() => {
            setShowGraphModal(false);
            setExpandedGraphMetric(null);
          }}
          metric={expandedGraphMetric}
          formEntries={getFilteredFormEntries()}
          forms={forms}
        />
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
