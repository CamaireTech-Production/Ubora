import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DynamicForm } from '../components/DynamicForm';
import { LoadingGuard } from '../components/LoadingGuard';
import { FileText, CheckCircle, ArrowLeft, Eye, AlertTriangle, Edit, Trash2, Send, FileEdit, Filter, Calendar, SortAsc, SortDesc } from 'lucide-react';
import { VideoSection } from '../components/VideoSection';

interface ResponsesInterfaceProps {
  myEntries: any[];
  assignedForms: any[];
  onClose: () => void;
  canEditResponse: (submittedAt: Date | string) => boolean;
  onUpdateResponse?: (responseId: string, updatedAnswers: Record<string, any>, updatedFileAttachments: any[]) => Promise<void>;
}

const ResponsesInterface: React.FC<ResponsesInterfaceProps> = ({ 
  myEntries, 
  assignedForms, 
  canEditResponse,
  onUpdateResponse
}) => {
  const [selectedFormFilter, setSelectedFormFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingResponse, setEditingResponse] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const getFilteredAndSortedEntries = () => {
    let filtered = [...myEntries];

    // Filter by form
    if (selectedFormFilter !== 'all') {
      filtered = filtered.filter(entry => entry.formId === selectedFormFilter);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.submittedAt);
            return entryDate >= today;
          });
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.submittedAt);
            return entryDate >= weekAgo;
          });
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          filtered = filtered.filter(entry => {
            const entryDate = new Date(entry.submittedAt);
            return entryDate >= monthAgo;
          });
          break;
      }
    }

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a.submittedAt).getTime();
      const dateB = new Date(b.submittedAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  };

  const getFormTitle = (formId: string) => {
    const form = assignedForms.find(f => f.id === formId);
    return form?.title || 'Formulaire inconnu';
  };

  const handleEditSubmit = async (responseId: string, updatedAnswers: Record<string, any>, updatedFileAttachments: any[]) => {
    if (!onUpdateResponse) return;
    
    setIsSubmittingEdit(true);
    try {
      await onUpdateResponse(responseId, updatedAnswers, updatedFileAttachments);
      setEditingResponse(null);
    } catch (error) {
      console.error('Error updating response:', error);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const filteredEntries = getFilteredAndSortedEntries();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={selectedFormFilter}
            onChange={(e) => setSelectedFormFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les formulaires</option>
            {assignedForms.map(form => (
              <option key={form.id} value={form.id}>{form.title}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les périodes</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            <span>{sortOrder === 'asc' ? 'Plus ancien' : 'Plus récent'}</span>
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        {filteredEntries.length} réponse(s) trouvée(s)
      </div>

      {/* Responses list */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucune réponse trouvée avec ces filtres</p>
          </div>
        ) : (
          filteredEntries.map(entry => {
            const form = assignedForms.find(f => f.id === entry.formId);
            const isEditable = canEditResponse(entry.submittedAt);
            const isEditing = editingResponse === entry.id;
            
            return (
              <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {isEditing ? (
                  /* Edit Form */
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Modifier la réponse</h3>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingResponse(null)}
                        className="flex items-center space-x-1"
                      >
                        <span>Annuler</span>
                      </Button>
                    </div>
                    
                    {form && (
                      <DynamicForm
                        form={form}
                        onSubmit={(answers, fileAttachments) => handleEditSubmit(entry.id, answers, fileAttachments || [])}
                        onCancel={() => setEditingResponse(null)}
                        initialAnswers={entry.answers || {}}
                        initialFileAttachments={entry.fileAttachments || []}
                        isDraft={false}
                        isLoading={isSubmittingEdit}
                      />
                    )}
                  </div>
                ) : (
                  /* Response Display */
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{getFormTitle(entry.formId)}</h3>
                        <p className="text-sm text-gray-500">
                          Soumis le {new Date(entry.submittedAt).toLocaleDateString()} à {new Date(entry.submittedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {isEditable ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingResponse(entry.id)}
                            className="flex items-center space-x-1"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Modifier</span>
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Non modifiable (3h+)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Response preview */}
                    <div className="space-y-2">
                      {Object.entries(entry.answers || {}).slice(0, 3).map(([fieldId, value]) => {
                        const field = form?.fields.find((f: any) => f.id === fieldId);
                        const fieldLabel = field?.label || fieldId;
                        
                        return (
                          <div key={fieldId} className="text-sm">
                            <span className="font-medium text-gray-700">{fieldLabel}:</span>
                            <span className="ml-2 text-gray-600">
                              {value !== null && value !== undefined ? 
                                (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
                                '-'
                              }
                            </span>
                          </div>
                        );
                      })}
                      {Object.keys(entry.answers || {}).length > 3 && (
                        <div className="text-sm text-gray-500 italic">
                          +{Object.keys(entry.answers || {}).length - 3} autres champs...
                        </div>
                      )}
                    </div>

                    {/* File attachments */}
                    {entry.fileAttachments && entry.fileAttachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center space-x-1">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{entry.fileAttachments.length} fichier(s) joint(s)</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const EmployeDashboard: React.FC = () => {
  const { user, firebaseUser, isLoading } = useAuth();
  const { 
    getFormsForEmployee, 
    submitMultipleFormEntries,
    updateFormEntry,
    getEntriesForEmployee,
    getDraftsForForm,
    saveDraft,
    deleteDraft,
    deleteDraftsForForm,
    createDraft,
    isLoading: appLoading
  } = useApp();
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [viewingEntries, setViewingEntries] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [isSubmittingDrafts, setIsSubmittingDrafts] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    draftId: string | null;
    draftTitle: string;
  }>({ show: false, draftId: null, draftTitle: '' });
  const [showResponsesInterface, setShowResponsesInterface] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sample video data - in a real app, this would come from your backend
  const employeeVideos = [
    {
      id: '1',
      title: 'Comment remplir les formulaires efficacement',
      description: 'Apprenez les meilleures pratiques pour remplir vos formulaires de manière efficace et éviter les erreurs courantes.',
      youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
      duration: '5:30',
      category: 'Formation'
    },
    {
      id: '2',
      title: 'Gestion du temps et des priorités',
      description: 'Découvrez des techniques pour mieux organiser votre temps et gérer vos priorités au travail.',
      youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
      duration: '8:15',
      category: 'Productivité'
    },
    {
      id: '3',
      title: 'Communication professionnelle',
      description: 'Améliorez vos compétences en communication pour une meilleure collaboration avec vos collègues.',
      youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
      duration: '12:45',
      category: 'Communication'
    },
    {
      id: '4',
      title: 'Sécurité au travail',
      description: 'Rappel des règles de sécurité essentielles à respecter dans votre environnement de travail.',
      youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
      duration: '6:20',
      category: 'Sécurité'
    }
  ];

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

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const formatDate = (date: Date | string) => {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString();
    } catch (error) {
      return 'Date invalide';
    }
  };

  const formatTime = (date: Date | string) => {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleTimeString();
    } catch (error) {
      return 'Heure invalide';
    }
  };


  const handleAddResponse = async (formId: string, answers: Record<string, any>, fileAttachments: any[] = []) => {
    if (!user?.id || !user?.agencyId) return;
    
    setIsSavingDraft(true);
    
    try {
      const newDraft = createDraft(formId, user.id, user.agencyId, answers, fileAttachments);
      saveDraft(newDraft);
      showToast('success', 'Réponse ajoutée aux brouillons');
      
      // Clear the form by resetting the editing state
      setEditingDraftId(null);
    } catch (error) {
      console.error('Error adding response:', error);
      showToast('error', 'Erreur lors de l\'ajout de la réponse');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleEditDraft = (draftId: string, formId: string) => {
    setEditingDraftId(draftId);
    setSelectedFormId(formId);
  };

  const handleDeleteDraft = (draftId: string, draftTitle: string) => {
    setDeleteModal({
      show: true,
      draftId,
      draftTitle
    });
  };

  const confirmDeleteDraft = () => {
    if (deleteModal.draftId) {
      deleteDraft(deleteModal.draftId);
      showToast('success', 'Brouillon supprimé');
      setDeleteModal({ show: false, draftId: null, draftTitle: '' });
    }
  };

  const cancelDeleteDraft = () => {
    setDeleteModal({ show: false, draftId: null, draftTitle: '' });
  };

  const handleSaveDraft = async (draftId: string, answers: Record<string, any>, fileAttachments: any[] = []) => {
    if (!user?.id || !user?.agencyId || !selectedFormId) return;
    
    setIsSavingDraft(true);
    
    try {
      const drafts = getDraftsForForm(user.id, selectedFormId);
      const draft = drafts.find(d => d.id === draftId);
      
      if (draft) {
        const updatedDraft = {
          ...draft,
          answers,
          fileAttachments,
          updatedAt: new Date()
        };
        saveDraft(updatedDraft);
        showToast('success', 'Brouillon sauvegardé');
        
        // Keep the form open for continued editing
        // Don't close the section - user can continue editing or manually close
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      showToast('error', 'Erreur lors de la sauvegarde du brouillon');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmitAllDrafts = async (formId: string) => {
    if (!user?.id || !user?.agencyId) return;
    
    const drafts = getDraftsForForm(user.id, formId);
    if (drafts.length === 0) {
      showToast('error', 'Aucun brouillon à soumettre');
      return;
    }

    setIsSubmittingDrafts(true);
    
    try {
      const entries = drafts.map(draft => ({
        formId: draft.formId,
        answers: draft.answers,
        fileAttachments: draft.fileAttachments || []
      }));

      await submitMultipleFormEntries(entries);
      deleteDraftsForForm(user.id, formId);
      showToast('success', `${drafts.length} réponse(s) soumise(s) avec succès`);
      
      // Only navigate back to dashboard after successful submission
      setSelectedFormId(null);
      setEditingDraftId(null);
    } catch (error) {
      console.error('Error submitting drafts:', error);
      showToast('error', 'Erreur lors de la soumission des réponses');
    } finally {
      setIsSubmittingDrafts(false);
    }
  };


  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  // Helper functions for new stats
  const getFormsToFillToday = (assignedForms: any[], myEntries: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let formsToFillToday = 0;

    assignedForms.forEach(form => {
      // Check if form has time restrictions
      if (form.timeRestrictions && (form.timeRestrictions.startTime || form.timeRestrictions.endTime)) {
        // For forms with time restrictions, check if they've been filled today
        const todayEntries = myEntries.filter(entry => 
          entry.formId === form.id && 
          new Date(entry.submittedAt) >= today && 
          new Date(entry.submittedAt) < tomorrow
        );
        
        if (todayEntries.length === 0) {
          formsToFillToday++;
        }
      } else {
        // For forms without time restrictions, check if they've been filled at least once today
        const todayEntries = myEntries.filter(entry => 
          entry.formId === form.id && 
          new Date(entry.submittedAt) >= today && 
          new Date(entry.submittedAt) < tomorrow
        );
        
        if (todayEntries.length === 0) {
          formsToFillToday++;
        }
      }
    });

    return formsToFillToday;
  };

  const getFormsToCatchUp = (assignedForms: any[], myEntries: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let formsToCatchUp = 0;

    assignedForms.forEach(form => {
      // Check if form has time restrictions
      if (form.timeRestrictions && (form.timeRestrictions.startTime || form.timeRestrictions.endTime)) {
        // For forms with time restrictions, count days since creation where no response was submitted
        const formCreatedDate = new Date(form.createdAt);
        formCreatedDate.setHours(0, 0, 0, 0);
        
        let currentDate = new Date(formCreatedDate);
        while (currentDate < today) {
          const nextDay = new Date(currentDate);
          nextDay.setDate(nextDay.getDate() + 1);
          
          const dayEntries = myEntries.filter(entry => 
            entry.formId === form.id && 
            new Date(entry.submittedAt) >= currentDate && 
            new Date(entry.submittedAt) < nextDay
          );
          
          if (dayEntries.length === 0) {
            formsToCatchUp++;
          }
          
          currentDate = nextDay;
        }
      } else {
        // For forms without time restrictions, check if they've been filled at least once
        const formEntries = myEntries.filter(entry => entry.formId === form.id);
        if (formEntries.length === 0) {
          formsToCatchUp++;
        }
      }
    });

    return formsToCatchUp;
  };

  const canEditResponse = (submittedAt: Date | string) => {
    const submittedTime = new Date(submittedAt);
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return submittedTime > threeHoursAgo;
  };

  const handleUpdateResponse = async (responseId: string, updatedAnswers: Record<string, any>, updatedFileAttachments: any[]) => {
    try {
      // Update the response in Firebase
      await updateFormEntry(responseId, {
        answers: updatedAnswers,
        fileAttachments: updatedFileAttachments
      });
      
      showToast('success', 'Réponse mise à jour avec succès');
      
    } catch (error) {
      console.error('Error updating response:', error);
      showToast('error', 'Erreur lors de la mise à jour de la réponse');
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


        const getFormEntryCount = (formId: string) => {
          return myEntries.filter(entry => entry.formId === formId).length;
        };

        const getDraftCount = (formId: string) => {
          return getDraftsForForm(user?.id || '', formId).length;
        };

        const getTotalSubmissions = () => {
          return myEntries.length;
        };

        if (selectedForm) {
          const drafts = getDraftsForForm(user?.id || '', selectedForm.id);
          const currentDraft = editingDraftId ? drafts.find(d => d.id === editingDraftId) : null;
          
          return (
            <Layout title="Remplir le formulaire">
              <div className="mb-6">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedFormId(null);
                    setEditingDraftId(null);
                  }}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Retour au dashboard</span>
                </Button>
              </div>

              {/* Form Display - Always show the form ready to be filled */}
              <div className="mb-6">
                <Card>
                  <div className="p-6">
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {selectedForm.title}
                      </h2>
                      <p className="text-sm text-gray-600 mb-4">
                        {selectedForm.description}
                      </p>
                      
                      {/* Simple explanation for employers */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-sm font-medium">i</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-blue-900 mb-2">
                              Comment soumettre vos réponses
                            </h3>
                            <div className="text-sm text-blue-800 space-y-1">
                              <p>• <strong>Remplissez le formulaire</strong> ci-dessous avec vos informations</p>
                              <p>• Cliquez sur <strong>"Ajouter la réponse"</strong> pour sauvegarder</p>
                              <p>• Répétez pour ajouter plusieurs réponses</p>
                              <p>• Quand vous avez terminé, cliquez sur <strong>"Soumettre mes réponses"</strong></p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {currentDraft ? (
                      <DynamicForm
                        key={`edit-${currentDraft.id}`}
                        form={selectedForm}
                        onSubmit={(answers, fileAttachments) => handleSaveDraft(currentDraft.id, answers, fileAttachments)}
                        onCancel={() => setEditingDraftId(null)}
                        initialAnswers={currentDraft.answers}
                        initialFileAttachments={currentDraft.fileAttachments}
                        isDraft={true}
                        isLoading={isSavingDraft}
                      />
                    ) : (
                      <DynamicForm
                        key={`new-${selectedForm.id}-${drafts.length}`}
                        form={selectedForm}
                        onSubmit={(answers, fileAttachments) => handleAddResponse(selectedForm.id, answers, fileAttachments)}
                        onCancel={() => setSelectedFormId(null)}
                        initialAnswers={{}}
                        initialFileAttachments={[]}
                        isDraft={false}
                        isLoading={isSavingDraft}
                      />
                    )}
                  </div>
                </Card>
              </div>

              {/* Draft Responses Section */}
              {drafts.length > 0 ? (
              <div className="mb-6">
                <Card>
                  <div className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Mes réponses en brouillon
                        </h3>
                        <p className="text-sm text-gray-600">
                            {drafts.length} réponse(s) sauvegardée(s)
                        </p>
                      </div>
                      
                          <Button
                            onClick={() => handleSubmitAllDrafts(selectedForm.id)}
                            disabled={isSubmittingDrafts}
                            className="flex items-center space-x-2"
                          >
                            <Send className="h-4 w-4" />
                            <span>
                            {isSubmittingDrafts ? 'Soumission en cours...' : `Soumettre mes réponses (${drafts.length})`}
                            </span>
                          </Button>
                    </div>

                    {/* Draft List */}
                      <div className="space-y-3">
                          {drafts.map((draft, index) => (
                            <div
                              key={draft.id}
                            className={`p-4 rounded-lg border ${
                                editingDraftId === draft.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <FileEdit className="h-4 w-4 text-gray-500" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    Réponse #{index + 1}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Créé le {formatDate(draft.createdAt)} à {formatTime(draft.createdAt)}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleEditDraft(draft.id, selectedForm.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <Edit className="h-3 w-3" />
                                  <span>Modifier</span>
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDeleteDraft(draft.id, `Réponse #${index + 1}`)}
                                  className="flex items-center space-x-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Draft Preview */}
                            <div className="space-y-2">
                              {Object.entries(draft.answers || {}).slice(0, 3).map(([fieldId, value]) => {
                                const field = selectedForm.fields.find(f => f.id === fieldId);
                                const fieldLabel = field?.label || fieldId;
                                
                                return (
                                  <div key={fieldId} className="text-xs">
                                    <span className="font-medium text-gray-800">{fieldLabel}:</span>
                                    <span className="ml-1 text-gray-600">
                                      {value !== null && value !== undefined ? 
                                        (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value).substring(0, 50) + (String(value).length > 50 ? '...' : '')) : 
                                        '-'
                                      }
                                    </span>
                        </div>
                                );
                              })}
                              {Object.keys(draft.answers || {}).length > 3 && (
                                <div className="text-xs text-gray-500 italic">
                                  +{Object.keys(draft.answers || {}).length - 3} autres champs...
                      </div>
                    )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="mb-6">
                  <Card>
                    <div className="p-4">
                      <div className="text-center py-6">
                        <FileEdit className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Aucune réponse en brouillon
                        </h3>
                        <p className="text-sm text-gray-600">
                          Remplissez le formulaire ci-dessus et cliquez sur "Ajouter la réponse" pour commencer.
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </Layout>
          );
        }

        return (
          <Layout title="Dashboard Employé">
            <div className="space-y-6 lg:space-y-8">
               {/* Statistiques rapides */}
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 opacity-80" />
                    <div>
                       <p className="text-blue-100">À remplir aujourd'hui</p>
                       <p className="text-xl sm:text-2xl font-bold">{getFormsToFillToday(assignedForms, myEntries)}</p>
                     </div>
                   </div>
                 </Card>
                 
                 <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                   <div className="flex items-center space-x-3">
                     <AlertTriangle className="h-8 w-8 opacity-80" />
                     <div>
                       <p className="text-orange-100">Formulaires à rattraper</p>
                       <p className="text-xl sm:text-2xl font-bold">{getFormsToCatchUp(assignedForms, myEntries)}</p>
                    </div>
                  </div>
                </Card>
                
                 <div 
                   className="cursor-pointer col-span-2 lg:col-span-1"
                   onClick={() => setShowResponsesInterface(true)}
                 >
                   <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all duration-200">
                     <div className="flex items-center space-x-3">
                       <CheckCircle className="h-8 w-8 opacity-80" />
                       <div>
                         <p className="text-green-100">Réponses soumises</p>
                         <p className="text-xl sm:text-2xl font-bold">{getTotalSubmissions()}</p>
                         <p className="text-xs text-green-200">Cliquez pour voir</p>
                       </div>
                     </div>
                   </Card>
                 </div>
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
                  <div className="relative">
                    <div ref={scrollContainerRef} className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide horizontal-scroll-forms">
                    {assignedForms.map(form => {
                      const entryCount = getFormEntryCount(form.id);
                      const draftCount = getDraftCount(form.id);
                      
                      return (
                        <div
                          key={form.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 hover:shadow-lg transition-all duration-200 hover:border-green-300 mobile-form-card flex-shrink-0 w-80 sm:w-96"
                        >
                          {/* Header avec titre et badges */}
                          <div className="mb-3">
                            <div className="flex flex-col space-y-2">
                              <h3 className="font-semibold text-gray-900 text-base sm:text-lg line-clamp-2 leading-tight">
                                {form.title}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {entryCount > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {entryCount} réponse(s)
                                  </span>
                                )}
                                {draftCount > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    📝 {draftCount} brouillon(s)
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
                          </div>

                          {/* Description */}
                          <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                            {form.description}
                          </p>

                          {/* Statistiques */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <div className="text-lg font-bold text-gray-900">{form.fields.length}</div>
                              <div className="text-xs text-gray-600">Champ(s)</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <div className="text-lg font-bold text-gray-900">{entryCount + draftCount}</div>
                              <div className="text-xs text-gray-600">Total</div>
                            </div>
                          </div>

                          {/* Date de création */}
                          <div className="text-xs text-gray-500 mb-4">
                            Créé le {form.createdAt.toLocaleDateString()}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col space-y-2 form-card-actions">
                            <Button
                              size="sm"
                              onClick={() => setSelectedFormId(form.id)}
                              className="w-full flex items-center justify-center space-x-1 text-xs"
                            >
                              <span>Remplir le formulaire</span>
                            </Button>
                            
                            {entryCount > 0 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setViewingEntries(
                                  viewingEntries === form.id ? null : form.id
                                )}
                                className="w-full flex items-center justify-center space-x-1 text-xs"
                              >
                                <Eye className="h-3 w-3" />
                                <span>{viewingEntries === form.id ? 'Masquer mes réponses' : 'Voir mes réponses'}</span>
                              </Button>
                            )}
                          </div>

                          {/* Affichage des réponses de l'employé */}
                          {viewingEntries === form.id && entryCount > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <h4 className="font-medium text-gray-900 mb-3 text-sm">Mes réponses précédentes</h4>
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {myEntries
                                  .filter(entry => entry.formId === form.id)
                                  .map(entry => (
                                    <div key={entry.id} className="bg-green-50 p-3 rounded-lg border border-green-100">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-green-600 font-medium">
                                          Réponse #{myEntries.filter(e => e.formId === form.id).indexOf(entry) + 1}
                                        </span>
                                        <span className="text-xs text-green-600">
                                          {new Date(entry.submittedAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {Object.entries(entry.answers || {}).slice(0, 3).map(([fieldId, value]) => {
                                          const field = form.fields.find(f => f.id === fieldId);
                                          const fieldLabel = field?.label || fieldId;
                                          
                                          return (
                                            <div key={fieldId} className="text-xs">
                                              <span className="font-medium text-green-800">{fieldLabel}:</span>
                                              <span className="ml-1 text-green-900">
                                                {value !== null && value !== undefined ? 
                                                  (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value).substring(0, 50) + (String(value).length > 50 ? '...' : '')) : 
                                                  '-'
                                                }
                                              </span>
                                            </div>
                                          );
                                        })}
                                        {Object.keys(entry.answers || {}).length > 3 && (
                                          <div className="text-xs text-green-600 italic">
                                            +{Object.keys(entry.answers || {}).length - 3} autres champs...
                                          </div>
                                        )}
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
                    
                    {/* Indicateurs de scroll */}
                    {assignedForms.length > 1 && (
                      <>
                        <div className="scroll-indicator scroll-indicator-left hidden md:flex" onClick={scrollLeft}>
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </div>
                        <div className="scroll-indicator scroll-indicator-right hidden md:flex" onClick={scrollRight}>
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>

              {/* Video Section */}
              <VideoSection 
                title="Vidéos de formation"
                videos={employeeVideos}
                className="mt-6"
              />
            </div>
          </Layout>
        );
      })()}

       {/* Responses Interface Modal */}
       {showResponsesInterface && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
             <div className="p-6 border-b border-gray-200">
               <div className="flex items-center justify-between">
                 <h2 className="text-xl font-semibold text-gray-900">Mes réponses soumises</h2>
                 <button
                   onClick={() => setShowResponsesInterface(false)}
                   className="text-gray-400 hover:text-gray-600"
                 >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>
             </div>
             
             <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
               <ResponsesInterface 
                 myEntries={getEntriesForEmployee(user?.id || '')}
                 assignedForms={getFormsForEmployee(user?.id || '')}
                 onClose={() => setShowResponsesInterface(false)}
                 canEditResponse={canEditResponse}
                 onUpdateResponse={handleUpdateResponse}
               />
             </div>
           </div>
         </div>
       )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Supprimer le brouillon
                  </h3>
                  <p className="text-sm text-gray-500">
                    Cette action est irréversible
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-700">
                  Êtes-vous sûr de vouloir supprimer le brouillon <strong>"{deleteModal.draftTitle}"</strong> ?
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Toutes les données saisies dans ce brouillon seront perdues.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <Button
                  variant="secondary"
                  onClick={cancelDeleteDraft}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmDeleteDraft}
                  className="flex-1"
                >
                  Supprimer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className={`ml-2 text-lg leading-none hover:opacity-70 ${
                toast.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </LoadingGuard>
  );
};