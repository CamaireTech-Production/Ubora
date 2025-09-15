import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, FormField } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { FormEditor } from '../components/FormEditor';
import { LoadingGuard } from '../components/LoadingGuard';
import { Plus, FileText, Users, Eye, Trash2, Edit, UserCheck, BarChart3, Calendar, ChevronDown } from 'lucide-react';
import { PendingApprovals } from '../components/PendingApprovals';
import { VideoSection } from '../components/VideoSection';
import { directorVideos } from '../data/videoData';
import { DashboardCreationModal } from '../components/DashboardCreationModal';
import { DashboardDisplay } from '../components/DashboardDisplay';
import { ComingSoonModal } from '../components/ComingSoonModal';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

export const DirecteurDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, firebaseUser, isLoading } = useAuth();
  const { 
    forms,
    formEntries,
    employees,
    dashboards,
    createForm, 
    updateForm,
    deleteForm,
    getEntriesForForm,
    getPendingEmployees,
    createDashboard,
    deleteDashboard,
    isLoading: appLoading
  } = useApp();
  const { toast, showSuccess, showError } = useToast();
  
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [showDeleteFormModal, setShowDeleteFormModal] = useState(false);
  const [showDeleteDashboardModal, setShowDeleteDashboardModal] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{id: string, title: string} | null>(null);
  const [dashboardToDelete, setDashboardToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState(false);
  const [isDeletingDashboard, setIsDeletingDashboard] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
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
      setEditingForm(null);
      showSuccess('Formulaire créé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la création du formulaire:', error);
      showError('Erreur lors de la création du formulaire. Veuillez réessayer.');
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

  const handleCreateDashboard = async (dashboardData: any) => {
    try {
      await createDashboard(dashboardData);
      setShowDashboardModal(false);
      showSuccess('Tableau de bord créé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la création du tableau de bord:', error);
      showError('Erreur lors de la création du tableau de bord. Veuillez réessayer.');
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


  function refreshData(): void {
    throw new Error('Function not implemented.');
  }

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
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
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
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
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

                  <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 opacity-80 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-yellow-100 text-xs">En attente</p>
                        <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold">{getPendingEmployees().length}</p>
                      </div>
                    </div>
                  </Card>
                  
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

            {/* Section des approbations en attente */}
            <PendingApprovals
              pendingEmployees={getPendingEmployees()}
              currentDirectorId={user?.id || ''}
              onApprovalChange={refreshData}
            />

            {/* Actions principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Button
                onClick={() => setShowFormBuilder(true)}
                className="flex items-center justify-center space-x-2 w-full text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Créer un nouveau formulaire</span>
              </Button>
              
              <Button
                onClick={() => setShowDashboardModal(true)}
                variant="secondary"
                className="flex items-center justify-center space-x-2 w-full text-sm sm:text-base"
              >
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Créer un nouveau tableau de bord</span>
              </Button>
            </div>

            {/* Liste des formulaires */}
            <Card title="Formulaires créés">
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
                      <Button onClick={() => setShowFormBuilder(true)}>
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
                        className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 hover:shadow-lg transition-all duration-200 hover:border-blue-300 mobile-form-card flex-shrink-0 w-80 sm:w-96"
                      >
                        {/* Header avec titre et badge */}
                        <div className="mb-3">
                          <div className="flex flex-col space-y-2">
                            <h3 className="font-semibold text-gray-900 text-base sm:text-lg line-clamp-2 leading-tight">
                              {form.title}
                            </h3>
                            {form.timeRestrictions && formatTimeRestrictions(form.timeRestrictions) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                                🕒 {formatTimeRestrictions(form.timeRestrictions)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                          {form.description}
                        </p>

                        {/* Statistiques */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-gray-900">{formEntriesForForm.length}</div>
                            <div className="text-xs text-gray-600">Réponse(s)</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-gray-900">{form.fields.length}</div>
                            <div className="text-xs text-gray-600">Champ(s)</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-gray-900">{form.assignedTo.length}</div>
                            <div className="text-xs text-gray-600">Employé(s)</div>
                          </div>
                        </div>

                        {/* Date de création */}
                        <div className="text-xs text-gray-500 mb-4">
                          Créé le {form.createdAt.toLocaleDateString()}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col space-y-2 form-card-actions">
                          <div className="flex space-x-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditForm(form)}
                              className="flex-1 flex items-center justify-center space-x-1 text-xs"
                            >
                              <Edit className="h-3 w-3" />
                              <span>Modifier</span>
                            </Button>
                            
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleViewResponses(form.id)}
                              className="flex-1 flex items-center justify-center space-x-1 text-xs"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Voir les réponses</span>
                            </Button>
                          </div>
                          
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteForm(form.id)}
                            className="w-full flex items-center justify-center space-x-1 text-xs"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Supprimer</span>
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
            <Card title="Tableaux de bord créés">
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
                      <Button onClick={() => setShowDashboardModal(true)}>
                        Créer votre premier tableau de bord
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    {/* Always horizontal scrollable like forms and videos */}
                    <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide horizontal-scroll-dashboards">
                      {filteredDashboards.map(dashboard => (
                        <div key={dashboard.id} className="flex-shrink-0 w-70 sm:w-75">
                          <DashboardDisplay
                            dashboard={dashboard}
                            formEntries={formEntries}
                            forms={forms}
                            onView={handleViewDashboard}
                            onDelete={handleDeleteDashboard}
                            showActions={true}
                            minimal={true}
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
        </Layout>
      )}

      {/* Dashboard Creation Modal */}
      <DashboardCreationModal
        isOpen={showDashboardModal}
        onClose={() => setShowDashboardModal(false)}
        onSave={handleCreateDashboard}
        forms={forms}
        currentUserId={user?.id || ''}
        agencyId={user?.agencyId || ''}
      />


      {/* Coming Soon Modal */}
      <ComingSoonModal
        isOpen={showComingSoonModal}
        onClose={() => setShowComingSoonModal(false)}
        title="Fonctionnalité bientôt disponible"
        description="Cette fonctionnalité sera bientôt disponible."
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
    </LoadingGuard>
  );
};