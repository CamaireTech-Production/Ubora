import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { WireframeLoader } from '../components/loading/WireframeLoader';
import { ArrowLeft, FileText, User, Calendar, Filter, Download, Eye, Edit, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, Clock, XCircle } from 'lucide-react';
import { FileAttachment } from '../types';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../components/Toast';
import { getFileDownloadURL } from '@ubora/shared/utils/firebaseStorageUtils';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { DynamicForm } from '../components/DynamicForm';
import { downloadFile } from '@ubora/shared/utils/downloadUtils';
import { forceDownloadFromFirebase } from '@ubora/shared/utils/firebaseDownloadUtils';
import { getFormatRetryEndpoint, getVectorSyncRetryEndpoint, getFormEntryStatusEndpoint } from '@ubora/shared/config/api';

export const ResponseDetailPage: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { user, firebaseUser, isLoading } = useAuth();
  const { 
    forms, 
    formEntries,
    employees, 
    getEntriesForForm,
    getEntriesForEmployee,
    updateFormEntry,
    isLoading: appLoading
  } = useApp();
  const { toast, showSuccess, showError } = useToast();

  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingResponse, setEditingResponse] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [pdfViewerModal, setPdfViewerModal] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
  }>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });
  
  // Vector sync and formatting status tracking
  const [responseStatuses, setResponseStatuses] = useState<Record<string, {
    formattingStatus?: string;
    formattingRetryCount?: number;
    formattingError?: string;
    vectorSyncStatus?: string;
    vectorSyncRetryCount?: number;
    vectorSyncError?: string;
    vectorSyncWithRawText?: boolean;
    files?: Array<{
      fileName: string;
      formattingStatus?: string;
      formattingError?: string;
    }>;
    canRetry?: {
      formatting: boolean;
      vectorSync: boolean;
    };
  }>>({});
  
  const [retryingStatuses, setRetryingStatuses] = useState<Record<string, {
    formatting?: boolean;
    vectorSync?: boolean;
  }>>({});

  // Get the form and responses
  const form = forms.find(f => f.id === formId);
  const isEmployee = user?.role === 'employe';
  const isDirector = user?.role === 'directeur';

  // Get responses based on user role - memoized to prevent infinite loops
  const allResponses = useMemo(() => {
    if (!formId) return [];
    if (isEmployee) {
      return getEntriesForEmployee(user?.id || '').filter(entry => entry.formId === formId);
    }
    return getEntriesForForm(formId);
  }, [formId, isEmployee, user?.id, formEntries]); // Use formEntries instead of function references

  // Load statuses for all responses - use stable IDs to prevent infinite loops
  const responseIds = useMemo(() => allResponses.map(r => r.id).join(','), [allResponses]);
  
  useEffect(() => {
    if (allResponses.length === 0) return;
    
    let isCancelled = false;
    
    const loadStatuses = async () => {
      const statusPromises = allResponses.map(async (formEntry) => {
        if (isCancelled) return null;
        try {
          const statusResponse = await fetch(getFormEntryStatusEndpoint(formEntry.id));
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            return { id: formEntry.id, status: data };
          }
        } catch (err) {
          console.error(`Failed to load status for ${formEntry.id}:`, err);
        }
        return null;
      });
      
      const results = await Promise.all(statusPromises);
      if (isCancelled) return;
      
      const statusMap: Record<string, any> = {};
      results.forEach(result => {
        if (result) {
          statusMap[result.id] = result.status;
        }
      });
      setResponseStatuses(statusMap);
    };
    
    loadStatuses();
    
    return () => {
      isCancelled = true;
    };
  }, [responseIds]); // Use stable string instead of array

  // Debug: Log all response data
  React.useEffect(() => {
    if (allResponses.length > 0) {
      console.log('🔍 All responses loaded:', allResponses.length);
      allResponses.forEach((response, index) => {
        console.log(`🔍 Response ${index + 1}:`, {
          id: response.id,
          formId: response.formId,
          userId: response.userId,
          hasFileAttachments: !!response.fileAttachments,
          fileAttachmentsCount: response.fileAttachments?.length || 0,
          fileAttachments: response.fileAttachments,
          answersKeys: Object.keys(response.answers || {}),
          answers: response.answers
        });
      });
    }
  }, [allResponses]);

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

  // Clean file name for display (remove technical prefixes)
  const getCleanFileName = (fileName: string) => {
    return fileName.replace(/^[0-9-]+-/, '').replace(/\.pdf$/i, '');
  };

  // Helper function to find file attachment for a field
  const findFileAttachment = (response: any, fieldId: string) => {
    console.log('🔍 findFileAttachment called with:', {
      fieldId,
      responseId: response.id,
      hasFileAttachments: !!response.fileAttachments,
      fileAttachmentsLength: response.fileAttachments?.length || 0,
      hasAnswers: !!response.answers,
      answerKeys: Object.keys(response.answers || {})
    });

    // Try to find in fileAttachments array
    if (response.fileAttachments && Array.isArray(response.fileAttachments)) {
      console.log('🔍 Searching in fileAttachments array:', response.fileAttachments);
      const attachment = response.fileAttachments.find((att: any) => att.fieldId === fieldId);
      if (attachment) {
        console.log('✅ Found attachment in fileAttachments array:', attachment);
        return attachment;
      }
    }

    // Try to find in answers object (sometimes file data is stored there)
    const answerValue = response.answers?.[fieldId];
    console.log('🔍 Checking answer value for fieldId:', {
      fieldId,
      answerValue,
      isObject: typeof answerValue === 'object',
      hasUploaded: answerValue?.uploaded
    });
    
    if (answerValue && typeof answerValue === 'object' && answerValue.uploaded) {
      // Create a file attachment object from the answer data
      const constructedAttachment = {
        fieldId,
        fileName: answerValue.fileName,
        fileSize: answerValue.fileSize,
        fileType: answerValue.fileType,
        downloadUrl: answerValue.downloadUrl,
        storagePath: answerValue.storagePath,
        uploadedAt: answerValue.uploadedAt || new Date(),
        base64Data: answerValue.base64Data // Include base64Data if it exists
      };
      console.log('✅ Constructed attachment from answer data:', constructedAttachment);
      return constructedAttachment;
    }

    console.log('❌ No file attachment found for fieldId:', fieldId);
    return null;
  };

  const handleViewPDF = async (fileAttachment: FileAttachment) => {
    console.log('🔄 handleViewPDF called with fileAttachment:', fileAttachment);
    try {
      const downloadUrl = await getFileDownloadURL(fileAttachment);
      console.log('✅ Got download URL:', downloadUrl);
      
      // Open in PDF viewer modal
      setPdfViewerModal({
        isOpen: true,
        fileUrl: downloadUrl,
        fileName: fileAttachment.fileName
      });
    } catch (error) {
      console.error('❌ Error viewing file:', error);
      showError('Erreur lors de l\'ouverture du fichier');
    }
  };

  const handleDownloadPDF = async (fileAttachment: FileAttachment) => {
    try {
      
      // Try Firebase-specific download first
      if (fileAttachment.storagePath) {
        await forceDownloadFromFirebase(
          fileAttachment.storagePath,
          fileAttachment.fileName,
          () => {
            showSuccess('Téléchargement démarré');
          },
          () => {
            // Fallback to regular download
            handleDownloadFallback(fileAttachment);
          }
        );
        return;
      }
      
      // Fallback to regular download
      await handleDownloadFallback(fileAttachment);
    } catch (error) {
      console.error('Error downloading file:', error);
      showError('Erreur lors du téléchargement du fichier');
    }
  };

  const handleDownloadFallback = async (fileAttachment: FileAttachment) => {
    try {
      const downloadUrl = await getFileDownloadURL(fileAttachment);
      
      await downloadFile({
        fileName: fileAttachment.fileName,
        url: downloadUrl,
        onSuccess: () => {
          showSuccess('Téléchargement démarré');
        },
        onError: (error) => {
          showError(`Erreur lors du téléchargement: ${error}`);
        }
      });
    } catch (error) {
      console.error('Fallback download failed:', error);
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

  const getEmployeeName = (employeeId: string): string => {
    // Check if it's the current user (could be director or employee)
    if (user?.id === employeeId) {
      return user.name || 'Utilisateur actuel';
    }
    
    // Check in employees list
    const employee = employees.find(emp => emp?.id === employeeId);
    if (employee) {
      return employee.name;
    }
    
    // Check if it's a director (they might not be in employees list)
    // For now, return a generic message - we could fetch from users collection if needed
    return 'Utilisateur inconnu';
  };

  const canEditResponse = (submittedAt: Date | string) => {
    const submittedTime = new Date(submittedAt);
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return submittedTime > threeHoursAgo;
  };

  const getFilteredAndSortedResponses = () => {
    let filtered = [...allResponses];

    // Filter by employee (only for directors)
    if (isDirector && selectedEmployeeFilter !== 'all') {
      filtered = filtered.filter(response => response.userId === selectedEmployeeFilter);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(response => {
            const responseDate = new Date(response.submittedAt);
            return responseDate >= today;
          });
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(response => {
            const responseDate = new Date(response.submittedAt);
            return responseDate >= weekAgo;
          });
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          filtered = filtered.filter(response => {
            const responseDate = new Date(response.submittedAt);
            return responseDate >= monthAgo;
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

  const handleUpdateResponse = async (responseId: string, updatedAnswers: Record<string, any>, updatedFileAttachments: any[]) => {
    setIsSubmittingEdit(true);
    try {
      await updateFormEntry(responseId, {
        answers: updatedAnswers,
        fileAttachments: updatedFileAttachments
      });
      
      showSuccess('Réponse mise à jour avec succès');
      setEditingResponse(null);
      
    } catch (err) {
      console.error('Error updating response:', err);
      showError('Erreur lors de la mise à jour de la réponse');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleBack = () => {
    if (isEmployee) {
      navigate('/employe/dashboard');
    } else {
      navigate('/directeur/dashboard');
    }
  };

  // Retry formatting for a specific file or all files
  const handleRetryFormatting = async (formEntryId: string, fileName?: string) => {
    const retryKey = `${formEntryId}_formatting`;
    setRetryingStatuses(prev => ({ ...prev, [retryKey]: { formatting: true } }));
    
    try {
      const response = await fetch(getFormatRetryEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formEntryId, fileName, forceRetry: false })
      });
      
      if (response.ok) {
        showSuccess(fileName ? `Formatage relancé pour ${fileName}` : 'Formatage relancé pour tous les fichiers');
        // Reload status after a delay
        setTimeout(() => {
          fetch(getFormEntryStatusEndpoint(formEntryId))
            .then(res => res.json())
            .then(data => {
              setResponseStatuses(prev => ({ ...prev, [formEntryId]: data }));
            })
            .catch(console.error);
        }, 2000);
      } else {
        const error = await response.json();
        showError(error.error || 'Erreur lors de la relance du formatage');
      }
    } catch (error) {
      console.error('Error retrying formatting:', error);
      showError('Erreur lors de la relance du formatage');
    } finally {
      setRetryingStatuses(prev => ({ ...prev, [retryKey]: { formatting: false } }));
    }
  };

  // Retry vector sync
  const handleRetryVectorSync = async (formEntryId: string) => {
    const retryKey = `${formEntryId}_vectorSync`;
    setRetryingStatuses(prev => ({ ...prev, [retryKey]: { vectorSync: true } }));
    
    try {
      const status = responseStatuses[formEntryId];
      const useRawText = status?.formattingStatus === 'failed' && (status?.formattingRetryCount || 0) >= 3;
      
      const response = await fetch(getVectorSyncRetryEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formEntryId, useRawText })
      });
      
      if (response.ok) {
        showSuccess('Synchronisation vectorielle relancée');
        // Reload status after a delay
        setTimeout(() => {
          fetch(getFormEntryStatusEndpoint(formEntryId))
            .then(res => res.json())
            .then(data => {
              setResponseStatuses(prev => ({ ...prev, [formEntryId]: data }));
            })
            .catch(console.error);
        }, 2000);
      } else {
        const error = await response.json();
        showError(error.error || 'Erreur lors de la relance de la synchronisation');
      }
    } catch (error) {
      console.error('Error retrying vector sync:', error);
      showError('Erreur lors de la relance de la synchronisation');
    } finally {
      setRetryingStatuses(prev => ({ ...prev, [retryKey]: { vectorSync: false } }));
    }
  };

  // Get status badge component
  const getStatusBadge = (status: string | undefined | null, error?: string) => {
    // Handle null/undefined (old entries without status tracking)
    if (!status || status === 'null' || status === 'not_applicable') {
      return null; // Don't show badge for old entries
    }
    
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </span>
      );
    }
    if (status === 'processing') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          En cours
        </span>
      );
    }
    if (status === 'completed' || status === 'synced' || status === 'skipped') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          {status === 'skipped' ? 'Ignoré' : 'Terminé'}
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800" title={error}>
          <XCircle className="h-3 w-3 mr-1" />
          Échec
        </span>
      );
    }
    return null;
  };

  const filteredResponses = getFilteredAndSortedResponses();

  // Pagination logic
  const totalPages = Math.ceil(filteredResponses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResponses = filteredResponses.slice(startIndex, endIndex);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedEmployeeFilter, dateFilter, sortOrder]);

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

  // Show wireframe loader during loading
  if (isLoading || appLoading || !user || !firebaseUser) {
    return (
      <Layout title="Chargement...">
        <WireframeLoader type="list" count={5} />
      </Layout>
    );
  }

  if (!form) {
    return (
      <Layout title="Réponse non trouvée">
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Formulaire non trouvé</h2>
          <p className="text-gray-600 mb-4">Le formulaire demandé n'existe pas ou vous n'avez pas l'autorisation de le consulter.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
        </div>
      </Layout>
    );
  }

  return (
      <Layout title={`Réponses - ${form.title}`}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBack}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
                <p className="text-gray-600">{form.description}</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <div className="p-4">
              <div className="flex flex-wrap gap-2 sm:gap-4">
                {/* Employee filter (only for directors) */}
                {isDirector && (
                  <div className="flex items-center space-x-2 min-w-0 flex-1 sm:flex-none">
                    <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <select
                      value={selectedEmployeeFilter}
                      onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0"
                    >
                      <option value="all">Tous les employés</option>
                      {employees
                        .filter(emp => allResponses.some(response => response.userId === emp.id))
                        .map(employee => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Date filter */}
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

                {/* Sort order */}
                <div className="flex items-center space-x-2 min-w-0 flex-1 sm:flex-none">
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0"
                  >
                    <Filter className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{sortOrder === 'asc' ? 'Plus ancien' : 'Plus récent'}</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Pagination Controls */}
          {filteredResponses.length > 0 && (
            <Card>
              <div className="p-3">
                {/* Top row: Results count, items per page, and navigation */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  {/* Left: Results count and items per page */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {filteredResponses.length} réponse(s)
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

                  {/* Right: Page navigation with icons */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      {/* Previous button with icon */}
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1.5 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Page précédente"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* Page numbers - compact */}
                      <div className="flex items-center gap-1">
                        {getPageNumbers().map((pageNum) => (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              currentPage === pageNum
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>

                      {/* Next button with icon */}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Page suivante"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom row: Page info - only show if multiple pages */}
                {totalPages > 1 && (
                  <div className="text-xs text-gray-500 text-center">
                    Page {currentPage} sur {totalPages} • {startIndex + 1}-{Math.min(endIndex, filteredResponses.length)} sur {filteredResponses.length}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Responses list */}
          <div className="space-y-4">
            {filteredResponses.length === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune réponse trouvée avec ces filtres</p>
                </div>
              </Card>
            ) : (
              paginatedResponses.map((response, index) => {
                const isEditable = isEmployee && canEditResponse(response.submittedAt);
                const isEditing = editingResponse === response.id;
                const globalIndex = startIndex + index; // Calculate global index for proper numbering
                
                return (
                  <Card key={response.id}>
                    <div className="p-6">
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
                              onSubmit={(answers, fileAttachments) => handleUpdateResponse(response.id, answers, fileAttachments || [])}
                              onCancel={() => setEditingResponse(null)}
                              initialAnswers={response.answers || {}}
                              initialFileAttachments={response.fileAttachments || []}
                              isDraft={false}
                              isEditMode={true}
                              isLoading={isSubmittingEdit}
                            />
                          )}
                        </div>
                      ) : (
                        /* Response Display */
                        <>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-semibold text-gray-900">
                                  {isEmployee ? `Ma réponse #${globalIndex + 1}` : `Réponse de ${getEmployeeName(response.userId)}`}
                                </h3>
                                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  #{globalIndex + 1}
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {new Date(response.submittedAt).toLocaleDateString()} à {new Date(response.submittedAt).toLocaleTimeString()}
                                  </span>
                                </div>
                                {isDirector && (
                                  <div className="flex items-center space-x-1">
                                    <User className="h-4 w-4" />
                                    <span>{getEmployeeName(response.userId)}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Status badges */}
                              {(() => {
                                const status = responseStatuses[response.id];
                                if (!status) return null;
                                
                                return (
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    {/* Formatting status */}
                                    {status.formattingStatus && (
                                      <div className="flex items-center gap-1">
                                        {getStatusBadge(status.formattingStatus, status.formattingError)}
                                        {(status.formattingRetryCount || 0) > 0 && (
                                          <span className="text-xs text-gray-500">
                                            ({status.formattingRetryCount} tentatives)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Vector sync status */}
                                    {status.vectorSyncStatus && (
                                      <div className="flex items-center gap-1">
                                        {getStatusBadge(status.vectorSyncStatus, status.vectorSyncError)}
                                        {status.vectorSyncWithRawText && (
                                          <span className="text-xs text-yellow-600" title="Synchronisé avec texte brut (formatage échoué)">
                                            (texte brut)
                                          </span>
                                        )}
                                        {(status.vectorSyncRetryCount || 0) > 0 && (
                                          <span className="text-xs text-gray-500">
                                            ({status.vectorSyncRetryCount} tentatives)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            
                            <div className="flex items-center space-x-2 flex-wrap gap-2">
                              {isEditable && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setEditingResponse(response.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <Edit className="h-3 w-3" />
                                  <span>Modifier</span>
                                </Button>
                              )}
                              {!isEditable && isEmployee && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  Non modifiable (3h+)
                                </span>
                              )}
                              
                              {/* Retry buttons */}
                              {(() => {
                                const status = responseStatuses[response.id];
                                const retryState = retryingStatuses[`${response.id}_formatting`] || retryingStatuses[`${response.id}_vectorSync`];
                                if (!status?.canRetry) return null;
                                
                                return (
                                  <div className="flex items-center gap-2">
                                    {/* Formatting retry */}
                                    {status.canRetry.formatting && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleRetryFormatting(response.id)}
                                        disabled={retryState?.formatting}
                                        className="flex items-center space-x-1 text-xs"
                                      >
                                        <RefreshCw className={`h-3 w-3 ${retryState?.formatting ? 'animate-spin' : ''}`} />
                                        <span>Relancer formatage</span>
                                      </Button>
                                    )}
                                    
                                    {/* Vector sync retry */}
                                    {status.canRetry.vectorSync && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleRetryVectorSync(response.id)}
                                        disabled={retryState?.vectorSync}
                                        className="flex items-center space-x-1 text-xs"
                                      >
                                        <RefreshCw className={`h-3 w-3 ${retryState?.vectorSync ? 'animate-spin' : ''}`} />
                                        <span>Relancer sync</span>
                                      </Button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Response details */}
                          <div className="space-y-4">
                            {Object.entries(response.answers || {}).filter(([fieldId]) => fieldId !== 'fileAttachments').map(([fieldId, value]) => {
                              const field = form.fields.find(f => f.id === fieldId);
                              const fieldLabel = field?.label || fieldId;
                              
                              // Handle file fields specially
                              if (field?.type === 'file' && value && typeof value === 'object' && 'uploaded' in value && value.uploaded) {
                                const fileAttachment = findFileAttachment(response, fieldId);
                                const fileStatus = responseStatuses[response.id]?.files?.find(f => f.fileName === fileAttachment?.fileName);
                                
                                return (
                                  <div key={fieldId} className="border-b border-gray-100 pb-3 last:border-b-0">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                      <div className="font-medium text-gray-700 text-sm">
                                        {fieldLabel}
                                      </div>
                                      <div className="text-gray-900 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-lg">{getFileIcon((value as any).fileType)}</span>
                                          <span>{getCleanFileName((value as any).fileName)}</span>
                                          <span className="text-xs text-gray-500">({formatFileSize((value as any).fileSize)})</span>
                                          {fileStatus && (
                                            <div className="ml-2">
                                              {getStatusBadge(fileStatus.formattingStatus, fileStatus.formattingError)}
                                            </div>
                                          )}
                                        </div>
                                         <div className="flex items-center space-x-2">
                                           <button
                                             onClick={() => handleViewPDF(fileAttachment)}
                                             className="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                                             disabled={!fileAttachment}
                                           >
                                             <Eye className="h-3 w-3" />
                                             <span>Voir</span>
                                           </button>
                                           <button
                                             onClick={() => handleDownloadPDF(fileAttachment)}
                                             className="flex items-center space-x-1 px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs"
                                             disabled={!fileAttachment}
                                           >
                                             <Download className="h-3 w-3" />
                                             <span>Télécharger</span>
                                           </button>
                                           {fileStatus?.formattingStatus === 'failed' && (
                                             <button
                                               onClick={() => handleRetryFormatting(response.id, fileAttachment?.fileName)}
                                               disabled={retryingStatuses[`${response.id}_formatting`]?.formatting}
                                               className="flex items-center space-x-1 px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs"
                                             >
                                               <RefreshCw className={`h-3 w-3 ${retryingStatuses[`${response.id}_formatting`]?.formatting ? 'animate-spin' : ''}`} />
                                               <span>Relancer</span>
                                             </button>
                                           )}
                                         </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <div key={fieldId} className="border-b border-gray-100 pb-3 last:border-b-0">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                    <div className="font-medium text-gray-700 text-sm">
                                      {fieldLabel}
                                    </div>
                                    <div className="text-gray-900 text-sm">
                                      {value !== null && value !== undefined ? 
                                        (() => {
                                          // Handle boolean
                                          if (typeof value === 'boolean') {
                                            return value ? 'Oui' : 'Non';
                                          }
                                          // Handle list-based dropdown (object with _listRow)
                                          if (typeof value === 'object' && value._listRow && value.rowData) {
                                            const displayColumnId = field?.displayColumnId;
                                            if (displayColumnId && value.rowData[displayColumnId] !== undefined) {
                                              return String(value.rowData[displayColumnId]);
                                            }
                                            // Fallback: show first available value
                                            const firstValue = Object.values(value.rowData)[0];
                                            return firstValue !== undefined ? String(firstValue) : 'Valeur sélectionnée';
                                          }
                                          // Handle other objects
                                          if (typeof value === 'object') {
                                            // Exclude internal fields
                                            const displayable = Object.entries(value)
                                              .filter(([key]) => key !== '_listRow' && key !== 'listId')
                                              .map(([key, val]) => `${key}: ${val}`)
                                              .join(', ');
                                            return displayable || 'Objet';
                                          }
                                          // Handle arrays
                                          if (Array.isArray(value)) {
                                            return value.join(', ');
                                          }
                                          // Default: convert to string
                                          return String(value);
                                        })() : 
                                        '-'
                                      }
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                        </>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Bottom Pagination Controls */}
          {filteredResponses.length > 0 && totalPages > 1 && (
            <Card>
              <div className="p-3">
                <div className="flex items-center justify-center gap-2">
                  {/* Previous button with icon */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Page précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Page numbers - compact */}
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          currentPage === pageNum
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  {/* Next button with icon */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Page suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>

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
      </Layout>
  );
};