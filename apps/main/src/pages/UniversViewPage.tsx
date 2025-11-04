import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Univers } from '../types';
import { universService } from '@ubora/shared/services/universService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../components/Toast';
import { 
  ArrowLeft, 
  Edit, 
  Globe, 
  Lock, 
  Building2, 
  CheckCircle, 
  Clock, 
  XCircle,
  FileText,
  BarChart3,
  Calendar,
  Database,
  FileBarChart,
  Sparkles,
  Loader2,
  Power
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';

export const UniversViewPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { activeUniversId } = useApp();
  const { toast, showSuccess, showError } = useToast();
  const [univers, setUnivers] = useState<Univers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstantiating, setIsInstantiating] = useState(false);
  const [showInstantiateModal, setShowInstantiateModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);

  useEffect(() => {
    if (id && user?.id && user?.agencyId) {
      loadUnivers();
    }
  }, [id, user]);

  const loadUnivers = async () => {
    if (!id || !user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const universData = await universService.getById(id);
      
      if (!universData) {
        showError('Univers non trouvé');
        navigate('/univers');
        return;
      }

      setUnivers(universData);
    } catch (error) {
      console.error('Erreur lors du chargement du Univers:', error);
      showError('Erreur lors du chargement du Univers');
      navigate('/univers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    if (univers) {
      navigate(`/univers/${univers.id}/edit`);
    }
  };

  const handleInstantiate = async () => {
    if (!univers || !user?.id || !user?.agencyId) return;

    setIsInstantiating(true);
    try {
      const { instanceId, result } = await universService.instantiate(
        univers.id,
        user.id,
        user.role as 'directeur' | 'employe' | 'admin',
        user.agencyId
      );

      const totalCreated = 
        result.forms.length +
        result.dashboards.length +
        result.instructions.length +
        result.lists.length +
        result.reports.length;

      showSuccess(
        `Univers instancié avec succès ! ${totalCreated} ressource(s) créée(s).`
      );
      
      // Reload to update usage stats
      await loadUnivers();
      setShowInstantiateModal(false);

      // Optionally navigate to a results page or back to list
      // navigate(`/univers/${univers.id}/instances/${instanceId}`);
    } catch (error) {
      console.error('Erreur lors de l\'instanciation du Univers:', error);
      showError(
        error instanceof Error 
          ? error.message 
          : 'Erreur lors de l\'instanciation du Univers'
      );
    } finally {
      setIsInstantiating(false);
    }
  };

  const handleActivateClick = () => {
    setShowActivateModal(true);
  };

  const handleConfirmActivation = async () => {
    if (!univers || !user?.id || !user?.agencyId) return;

    setIsActivating(true);
    try {
      await universService.activateUnivers(univers.id, user.id, user.agencyId);
      showSuccess(`Univers "${univers.metadata.name}" activé avec succès`);
      setShowActivateModal(false);
      
      // Recharger la page pour mettre à jour les données filtrées
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de l\'activation du Univers:', error);
      showError('Erreur lors de l\'activation du Univers');
      setIsActivating(false);
    }
  };

  const handleCancelActivation = () => {
    setShowActivateModal(false);
    setIsActivating(false);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getOwnershipIcon = () => {
    if (!univers) return null;
    if (univers.ownership.isMarketplaceTemplate) {
      return <Globe className="h-5 w-5 text-blue-500" />;
    }
    if (univers.ownership.agencyId) {
      return <Building2 className="h-5 w-5 text-purple-500" />;
    }
    return <Lock className="h-5 w-5 text-gray-500" />;
  };

  const getOwnershipLabel = () => {
    if (!univers) return '';
    if (univers.ownership.isMarketplaceTemplate) {
      return 'Marketplace';
    }
    if (univers.ownership.agencyId) {
      return 'Partagé avec l\'agence';
    }
    return 'Privé';
  };

  const getApprovalStatusIcon = () => {
    if (!univers) return null;
    switch (univers.ownership.approvalStatus) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getApprovalStatusLabel = () => {
    if (!univers) return '';
    switch (univers.ownership.approvalStatus) {
      case 'approved':
        return 'Approuvé';
      case 'pending':
        return 'En attente d\'approbation';
      case 'rejected':
        return 'Rejeté';
      default:
        return '';
    }
  };

  if (!user?.id || !user?.agencyId) {
    return (
      <Layout title="Détails du Univers">
        <div className="text-center py-12">
          <p className="text-gray-600">Chargement...</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Détails du Univers">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement du Univers...</p>
        </div>
      </Layout>
    );
  }

  if (!univers) {
    return (
      <Layout title="Détails du Univers">
        <div className="text-center py-12">
          <p className="text-gray-600">Univers non trouvé</p>
          <Button
            variant="secondary"
            onClick={() => navigate('/univers')}
            className="mt-4"
          >
            Retour à la liste
          </Button>
        </div>
      </Layout>
    );
  }

  const canEdit = univers.ownership.createdBy === user.id || user.role === 'admin';
  const isActive = univers.id === activeUniversId;
  const isDirecteur = user?.role === 'directeur';

  return (
    <>
      <Layout title={univers.metadata.name}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/univers')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Retour</span>
              </Button>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {univers.metadata.name}
                  </h1>
                  {isActive && isDirecteur && (
                    <span className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      <span>Actif</span>
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {univers.metadata.description || 'Aucune description'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isDirecteur && !isActive && (
                <Button
                  variant="primary"
                  onClick={handleActivateClick}
                  className="flex items-center space-x-2"
                  disabled={isActivating}
                >
                  <Power className="h-4 w-4" />
                  <span>Activer</span>
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => setShowInstantiateModal(true)}
                className="flex items-center space-x-2"
                disabled={isInstantiating}
              >
                <Sparkles className="h-4 w-4" />
                <span>Utiliser ce template</span>
              </Button>
              {canEdit && (
                <Button
                  variant="secondary"
                  onClick={handleEdit}
                  className="flex items-center space-x-2"
                >
                  <Edit className="h-4 w-4" />
                  <span className="hidden sm:inline">Modifier</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Metadata Card */}
              <Card title="Métadonnées">
                <div className="space-y-4">
                  {univers.metadata.iconUrl && (
                    <div className="flex items-center space-x-4">
                      <img
                        src={univers.metadata.iconUrl}
                        alt={univers.metadata.name}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Icône</p>
                        <p className="text-xs text-gray-500">Image personnalisée</p>
                      </div>
                    </div>
                  )}
                  
                  {univers.metadata.category && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Catégorie</p>
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {univers.metadata.category}
                      </span>
                    </div>
                  )}

                  {univers.metadata.tags && univers.metadata.tags.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {univers.metadata.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Version</p>
                    <p className="text-sm text-gray-600">{univers.metadata.version || 1}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Créé le</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(univers.metadata.createdAt)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Definitions Preview */}
              <Card title="Contenu du Univers">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Forms */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Formulaires</h3>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mb-1">
                      {univers.definitions.forms?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600">
                      {univers.definitions.forms?.length === 1 ? 'formulaire' : 'formulaires'}
                    </p>
                  </div>

                  {/* Dashboards */}
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-3 mb-2">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">Tableaux de bord</h3>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 mb-1">
                      {univers.definitions.dashboards?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600">
                      {univers.definitions.dashboards?.length === 1 ? 'tableau de bord' : 'tableaux de bord'}
                    </p>
                  </div>

                  {/* Instructions */}
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-gray-900">Instructions</h3>
                    </div>
                    <p className="text-2xl font-bold text-green-600 mb-1">
                      {univers.definitions.instructions?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600">
                      {univers.definitions.instructions?.length === 1 ? 'instruction' : 'instructions'}
                    </p>
                  </div>

                  {/* Lists */}
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center space-x-3 mb-2">
                      <Database className="h-5 w-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">Listes</h3>
                    </div>
                    <p className="text-2xl font-bold text-orange-600 mb-1">
                      {univers.definitions.lists?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600">
                      {univers.definitions.lists?.length === 1 ? 'liste' : 'listes'}
                    </p>
                  </div>

                  {/* Reports */}
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 sm:col-span-2">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileBarChart className="h-5 w-5 text-indigo-600" />
                      <h3 className="font-semibold text-gray-900">Rapports</h3>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600 mb-1">
                      {univers.definitions.reports?.length || 0}
                    </p>
                    <p className="text-xs text-gray-600">
                      {univers.definitions.reports?.length === 1 ? 'rapport' : 'rapports'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Ownership Card */}
              <Card title="Propriété">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    {getOwnershipIcon()}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getOwnershipLabel()}
                      </p>
                      <p className="text-xs text-gray-500">Type de partage</p>
                    </div>
                  </div>

                  {univers.ownership.isMarketplaceTemplate && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center space-x-3 mb-2">
                        {getApprovalStatusIcon()}
                        <p className="text-sm font-medium text-gray-900">
                          {getApprovalStatusLabel()}
                        </p>
                      </div>
                      {univers.ownership.approvedAt && (
                        <p className="text-xs text-gray-500">
                          Approuvé le {formatDate(univers.ownership.approvedAt)}
                        </p>
                      )}
                      {univers.ownership.approvalStatus === 'rejected' && 
                       univers.ownership.rejectionReason && (
                        <p className="text-xs text-red-600 mt-2">
                          Raison: {univers.ownership.rejectionReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* Usage Card */}
              <Card title="Utilisation">
                <div className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      {univers.usage.totalUsages}
                    </p>
                    <p className="text-sm text-gray-600">
                      {univers.usage.totalUsages === 1 ? 'utilisation' : 'utilisations'}
                    </p>
                  </div>
                  {univers.usage.lastUsedAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Dernière utilisation
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(univers.usage.lastUsedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Layout>

      {/* Activate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showActivateModal}
        onClose={handleCancelActivation}
        onConfirm={handleConfirmActivation}
        title="Activer ce Univers"
        message={
          univers ? (
            <div className="space-y-2">
              <p>
                Êtes-vous sûr de vouloir activer le Univers <strong>"{univers.metadata.name}"</strong> ?
              </p>
              <p className="text-sm text-gray-600">
                L'Univers actif détermine quelles ressources (formulaires, tableaux de bord, etc.) sont visibles dans votre dashboard.
              </p>
            </div>
          ) : null
        }
        confirmText="Activer"
        cancelText="Annuler"
        variant="info"
        isLoading={isActivating}
      />

      {/* Instantiate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showInstantiateModal}
        onClose={() => setShowInstantiateModal(false)}
        onConfirm={handleInstantiate}
        title="Utiliser ce template"
        message={
          <div className="space-y-3">
            <p>
              Voulez-vous instancier ce Univers ? Cela créera les ressources suivantes dans votre agence :
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              {univers.definitions.forms && univers.definitions.forms.length > 0 && (
                <li>{univers.definitions.forms.length} formulaire(s)</li>
              )}
              {univers.definitions.dashboards && univers.definitions.dashboards.length > 0 && (
                <li>{univers.definitions.dashboards.length} tableau(x) de bord</li>
              )}
              {univers.definitions.instructions && univers.definitions.instructions.length > 0 && (
                <li>{univers.definitions.instructions.length} instruction(s)</li>
              )}
              {univers.definitions.lists && univers.definitions.lists.length > 0 && (
                <li>{univers.definitions.lists.length} liste(s)</li>
              )}
              {univers.definitions.reports && univers.definitions.reports.length > 0 && (
                <li>{univers.definitions.reports.length} rapport(s)</li>
              )}
            </ul>
          </div>
        }
        confirmText="Instancier"
        cancelText="Annuler"
        variant="primary"
        isLoading={isInstantiating}
      />

      {toast && <Toast {...toast} />}
    </>
  );
};

