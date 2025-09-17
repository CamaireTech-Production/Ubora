import React, { useState, useEffect } from 'react';
import { Form, FormField, Dashboard, DashboardMetric, FormEntry } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { GraphPreview } from './charts/GraphPreview';
import { X, Plus, Trash2, BarChart3, FileText, Hash, Type, Mail, Calendar, CheckSquare, Upload } from 'lucide-react';

interface DashboardCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dashboard: Omit<Dashboard, 'id' | 'createdAt'>) => void;
  forms: Form[];
  formEntries: FormEntry[];
  currentUserId: string;
  agencyId: string;
}

export const DashboardCreationModal: React.FC<DashboardCreationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  forms,
  formEntries,
  currentUserId,
  agencyId
}) => {
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [metrics, setMetrics] = useState<Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showGraphPreviews, setShowGraphPreviews] = useState<Record<number, boolean>>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDashboardName('');
      setDashboardDescription('');
      setSelectedFormId('');
      setMetrics([]);
      setErrors([]);
      setIsLoading(false);
    }
  }, [isOpen]);

  const selectedForm = forms.find(form => form.id === selectedFormId);

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

  const addMetric = () => {
    if (!selectedFormId) {
      setErrors(['Veuillez d\'abord sélectionner un formulaire']);
      return;
    }

    const newMetric: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'> = {
      name: '',
      description: '',
      formId: selectedFormId,
      fieldId: '',
      fieldType: 'text',
      calculationType: 'count',
      metricType: 'value',
      graphConfig: undefined
    };

    setMetrics([...metrics, newMetric]);
    setErrors([]);
  };

  const updateMetric = (index: number, updates: Partial<Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    const updatedMetrics = [...metrics];
    updatedMetrics[index] = { ...updatedMetrics[index], ...updates };
    setMetrics(updatedMetrics);
  };

  const removeMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const newErrors: string[] = [];

    if (!dashboardName.trim()) {
      newErrors.push('Le nom du tableau de bord est requis');
    }

    if (metrics.length === 0) {
      newErrors.push('Au moins une métrique est requise');
    }

    metrics.forEach((metric, index) => {
      if (!metric.name.trim()) {
        newErrors.push(`Le nom de la métrique ${index + 1} est requis`);
      }
      if (!metric.fieldId) {
        newErrors.push(`Le champ de la métrique ${index + 1} est requis`);
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const dashboard: Omit<Dashboard, 'id' | 'createdAt'> = {
        name: dashboardName.trim(),
        description: dashboardDescription.trim(),
        metrics: metrics.map(metric => ({
          ...metric,
          id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          createdBy: currentUserId,
          agencyId: agencyId
        })),
        createdBy: currentUserId,
        agencyId: agencyId
      };

      await onSave(dashboard);
    } catch (error) {
      console.error('Erreur lors de la création du tableau de bord:', error);
      setErrors(['Erreur lors de la création du tableau de bord. Veuillez réessayer.']);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Créer un tableau de bord</h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
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

          {/* Dashboard Info */}
          <div className="space-y-4 mb-6">
            <Input
              label="Nom du tableau de bord *"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder="Ex: Tableau de bord des ventes"
            />
            
            <Textarea
              label="Description (optionnel)"
              value={dashboardDescription}
              onChange={(e) => setDashboardDescription(e.target.value)}
              placeholder="Description du tableau de bord..."
              rows={3}
            />
          </div>

          {/* Form Selection */}
          <div className="mb-6">
            <Select
              label="Sélectionner un formulaire *"
              value={selectedFormId}
              onChange={(e) => {
                setSelectedFormId(e.target.value);
                setMetrics([]); // Reset metrics when form changes
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

          {/* Metrics Section */}
          {selectedForm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Métriques</h3>
                <Button
                  onClick={addMetric}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Ajouter une métrique</span>
                </Button>
              </div>

              {metrics.length === 0 ? (
                <Card className="p-6 text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">
                    Aucune métrique ajoutée. Cliquez sur "Ajouter une métrique" pour commencer.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {metrics.map((metric, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-medium text-gray-900">
                          Métrique {index + 1}
                        </h4>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeMetric(index)}
                          className="p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="Nom de la métrique *"
                          value={metric.name}
                          onChange={(e) => updateMetric(index, { name: e.target.value })}
                          placeholder="Ex: Nombre de ventes"
                        />

                        <Select
                          label="Champ du formulaire *"
                          value={metric.fieldId}
                          onChange={(e) => {
                            const field = selectedForm.fields.find((f: FormField) => f.id === e.target.value);
                            updateMetric(index, { 
                              fieldId: e.target.value,
                              fieldType: field?.type || 'text'
                            });
                          }}
                          options={[
                            { value: '', label: 'Choisir un champ...' },
                            ...selectedForm.fields.map((field: FormField) => ({
                              value: field.id,
                              label: `${field.label} (${field.type})`
                            }))
                          ]}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type d'affichage
                          </label>
                          <Select
                            value={metric.metricType || 'value'}
                            onChange={(e) => {
                              const metricType = e.target.value as 'value' | 'graph';
                              updateMetric(index, { 
                                metricType,
                                graphConfig: metricType === 'graph' ? {
                                  xAxisType: 'time',
                                  yAxisType: 'count',
                                  chartType: 'line'
                                } : undefined
                              });
                            }}
                            options={[
                              { value: 'value', label: 'Valeur numérique' },
                              { value: 'graph', label: 'Graphique' }
                            ]}
                          />
                        </div>

                        <Input
                          label="Description (optionnel)"
                          value={metric.description || ''}
                          onChange={(e) => updateMetric(index, { description: e.target.value })}
                          placeholder="Description de la métrique..."
                        />
                      </div>

                      {/* Value type configuration */}
                      {metric.metricType === 'value' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type de calcul
                          </label>
                          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                            {getFieldIcon(metric.fieldType)}
                            <Select
                              value={metric.calculationType}
                              onChange={(e) => updateMetric(index, { calculationType: e.target.value as any })}
                              options={getCalculationOptions(metric.fieldType)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Graph type configuration */}
                      {metric.metricType === 'graph' && metric.graphConfig && (
                        <div className="mt-4 space-y-4 p-4 bg-blue-50 rounded-lg">
                          <h5 className="font-medium text-blue-900">Configuration du graphique</h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Axe X (horizontal)
                              </label>
                              <Select
                                value={metric.graphConfig.xAxisType || 'time'}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    xAxisType: e.target.value as 'field' | 'time' | 'date'
                                  }
                                })}
                                options={[
                                  { value: 'time', label: 'Heure de soumission' },
                                  { value: 'date', label: 'Date de soumission' },
                                  { value: 'field', label: 'Champ du formulaire' }
                                ]}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Axe Y (vertical)
                              </label>
                              <Select
                                value={metric.graphConfig.yAxisType || 'count'}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    yAxisType: e.target.value as 'field' | 'count' | 'sum' | 'average'
                                  }
                                })}
                                options={[
                                  { value: 'count', label: 'Nombre de soumissions' },
                                  { value: 'sum', label: 'Somme des valeurs' },
                                  { value: 'average', label: 'Moyenne des valeurs' },
                                  { value: 'field', label: 'Valeur du champ' }
                                ]}
                              />
                            </div>
                          </div>

                          {/* X Axis Field Selection */}
                          {metric.graphConfig.xAxisType === 'field' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Champ pour l'axe X
                              </label>
                              <Select
                                value={metric.graphConfig.xAxisFieldId || ''}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    xAxisFieldId: e.target.value
                                  }
                                })}
                                options={[
                                  { value: '', label: 'Choisir un champ...' },
                                  ...selectedForm.fields.map((field: FormField) => ({
                                    value: field.id,
                                    label: `${field.label} (${field.type})`
                                  }))
                                ]}
                              />
                            </div>
                          )}

                          {/* Y Axis Field Selection */}
                          {metric.graphConfig.yAxisType === 'field' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Champ pour l'axe Y
                              </label>
                              <Select
                                value={metric.graphConfig.yAxisFieldId || ''}
                                onChange={(e) => updateMetric(index, { 
                                  graphConfig: {
                                    ...metric.graphConfig!,
                                    yAxisFieldId: e.target.value
                                  }
                                })}
                                options={[
                                  { value: '', label: 'Choisir un champ...' },
                                  ...selectedForm.fields.map((field: FormField) => ({
                                    value: field.id,
                                    label: `${field.label} (${field.type})`
                                  }))
                                ]}
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type de graphique
                            </label>
                            <Select
                              value={metric.graphConfig.chartType || 'line'}
                              onChange={(e) => updateMetric(index, { 
                                graphConfig: {
                                  ...metric.graphConfig!,
                                  chartType: e.target.value as 'line' | 'bar' | 'area'
                                }
                              })}
                              options={[
                                { value: 'line', label: 'Ligne' },
                                { value: 'bar', label: 'Barres' },
                                { value: 'area', label: 'Aire' }
                              ]}
                            />
                          </div>
                        </div>
                      )}

                      {/* Graph Preview */}
                      {metric.metricType === 'graph' && metric.graphConfig && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-green-900">Aperçu du graphique</h5>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowGraphPreviews(prev => ({
                                ...prev,
                                [index]: !prev[index]
                              }))}
                              className="text-xs"
                            >
                              {showGraphPreviews[index] ? 'Masquer' : 'Aperçu'}
                            </Button>
                          </div>
                          
                          {showGraphPreviews[index] && (
                            <div className="h-32">
                              <GraphPreview
                                metric={{
                                  ...metric,
                                  id: `preview-${index}`,
                                  createdAt: new Date(),
                                  createdBy: currentUserId,
                                  agencyId: agencyId
                                }}
                                formEntries={formEntries.filter(entry => entry.formId === selectedFormId)}
                                forms={forms}
                                compact={true}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Field Preview */}
                      {metric.fieldId && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Aperçu du champ</span>
                          </div>
                          {(() => {
                            const field = selectedForm.fields.find((f: FormField) => f.id === metric.fieldId);
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
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dashboardName.trim() || metrics.length === 0 || isLoading}
            className={isLoading ? 'opacity-75 cursor-not-allowed' : ''}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Création...
              </>
            ) : (
              'Créer le tableau de bord'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
