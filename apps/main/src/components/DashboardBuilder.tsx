import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DashboardMetric, Form, FormField } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';
import { Card } from './Card';
import { Plus, Trash2, AlertCircle, FileText, Hash, Type, Mail, Calendar, CheckSquare, Upload, AlertTriangle, ArrowLeft } from 'lucide-react';
import { GraphPreview } from './charts/GraphPreview';
import { getValidYAxisFields, validateYAxisField } from '@ubora/shared/utils/GraphFieldValidator';

interface DashboardBuilderProps {
  onSave: (dashboard: {
    name: string;
    description: string;
    metrics: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[];
  }) => void;
  onCancel: () => void;
  forms: Form[];
  formEntries: any[];
  currentUserId: string;
  agencyId: string;
  isLoading?: boolean;
  initialDashboard?: {
    name: string;
    description?: string;
    metrics: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[];
  };
}

export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  onSave,
  onCancel,
  forms,
  formEntries,
  currentUserId,
  agencyId,
  isLoading = false,
  initialDashboard
}) => {
  const [name, setName] = useState(initialDashboard?.name || '');
  const [description, setDescription] = useState(initialDashboard?.description || '');
  const [metrics, setMetrics] = useState<Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>[]>(initialDashboard?.metrics || []);
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const [showGraphPreviews, setShowGraphPreviews] = useState<Record<number, boolean>>({});
  
  // Auto-scroll to errors when they appear (mobile-responsive)
  useEffect(() => {
    if (errors.length > 0 && errorRef.current) {
      // Immediate scroll
      errorRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
      
      // Additional scroll after delay for mobile keyboard animations
      setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }
      }, 100);
    }
  }, [errors]);

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
    const newMetric: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'> = {
      name: '',
      description: '',
      formId: '',
      fieldId: '',
      fieldType: 'text',
      calculationType: 'count',
      metricType: 'value',
      graphConfig: undefined
    };

    setMetrics([...metrics, newMetric]);
    setErrors([]);
  };

  const removeMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const updateMetric = (index: number, updates: Partial<Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    setMetrics(metrics.map((metric, i) => 
      i === index ? { ...metric, ...updates } : metric
    ));
  };

  const handleSave = useCallback(() => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Le nom du tableau de bord est requis');
    }

    if (metrics.length === 0) {
      newErrors.push('Au moins une métrique est requise');
    }

    metrics.forEach((metric, index) => {
      if (!metric.name.trim()) {
        newErrors.push(`Le nom de la métrique ${index + 1} est requis`);
      }
      if (!metric.formId) {
        newErrors.push(`Le formulaire de la métrique ${index + 1} est requis`);
      }
      if (!metric.fieldId) {
        newErrors.push(`Le champ de la métrique ${index + 1} est requis`);
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      metrics
    });
  }, [name, description, metrics, onSave]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Affichage des erreurs de validation */}
      {errors.length > 0 && (
        <Card ref={errorRef} className="border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                Veuillez corriger les erreurs suivantes :
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4 sm:space-y-6">
          <Input
            label="Nom du tableau de bord *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Tableau de bord des ventes"
            required
          />
          
          <Textarea
            label="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description du tableau de bord..."
            rows={3}
          />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-medium text-gray-900">Métriques du tableau de bord</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addMetric}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Ajouter une métrique</span>
                <span className="sm:hidden">Ajouter</span>
              </Button>
            </div>

            {metrics.length === 0 ? (
              <p className="text-gray-500 text-center py-6 sm:py-8 bg-gray-50 rounded-lg text-sm sm:text-base">
                Aucune métrique ajoutée. Cliquez sur "Ajouter une métrique" pour commencer.
              </p>
            ) : (
              <div className="space-y-4">
                {metrics.map((metric, index) => {
                  const selectedForm = forms.find(form => form.id === metric.formId);
                  
                  return (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">Métrique {index + 1}</h4>
                            <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                              ID: metric_{index + 1}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => removeMetric(index)}
                            className="flex items-center space-x-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="Nom de la métrique *"
                            value={metric.name}
                            onChange={(e) => updateMetric(index, { name: e.target.value })}
                            placeholder="Ex: Nombre de ventes"
                            required
                          />

                          <Select
                            label="Formulaire *"
                            value={metric.formId}
                            onChange={(e) => {
                              updateMetric(index, { 
                                formId: e.target.value,
                                fieldId: '', // Reset field when form changes
                                fieldType: 'text'
                              });
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

                        {selectedForm && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          </div>
                        )}

                        <Input
                          label="Description (optionnel)"
                          value={metric.description || ''}
                          onChange={(e) => updateMetric(index, { description: e.target.value })}
                          placeholder="Description de la métrique..."
                        />

                      {/* Value type configuration */}
                      {metric.metricType === 'value' && metric.fieldId && (
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
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {metric.graphConfig.xAxisType === 'field' && selectedForm && (
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
                          {metric.graphConfig.yAxisType === 'field' && selectedForm && (
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
                                  ...getValidYAxisFields(selectedForm.fields, metric.calculationType, 'field').map((field: FormField) => ({
                                    value: field.id,
                                    label: `${field.label} (${field.type})`
                                  }))
                                ]}
                              />
                              
                              {/* Field validation error message */}
                              {metric.graphConfig?.yAxisFieldId && (() => {
                                const selectedField = selectedForm.fields.find(f => f.id === metric.graphConfig?.yAxisFieldId);
                                if (selectedField) {
                                  const validation = validateYAxisField(selectedField, metric.calculationType, 'field');
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
                      {metric.metricType === 'graph' && metric.graphConfig && metric.formId && metric.fieldId && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-green-900">Aperçu du graphique</h5>
                            <Button
                              type="button"
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
                                formEntries={formEntries.filter(entry => entry.formId === metric.formId)}
                                forms={forms}
                                compact={true}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Field Preview */}
                      {metric.fieldId && selectedForm && (
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
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with responsive buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6 border-t border-gray-200">
            <Button 
              type="submit" 
              className="w-full sm:flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {initialDashboard ? 'Modification...' : 'Création...'}
                </>
              ) : (
                initialDashboard ? 'Modifier le tableau de bord' : 'Créer le tableau de bord'
              )}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onCancel} 
              className="w-full sm:w-auto flex items-center justify-center space-x-2"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Annuler</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
