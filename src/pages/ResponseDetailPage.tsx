import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { LoadingGuard } from '../components/LoadingGuard';
import { ArrowLeft, FileText, User, Calendar, Filter, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { FileAttachment } from '../types';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { getFileDownloadURL } from '../utils/firebaseStorageUtils';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { downloadFile } from '../utils/downloadUtils';
import { forceDownloadFromFirebase } from '../utils/firebaseDownloadUtils';

export const ResponseDetailPage: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
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
  const [pdfViewerModal, setPdfViewerModal] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
  }>({
    isOpen: false,
    fileUrl: '',
    fileName: ''
  });

  // Get the form and responses
  const form = forms.find(f => f.id === formId);
  const isEmployee = user?.role === 'employe';
  const isDirector = user?.role === 'directeur';

  // Get responses based on user role
  const allResponses = formId ? (
    isEmployee 
      ? getEntriesForEmployee(user?.id || '').filter(entry => entry.formId === formId)
      : getEntriesForForm(formId)
  ) : [];

  // Debug: Log all response data
  React.useEffect(() => {
    if (allResponses.length > 0) {
      console.log('🔍 All responses data:', allResponses);
      allResponses.forEach((response, index) => {
        console.log(`Response ${index + 1}:`, {
          id: response.id,
          fileAttachments: response.fileAttachments,
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

  // Helper function to find file attachment for a field
  const findFileAttachment = (response: any, fieldId: string) => {
    // Try to find in fileAttachments array
    if (response.fileAttachments && Array.isArray(response.fileAttachments)) {
      const attachment = response.fileAttachments.find((att: any) => att.fieldId === fieldId);
      if (attachment) {
        console.log('🔍 Found file attachment in fileAttachments array:', attachment);
        return attachment;
      }
    }

    // Try to find in answers object (sometimes file data is stored there)
    const answerValue = response.answers?.[fieldId];
    if (answerValue && typeof answerValue === 'object' && answerValue.uploaded) {
      console.log('🔍 Found file data in answers:', answerValue);
      // Create a file attachment object from the answer data
      return {
        fieldId,
        fileName: answerValue.fileName,
        fileSize: answerValue.fileSize,
        fileType: answerValue.fileType,
        downloadUrl: answerValue.downloadUrl,
        storagePath: answerValue.storagePath,
        uploadedAt: answerValue.uploadedAt || new Date()
      };
    }

    console.log('🔍 No file attachment found for fieldId:', fieldId);
    return null;
  };

  const handleViewPDF = async (fileAttachment: FileAttachment) => {
    try {
      console.log('🔍 Attempting to view file:', fileAttachment);
      const downloadUrl = await getFileDownloadURL(fileAttachment);
      console.log('🔍 Generated download URL:', downloadUrl);
      
      // Open in PDF viewer modal
      setPdfViewerModal({
        isOpen: true,
        fileUrl: downloadUrl,
        fileName: fileAttachment.fileName
      });
    } catch (error) {
      console.error('Error viewing file:', error);
      showError('Erreur lors de l\'ouverture du fichier');
    }
  };

  const handleDownloadPDF = async (fileAttachment: FileAttachment) => {
    try {
      console.log('🔍 Attempting to download file:', fileAttachment);
      
      // Try Firebase-specific download first
      if (fileAttachment.storagePath) {
        console.log('🔄 Using Firebase-specific download method...');
        await forceDownloadFromFirebase(
          fileAttachment.storagePath,
          fileAttachment.fileName,
          () => {
            showSuccess('Téléchargement démarré');
          },
          (error) => {
            console.warn('Firebase download failed, trying fallback:', error);
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
      console.log('🔍 Generated download URL:', downloadUrl);
      
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
    const employee = employees.find(emp => emp?.id === employeeId);
    return employee?.name || 'Employé inconnu';
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
    try {
      await updateFormEntry(responseId, {
        answers: updatedAnswers,
        fileAttachments: updatedFileAttachments
      });
      
      showSuccess('Réponse mise à jour avec succès');
      setEditingResponse(null);
      
    } catch (error) {
      console.error('Error updating response:', error);
      showError('Erreur lors de la mise à jour de la réponse');
    }
  };

  const handleBack = () => {
    if (isEmployee) {
      navigate('/employe/dashboard');
    } else {
      navigate('/directeur/dashboard');
    }
  };

  const filteredResponses = getFilteredAndSortedResponses();

  if (!form) {
    return (
      <LoadingGuard 
        isLoading={isLoading || appLoading} 
        user={user} 
        firebaseUser={firebaseUser}
        message="Chargement des détails de la réponse..."
      >
        <Layout title="Réponse non trouvée">
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Formulaire non trouvé</h2>
            <p className="text-gray-600 mb-4">Le formulaire demandé n'existe pas ou vous n'avez pas l'autorisation de le consulter.</p>
            <Button onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au dashboard
            </Button>
          </div>
        </Layout>
      </LoadingGuard>
    );
  }

  return (
    <LoadingGuard 
      isLoading={isLoading || appLoading} 
      user={user} 
      firebaseUser={firebaseUser}
      message="Chargement des détails de la réponse..."
    >
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
                <span>Retour</span>
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
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Employee filter (only for directors) */}
                {isDirector && (
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <select
                      value={selectedEmployeeFilter}
                      onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                {/* Sort order */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Filter className="h-4 w-4" />
                    <span>{sortOrder === 'asc' ? 'Plus ancien' : 'Plus récent'}</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Results count */}
          <div className="text-sm text-gray-600">
            {filteredResponses.length} réponse(s) trouvée(s)
          </div>

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
              filteredResponses.map((response, index) => {
                const isEditable = isEmployee && canEditResponse(response.submittedAt);
                const isEditing = editingResponse === response.id;
                
                return (
                  <Card key={response.id}>
                    <div className="p-6">
                      {isEditing ? (
                        /* Edit Form - This would need a DynamicForm component */
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900">Modifier la réponse</h3>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingResponse(null)}
                            >
                              Annuler
                            </Button>
                          </div>
                          <p className="text-gray-600">Fonctionnalité d'édition à implémenter</p>
                        </div>
                      ) : (
                        /* Response Display */
                        <>
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-semibold text-gray-900">
                                  {isEmployee ? `Ma réponse #${index + 1}` : `Réponse de ${getEmployeeName(response.userId)}`}
                                </h3>
                                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  #{index + 1}
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
                            </div>
                            
                            <div className="flex items-center space-x-2">
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
                                console.log('🔍 File field debug:', {
                                  fieldId,
                                  fieldLabel,
                                  isDirector,
                                  fileAttachment,
                                  hasDownloadUrl: fileAttachment?.downloadUrl,
                                  hasStoragePath: fileAttachment?.storagePath,
                                  value
                                });
                                return (
                                  <div key={fieldId} className="border-b border-gray-100 pb-3 last:border-b-0">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                      <div className="font-medium text-gray-700 text-sm">
                                        {fieldLabel}
                                      </div>
                                      <div className="text-gray-900 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-lg">{getFileIcon((value as any).fileType)}</span>
                                          <span>{(value as any).fileName}</span>
                                          <span className="text-xs text-gray-500">({formatFileSize((value as any).fileSize)})</span>
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
                                        (typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value)) : 
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
    </LoadingGuard>
  );
};
