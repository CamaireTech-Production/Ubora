import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { universService } from '@ubora/shared/services/universService';
import { Univers, UniversVersion } from '@ubora/shared/types';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  FileText,
  AlertCircle,
  Loader2,
  Eye
} from 'lucide-react';

export const UniversApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pendingUnivers, setPendingUnivers] = useState<{ univers: Univers; pendingVersion: UniversVersion }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    loadPendingUnivers();
  }, []);

  const loadPendingUnivers = async () => {
    setIsLoading(true);
    try {
      const pending = await universService.getPendingApprovalUnivers();
      setPendingUnivers(pending);
    } catch (error) {
      console.error('Erreur lors du chargement des Univers en attente:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (universId: string, version: number) => {
    if (!user?.id) return;

    setApprovingId(universId);
    try {
      await universService.approveNewVersion(universId, version, user.id);
      // Attendre un peu plus pour laisser Firestore se synchroniser complètement
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Recharger la liste
      await loadPendingUnivers();
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
      alert('Erreur lors de l\'approbation. Veuillez réessayer.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (universId: string, version: number) => {
    if (!user?.id || !rejectionReason.trim()) {
      alert('Veuillez fournir une raison de rejet.');
      return;
    }

    setRejectingId(universId);
    try {
      await universService.rejectNewVersion(universId, version, user.id, rejectionReason.trim());
      // Recharger la liste
      await loadPendingUnivers();
      setShowRejectModal(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Erreur lors du rejet:', error);
      alert('Erreur lors du rejet. Veuillez réessayer.');
    } finally {
      setRejectingId(null);
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

  const getChangesSummary = (changes?: UniversVersion['changes']) => {
    if (!changes) return 'Aucun détail';
    
    const parts: string[] = [];
    if (changes.metadata) parts.push('Métadonnées');
    if (changes.definitions?.forms) parts.push('Formulaires');
    if (changes.definitions?.dashboards) parts.push('Tableaux de bord');
    if (changes.definitions?.instructions) parts.push('Instructions');
    if (changes.definitions?.lists) parts.push('Listes');
    if (changes.definitions?.reports) parts.push('Rapports');
    
    return parts.length > 0 ? parts.join(', ') : 'Aucun détail';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Approbations Univers
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Gérer les nouvelles versions de Univers marketplace en attente d'approbation
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadPendingUnivers}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>

        {/* Pending Univers List */}
        {pendingUnivers.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Aucun Univers en attente d'approbation</p>
              <p className="text-gray-500 text-sm mt-2">Tous les Univers sont à jour</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingUnivers
              .filter(({ univers, pendingVersion }) => {
                // Ne montrer que les univers vraiment en attente
                // Exclure les univers qui ont déjà été approuvés (approvedAt existe)
                if (univers.ownership.approvalStatus === 'approved' && univers.ownership.approvedAt) {
                  return false;
                }
                // Exclure si la version en attente a déjà été approuvée
                if (pendingVersion.approvalStatus !== 'pending' || pendingVersion.approvedAt) {
                  return false;
                }
                // Exclure si le Univers a un statut approuvé
                if (univers.ownership.approvalStatus === 'approved') {
                  // Vérifier si la version en attente est vraiment une nouvelle version
                  // (supérieure à la version actuelle approuvée)
                  if (pendingVersion.version <= (univers.metadata.version || 1)) {
                    return false;
                  }
                }
                return true;
              })
              .map(({ univers, pendingVersion }) => (
              <Card key={univers.id} className="border-l-4 border-yellow-400">
                <div className="space-y-4">
                  {/* Univers Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                          {univers.metadata.name}
                        </h2>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          univers.ownership.approvalStatus === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : univers.ownership.approvalStatus === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {univers.ownership.approvalStatus === 'pending' 
                            ? 'En attente' 
                            : univers.ownership.approvalStatus === 'approved'
                            ? 'Approuvé'
                            : 'Rejeté'}
                        </span>
                      </div>
                      {univers.metadata.description && (
                        <p className="text-gray-600 text-sm mb-3">{univers.metadata.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Version {pendingVersion.previousVersion} → {pendingVersion.version}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>Créé le:</span>
                          <span>{formatDate(pendingVersion.createdAt)}</span>
                        </div>
                        {univers.metadata.price !== undefined && univers.metadata.price !== null && (
                          <div className="flex items-center space-x-1">
                            <span>Prix:</span>
                            <span className="font-medium">
                              {univers.metadata.price === 0 
                                ? 'Gratuit' 
                                : `${univers.metadata.price} ${univers.metadata.currency || 'XAF'}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Changes Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Modifications:</h3>
                    <p className="text-sm text-gray-600">{getChangesSummary(pendingVersion.changes)}</p>
                  </div>

                  {/* Actions - Seulement afficher Approuver/Rejeter pour les Univers en attente */}
                  {pendingVersion.approvalStatus === 'pending' && univers.ownership.approvalStatus === 'pending' ? (
                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/univers-approvals/${univers.id}`)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Voir les détails</span>
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleApprove(univers.id, pendingVersion.version)}
                        disabled={approvingId === univers.id || rejectingId === univers.id}
                        className="flex items-center space-x-2"
                      >
                        {approvingId === univers.id ? (
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
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowRejectModal(univers.id)}
                        disabled={approvingId === univers.id || rejectingId === univers.id}
                        className="flex items-center space-x-2"
                      >
                        {rejectingId === univers.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Rejet...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            <span>Rejeter</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/univers-approvals/${univers.id}`)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Voir les détails</span>
                      </Button>
                      {univers.ownership.approvedBy && univers.ownership.approvedAt && (
                        <div className="flex items-center space-x-2 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>
                            Approuvé le {formatDate(univers.ownership.approvedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

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
                      setShowRejectModal(null);
                      setRejectionReason('');
                    }}
                    disabled={rejectingId !== null}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      const item = pendingUnivers.find(p => p.univers.id === showRejectModal);
                      if (item) {
                        handleReject(item.univers.id, item.pendingVersion.version);
                      }
                    }}
                    disabled={!rejectionReason.trim() || rejectingId !== null}
                  >
                    {rejectingId === showRejectModal ? (
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

