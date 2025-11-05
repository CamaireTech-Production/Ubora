import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DynamicForm } from '../components/DynamicForm';
import { WireframeLoader } from '../components/loading/WireframeLoader';
import { Toast } from '../components/Toast';
import { useToast } from '@ubora/shared/hooks/useToast';
import { FileText, CheckCircle, ArrowLeft, Eye, AlertTriangle, Edit, Trash2, Send, FileEdit, Filter, Calendar, SortAsc, SortDesc, Download, ClipboardList, FileBarChart } from 'lucide-react';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { downloadFile } from '@ubora/shared/utils/downloadUtils';
import { getFileBlobUrl, downloadFileFromBlob } from '@ubora/shared/utils/simpleFileDownload';
import { VideoSection } from '../components/VideoSection';
import { employeeVideos } from '../data/videoData';

interface ResponsesInterfaceProps {
  myEntries: any[];
  assignedForms: any[];
  onClose: () => void;
  canEditResponse: (submittedAt: Date | string) => boolean;
  onUpdateResponse?: (responseId: string, updatedAnswers: Record<string, any>, updatedFileAttachments: any[]) => Promise<void>;
  onViewPDF: (fileAttachment: any) => void;
  onDownloadPDF: (fileAttachment: any) => void;
}

// Helper functions for file handling
const getFileIcon = (fileType: string): string => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
  if (fileType.includes('text')) return '📄';
  return '📎';
};

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


