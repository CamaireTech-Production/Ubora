import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { universService } from '@ubora/shared/services/universService';
import { Univers, UniversVersion, FormDefinition, DashboardDefinition, ListDefinition, ReportDefinition, InstructionDefinition } from '@ubora/shared/types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileText,
  BarChart3,
  List,
  FileCheck,
  BookOpen,
  Loader2,
  Eye,
  AlertCircle
} from 'lucide-react';

type TabType = 'forms' | 'dashboards' | 'lists' | 'reports' | 'instructions';

export const UniversApprovalDetailPage: React.FC = () => {
  const { universId } = useParams<{ universId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [univers, setUnivers] = useState<Univers | null>(null);
  const [pendingVersion, setPendingVersion] = useState<UniversVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('forms');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (universId) {
      loadUniversDetails();
    }
  }, [universId]);

  const loadUniversDetails = async () => {
    if (!universId) return;
    
    setIsLoading(true);
    try {
      // Récupérer le Univers
      const universData = await universService.getById(universId);
      
      // Récupérer les versions pour trouver celle en attente
      const versions = await universService.getVersionsByUnivers(universId);
      const pending = versions.find(v => v.approvalStatus === 'pending');
      
      // Si pas de version en attente, vérifier si le Univers lui-même est en attente
      if (!pending && universData.ownership.approvalStatus === 'pending') {
        // Créer une version virtuelle pour le Univers initial en attente
        const virtualVersion: UniversVersion = {
          id: `univers-${universId}`,
          universId: universId,
          version: universData.metadata.version || 1,
          previousVersion: 0,
          createdBy: universData.ownership.createdBy,
          createdAt: universData.metadata.createdAt || new Date(),
          approvalStatus: 'pending',
          changes: {
            metadata: true,
            definitions: {
              forms: (universData.definitions.forms?.length || 0) > 0,
              dashboards: (universData.definitions.dashboards?.length || 0) > 0,
              instructions: (universData.definitions.instructions?.length || 0) > 0,
              lists: (universData.definitions.lists?.length || 0) > 0,
              reports: (universData.definitions.reports?.length || 0) > 0
            }
          }
        };
        setPendingVersion(virtualVersion);
      } else {
        setPendingVersion(pending || null);
      }
      
      setUnivers(universData);
    } catch (error) {
      console.error('Erreur lors du chargement des détails du Univers:', error);
      alert('Erreur lors du chargement des détails. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user?.id || !universId || !pendingVersion) return;

    setApproving(true);
    try {
      await universService.approveNewVersion(universId, pendingVersion.version, user.id);
      // Retourner à la page des approbations
      navigate('/univers-approvals');
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
      alert('Erreur lors de l\'approbation. Veuillez réessayer.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!user?.id || !universId || !pendingVersion || !rejectionReason.trim()) {
      alert('Veuillez fournir une raison de rejet.');
      return;
    }

    setRejecting(true);
    try {
      await universService.rejectNewVersion(universId, pendingVersion.version, user.id, rejectionReason.trim());
      // Retourner à la page des approbations
      navigate('/univers-approvals');
    } catch (error) {
      console.error('Erreur lors du rejet:', error);
      alert('Erreur lors du rejet. Veuillez réessayer.');
    } finally {
      setRejecting(false);
      setShowRejectModal(false);
      setRejectionReason('');
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'forms', label: 'Formulaires', icon: FileText, count: univers?.definitions.forms?.length || 0 },
    { id: 'dashboards', label: 'Tableaux de bord', icon: BarChart3, count: univers?.definitions.dashboards?.length || 0 },
    { id: 'lists', label: 'Listes', icon: List, count: univers?.definitions.lists?.length || 0 },
    { id: 'reports', label: 'Rapports', icon: FileCheck, count: univers?.definitions.reports?.length || 0 },
    { id: 'instructions', label: 'Instructions', icon: BookOpen, count: univers?.definitions.instructions?.length || 0 }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!univers || !pendingVersion) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Univers non trouvé ou pas en attente d'approbation</p>
              <Button
                variant="secondary"
                onClick={() => navigate('/univers-approvals')}
                className="mt-4"
              >
                Retour aux approbations
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/univers-approvals')}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {univers.metadata.name}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Version {pendingVersion.previousVersion} → {pendingVersion.version}
                </p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                En attente d'approbation
              </span>
            </div>
          </div>
        </div>

        {/* Univers Info Card */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Informations</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Description:</span>{' '}
                  {univers.metadata.description || 'Aucune description'}
                </div>
                {univers.metadata.category && (
                  <div>
                    <span className="font-medium">Catégorie:</span> {univers.metadata.category}
                  </div>
                )}
                {univers.metadata.tags && univers.metadata.tags.length > 0 && (
                  <div>
                    <span className="font-medium">Tags:</span>{' '}
                    {univers.metadata.tags.join(', ')}
                  </div>
                )}
                {univers.metadata.price !== undefined && univers.metadata.price !== null && (
                  <div>
                    <span className="font-medium">Prix:</span>{' '}
                    {univers.metadata.price === 0 
                      ? 'Gratuit' 
                      : `${univers.metadata.price} ${univers.metadata.currency || 'XAF'}`}
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Statistiques</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Formulaires:</span> {univers.definitions.forms?.length || 0}
                </div>
                <div>
                  <span className="font-medium">Tableaux de bord:</span> {univers.definitions.dashboards?.length || 0}
                </div>
                <div>
                  <span className="font-medium">Listes:</span> {univers.definitions.lists?.length || 0}
                </div>
                <div>
                  <span className="font-medium">Rapports:</span> {univers.definitions.reports?.length || 0}
                </div>
                <div>
                  <span className="font-medium">Instructions:</span> {univers.definitions.instructions?.length || 0}
                </div>
                <div>
                  <span className="font-medium">Créé le:</span> {formatDate(pendingVersion.createdAt)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-6">
          {activeTab === 'forms' && (
            <div className="space-y-4">
              {univers.definitions.forms && univers.definitions.forms.length > 0 ? (
                univers.definitions.forms.map((form: FormDefinition) => (
                  <Card key={form.id}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{form.title}</h3>
                          {form.description && (
                            <p className="text-sm text-gray-600 mt-1">{form.description}</p>
                          )}
                        </div>
                        <Eye className="h-5 w-5 text-gray-400" />
                      </div>
                      {form.fields && form.fields.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Champs ({form.fields.length})</h4>
                          <div className="space-y-2">
                            {form.fields.map((field, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{field.label}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Type: {field.type}
                                      {field.required && <span className="text-red-500 ml-2">* Requis</span>}
                                    </div>
                                  </div>
                                </div>
                                {field.options && field.options.length > 0 && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    Options: {field.options.join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              ) : (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    Aucun formulaire défini
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'dashboards' && (
            <div className="space-y-4">
              {univers.definitions.dashboards && univers.definitions.dashboards.length > 0 ? (
                univers.definitions.dashboards.map((dashboard: DashboardDefinition) => (
                  <Card key={dashboard.id}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{dashboard.name}</h3>
                          {dashboard.description && (
                            <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
                          )}
                        </div>
                        <Eye className="h-5 w-5 text-gray-400" />
                      </div>
                      {dashboard.metrics && dashboard.metrics.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Métriques ({dashboard.metrics.length})</h4>
                          <div className="space-y-2">
                            {dashboard.metrics.map((metric, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3">
                                <div className="font-medium text-gray-900">{metric.name}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Type: {metric.type}
                                  {metric.formId && <span className="ml-2">Formulaire: {metric.formId}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              ) : (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    Aucun tableau de bord défini
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'lists' && (
            <div className="space-y-4">
              {univers.definitions.lists && univers.definitions.lists.length > 0 ? (
                univers.definitions.lists.map((list: ListDefinition) => (
                  <Card key={list.id}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{list.name}</h3>
                        </div>
                        <Eye className="h-5 w-5 text-gray-400" />
                      </div>
                      {list.columns && list.columns.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Colonnes ({list.columns.length})</h4>
                          <div className="space-y-2">
                            {list.columns.map((column, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3">
                                <div className="font-medium text-gray-900">{column.name}</div>
                                <div className="text-xs text-gray-500 mt-1">Type: {column.type}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {list.rows && list.rows.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Lignes ({list.rows.length})</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  {list.columns?.map((col) => (
                                    <th key={col.id} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      {col.name}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {list.rows.slice(0, 10).map((row, rowIndex) => (
                                  <tr key={rowIndex}>
                                    {list.columns?.map((col) => (
                                      <td key={col.id} className="px-4 py-2 text-sm text-gray-900">
                                        {row[col.id]?.toString() || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {list.rows.length > 10 && (
                              <div className="text-center py-2 text-sm text-gray-500">
                                ... et {list.rows.length - 10} autres lignes
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              ) : (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    Aucune liste définie
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              {univers.definitions.reports && univers.definitions.reports.length > 0 ? (
                univers.definitions.reports.map((report: ReportDefinition) => (
                  <Card key={report.id}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
                          {report.description && (
                            <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                          )}
                        </div>
                        <Eye className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="mt-4 space-y-3">
                        <div>
                          <span className="text-sm font-semibold text-gray-700">Type de template:</span>
                          <span className="text-sm text-gray-600 ml-2">{report.templateType}</span>
                        </div>
                        {report.placeholders && report.placeholders.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Placeholders ({report.placeholders.length})</h4>
                            <div className="space-y-1">
                              {report.placeholders.map((placeholder, index) => (
                                <div key={index} className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                                  {placeholder.name}: {placeholder.description || 'Aucune description'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {report.mappings && report.mappings.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Mappings ({report.mappings.length})</h4>
                            <div className="space-y-1">
                              {report.mappings.map((mapping, index) => (
                                <div key={index} className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                                  {mapping.placeholder} → {mapping.source}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    Aucun rapport défini
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="space-y-4">
              {univers.definitions.instructions && univers.definitions.instructions.length > 0 ? (
                univers.definitions.instructions.map((instruction: InstructionDefinition, index: number) => (
                  <Card key={index}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {instruction.title || `Instruction ${index + 1}`}
                          </h3>
                          {instruction.description && (
                            <p className="text-sm text-gray-600 mt-1">{instruction.description}</p>
                          )}
                        </div>
                        <Eye className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {instruction.question && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Question</h4>
                            <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                              {instruction.question}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                          {instruction.filters && (
                            <>
                              <div>
                                <span className="font-medium">Période:</span> {instruction.filters.period}
                              </div>
                              <div>
                                <span className="font-medium">Formulaire:</span> {instruction.filters.formId}
                              </div>
                              <div>
                                <span className="font-medium">Utilisateur:</span> {instruction.filters.userId}
                              </div>
                            </>
                          )}
                          <div>
                            <span className="font-medium">Fréquence:</span> {instruction.frequency}
                          </div>
                          {instruction.selectedFormat && (
                            <div>
                              <span className="font-medium">Format:</span> {instruction.selectedFormat}
                            </div>
                          )}
                          {instruction.selectedFormats && instruction.selectedFormats.length > 0 && (
                            <div>
                              <span className="font-medium">Formats:</span> {instruction.selectedFormats.join(', ')}
                            </div>
                          )}
                          {instruction.maxExecutions && (
                            <div>
                              <span className="font-medium">Exécutions max:</span> {instruction.maxExecutions}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card>
                  <div className="text-center py-8 text-gray-500">
                    Aucune instruction définie
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <Card className="border-t-4 border-yellow-400">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Actions</h3>
              <p className="text-xs text-gray-600">
                Après avoir consulté les détails, vous pouvez approuver ou rejeter cette version.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowRejectModal(true)}
                disabled={approving || rejecting}
                className="flex items-center space-x-2"
              >
                <XCircle className="h-4 w-4" />
                <span>Rejeter</span>
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="flex items-center space-x-2"
              >
                {approving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Approbation...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Approuver</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-md w-full">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Rejeter la version</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Veuillez fournir une raison de rejet. Cette raison sera visible par le créateur du Univers.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raison du rejet *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Contenu inapproprié, erreurs dans les définitions, etc."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectionReason('');
                    }}
                    disabled={rejecting}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || rejecting}
                  >
                    {rejecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Rejet en cours...
                      </>
                    ) : (
                      'Rejeter'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

