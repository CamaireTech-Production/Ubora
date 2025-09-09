import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DynamicForm } from '../components/DynamicForm';
import { LoadingGuard } from '../components/LoadingGuard';
import { FileText, CheckCircle, Clock, ArrowLeft, Eye } from 'lucide-react';

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
            <div className="space-y-8">
              {/* Statistiques rapides */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 opacity-80" />
                    <div>
                      <p className="text-blue-100">Formulaires assignés</p>
                      <p className="text-2xl font-bold">{assignedForms.length}</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-8 w-8 opacity-80" />
                    <div>
                      <p className="text-green-100">Réponses soumises</p>
                      <p className="text-2xl font-bold">{myEntries.length}</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-8 w-8 opacity-80" />
                    <div>
                      <p className="text-purple-100">Dernière activité</p>
                      <p className="text-sm">
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
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">Aucun formulaire assigné</p>
                    <p className="text-sm text-gray-400">
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
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-semibold text-gray-900">{form.title}</h3>
                                {entryCount > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {entryCount} réponse(s)
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{form.description}</p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>Créé le {form.createdAt.toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{form.fields.length} champ(s)</span>
                                <span>•</span>
                                <span>Soumissions multiples autorisées</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {entryCount > 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setViewingEntries(
                                    viewingEntries === form.id ? null : form.id
                                  )}
                                  className="flex items-center space-x-1"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>{viewingEntries === form.id ? 'Masquer' : 'Voir mes réponses'}</span>
                                </Button>
                              )}
                              
                              <Button
                                size="sm"
                                onClick={() => setSelectedFormId(form.id)}
                              >
                                Remplir
                              </Button>
                            </div>
                          </div>

                          {/* Affichage des réponses de l'employé */}
                          {viewingEntries === form.id && entryCount > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <h4 className="font-medium text-gray-900 mb-3">Mes réponses précédentes</h4>
                              <div className="space-y-3">
                                {myEntries
                                  .filter(entry => entry.formId === form.id)
                                  .map(entry => (
                                    <div key={entry.id} className="bg-blue-50 p-3 rounded-lg">
                                      <div className="text-xs text-gray-500 mb-2">
                                        Soumis le {new Date(entry.submittedAt).toLocaleDateString()} à {new Date(entry.submittedAt).toLocaleTimeString()}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {Object.entries(entry.answers || {}).map(([fieldId, value]) => {
                                          const field = form.fields.find(f => f.id === fieldId);
                                          const fieldLabel = field?.label || fieldId;
                                          
                                          return (
                                            <div key={fieldId} className="text-sm">
                                              <span className="font-medium text-gray-700">{fieldLabel}:</span>
                                              <span className="ml-2 text-gray-900">
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