const ResponsesInterface: React.FC<ResponsesInterfaceProps> = ({ 
  myEntries, 
  assignedForms, 
  canEditResponse,
  onUpdateResponse,
  onViewPDF,
  onDownloadPDF
}) => {
  const [selectedFormFilter, setSelectedFormFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingResponse, setEditingResponse] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);



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

  // Pagination logic
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFormFilter, dateFilter, sortOrder]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  return (
    <div className="space-y-6">
      {/* Filters and Pagination Controls */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 sm:gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 min-w-0 flex-1 sm:flex-none">
            <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <select
              value={selectedFormFilter}
              onChange={(e) => setSelectedFormFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0"
            >
              <option value="all">Tous les formulaires</option>
              {assignedForms.map(form => (
                <option key={form.id} value={form.id}>{form.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 min-w-0 flex-1 sm:flex-none">
            <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0"
            >
              <option value="all">Toutes les périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 min-w-0 flex-1 sm:flex-none">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0"
            >
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4 flex-shrink-0" /> : <SortDesc className="h-4 w-4 flex-shrink-0" />}
              <span className="truncate">{sortOrder === 'asc' ? 'Plus ancien' : 'Plus récent'}</span>
            </button>
          </div>
        </div>

        {/* Pagination Controls */}
        {filteredEntries.length > 0 && (
          <div className="flex items-center justify-between gap-2 p-3 bg-white border border-gray-200 rounded-lg">
            {/* Left: Results count and items per page */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {filteredEntries.length} réponse(s)
              </span>
              
              {/* Items per page dropdown - compact */}
              <div className="flex items-center gap-1">
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-xs text-gray-500">/page</span>
              </div>
            </div>

            {/* Right: Page navigation */}
            <div className="flex items-center gap-2">
              {/* Previous button */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {getPageNumbers().map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-2 py-1 text-xs rounded ${
                      pageNum === currentPage
                        ? 'bg-blue-500 text-white'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              {/* Next button */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Responses list */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucune réponse trouvée avec ces filtres</p>
          </div>
        ) : (
          paginatedEntries.map(entry => {
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
                        isEditMode={true}
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
                      {Object.entries(entry.answers || {}).filter(([fieldId]) => fieldId !== 'fileAttachments').slice(0, 3).map(([fieldId, value]) => {
                        const field = form?.fields.find((f: any) => f.id === fieldId);
                        const fieldLabel = field?.label || fieldId;
                        
                        // Handle file fields specially
                        if (field?.type === 'file' && value && typeof value === 'object' && 'uploaded' in value && value.uploaded) {
                          const fileAttachment = entry.fileAttachments?.find((att: any) => att.fieldId === fieldId);
                          return (
                            <div key={fieldId} className="text-sm">
                              <span className="font-medium text-gray-700">{fieldLabel}:</span>
                              <div className="ml-2 text-gray-600 flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">{getFileIcon((value as any).fileType)}</span>
                                  <span>{(value as any).fileName}</span>
                                  <span className="text-xs text-gray-500">({formatFileSize((value as any).fileSize)})</span>
                                </div>
                                {(fileAttachment?.downloadUrl || fileAttachment?.storagePath) && (
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => onViewPDF(fileAttachment)}
                                      className="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                                    >
                                      <Eye className="h-3 w-3" />
                                      <span>Voir</span>
                                    </button>
                                    <button
                                      onClick={() => onDownloadPDF(fileAttachment)}
                                      className="flex items-center space-x-1 px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs"
                                    >
                                      <Download className="h-3 w-3" />
                                      <span>Télécharger</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        
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
                      {Object.keys(entry.answers || {}).filter(fieldId => fieldId !== 'fileAttachments').length > 3 && (
                        <div className="text-sm text-gray-500 italic">
                          +{Object.keys(entry.answers || {}).filter(fieldId => fieldId !== 'fileAttachments').length - 3} autres champs...
                        </div>
                      )}
                    </div>

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
  const navigate = useNavigate();
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
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [isSubmittingDrafts, setIsSubmittingDrafts] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const { toast, showSuccess, showError } = useToast();

  // Function to get form icon based on form type or content
  const getFormIcon = (form: any) => {
    // Check if form has specific field types that suggest its purpose
    const hasFileFields = form.fields.some((field: any) => field.type === 'file');
    const hasDateFields = form.fields.some((field: any) => field.type === 'date');
    const hasNumberFields = form.fields.some((field: any) => field.type === 'number');
    const hasSelectFields = form.fields.some((field: any) => field.type === 'select');
    
    // Determine icon based on form characteristics
    if (hasFileFields) return <FileEdit className="h-5 w-5 text-blue-600" />;
    if (hasDateFields && hasNumberFields) return <FileBarChart className="h-5 w-5 text-green-600" />;
    if (hasSelectFields) return <ClipboardList className="h-5 w-5 text-purple-600" />;
    if (hasNumberFields) return <FileBarChart className="h-5 w-5 text-orange-600" />;
    
    // Default form icon
    return <FileText className="h-5 w-5 text-indigo-600" />;
  };

  const [pdfViewerModal, setPdfViewerModal] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
  }>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    draftId: string | null;
    draftTitle: string;
  }>({ show: false, draftId: null, draftTitle: '' });
  const [showResponsesInterface, setShowResponsesInterface] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      // Legacy single stored in startTime
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
    const { startTime, endTime } = restrictions;
    if (startTime && endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else if (!startTime && endTime) {
      // Single-time: allowed from 00:00 until endTime
      return currentTime <= endTime;
    } else if (startTime && !endTime) {
      // Legacy single stored in startTime: treat as end time
      return currentTime <= startTime;
    }

    return true;
  };


  const formatDate = (date: Date | string) => {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString();
    } catch (error) {
      return 'Date invalide';
    }
  };

  const handleViewPDF = async (fileAttachment: any) => {
    try {
      console.log('🔄 Opening PDF viewer for:', fileAttachment.fileName);
      
      // Get blob URL for the file
      const blobUrl = await getFileBlobUrl(fileAttachment);
      
      // Open in PDF viewer modal
      setPdfViewerModal({
        isOpen: true,
        fileUrl: blobUrl,
        fileName: fileAttachment.fileName
      });
      
      console.log('✅ PDF viewer opened successfully');
    } catch (error) {
      console.error('Error viewing file:', error);
      showError('Erreur lors de l\'ouverture du fichier');
    }
  };

  const handleDownloadPDF = async (fileAttachment: any) => {
    try {
      console.log('🔄 Downloading file:', fileAttachment.fileName);
      
      // Use the simple blob download approach
      await downloadFileFromBlob(fileAttachment);
      showSuccess('Téléchargement démarré');
      
    } catch (error) {
      console.error('Error downloading file:', error);
      showError('Erreur lors du téléchargement du fichier');
    }
  };


  const handleClosePdfModal = () => {
    setPdfViewerModal({
      isOpen: false,
      fileUrl: '',
      fileName: ''
    });
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
      showSuccess('Réponse ajoutée aux brouillons');
      
      // Clear the form by resetting the editing state
      setEditingDraftId(null);
    } catch (error) {
      console.error('Error adding response:', error);
      showError('Erreur lors de l\'ajout de la réponse');
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
      showSuccess('Brouillon supprimé');
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
        showSuccess('Brouillon sauvegardé');
        
        // Clear the form by exiting edit mode - this will show the empty form for new responses
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
      
      // Only navigate back to dashboard after successful submission
      setSelectedFormId(null);
      setEditingDraftId(null);
    } catch (error) {
      console.error('Error submitting drafts:', error);
      showError('Erreur lors de la soumission des réponses');
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
      
      showSuccess('Réponse mise à jour avec succès');
      
    } catch (error) {
      console.error('Error updating response:', error);
      showError('Erreur lors de la mise à jour de la réponse');
    }
  };

  const handleViewResponses = (formId: string) => {
    navigate(`/responses/${formId}`);
  };

  // Show wireframe immediately if any loading state
  if (isLoading || !user || !firebaseUser || appLoading) {
    return (
      <Layout title="Dashboard Employé">
        <WireframeLoader type="dashboard" />
      </Layout>
    );
  }

  return (
    <>
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
                        isDraft={true}
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
                              {Object.entries(draft.answers || {}).filter(([fieldId]) => fieldId !== 'fileAttachments').slice(0, 3).map(([fieldId, value]) => {
                                const field = selectedForm.fields.find(f => f.id === fieldId);
                                const fieldLabel = field?.label || fieldId;
                                
                                // Handle file fields specially
                                if (field?.type === 'file' && value && typeof value === 'object' && 'uploaded' in value && value.uploaded) {
                                  return (
                                    <div key={fieldId} className="text-xs">
                                      <span className="font-medium text-gray-800">{fieldLabel}:</span>
                                      <div className="ml-1 text-gray-600 flex items-center space-x-1">
                                        <span className="text-sm">{getFileIcon((value as any).fileType)}</span>
                                        <span>{(value as any).fileName}</span>
                                        <span className="text-xs text-gray-500">({formatFileSize((value as any).fileSize)})</span>
                                      </div>
                                    </div>
                                  );
                                }
                                
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
                              {Object.keys(draft.answers || {}).filter(fieldId => fieldId !== 'fileAttachments').length > 3 && (
                                <div className="text-xs text-gray-500 italic">
                                  +{Object.keys(draft.answers || {}).filter(fieldId => fieldId !== 'fileAttachments').length - 3} autres champs...
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
              <Card title={`Mes formulaires (${assignedForms.length})`}>
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
                          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-xl transition-all duration-300 hover:border-green-300 hover:-translate-y-1 mobile-form-card flex-shrink-0 w-80 sm:w-96 h-80 group flex flex-col"
                        >
                          {/* Header avec icône, titre et badges */}
                          <div className="mb-3 flex-shrink-0">
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
                          <div className="grid grid-cols-2 gap-3 mb-4 flex-shrink-0">
                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 text-center border border-green-200">
                              <div className="text-xl font-bold text-green-700">{form.fields.length}</div>
                              <div className="text-xs text-green-600 font-medium">Champ(s)</div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 text-center border border-blue-200">
                              <div className="text-xl font-bold text-blue-700">{entryCount + draftCount}</div>
                              <div className="text-xs text-blue-600 font-medium">Total</div>
                            </div>
                          </div>

                          {/* Date de création */}
                          <div className="text-xs text-gray-500 mb-4 flex-shrink-0">
                            Créé le {form.createdAt.toLocaleDateString()}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col space-y-2 form-card-actions flex-shrink-0">
                            <Button
                              size="sm"
                              onClick={() => setSelectedFormId(form.id)}
                              className="w-full flex items-center justify-center space-x-1 text-xs bg-green-600 hover:bg-green-700 text-white border-0 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
                            >
                              <span>Remplir le formulaire</span>
                            </Button>
                            
                            {entryCount > 0 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleViewResponses(form.id)}
                                className="w-full flex items-center justify-center space-x-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-0 rounded-lg font-medium"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Voir mes réponses</span>
                              </Button>
                            )}
                          </div>

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
                 onViewPDF={handleViewPDF}
                 onDownloadPDF={handleDownloadPDF}
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
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
      />

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={pdfViewerModal.isOpen}
        onClose={handleClosePdfModal}
        fileUrl={pdfViewerModal.fileUrl}
        fileName={pdfViewerModal.fileName}
        onDownload={() => {
          // Download from modal
          downloadFile({
            fileName: pdfViewerModal.fileName,
            url: pdfViewerModal.fileUrl,
            onSuccess: () => {
              showSuccess('Téléchargement démarré');
            },
            onError: (error) => {
              showError(`Erreur lors du téléchargement: ${error}`);
            }
          });
        }}
      />
    </>
  );
};