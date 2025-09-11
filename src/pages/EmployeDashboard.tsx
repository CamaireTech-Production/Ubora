import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DynamicForm } from '../components/DynamicForm';
import { LoadingGuard } from '../components/LoadingGuard';
import { FileText, CheckCircle, Clock, ArrowLeft, Eye, AlertTriangle } from 'lucide-react';

export const EmployeDashboard: React.FC = () => {
  const { user, firebaseUser, isLoading } = useAuth();
  const { 
    getFormsForEmployee, 
    submitFormEntry, 
    getEntriesForEmployee,
    isLoading: appLoading
  } = useApp();
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [viewingEntries, setViewingEntries] = useState<string | null>(null);

  const formatTimeRestrictions = (restrictions?: {
    startTime?: string;
    endTime?: string;
    allowedDays?: number[];
  }): string => {
    if (!restrictions || (!restrictions.startTime && !restrictions.endTime)) {
      return '';
    }

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    
    let timeStr = '';
    if (restrictions.startTime && restrictions.endTime) {
      timeStr = `${restrictions.startTime} - ${restrictions.endTime}`;
    } else if (restrictions.startTime) {
      timeStr = `À partir de ${restrictions.startTime}`;
    } else if (restrictions.endTime) {
      timeStr = `Jusqu'à ${restrictions.endTime}`;
    }

    let dayStr = '';
    if (restrictions.allowedDays && restrictions.allowedDays.length > 0) {
      const selectedDays = restrictions.allowedDays
        .sort((a, b) => a - b)
        .map(day => dayNames[day])
        .join(', ');
      dayStr = ` (${selectedDays})`;
    }

    return `${timeStr}${dayStr}`;
  };

  const isWithinTimeRestrictions = (restrictions?: {
    startTime?: string;
    endTime?: string;
    allowedDays?: number[];
  }): boolean => {
    if (!restrictions || (!restrictions.startTime && !restrictions.endTime)) {
      return true; // No restrictions
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Check day restrictions
    if (restrictions.allowedDays && restrictions.allowedDays.length > 0) {
      if (!restrictions.allowedDays.includes(currentDay)) {
        return false;
      }
    }

    // Check time restrictions
    if (restrictions.startTime && restrictions.endTime) {
      return currentTime >= restrictions.startTime && currentTime <= restrictions.endTime;
    } else if (restrictions.startTime) {
      return currentTime >= restrictions.startTime;
    } else if (restrictions.endTime) {
      return currentTime <= restrictions.endTime;
    }

    return true;
  };

  const handleFormSubmit = async (formId: string, answers: Record<string, any>) => {
    try {
      await submitFormEntry({
        formId,
        answers,
      });
      setSelectedFormId(null);
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert('Erreur lors de la soumission du formulaire.');
    }
  };

  return (
    <LoadingGuard 
      isLoading={isLoading || appLoading} 
      user={user} 
      firebaseUser={firebaseUser}
      message="Chargement du dashboard employé..."
    >
      {(() => {
        const assignedForms = getFormsForEmployee(user?.id || '');
        const myEntries = getEntriesForEmployee(user?.id || '');
        const selectedForm = assignedForms.find(form => form.id === selectedFormId);

        // Debug logging
        console.log('Employee Dashboard Debug:', {
          userId: user?.id,
          userRole: user?.role,
          userAgencyId: user?.agencyId,
          assignedFormsCount: assignedForms.length,
          assignedForms: assignedForms.map(f => ({ id: f.id, title: f.title, assignedTo: f.assignedTo }))
        });

        const getFormEntryCount = (formId: string) => {
          return myEntries.filter(entry => entry.formId === formId).length;
        };

        if (selectedForm) {
          return (
            <Layout title="Remplir le formulaire">
              <div className="mb-6">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedFormId(null)}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Retour au dashboard</span>
                </Button>
              </div>
              <DynamicForm
                form={selectedForm}
                onSubmit={(answers) => handleFormSubmit(selectedForm.id, answers)}
                onCancel={() => setSelectedFormId(null)}
              />
            </Layout>
          );
        }

        return (
          <Layout title="Dashboard Employé">
            <div className="space-y-6 lg:space-y-8">
              {/* Statistiques rapides */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 opacity-80" />
                    <div>
                      <p className="text-blue-100">Formulaires assignés</p>
                      <p className="text-xl sm:text-2xl font-bold">{assignedForms.length}</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-8 w-8 opacity-80" />
                    <div>
                      <p className="text-green-100">Réponses soumises</p>
                      <p className="text-xl sm:text-2xl font-bold">{myEntries.length}</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-8 w-8 opacity-80" />
                    <div>
                      <p className="text-purple-100">Dernière activité</p>
                      <p className="text-xs sm:text-sm">
                        {myEntries.length > 0 ? 
                          new Date(Math.max(...myEntries.map(e => new Date(e.submittedAt).getTime()))).toLocaleDateString() :
                          'Aucune'
                        }
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Liste des formulaires assignés */}
              <Card title="Mes formulaires">
                {assignedForms.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">Aucun formulaire assigné</p>
                    <p className="text-sm text-gray-400 px-4">
                      Votre directeur vous assignera des formulaires à remplir.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignedForms.map(form => {
                      const entryCount = getFormEntryCount(form.id);
                      
                      return (
                        <div
                          key={form.id}
                          className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
                                <h3 className="font-semibold text-gray-900 text-base sm:text-lg break-words">{form.title}</h3>
                                <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                                  {entryCount > 0 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      {entryCount} réponse(s)
                                    </span>
                                  )}
                                  {form.timeRestrictions && formatTimeRestrictions(form.timeRestrictions) && (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      isWithinTimeRestrictions(form.timeRestrictions)
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {isWithinTimeRestrictions(form.timeRestrictions) ? '🕒' : '⚠️'} {formatTimeRestrictions(form.timeRestrictions)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{form.description}</p>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs text-gray-500 space-y-1 sm:space-y-0">
                                <span>Créé le {form.createdAt.toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{form.fields.length} champ(s)</span>
                                <span>•</span>
                                <span>Soumissions multiples autorisées</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              {entryCount > 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setViewingEntries(
                                    viewingEntries === form.id ? null : form.id
                                  )}
                                  className="flex items-center justify-center space-x-1 w-full sm:w-auto"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="hidden sm:inline">{viewingEntries === form.id ? 'Masquer' : 'Voir mes réponses'}</span>
                                  <span className="sm:hidden">{viewingEntries === form.id ? 'Masquer' : 'Réponses'}</span>
                                </Button>
                              )}
                              
                              <Button
                                size="sm"
                                onClick={() => setSelectedFormId(form.id)}
                                className="w-full sm:w-auto"
                              >
                                Remplir
                              </Button>
                            </div>
                          </div>

                          {/* Affichage des réponses de l'employé */}
                          {viewingEntries === form.id && entryCount > 0 && (
                            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                              <h4 className="font-medium text-gray-900 mb-3">Mes réponses précédentes</h4>
                              <div className="space-y-3 max-h-60 overflow-y-auto">
                                {myEntries
                                  .filter(entry => entry.formId === form.id)
                                  .map(entry => (
                                    <div key={entry.id} className="bg-blue-50 p-3 rounded-lg">
                                      <div className="text-xs text-gray-500 mb-2">
                                        Soumis le {new Date(entry.submittedAt).toLocaleDateString()} à {new Date(entry.submittedAt).toLocaleTimeString()}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {Object.entries(entry.answers || {}).map(([fieldId, value]) => {
                                          const field = form.fields.find(f => f.id === fieldId);
                                          const fieldLabel = field?.label || fieldId;
                                          
                                          return (
                                            <div key={fieldId} className="text-sm break-words">
                                              <span className="font-medium text-gray-700 block sm:inline">{fieldLabel}:</span>
                                              <span className="sm:ml-2 text-gray-900 block sm:inline">
                                                {value !== null && value !== undefined ? 
                                                  (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
                                                  '-'
                                                }
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </Layout>
        );
      })()}
    </LoadingGuard>
  );
};