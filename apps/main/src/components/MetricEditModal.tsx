import React, { useState, useEffect } from 'react';
import { Form, FormField, DashboardMetric, FormEntry } from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { GraphPreview } from './charts/GraphPreview';
import { GraphModal } from './charts/GraphModal';
import { X, BarChart3, FileText, Hash, Type, Mail, Calendar, CheckSquare, Upload, AlertTriangle } from 'lucide-react';
import { getValidYAxisFields, validateYAxisField, getFieldValidationErrorMessage } from '../utils/GraphFieldValidator';

interface MetricEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (metricIndex: number, updatedMetric: Omit<DashboardMetric, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>) => void;
  metric: DashboardMetric | null;
  metricIndex: number;
  forms: Form[];
  formEntries: FormEntry[];
  currentUserId: string;
  agencyId: string;
}

export const MetricEditModal: React.FC<MetricEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  metric,
  metricIndex,
  forms,
  formEntries,
  currentUserId,
  agencyId
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formId, setFormId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'calculated'>('text');
  const [calculationType, setCalculationType] = useState<'count' | 'sum' | 'average' | 'min' | 'max' | 'unique'>('count');
  const [metricType, setMetricType] = useState<'value' | 'graph'>('value');
  const [graphConfig, setGraphConfig] = useState<DashboardMetric['graphConfig']>(undefined);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showGraphPreview, setShowGraphPreview] = useState(false);

  // Reset form when modal opens/closes or metric changes
  useEffect(() => {
    if (isOpen && metric) {
      setName(metric.name);
      setDescription(metric.description || '');
      setFormId(metric.formId);
      setFieldId(metric.fieldId);
      setFieldType(metric.fieldType);
      setCalculationType(metric.calculationType);
      setMetricType(metric.metricType || 'value');
      setGraphConfig(metric.graphConfig);
      setErrors([]);
      setIsLoading(false);
    }
  }, [isOpen, metric]);

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
      case 'calculated': return <Hash className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'textarea': return <FileText className="h-4 w-4" />;
      case 'select': return <CheckSquare className="h-4 w-4" />;
      case 'checkbox': return <CheckSquare className="h-4 w-4" />;
      case 'date': return <Calendar className="h-4 w-4" />;
      case 'file': return <Upload className="h-4 w-4" />;
      default: return <Type className="h-4 w-4" />;
    }
  };

  const getCalculationIcon = (calculationType: string) => {
    switch (calculationType) {
      case 'count': return <Hash className="h-4 w-4" />;
      case 'sum': return <BarChart3 className="h-4 w-4" />;
      case 'average': return <BarChart3 className="h-4 w-4" />;
      case 'min': return <Hash className="h-4 w-4" />;
      case 'max': return <Hash className="h-4 w-4" />;
      case 'unique': return <CheckSquare className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getCalculationLabel = (calculationType: string) => {
    switch (calculationType) {
      case 'count': return 'Nombre';
      case 'sum': return 'Somme';
      case 'average': return 'Moyenne';
      case 'min': return 'Minimum';
      case 'max': return 'Maximum';
      case 'unique': return 'Valeurs uniques';
      default: return calculationType;
    }
  };

  const selectedForm = forms.find(form => form.id === formId);
  const availableFields = selectedForm?.fields || [];

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Le nom de la métrique est requis');
    }
    if (!formId) {
      newErrors.push('Le formulaire est requis');
    }
    if (!fieldId) {
      newErrors.push('Le champ est requis');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await onSave(metricIndex, {
        name: name.trim(),
        description: description.trim(),
        formId,
        fieldId,
        fieldType,
        calculationType,
        metricType,
        graphConfig
      });
      
      // Small delay to show loading animation
      await new Promise(resolve => setTimeout(resolve, 500));
      onClose();
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la métrique:', error);
      setErrors(['Erreur lors de la mise à jour de la métrique. Veuillez réessayer.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (newFormId: string) => {
    setFormId(newFormId);
    setFieldId(''); // Reset field when form changes
  };

  const handleFieldChange = (newFieldId: string) => {
    const selectedField = availableFields.find(f => f.id === newFieldId);
    setFieldId(newFieldId);
    if (selectedField) {
      setFieldType(selectedField.type as any);
    }
  };

  if (!isOpen || !metric) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Modifier la métrique</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <ul className="text-sm text-red-600">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Metric Info */}
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la métrique *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom de la métrique"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description de la métrique"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Formulaire *
                </label>
                <select
                  value={formId}
                  onChange={(e) => handleFormChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Sélectionner un formulaire</option>
                  {forms.map(form => (
                    <option key={form.id} value={form.id}>
                      {form.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Champ *
                </label>
                <select
                  value={fieldId}
                  onChange={(e) => handleFieldChange(e.target.value)}
                  disabled={!formId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Sélectionner un champ</option>
                  {availableFields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.label} ({field.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'affichage *
                </label>
                <select
                  value={metricType}
                  onChange={(e) => {
                    const newMetricType = e.target.value as 'value' | 'graph';
                    setMetricType(newMetricType);
                    if (newMetricType === 'graph') {
                      setGraphConfig({
                        xAxisType: 'time',
                        yAxisType: 'count',
                        chartType: 'line'
                      });
                    } else {
                      setGraphConfig(undefined);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="value">Valeur numérique</option>
                  <option value="graph">Graphique</option>
                </select>
              </div>

              {/* Value type configuration */}
              {metricType === 'value' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de calcul *
                  </label>
                  <select
                    value={calculationType}
                    onChange={(e) => setCalculationType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="count">Nombre</option>
                    <option value="sum">Somme</option>
                    <option value="average">Moyenne</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                    <option value="unique">Valeurs uniques</option>
                  </select>
                </div>
              )}

              {/* Graph type configuration */}
              {metricType === 'graph' && graphConfig && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <h5 className="font-medium text-blue-900">Configuration du graphique</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Axe X (horizontal)
                      </label>
                      <select
                        value={graphConfig.xAxisType || 'time'}
                        onChange={(e) => setGraphConfig({
                          ...graphConfig,
                          xAxisType: e.target.value as 'field' | 'time' | 'date'
                        })}
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
                        value={graphConfig.yAxisType || 'count'}
                        onChange={(e) => setGraphConfig({
                          ...graphConfig,
                          yAxisType: e.target.value as 'field' | 'count' | 'sum' | 'average'
                        })}
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
                  {graphConfig.xAxisType === 'field' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Champ pour l'axe X
                      </label>
                      <select
                        value={graphConfig.xAxisFieldId || ''}
                        onChange={(e) => setGraphConfig({
                          ...graphConfig,
                          xAxisFieldId: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Choisir un champ...</option>
                        {availableFields.map(field => (
                          <option key={field.id} value={field.id}>
                            {field.label} ({field.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Y Axis Field Selection */}
                  {graphConfig.yAxisType === 'field' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Champ pour l'axe Y
                      </label>
                      <select
                        value={graphConfig.yAxisFieldId || ''}
                        onChange={(e) => setGraphConfig({
                          ...graphConfig,
                          yAxisFieldId: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Choisir un champ...</option>
                        {getValidYAxisFields(availableFields, calculationType, 'field').map(field => (
                          <option key={field.id} value={field.id}>
                            {field.label} ({field.type})
                          </option>
                        ))}
                      </select>
                      
                      {/* Field validation error message */}
                      {graphConfig.yAxisFieldId && (() => {
                        const selectedField = availableFields.find(f => f.id === graphConfig.yAxisFieldId);
                        if (selectedField) {
                          const validation = validateYAxisField(selectedField, calculationType, 'field');
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
                      value={graphConfig.chartType || 'line'}
                      onChange={(e) => setGraphConfig({
                        ...graphConfig,
                        chartType: e.target.value as 'line' | 'bar' | 'area'
                      })}
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
              {metricType === 'graph' && graphConfig && formId && (
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
                          ...metric!,
                          metricType: 'graph',
                          graphConfig: graphConfig
                        }}
                        formEntries={formEntries.filter(entry => entry.formId === formId)}
                        forms={forms}
                        compact={true}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Preview */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Aperçu de la métrique</h4>
                <div className="flex items-center space-x-2">
                  {getFieldIcon(fieldType)}
                  {getCalculationIcon(calculationType)}
                  <span className="text-sm text-gray-600">
                    {name || 'Nom de la métrique'} - {getCalculationLabel(calculationType)}
                  </span>
                </div>
                {description && (
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className={isLoading ? 'opacity-75 cursor-not-allowed' : ''}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Mise à jour...
                </>
              ) : (
                'Mettre à jour la métrique'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
