import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { FormEditor } from '../components/FormEditor';
import { LoadingGuard } from '../components/LoadingGuard';
import { Plus, FileText, Users, Download, Eye, Trash2, MessageSquare, Edit } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export const DirecteurDashboard: React.FC = () => {
  const { user, firebaseUser, isLoading } = useAuth();
  const { 
    forms,
    formEntries,
    employees,
    createForm, 
    updateForm,
    updateForm,
    deleteForm,
    getEntriesForForm, 
    isLoading: appLoading
  } = useApp();
  
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleCreateForm = async (formData: {
    title: string;
    description: string;
    fields: any[];
    assignedTo: string[];
  }) => {
    try {
      if (!user?.id || !user?.agencyId) {
        throw new Error('Données utilisateur manquantes');
      }

      await createForm({
        ...formData,
        createdBy: user.id,
        agencyId: user.agencyId,
      });
      setShowFormBuilder(false);
      setFormToEdit(null);
    } catch (error) {
      console.error('Erreur lors de la création du formulaire:', error);
      alert('Erreur lors de la création du formulaire. Veuillez réessayer.');
    }
  };

  const handleUpdateForm = async (formData: {
    title: string;
    description: string;
    fields: any[];
    assignedTo: string[];
  }) => {
    if (!editingForm) return;

    try {
      await updateForm(editingForm.id, formData);
      setEditingForm(null);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du formulaire:', error);
      alert('Erreur lors de la mise à jour du formulaire. Veuillez réessayer.');
    }
  };

  const handleEditForm = (form: Form) => {
    setEditingForm(form);
  };

  const handleCancelEdit = () => {
    setEditingForm(null);
    setShowFormBuilder(false);
  };

  const handleDeleteForm = async (formId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce formulaire ?')) {
      try {
        await deleteForm(formId);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du formulaire.');
      }
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Rapport_${user?.name || 'Directeur'}_${new Date().toLocaleDateString()}`,
    onError: (error) => {
      console.error('Erreur lors de l\'impression:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  });

  const getEmployeeName = (employeeId: string): string => {
    const employee = employees.find(emp => emp?.id === employeeId);
    return employee?.name || 'Employé inconnu';
  };

  const getAssignedEmployeeNames = (assignedTo: string[]): string => {
    if (!assignedTo || assignedTo.length === 0) return 'Aucun employé assigné';
    
    const names = assignedTo.map(id => getEmployeeName(id)).filter(name => name !== 'Employé inconnu');
    return names.length > 0 ? names.join(', ') : 'Employés non trouvés';
  };

  return (
    <LoadingGuard 
      isLoading={isLoading || appLoading} 
      user={user} 
      firebaseUser={firebaseUser}
      message="Chargement du dashboard directeur..."
    >
      {user?.role !== 'directeur' ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Accès refusé</h1>
            <p className="text-gray-600">Seuls les directeurs peuvent accéder à cette page.</p>
          </Card>
        </div>
      ) : showFormBuilder || editingForm ? (
        <Layout title={editingForm ? "Modifier le formulaire" : "Créer un formulaire"}>
          <FormEditor
            form={editingForm || undefined}
            onSave={editingForm ? handleUpdateForm : handleCreateForm}
            onCancel={handleCancelEdit}
            employees={employees}
          />
        </Layout>
      ) : (
        <Layout title="Dashboard Directeur">
          <div className="space-y-6 lg:space-y-8">
            {/* Statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 opacity-80" />
                  <div>
                    <p className="text-blue-100">Formulaires créés</p>
                    <p className="text-xl sm:text-2xl font-bold">{forms.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 opacity-80" />
                  <div>
                    <p className="text-green-100">Employés</p>
                    <p className="text-xl sm:text-2xl font-bold">{employees.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white sm:col-span-2 lg:col-span-1">
                <div className="flex items-center space-x-3">
                  <Download className="h-8 w-8 opacity-80" />
                  <div>
                    <p className="text-purple-100">Réponses totales</p>
                    <p className="text-xl sm:text-2xl font-bold">{formEntries.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Actions principales */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                onClick={() => setShowFormBuilder(true)}
                className="flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <Plus className="h-5 w-5" />
                <span>Créer un nouveau formulaire</span>
              </Button>
              
              <Button
                variant="secondary"
                onClick={() => window.location.href = '/directeur/chat'}
                className="flex items-center justify-center space-x-2 w-full sm:w-auto"
              >
                <MessageSquare className="h-5 w-5" />
                <span>Retour au Chat IA</span>
              </Button>
              
              <Button
                variant="secondary"
                onClick={handlePrint}
                className="flex items-center justify-center space-x-2 w-full sm:w-auto"
                disabled={forms.length === 0}
              >
                <Download className="h-5 w-5" />
                <span className="hidden sm:inline">Exporter le rapport PDF</span>
                <span className="sm:hidden">Export PDF</span>
              </Button>
            </div>

            {/* Liste des formulaires */}
            <Card title="Formulaires créés">
              {forms.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Aucun formulaire créé pour le moment</p>
                  <Button onClick={() => setShowFormBuilder(true)}>
                    Créer votre premier formulaire
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {forms.map(form => {
                    const formEntriesForForm = getEntriesForForm(form.id);
                    
                    return (
                      <div
                        key={form.id}
                        className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-base sm:text-lg">{form.title}</h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{form.description}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 text-xs sm:text-sm text-gray-500 space-y-1 sm:space-y-0">
                              <span className="break-words">Assigné à: {getAssignedEmployeeNames(form.assignedTo)}</span>
                              <span>•</span>
                              <span>{formEntriesForForm.length} réponse(s)</span>
                              <span>•</span>
                              <span>{form.fields.length} champ(s)</span>
                              <span>•</span>
                              <span>Créé le {form.createdAt.toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditForm(form)}
                              className="flex items-center space-x-2"
                            >
                              <Edit className="h-4 w-4" />
                              <span>Modifier</span>
                            </Button>
                            
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedFormId(
                                selectedFormId === form.id ? null : form.id
                              )}
                              className="flex items-center justify-center space-x-2 w-full sm:w-auto"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">{selectedFormId === form.id ? 'Masquer' : 'Voir les réponses'}</span>
                              <span className="sm:hidden">{selectedFormId === form.id ? 'Masquer' : 'Réponses'}</span>
                            </Button>
                            
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditForm(form)}
                              className="flex items-center justify-center space-x-2 w-full sm:w-auto"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="hidden sm:inline">Modifier</span>
                              <span className="sm:hidden">Éditer</span>
                            </Button>
                            
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteForm(form.id)}
                              className="flex items-center justify-center space-x-1 w-full sm:w-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sm:hidden">Supprimer</span>
                            </Button>
                          </div>
                        </div>
                        
                        {/* Affichage des réponses */}
                        {selectedFormId === form.id && (
                          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                            {formEntriesForForm.length === 0 ? (
                              <p className="text-gray-500 italic">Aucune réponse pour ce formulaire</p>
                            ) : (
                              <div className="space-y-3 sm:space-y-4">
                                {formEntriesForForm.map(entry => (
                                  <div key={entry.id} className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-1">
                                      <span className="text-sm font-medium text-gray-900 break-words">
                                        Réponse de {getEmployeeName(entry.userId)}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {new Date(entry.submittedAt).toLocaleDateString()} à {new Date(entry.submittedAt).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Rapport pour l'impression (masqué) */}
            <div style={{ display: 'none' }}>
              <div ref={printRef} className="p-8 bg-white">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Rapport d'Activité</h1>
                  <p className="text-gray-600">Agence: {user?.agencyId}</p>
                  <p className="text-gray-600">
                    Généré le {new Date().toLocaleDateString()} par {user?.name}
                  </p>
                </div>

                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Résumé</h2>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{forms.length}</p>
                      <p className="text-gray-600">Formulaires créés</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{employees.length}</p>
                      <p className="text-gray-600">Employés</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{formEntries.length}</p>
                      <p className="text-gray-600">Réponses totales</p>
                    </div>
                  </div>
                </div>

                {/* Détail des formulaires pour l'impression */}
                {forms.map(form => {
                  const formEntriesForForm = getEntriesForForm(form.id);
                  
                  return (
                    <div key={form.id} className="mb-8 break-inside-avoid">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{form.title}</h3>
                      <p className="text-gray-600 mb-2">{form.description}</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Assigné à: {getAssignedEmployeeNames(form.assignedTo)}
                      </p>
                      
                      {formEntriesForForm.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-300">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="border border-gray-300 px-4 py-2 text-left">Employé</th>
                                <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                                {form.fields.map(field => (
                                  <th key={field.id} className="border border-gray-300 px-4 py-2 text-left">
                                    {field.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {formEntriesForForm.map(entry => (
                                <tr key={entry.id}>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {getEmployeeName(entry.userId)}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {new Date(entry.submittedAt).toLocaleDateString()}
                                  </td>
                                  {form.fields.map(field => (
                                    <td key={field.id} className="border border-gray-300 px-4 py-2">
                                      {entry.answers?.[field.id] !== undefined ? 
                                        (typeof entry.answers[field.id] === 'boolean' ? 
                                          (entry.answers[field.id] ? 'Oui' : 'Non') : 
                                          String(entry.answers[field.id])
                                        ) : 
                                        '-'
                                      }
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">Aucune réponse pour ce formulaire</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Layout>
      )}
    </LoadingGuard>
  );
};