import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, FormField } from '../../types';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { usePermissions } from '@ubora/shared/hooks/usePermissions';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormEditor } from '../../components/forms/FormEditor';
import { FormBuilder } from '../../components/forms/FormBuilder';
import { DynamicForm } from '../../components/forms/DynamicForm';
import { WireframeLoader } from '../../components/loading/WireframeLoader';
import { Plus, FileText, Users, Eye, Trash2, Edit, UserCheck, BarChart3, Calendar, ChevronDown, Crown, User as UserIcon, ClipboardList, FileEdit, FileBarChart, ArrowLeft, Send, Sparkles } from 'lucide-react';
import { PendingApprovals } from '../../components/employees/PendingApprovals';
import { VideoSection } from '../../components/core/VideoSection';
import { directorVideos } from '../../data/videoData';
import { DashboardBuilder } from '../../components/dashboard/DashboardBuilder';
import { DashboardDisplay } from '../../components/dashboard/DashboardDisplay';
import { ComingSoonModal } from '../../components/modals/ComingSoonModal';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../../components/ui/Toast';
import { usePackageAccess } from '../../hooks/packages/usePackageAccess';
import { LimitReachedModal } from '../../components/modals/LimitReachedModal';
import { ImpersonationHeader } from '../../components/layout/ImpersonationHeader';
import { AccessDeniedModal } from '../../components/modals/AccessDeniedModal';
import { universService } from '@ubora/shared/services/universService';
import { UniversBadge } from '../../components/univers/UniversBadge';

export const DirecteurDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, firebaseUser, isLoading } = useAuth();
  const { hasDirectorDashboardAccess } = usePermissions();
  
  const { 
    forms,
    formEntries,
    employees,
    dashboards,
    createForm, 
    updateForm,
    deleteForm,
    // Draft workflow and submissions
    getDraftsForForm,
    saveDraft,
    deleteDraft,
    deleteDraftsForForm,
    createDraft,
    submitMultipleFormEntries,
    submitFormEntry,
    getEntriesForForm,
    getPendingEmployees,
    createDashboard,
    deleteDashboard,
    isLoading: appLoading
  } = useApp();
  const { toast, showSuccess, showError } = useToast();
  const { 
    canCreateForm, 
    canCreateDashboard, 
    getLimit,
    packageInfo
  } = usePackageAccess();
  
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [showDashboardBuilder, setShowDashboardBuilder] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [showDeleteFormModal, setShowDeleteFormModal] = useState(false);
  const [showDeleteDashboardModal, setShowDeleteDashboardModal] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{id: string, title: string} | null>(null);
  const [dashboardToDelete, setDashboardToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState(false);
  const [isDeletingDashboard, setIsDeletingDashboard] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<'forms' | 'dashboards' | 'users'>('forms');
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [accessDeniedFeature, setAccessDeniedFeature] = useState<'programmed-instructions' | 'push-indicators'>('programmed-instructions');
  const [selectedFormForFilling, setSelectedFormForFilling] = useState<Form | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmittingDrafts, setIsSubmittingDrafts] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [universCount, setUniversCount] = useState<number>(0);
  const [showUniversHighlight, setShowUniversHighlight] = useState(false);
  const [universMap, setUniversMap] = useState<Map<string, { name: string }>>(new Map()); // Cache Univers names
  
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

         // Load Univers count and cache Univers names
         useEffect(() => {
           const loadUniversData = async () => {
             if (!user?.id || !user?.agencyId) return;
             try {
               // getUserUnivers inclut les univers créés ET les instances achetées
               const [myUnivers, marketplaceUnivers] = await Promise.all([
                 universService.getUserUnivers(user.id, user.agencyId),
                 universService.getMarketplaceTemplates()
               ]);

               // Combine and create map for quick lookup
               const map = new Map<string, { name: string }>();
               [...myUnivers, ...marketplaceUnivers].forEach(u => {
                 map.set(u.id, { name: u.metadata.name });
               });

               setUniversMap(map);
               // Compter tous les univers (créés + instances achetées)
               setUniversCount(myUnivers.length);
             } catch (error) {
               console.error('Erreur lors du chargement des Univers:', error);
             }
           };
           loadUniversData();
         }, [user?.id, user?.agencyId]);

  // Trigger highlight animation on mount
  useEffect(() => {
    setShowUniversHighlight(true);
    const timer = setTimeout(() => {
      setShowUniversHighlight(false);
    }, 2000); // Highlight for 2 seconds
    return () => clearTimeout(timer);
  }, []);

  // Handler for Univers button
  const handleUniversClick = () => {
    navigate('/univers');
  };

  // Function to get form icon based on form type or content
  const getFormIcon = (form: Form) => {
    // Check if form has specific field types that suggest its purpose
    const hasFileFields = form.fields.some(field => field.type === 'file');
    const hasDateFields = form.fields.some(field => field.type === 'date');
    const hasNumberFields = form.fields.some(field => field.type === 'number');
    const hasSelectFields = form.fields.some(field => field.type === 'select');
    
    // Determine icon based on form characteristics
    if (hasFileFields) return <FileEdit className="h-5 w-5 text-blue-600" />;
    if (hasDateFields && hasNumberFields) return <FileBarChart className="h-5 w-5 text-green-600" />;
    if (hasSelectFields) return <ClipboardList className="h-5 w-5 text-purple-600" />;
    if (hasNumberFields) return <FileBarChart className="h-5 w-5 text-orange-600" />;
    
    // Default form icon
    return <FileText className="h-5 w-5 text-indigo-600" />;
  };


  const handleCreateForm = async (formData: {
    title: string;
    description: string;
    fields: FormField[];
    assignedTo: string[];
    timeRestrictions?: {
      startTime?: string;
      endTime?: string;
      allowedDays?: number[];
    };
  }) => {
    console.log('🟢 [FORM CREATION] ========================================');
    console.log('🟢 [FORM CREATION] Form submission started');
    console.log('🟢 [FORM CREATION] Form data:', {
      title: formData.title,
      fieldsCount: formData.fields.length,
      assignedToCount: formData.assignedTo.length
    });
    console.log('🟢 [FORM CREATION] Current forms count before creation:', forms.length);
    
    setIsCreatingForm(true);
    try {
      if (!user?.id || !user?.agencyId) {
        throw new Error('Données utilisateur manquantes');
      }

      await createForm({
        ...formData,
        createdBy: user.id,
        createdByRole: user.role as 'directeur' | 'employe',
        agencyId: user.agencyId,
      });
      console.log('🟢 [FORM CREATION] ✅ Form created successfully');
      setShowFormBuilder(false);
      setEditingForm(null);
      showSuccess('Formulaire créé avec succès !');
    } catch (error) {
      console.error('🟢 [FORM CREATION] ❌ Error creating form:', error);
      showError('Erreur lors de la création du formulaire. Veuillez réessayer.');
    } finally {
      setIsCreatingForm(false);
      console.log('🟢 [FORM CREATION] ========================================');
    }
  };

  const handleFormButtonClick = () => {
    console.log('🔵 [QUOTA CHECK] ========================================');
    console.log('🔵 [QUOTA CHECK] Button clicked: "Créer un nouveau formulaire"');
    console.log('🔵 [QUOTA CHECK] Current form count:', forms.length);
    console.log('🔵 [QUOTA CHECK] User:', {
      id: user?.id,
      role: user?.role,
      agencyId: user?.agencyId,
      hasDirectorDashboardAccess: user?.hasDirectorDashboardAccess
    });
    
    const canCreate = canCreateForm(forms.length);
    console.log('🔵 [QUOTA CHECK] canCreateForm result:', canCreate);
    
    if (!canCreate) {
      console.log('🔵 [QUOTA CHECK] ❌ Quota check FAILED - Showing limit modal');
      setLimitModalType('forms');
      setShowLimitModal(true);
    } else {
      console.log('🔵 [QUOTA CHECK] ✅ Quota check PASSED - Opening form builder');
      setShowFormBuilder(true);
    }
    console.log('🔵 [QUOTA CHECK] ========================================');
  };

  const handleDashboardButtonClick = () => {
    if (!canCreateDashboard(dashboards.length)) {
      setLimitModalType('dashboards');
      setShowLimitModal(true);
    } else {
      setShowDashboardBuilder(true);
    }
  };

  const handleUpdateForm = async (formData: {
    title: string;
    description: string;
    fields: FormField[];
    assignedTo: string[];
    timeRestrictions?: {
      startTime?: string;
      endTime?: string;
      allowedDays?: number[];
    };
  }) => {
    if (!editingForm) return;

    try {
      await updateForm(editingForm.id, formData);
      setEditingForm(null);
      showSuccess('Formulaire mis à jour avec succès !');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du formulaire:', error);
      showError('Erreur lors de la mise à jour du formulaire. Veuillez réessayer.');
    }
  };

  const handleEditForm = (form: Form) => {
    setEditingForm(form);
  };

  const handleCancelEdit = () => {
    setEditingForm(null);
    setShowFormBuilder(false);
  };

  const handleFillForm = (form: Form) => {
    setSelectedFormForFilling(form);
  };

  const handleCancelFillForm = () => {
    setSelectedFormForFilling(null);
    setEditingDraftId(null);
  };

  // Draft helpers (mirror employee flow)
  const handleAddResponse = async (formId: string, answers: Record<string, any>, fileAttachments: any[] = []) => {
    if (!user?.id || !user?.agencyId) return;
    setIsSavingDraft(true);
    try {
      const newDraft = createDraft(formId, user.id, user.agencyId, answers, fileAttachments);
      saveDraft(newDraft);
      showSuccess('Réponse ajoutée aux brouillons');
      setEditingDraftId(null);
    } catch (error) {
      console.error('Error adding response:', error);
      showError('Erreur lors de l\'ajout de la réponse');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveDraft = async (draftId: string, answers: Record<string, any>, fileAttachments: any[] = []) => {
    if (!user?.id || !user?.agencyId || !selectedFormForFilling) return;
    setIsSavingDraft(true);
    try {
      const drafts = getDraftsForForm(user.id, selectedFormForFilling.id);
      const draft = drafts.find(d => d.id === draftId);
      if (draft) {
        const updatedDraft = { ...draft, answers, fileAttachments, updatedAt: new Date() };
        saveDraft(updatedDraft);
        showSuccess('Brouillon sauvegardé');
        setEditingDraftId(null);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      showError('Erreur lors de la sauvegarde du brouillon');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmitAllDrafts = async (formId: string) => {
    if (!user?.id || !user?.agencyId) return;
    const drafts = getDraftsForForm(user.id, formId);
    if (drafts.length === 0) {
      showError('Aucun brouillon à soumettre');
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
      showSuccess(`${drafts.length} réponse(s) soumise(s) avec succès`);
      setSelectedFormForFilling(null);
    } catch (error) {
      console.error('Error submitting drafts:', error);
      showError('Erreur lors de la soumission des brouillons');
    } finally {
      setIsSubmittingDrafts(false);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    try {
      deleteDraft(draftId);
      showSuccess('Brouillon supprimé');
    } catch (e) {
      showError('Erreur lors de la suppression du brouillon');
    }
  };

  const handleCancelDashboard = () => {
    setShowDashboardBuilder(false);
  };

  const handleCreateDashboard = async (dashboardData: {
    name: string;
    description: string;
    metrics: any[];
  }) => {
    setIsCreatingDashboard(true);
    try {
      if (!user?.id || !user?.agencyId) {
        throw new Error('Données utilisateur manquantes');
      }

      await createDashboard({
        name: dashboardData.name,
        description: dashboardData.description,
        metrics: dashboardData.metrics,
        createdBy: user.id,
        createdByRole: user.role as 'directeur' | 'employe',
        agencyId: user.agencyId,
      });
      setShowDashboardBuilder(false);
      showSuccess('Tableau de bord créé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la création du tableau de bord:', error);
      showError('Erreur lors de la création du tableau de bord. Veuillez réessayer.');
    } finally {
      setIsCreatingDashboard(false);
    }
  };

  const handleDeleteForm = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (form) {
      setFormToDelete({ id: formId, title: form.title });
      setShowDeleteFormModal(true);
    }
  };

  const confirmDeleteForm = async () => {
    if (!formToDelete) return;

    setIsDeletingForm(true);
    try {
      await deleteForm(formToDelete.id);
      showSuccess('Formulaire supprimé avec succès !');
      setShowDeleteFormModal(false);
      setFormToDelete(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showError('Erreur lors de la suppression du formulaire.');
    } finally {
      setIsDeletingForm(false);
    }
  };

  const handleDeleteDashboard = (dashboardId: string) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (dashboard) {
      setDashboardToDelete({ id: dashboardId, name: dashboard.name });
      setShowDeleteDashboardModal(true);
    }
  };

  const handleProgrammedInstructionsClick = () => {
    if (!user) return;
    
    // Check if package has programmed instructions feature
    // programmedInstructions is in PACKAGE_LIMITS, check via package type
    const hasAccess = packageInfo?.packageType && 
      (packageInfo.packageType === 'starter' || packageInfo.packageType === 'standard');
    
    if (hasAccess) {
      navigate('/directeur/scheduled-questions');
    } else {
      setAccessDeniedFeature('programmed-instructions');
      setShowAccessDeniedModal(true);
    }
  };

  const confirmDeleteDashboard = async () => {
    if (!dashboardToDelete) return;

    setIsDeletingDashboard(true);
    try {
      await deleteDashboard(dashboardToDelete.id);
      showSuccess('Tableau de bord supprimé avec succès !');
      setShowDeleteDashboardModal(false);
      setDashboardToDelete(null);
    } catch (error) {
      console.error('Erreur lors de la suppression du tableau de bord:', error);
      showError('Erreur lors de la suppression du tableau de bord.');
    } finally {
      setIsDeletingDashboard(false);
    }
  };

  const handleViewDashboard = (dashboard: any) => {
    navigate(`/directeur/dashboards/${dashboard.id}`);
  };


  const handleViewResponses = (formId: string) => {
    navigate(`/responses/${formId}`);
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
        const last7days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: last7days, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'last30days':
        const last30days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: last30days, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'thisweek':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { start: startOfWeek, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'lastweek':
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay());
        return { start: lastWeekStart, end: lastWeekEnd };
      case 'thismonth':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: startOfMonth, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'lastmonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: lastMonthStart, end: lastMonthEnd };
      case 'thisquarter':
        const quarter = Math.floor(now.getMonth() / 3);
        const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
        return { start: startOfQuarter, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'lastquarter':
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const lastQuarterStart = new Date(now.getFullYear(), lastQuarter * 3, 1);
        const lastQuarterEnd = new Date(now.getFullYear(), (lastQuarter + 1) * 3, 1);
        return { start: lastQuarterStart, end: lastQuarterEnd };
      case 'thisyear':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return { start: startOfYear, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'lastyear':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear(), 0, 1);
        return { start: lastYearStart, end: lastYearEnd };
      case 'custom':
        return {
          start: customDateRange.start ? new Date(customDateRange.start) : null,
          end: customDateRange.end ? new Date(customDateRange.end) : null
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

  const getFilteredData = () => {
    const { start, end } = getDateRange(timeFilter);
    
    const filteredForms = forms.filter(form => 
      isDateInRange(form.createdAt, start, end)
    );
    
    const filteredFormEntries = formEntries.filter(entry => 
      isDateInRange(new Date(entry.submittedAt), start, end)
    );
    
    const filteredEmployees = employees.filter(emp => 
      emp.createdAt && isDateInRange(emp.createdAt, start, end)
    );
    
    return {
      forms: filteredForms,
      formEntries: filteredFormEntries,
      employees: filteredEmployees
    };
  };



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
    } else if (!restrictions.startTime && restrictions.endTime) {
      timeStr = `À remplir avant ${restrictions.endTime}`;
    } else if (restrictions.startTime && !restrictions.endTime) {
      // Legacy single-time stored in startTime
      timeStr = `À remplir avant ${restrictions.startTime}`;
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


  function refreshData(): void {
    throw new Error('Function not implemented.');
  }

  // Show wireframe immediately if any loading state
  if (isLoading || !user || !firebaseUser || appLoading) {
    return (
      <>
        <ImpersonationHeader />
        <Layout title="Dashboard Directeur">
          <WireframeLoader type="dashboard" />
        </Layout>
      </>
    );
  }

  return (
    <>
      {!hasDirectorDashboardAccess() ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Accès refusé</h1>
            <p className="text-gray-600">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
          </Card>
        </div>
      ) : showFormBuilder || editingForm ? (
        <Layout title={editingForm ? "Modifier le formulaire" : "Créer un formulaire"}>
          {editingForm ? (
            <FormEditor
              form={editingForm}
              onSave={handleUpdateForm}
              onCancel={handleCancelEdit}
              employees={employees}
              currentUser={user}
            />
          ) : (
            <FormBuilder
              onSave={handleCreateForm}
              onCancel={handleCancelEdit}
              employees={employees}
              currentUser={user}
              isLoading={isCreatingForm}
            />
          )}
        </Layout>
      ) : selectedFormForFilling ? (
        <Layout title="Remplir le formulaire">
          <div className="mb-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancelFillForm}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Form Display */}
          <div className="mb-6">
            <Card>
              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {selectedFormForFilling.title}
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    {selectedFormForFilling.description}
                  </p>
                  
                  {/* Simple explanation for directors */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 text-sm font-semibold">💡</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-blue-900 mb-1">
                          Instructions pour remplir ce formulaire
                        </h3>
                        <p className="text-sm text-blue-700">
                          Remplissez tous les champs requis et soumettez votre réponse. 
                          Vous pouvez sauvegarder un brouillon à tout moment.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {(() => {
                  const drafts = getDraftsForForm(user?.id || '', selectedFormForFilling.id);
                  const currentDraft = editingDraftId ? drafts.find(d => d.id === editingDraftId) : null;
                  return (
                    <>
                      {currentDraft ? (
                        <DynamicForm
                          key={`edit-${currentDraft.id}`}
                          form={selectedFormForFilling}
                          onSubmit={(answers, fileAttachments) => handleSaveDraft(currentDraft.id, answers, fileAttachments)}
                          onCancel={() => setEditingDraftId(null)}
                          initialAnswers={currentDraft.answers}
                          initialFileAttachments={currentDraft.fileAttachments}
                          isDraft={true}
                          isLoading={isSavingDraft}
                        />
                      ) : (
                        <DynamicForm
                          key={`new-${selectedFormForFilling.id}-${drafts.length}`}
                          form={selectedFormForFilling}
                          onSubmit={(answers, fileAttachments) => handleAddResponse(selectedFormForFilling.id, answers, fileAttachments)}
                          onCancel={handleCancelFillForm}
                          initialAnswers={{}}
                          initialFileAttachments={[]}
                          isDraft={true}
                          isLoading={isSavingDraft}
                        />
                      )}

                      {/* Draft Responses Section */}
                      {drafts.length > 0 && (
                        <div className="mt-6">
                          <Card>
                            <div className="p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Mes réponses en brouillon</h3>
                                  <p className="text-sm text-gray-600">{drafts.length} réponse(s) sauvegardée(s)</p>
                                </div>
                                <Button onClick={() => handleSubmitAllDrafts(selectedFormForFilling.id)} disabled={isSubmittingDrafts} className="flex items-center space-x-2">
                                  <Send className="h-4 w-4" />
                                  <span>{isSubmittingDrafts ? 'Soumission en cours...' : `Soumettre mes réponses (${drafts.length})`}</span>
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {drafts.map((draft: any, index: number) => (
                                  <div key={draft.id} className={`p-4 rounded-lg border ${editingDraftId === draft.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center space-x-3">
                                        <FileEdit className="h-4 w-4 text-gray-500" />
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">Réponse #{index + 1}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Button variant="secondary" size="sm" onClick={() => setEditingDraftId(draft.id)}>Modifier</Button>
                                        <Button variant="danger" size="sm" onClick={() => handleDeleteDraft(draft.id)}>Supprimer</Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </Card>
          </div>
        </Layout>
      ) : showDashboardBuilder ? (
        <Layout title="Créer un tableau de bord">
          <DashboardBuilder
            onSave={handleCreateDashboard}
            onCancel={handleCancelDashboard}
            forms={forms}
            formEntries={formEntries}
            currentUserId={user?.id || ''}
            agencyId={user?.agencyId || ''}
            isLoading={isCreatingDashboard}
          />
        </Layout>
      ) : (
        <>
          <ImpersonationHeader />
          <Layout title="Dashboard Directeur">
            {appLoading ? (
              <WireframeLoader type="dashboard" />
            ) : (
            <div className="space-y-6 lg:space-y-8">
            
            {/* Univer Ubora Button - Prominent at top */}
            <div className={`relative overflow-hidden rounded-xl transition-all duration-500 ${
              showUniversHighlight 
                ? 'ring-4 ring-blue-400 ring-opacity-50 shadow-2xl transform scale-[1.01]' 
                : 'shadow-lg'
            }`}>
              <button
                onClick={handleUniversClick}
                className="relative w-full bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-blue-600 text-white p-6 sm:p-8 rounded-xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group overflow-hidden"
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                
                {/* Content */}
                <div className="relative flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                  <div className="flex items-center space-x-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 group-hover:bg-white/30 transition-colors">
                        <Sparkles className="h-6 w-6 sm:h-8 sm:w-8" />
                      </div>
                    </div>
                    
                    {/* Text */}
                    <div className="text-left">
                      <h2 className="text-xl sm:text-2xl font-bold mb-1">
                        Univer Ubora
                      </h2>
                      <p className="text-sm sm:text-base text-blue-100 opacity-90">
                        Créez et gérez vos Univers - Templates regroupant formulaires, tableaux de bord, instructions et plus
                      </p>
                    </div>
                  </div>
                  
                  {/* Count badge */}
                  <div className="flex items-center space-x-3">
                    {universCount > 0 && (
                      <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                        <span className="text-sm font-semibold">{universCount} Univers</span>
                      </div>
                    )}
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 group-hover:bg-white/30 transition-colors">
                      <ArrowLeft className="h-5 w-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Filtre temporel compact */}
            
            <div className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">Période:</span>
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
                    className="appearance-none bg-white border border-gray-300 rounded-md px-2 py-1.5 pr-6 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-w-[120px] sm:min-w-[140px]"
                  >
                    <option value="all">Toutes les périodes</option>
                    <option value="today">Aujourd'hui</option>
                    <option value="yesterday">Hier</option>
                    <option value="last7days">7 derniers jours</option>
                    <option value="last30days">30 derniers jours</option>
                    <option value="thisweek">Cette semaine</option>
                    <option value="lastweek">Semaine dernière</option>
                    <option value="thismonth">Ce mois</option>
                    <option value="lastmonth">Mois dernier</option>
                    <option value="thisquarter">Ce trimestre</option>
                    <option value="lastquarter">Trimestre dernier</option>
                    <option value="thisyear">Cette année</option>
                    <option value="lastyear">Année dernière</option>
                    <option value="custom">Période personnalisée</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                </div>
                
                {/* Bouton pour ouvrir le sélecteur de dates personnalisées */}
                {timeFilter === 'custom' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Dates</span>
                  </Button>
                )}
              </div>
            </div>
              
            {/* Sélecteur de dates personnalisées */}
            {showCustomDatePicker && timeFilter === 'custom' && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Date de début
                      </label>
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
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Date de fin
                      </label>
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
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowCustomDatePicker(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCustomDatePicker(false)}
                      disabled={!customDateRange.start || !customDateRange.end}
                    >
                      Appliquer
                    </Button>
                  </div>
                </div>
              )}

            {/* Statistiques */}
            {(() => {
              const filteredData = getFilteredData();
              return (
                <div className={`grid gap-3 sm:gap-4 lg:gap-6 ${
                  user?.role === 'directeur' 
                    ? 'grid-cols-2 lg:grid-cols-4' 
                    : 'grid-cols-2 lg:grid-cols-3'
                }`}>
                  <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 opacity-80 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-blue-100 text-xs">Formulaires créés</p>
                        <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">{filteredData.forms.length}</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 opacity-80 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-green-100 text-xs">Employés approuvés</p>
                        <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">{filteredData.employees.filter(emp => emp.isApproved !== false).length}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Only show "En attente" card for actual directors */}
                  {user?.role === 'directeur' && (
                    <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 opacity-80 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-yellow-100 text-xs">En attente</p>
                          <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">{getPendingEmployees().length}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                  
                  <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 opacity-80 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-purple-100 text-xs">Réponses totales</p>
                        <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">{filteredData.formEntries.length}</p>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })()}

            {/* Section des approbations en attente - Only for actual directors */}
            {user?.role === 'directeur' && (
              <PendingApprovals
                pendingEmployees={getPendingEmployees()}
                currentDirectorId={user?.id || ''}
                onApprovalChange={refreshData}
              />
            )}


            {/* Actions principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Button
                onClick={handleFormButtonClick}
                className="flex items-center justify-center space-x-2 w-full text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Créer un nouveau formulaire</span>
              </Button>
              
              <Button
                onClick={handleDashboardButtonClick}
                variant="secondary"
                className="flex items-center justify-center space-x-2 w-full text-sm sm:text-base"
              >
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Créer un nouveau tableau de bord</span>
              </Button>
              
              {user && packageInfo?.packageType && 
               (packageInfo.packageType === 'starter' || packageInfo.packageType === 'standard') && (
                <Button
                  onClick={handleProgrammedInstructionsClick}
                  variant="secondary"
                  className="flex items-center justify-center space-x-2 w-full text-sm sm:text-base"
                >
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="truncate">Instructions Programmées</span>
                </Button>
              )}
            </div>

            {/* Liste des formulaires */}
            <Card title={`Formulaires créés (${getFilteredData().forms.length})`}>
              {(() => {
                const filteredData = getFilteredData();
                return filteredData.forms.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">
                      {timeFilter === 'all' 
                        ? 'Aucun formulaire créé pour le moment'
                        : 'Aucun formulaire créé dans cette période'
                      }
                    </p>
                    {timeFilter === 'all' && (
                      <Button 
                        onClick={handleFormButtonClick}
                      >
                        Créer votre premier formulaire
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div ref={scrollContainerRef} className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide horizontal-scroll-forms">
                    {filteredData.forms.map(form => {
                    const formEntriesForForm = getEntriesForForm(form.id);
                    
                    return (
                      <div
                        key={form.id}
                        className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 mobile-form-card flex-shrink-0 w-80 sm:w-96 h-80 relative group flex flex-col"
                      >
                        {/* Delete button in top-right corner */}
                        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteForm(form.id)}
                            className="p-1.5 h-8 w-8 shadow-lg"
                            title="Supprimer le formulaire"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Header avec icône, titre et badge */}
                        <div className="mb-3 pr-10 flex-shrink-0">
                          <div className="flex items-start space-x-3 mb-2">
                            <div className="flex-shrink-0 mt-1">
                              {getFormIcon(form)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 text-base sm:text-lg leading-tight" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: '1.3'
                              }}>
                                {form.title}
                              </h3>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {form.fromUnivers && form.universId && universMap.has(form.universId) && (
                              <UniversBadge
                                universId={form.universId}
                                universName={universMap.get(form.universId)?.name}
                                size="sm"
                              />
                            )}
                            {form.timeRestrictions && formatTimeRestrictions(form.timeRestrictions) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                                🕒 {formatTimeRestrictions(form.timeRestrictions)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-600 mb-4 leading-relaxed flex-1" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {form.description}
                        </p>

                        {/* Statistiques */}
                        <div className="grid grid-cols-3 gap-3 mb-4 flex-shrink-0">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 text-center border border-blue-200">
                            <div className="text-xl font-bold text-blue-700">{formEntriesForForm.length}</div>
                            <div className="text-xs text-blue-600 font-medium">Réponse(s)</div>
                          </div>
                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 text-center border border-green-200">
                            <div className="text-xl font-bold text-green-700">{form.fields.length}</div>
                            <div className="text-xs text-green-600 font-medium">Champ(s)</div>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 text-center border border-purple-200">
                            <div className="text-xl font-bold text-purple-700">{form.assignedTo.length}</div>
                            <div className="text-xs text-purple-600 font-medium">Employé(s)</div>
                          </div>
                        </div>

                        {/* Date de création et créateur */}
                        <div className="text-xs text-gray-500 mb-4 space-y-1 flex-shrink-0">
                          <div>Créé le {form.createdAt.toLocaleDateString()}</div>
                          {form.createdByRole === 'directeur' ? (
                            <div className="flex items-center space-x-1">
                              <Crown className="h-3 w-3 text-yellow-500" />
                              <span className="text-yellow-600 font-medium">Créé par le Directeur</span>
                            </div>
                          ) : form.createdByRole === 'employe' && form.createdByEmployeeId ? (
                            <div className="flex items-center space-x-1">
                              <UserIcon className="h-3 w-3 text-blue-500" />
                              <span className="text-blue-600">Créé par: {employees.find(emp => emp.id === form.createdByEmployeeId)?.name || 'Employé inconnu'}</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2 form-card-actions flex-shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEditForm(form)}
                            className="flex-1 flex items-center justify-center space-x-1 text-xs bg-gray-100 hover:bg-gray-200 border-0 rounded-lg font-medium"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Modifier</span>
                          </Button>
                          
                          {/* Show "Remplir" button if form is assigned to the director */}
                          {form.assignedTo.includes(user?.id || '') && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleFillForm(form)}
                              className="flex-1 flex items-center justify-center space-x-1 text-xs bg-green-500 hover:bg-green-600 text-white border-0 rounded-lg font-medium"
                            >
                              <FileEdit className="h-3 w-3" />
                              <span>Remplir</span>
                            </Button>
                          )}
                          
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleViewResponses(form.id)}
                            className="flex-1 flex items-center justify-center space-x-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-0 rounded-lg font-medium"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Voir les réponses</span>
                          </Button>
                        </div>
                        
                      </div>
                    );
                  })}
                  </div>
                  
                    {/* Indicateurs de scroll */}
                    {filteredData.forms.length > 1 && (
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
                );
              })()}
            </Card>

            {/* Liste des tableaux de bord */}
            <Card title={`Tableaux de bord créés (${dashboards.filter(dashboard => 
              isDateInRange(dashboard.createdAt, getDateRange(timeFilter).start, getDateRange(timeFilter).end)
            ).length})`}>
              {(() => {
                const filteredDashboards = dashboards.filter(dashboard => 
                  isDateInRange(dashboard.createdAt, getDateRange(timeFilter).start, getDateRange(timeFilter).end)
                );
                
                return filteredDashboards.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">
                      {timeFilter === 'all' 
                        ? 'Aucun tableau de bord créé pour le moment'
                        : 'Aucun tableau de bord créé dans cette période'
                      }
                    </p>
                    {timeFilter === 'all' && (
                      <Button 
                        onClick={handleDashboardButtonClick}
                      >
                        Créer votre premier tableau de bord
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    {/* Always horizontal scrollable like forms and videos */}
                    <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide horizontal-scroll-dashboards">
                      {filteredDashboards.map(dashboard => (
                        <div key={dashboard.id} className="flex-shrink-0">
                          <DashboardDisplay
                            dashboard={dashboard}
                            formEntries={formEntries}
                            forms={forms}
                            employees={employees}
                            onView={handleViewDashboard}
                            onDelete={handleDeleteDashboard}
                            showActions={true}
                            minimal={true}
                            universName={dashboard.universId ? universMap.get(dashboard.universId)?.name : undefined}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Card>

            {/* Video Section */}
            <VideoSection 
              title="Vidéos de formation pour directeurs"
              videos={directorVideos}
              className="mt-6"
            />

          </div>
            )}
        </Layout>
        </>
      )}



      {/* Coming Soon Modal */}
      <ComingSoonModal
        isOpen={showComingSoonModal}
        onClose={() => setShowComingSoonModal(false)}
        title="Fonctionnalité bientôt disponible"
        description="Cette fonctionnalité sera bientôt disponible."
      />

      {/* Limit Reached Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        type={limitModalType}
        current={limitModalType === 'forms' ? forms.length : dashboards.length}
        limit={limitModalType === 'forms' ? getLimit('maxForms') : getLimit('maxDashboards')}
        onUpgrade={() => {
          setShowLimitModal(false);
          navigate('/packages/manage');
        }}
        onPayAsYouGo={async () => {
          // This will be handled by the LimitReachedModal with Campay integration
          // The modal will create the payment and handle the success/failure
          // This callback is kept for backward compatibility but won't be used
          // since the LimitReachedModal now handles the payment flow directly
        }}
      />

      {/* Delete Form Confirmation Modal */}
      {showDeleteFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Supprimer le formulaire</h3>
                  <p className="text-sm text-gray-500">Cette action est irréversible</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Êtes-vous sûr de vouloir supprimer le formulaire <strong>"{formToDelete?.title}"</strong> ? 
                Toutes les réponses associées seront également supprimées.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteFormModal(false);
                    setFormToDelete(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmDeleteForm}
                  disabled={isDeletingForm}
                  className={isDeletingForm ? 'opacity-75 cursor-not-allowed' : ''}
                >
                  {isDeletingForm ? (
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
                Êtes-vous sûr de vouloir supprimer le tableau de bord <strong>"{dashboardToDelete?.name}"</strong> ? 
                Toutes les métriques associées seront également supprimées.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteDashboardModal(false);
                    setDashboardToDelete(null);
                  }}
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

      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
      />

      {/* Access Denied Modal */}
      <AccessDeniedModal
        isOpen={showAccessDeniedModal}
        onClose={() => setShowAccessDeniedModal(false)}
        feature={accessDeniedFeature}
      />
    </>
  );
};