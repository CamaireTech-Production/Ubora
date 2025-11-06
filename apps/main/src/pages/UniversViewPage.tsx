import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Univers, UniversInstance } from '@ubora/shared/types';
import { universService } from '@ubora/shared/services/universService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../components/Toast';
import { InstanceVersionHistory } from '../components/InstanceVersionHistory';
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
  Power,
  Download,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { FormPreview } from '../components/FormPreview';
import { DashboardPreview } from '../components/DashboardPreview';
import { ReportPreview } from '../components/ReportPreview';

export const UniversViewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { activeUniversId, refreshData } = useApp();
  const { toast, showSuccess, showError } = useToast();
  
  // Déterminer d'où on vient (marketplace ou mes univers)
  const fromSource = (location.state as any)?.from || 'my-univers';
  const isFromMarketplace = fromSource === 'marketplace';
  const [univers, setUnivers] = useState<Univers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstantiating, setIsInstantiating] = useState(false);
  const [showInstantiateModal, setShowInstantiateModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [userInstance, setUserInstance] = useState<UniversInstance | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'forms' | 'dashboards' | 'instructions' | 'lists' | 'reports'>('overview');
  const [formNamesMap, setFormNamesMap] = useState<Map<string, { title: string; fieldNames: Map<string, string> }>>(new Map());
  // Accordion state management - track which item is expanded in each tab
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [expandedDashboardId, setExpandedDashboardId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedInstructionId, setExpandedInstructionId] = useState<string | null>(null);

  useEffect(() => {
    if (id && user?.id && user?.agencyId) {
      loadUnivers();
    }
  }, [id, user]);

  // Charger l'instance de l'utilisateur pour ce Univers
  useEffect(() => {
    if (!id || !user?.id || !user?.agencyId || user.role !== 'directeur') return;

    const loadUserInstance = async () => {
      try {
        const instances = await universService.getInstancesByUser(user.id, user.agencyId);
        const instance = instances.find(inst => inst.universId === id);
        if (instance) {
          setUserInstance(instance);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'instance:', error);
      }
    };

    loadUserInstance();
  }, [id, user]);

  const loadUnivers = async () => {
    if (!id || !user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const universData = await universService.getById(id);
      
      if (!universData) {
        showError('Univers non trouvé');
        navigate(isFromMarketplace ? '/univers/marketplace' : '/univers');
        return;
      }

      setUnivers(universData);
      
      // Charger les noms des formulaires et champs pour les métriques
      if (universData.definitions.forms && universData.definitions.forms.length > 0) {
        const formMap = new Map<string, { title: string; fieldNames: Map<string, string> }>();
        universData.definitions.forms.forEach(form => {
          const fieldNamesMap = new Map<string, string>();
          if (form.fields && form.fields.length > 0) {
            form.fields.forEach(field => {
              fieldNamesMap.set(field.id || '', field.label || '');
            });
          }
          formMap.set(form.id, { title: form.title || '', fieldNames: fieldNamesMap });
        });
        setFormNamesMap(formMap);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du Univers:', error);
      showError('Erreur lors du chargement du Univers');
      navigate(isFromMarketplace ? '/univers/marketplace' : '/univers');
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
      const { result } = await universService.instantiate(
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
      showSuccess(`Univers "${univers.metadata.name}" activé avec succès. Les ressources sont maintenant filtrées par cet Univers.`);
      setShowActivateModal(false);
      
      // Rafraîchir le contexte AppContext pour recharger l'Univers actif et les données filtrées
      // Attendre un peu pour laisser Firestore se synchroniser
      await new Promise(resolve => setTimeout(resolve, 500));
      refreshData();
      
      // Rediriger vers la liste des univers au lieu de recharger la page
      navigate('/univers');
    } catch (error) {
      console.error('Erreur lors de l\'activation du Univers:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Une erreur est survenue lors de l\'activation du Univers. Veuillez réessayer.';
      showError(errorMessage);
      setIsActivating(false);
    }
  };

  const handleCancelActivation = () => {
    setShowActivateModal(false);
    setIsActivating(false);
  };

  // Détecter les mises à jour disponibles
  // Pour le propriétaire : vérifier si le Univers a une version plus récente que l'instance
  // Pour les non-propriétaires : utiliser updateAvailable de l'instance
  const isOwner = univers?.ownership.createdBy === user?.id;
  const instanceVersion = userInstance?.universVersion || userInstance?.metadata?.universVersion || 1;
  const universVersion = univers?.metadata.version || 1;
  
  let hasUpdateAvailable = false;
  if (isOwner && userInstance) {
    // Pour le propriétaire : vérifier si le Univers template a une version plus récente
    hasUpdateAvailable = universVersion > instanceVersion;
  } else if (userInstance) {
    // Pour les non-propriétaires : utiliser le marqueur updateAvailable
    hasUpdateAvailable = userInstance.updateAvailable === true;
  }
  
  const currentVersion = instanceVersion;
  const latestVersion = userInstance?.latestAvailableVersion || universVersion;
  const isDirecteur = user?.role === 'directeur';

  const handleUpgradeClick = () => {
    setShowUpgradeModal(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!user?.id || !user?.agencyId || !userInstance) return;

    setIsUpgrading(true);
    setUpgradeProgress('Initialisation de la mise à jour...');
    
    try {
      setUpgradeProgress('Création de la nouvelle instance...');
      await universService.upgradeInstance(
        userInstance.id,
        user.id,
        user.role as 'directeur' | 'employe' | 'admin',
        user.agencyId
      );

      setUpgradeProgress('Migration des données...');
      // La migration est déjà faite dans upgradeInstance, mais on peut afficher un message
      await new Promise(resolve => setTimeout(resolve, 500)); // Petit délai pour UX

      setUpgradeProgress('Finalisation...');
      await new Promise(resolve => setTimeout(resolve, 300));

      showSuccess(`Univers mis à jour avec succès vers la version ${latestVersion}`);
      setShowUpgradeModal(false);
      setIsUpgrading(false);
      setUpgradeProgress('');

      // Recharger la page pour mettre à jour les données
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du Univers:', error);
      let errorMessage = 'Une erreur est survenue lors de la mise à jour du Univers.';
      if (error instanceof Error) {
        if (error.message.includes('No update available')) {
          errorMessage = 'Aucune mise à jour disponible pour cette instance.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Instance ou Univers introuvable. Veuillez réessayer.';
        } else if (error.message.includes('version')) {
          errorMessage = `Erreur de version : ${error.message}`;
        } else {
          errorMessage = error.message;
        }
      }
      showError(errorMessage);
      setIsUpgrading(false);
      setUpgradeProgress('');
    }
  };

  const handleCancelUpgrade = () => {
    setShowUpgradeModal(false);
    setIsUpgrading(false);
    setUpgradeProgress('');
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
            onClick={() => navigate(isFromMarketplace ? '/univers/marketplace' : '/univers')}
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
                onClick={() => navigate(isFromMarketplace ? '/univers/marketplace' : '/univers')}
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
                  {hasUpdateAvailable && isDirecteur && (
                    <span className="flex items-center space-x-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium animate-pulse">
                      <AlertCircle className="h-4 w-4" />
                      <span>Nouvelle version</span>
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {univers.metadata.description || 'Aucune description'}
                </p>
                {hasUpdateAvailable && isDirecteur && (
                  <div className="mt-2 text-sm text-orange-600">
                    <span>Version actuelle: v{currentVersion}</span>
                    <span className="mx-2">•</span>
                    <span className="font-semibold">Version disponible: v{latestVersion}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-auto sm:ml-0">
              {hasUpdateAvailable && isDirecteur && (
                <Button
                  variant="primary"
                  onClick={handleUpgradeClick}
                  className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600"
                  disabled={isUpgrading}
                >
                  <Download className="h-4 w-4" />
                  <span>Mettre à jour vers v{latestVersion}</span>
                </Button>
              )}
              {/* Boutons selon le contexte */}
              {isFromMarketplace ? (
                // Si on vient de la marketplace, seulement "Utiliser ce template"
                univers.ownership.isMarketplaceTemplate && 
                univers.ownership.approvalStatus === 'approved' && 
                isDirecteur && 
                !hasUpdateAvailable && (
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/univers/create-from-template/${univers.id}`)}
                    className="flex items-center space-x-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Utiliser ce template</span>
                  </Button>
                )
              ) : (
                // Si on vient de Mes Univers, montrer "Activer" si non actif
                <>
                  {isDirecteur && 
                   !isActive && 
                   !hasUpdateAvailable &&
                   univers.ownership.approvalStatus !== 'pending' && 
                   univers.ownership.approvalStatus !== 'rejected' && (
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
                  {/* Bouton "Utiliser ce template" pour Univers marketplace possédés */}
                  {univers.ownership.isMarketplaceTemplate && 
                   univers.ownership.approvalStatus === 'approved' && 
                   isDirecteur && 
                   !hasUpdateAvailable && (
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/univers/create-from-template/${univers.id}`)}
                      className="flex items-center space-x-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Utiliser ce template</span>
                    </Button>
                  )}
                </>
              )}
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
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Créé le</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(univers.metadata.createdAt)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Onglets pour le contenu du Univers */}
              <Card title="Contenu du Univers">
                {/* Onglets */}
                <div className="border-b border-gray-200 mb-6">
                  <nav className="flex space-x-1 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        activeTab === 'overview'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Vue d'ensemble
                    </button>
                    {univers.definitions.lists && univers.definitions.lists.length > 0 && (
                      <button
                        onClick={() => setActiveTab('lists')}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center space-x-1 ${
                          activeTab === 'lists'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Database className="h-4 w-4" />
                        <span>Listes ({univers.definitions.lists.length})</span>
                      </button>
                    )}
                    {univers.definitions.forms && univers.definitions.forms.length > 0 && (
                      <button
                        onClick={() => setActiveTab('forms')}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center space-x-1 ${
                          activeTab === 'forms'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                        <span>Formulaires ({univers.definitions.forms.length})</span>
                      </button>
                    )}
                    {univers.definitions.dashboards && univers.definitions.dashboards.length > 0 && (
                      <button
                        onClick={() => setActiveTab('dashboards')}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center space-x-1 ${
                          activeTab === 'dashboards'
                            ? 'border-purple-500 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span>Dashboards ({univers.definitions.dashboards.length})</span>
                      </button>
                    )}
                    {univers.definitions.reports && univers.definitions.reports.length > 0 && (
                      <button
                        onClick={() => setActiveTab('reports')}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center space-x-1 ${
                          activeTab === 'reports'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <FileBarChart className="h-4 w-4" />
                        <span>Rapports ({univers.definitions.reports.length})</span>
                      </button>
                    )}
                    {univers.definitions.instructions && univers.definitions.instructions.length > 0 && (
                      <button
                        onClick={() => setActiveTab('instructions')}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center space-x-1 ${
                          activeTab === 'instructions'
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Calendar className="h-4 w-4" />
                        <span>Instructions ({univers.definitions.instructions.length})</span>
                      </button>
                    )}
                  </nav>
                </div>

                {/* Contenu des onglets */}
                <div className="mt-6">
                  {/* Vue d'ensemble */}
                  {activeTab === 'overview' && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
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
                      <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 col-span-2">
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
                  )}

                  {/* Formulaires détaillés */}
                  {activeTab === 'forms' && univers.definitions.forms && univers.definitions.forms.length > 0 && (
                    <div className="space-y-4">
                      {univers.definitions.forms.map((form, index) => {
                        const formId = form.id || `form-${index}`;
                        const isExpanded = expandedFormId === formId;
                        
                        return (
                          <div key={index} className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                            {/* Accordion Header */}
                            <button
                              onClick={() => {
                                setExpandedFormId(isExpanded ? null : formId);
                              }}
                              className="w-full p-4 flex items-start justify-between hover:bg-blue-100 transition-colors"
                            >
                              <div className="flex-1 text-left">
                                <div className="flex items-center space-x-3">
                                  <h4 className="text-lg font-semibold text-gray-900">{form.title || `Formulaire ${index + 1}`}</h4>
                                  {form.fields && (
                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                      {form.fields.length} champ{form.fields.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                {form.description && (
                                  <p className="text-sm text-gray-600 mt-1">{form.description}</p>
                                )}
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                            </button>
                            
                            {/* Accordion Content */}
                            {isExpanded && (
                              <div className="px-4 pb-4">
                                <FormPreview form={form} universLists={univers.definitions.lists || []} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Dashboards détaillés */}
                  {activeTab === 'dashboards' && univers.definitions.dashboards && univers.definitions.dashboards.length > 0 && (
                    <div className="space-y-4">
                      {univers.definitions.dashboards.map((dashboard, index) => {
                        const dashboardId = dashboard.id || `dashboard-${index}`;
                        const isExpanded = expandedDashboardId === dashboardId;
                        
                        return (
                          <div key={index} className="bg-purple-50 rounded-lg border border-purple-200 overflow-hidden">
                            {/* Accordion Header */}
                            <button
                              onClick={() => {
                                setExpandedDashboardId(isExpanded ? null : dashboardId);
                              }}
                              className="w-full p-4 flex items-start justify-between hover:bg-purple-100 transition-colors"
                            >
                              <div className="flex-1 text-left">
                                <div className="flex items-center space-x-3">
                                  <h4 className="text-lg font-semibold text-gray-900">{dashboard.name || `Tableau de bord ${index + 1}`}</h4>
                                  {dashboard.metrics && (
                                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                      {dashboard.metrics.length} métrique{dashboard.metrics.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                {dashboard.description && (
                                  <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
                                )}
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                            </button>
                            
                            {/* Accordion Content */}
                            {isExpanded && (
                              <div className="px-4 pb-4">
                                <DashboardPreview dashboard={dashboard} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Instructions détaillées */}
                  {activeTab === 'instructions' && univers.definitions.instructions && univers.definitions.instructions.length > 0 && (
                    <div className="space-y-4">
                      {univers.definitions.instructions.map((instruction, index) => {
                        const instructionId = instruction.id || `instruction-${index}`;
                        const isExpanded = expandedInstructionId === instructionId;
                        
                        return (
                          <div key={index} className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
                            {/* Accordion Header */}
                            <button
                              onClick={() => {
                                setExpandedInstructionId(isExpanded ? null : instructionId);
                              }}
                              className="w-full p-4 flex items-start justify-between hover:bg-green-100 transition-colors"
                            >
                              <div className="flex-1 text-left">
                                <div className="flex items-center space-x-3">
                                  <h4 className="text-lg font-semibold text-gray-900">{instruction.title || `Instruction ${index + 1}`}</h4>
                                  {instruction.frequency && (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                      {instruction.frequency}
                                    </span>
                                  )}
                                </div>
                                {instruction.description && (
                                  <p className="text-sm text-gray-600 mt-1">{instruction.description}</p>
                                )}
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                            </button>
                            
                            {/* Accordion Content */}
                            {isExpanded && (
                              <div className="px-4 pb-4 space-y-3">
                                {instruction.question && (
                                  <div>
                                    <h5 className="text-sm font-medium text-gray-700 mb-1">Question:</h5>
                                    <p className="text-sm text-gray-900 bg-white p-3 rounded-md border border-green-100">{instruction.question}</p>
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {instruction.filters && (
                                    <div>
                                      <h5 className="text-sm font-medium text-gray-700 mb-1">Filtres:</h5>
                                      <div className="bg-white p-3 rounded-md border border-green-100 space-y-1">
                                        {instruction.filters.period && (
                                          <p className="text-xs text-gray-600">Période: {instruction.filters.period}</p>
                                        )}
                                        {instruction.filters.formId && (() => {
                                          const formInfo = formNamesMap.get(instruction.filters.formId);
                                          const formName = formInfo ? formInfo.title : instruction.filters.formId;
                                          return (
                                            <p className="text-xs text-gray-600">
                                              Formulaire: {formName}
                                            </p>
                                          );
                                        })()}
                                        {instruction.filters.userId && (
                                          <p className="text-xs text-gray-600">Utilisateur: {instruction.filters.userId}</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <h5 className="text-sm font-medium text-gray-700 mb-1">Informations:</h5>
                                    <div className="bg-white p-3 rounded-md border border-green-100 space-y-1">
                                      {instruction.frequency && (
                                        <p className="text-xs text-gray-600">Fréquence: {instruction.frequency}</p>
                                      )}
                                      {instruction.maxExecutions && (
                                        <p className="text-xs text-gray-600">Max exécutions: {instruction.maxExecutions}</p>
                                      )}
                                      {instruction.selectedFormat && (
                                        <p className="text-xs text-gray-600">Format: {instruction.selectedFormat}</p>
                                      )}
                                      {instruction.selectedFormats && instruction.selectedFormats.length > 0 && (
                                        <p className="text-xs text-gray-600">Formats: {instruction.selectedFormats.join(', ')}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Listes détaillées */}
                  {activeTab === 'lists' && univers.definitions.lists && univers.definitions.lists.length > 0 && (
                    <div className="space-y-4">
                      {univers.definitions.lists.map((list, index) => (
                        <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">{list.name || `Liste ${index + 1}`}</h4>
                              {list.description && (
                                <p className="text-sm text-gray-600 mt-1">{list.description}</p>
                              )}
                            </div>
                            {list.columns && (
                              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                {list.columns.length} colonne{list.columns.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          
                          {list.columns && list.columns.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Colonnes:</h5>
                              <div className="bg-white rounded-md border border-orange-100 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      {list.columns.map((col, colIndex) => (
                                        <th key={colIndex} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                          {(col as any).name || `Colonne ${colIndex + 1}`}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {list.rows && list.rows.length > 0 ? (
                                      list.rows.slice(0, 5).map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                          {list.columns.map((col) => {
                                            const colId = (col as any).id;
                                            const value = colId ? (row as any)[colId] : row[col as any];
                                            return (
                                              <td key={colId || `col-${col}`} className="px-3 py-2 text-sm text-gray-900">
                                                {value !== null && value !== undefined && value !== '' ? String(value) : '-'}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={list.columns.length} className="px-3 py-4 text-sm text-gray-500 text-center">
                                          Aucune donnée
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                                {list.rows && list.rows.length > 5 && (
                                  <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center">
                                    ... et {list.rows.length - 5} autre{list.rows.length - 5 > 1 ? 's' : ''} ligne{list.rows.length - 5 > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rapports détaillés */}
                  {activeTab === 'reports' && univers.definitions.reports && univers.definitions.reports.length > 0 && (
                    <div className="space-y-4">
                      {univers.definitions.reports.map((report, index) => {
                        const reportId = report.id || `report-${index}`;
                        const isExpanded = expandedReportId === reportId;
                        
                        return (
                          <div key={index} className="bg-indigo-50 rounded-lg border border-indigo-200 overflow-hidden">
                            {/* Accordion Header */}
                            <button
                              onClick={() => {
                                setExpandedReportId(isExpanded ? null : reportId);
                              }}
                              className="w-full p-4 flex items-start justify-between hover:bg-indigo-100 transition-colors"
                            >
                              <div className="flex-1 text-left">
                                <div className="flex items-center space-x-3">
                                  <h4 className="text-lg font-semibold text-gray-900">{report.name || `Rapport ${index + 1}`}</h4>
                                  {report.templateType && (
                                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                      {report.templateType.toUpperCase()}
                                    </span>
                                  )}
                                  {report.placeholders && report.placeholders.length > 0 && (
                                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                      {report.placeholders.length} placeholder{report.placeholders.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                {report.description && (
                                  <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                                )}
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                            </button>
                            
                            {/* Accordion Content */}
                            {isExpanded && (
                              <div className="px-4 pb-4">
                                <ReportPreview 
                                  report={report} 
                                  dashboards={univers.definitions.dashboards || []}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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

              {/* Instance Version History - Only for directors with an instance */}
              {isDirecteur && userInstance && (
                <InstanceVersionHistory instance={userInstance} />
              )}
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
        loadingText="Activation..."
      />

      {/* Modal de confirmation mise à jour */}
      <ConfirmationModal
        isOpen={showUpgradeModal}
        onClose={handleCancelUpgrade}
        onConfirm={handleConfirmUpgrade}
        title="Mettre à jour ce Univers"
        message={
          univers ? (
            <div className="space-y-4">
              <div>
                <p>
                  Êtes-vous sûr de vouloir mettre à jour le Univers <strong>"{univers.metadata.name}"</strong> ?
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Version actuelle: <strong>v{currentVersion}</strong> → Version disponible: <strong>v{latestVersion}</strong>
                </p>
              </div>
              {isUpgrading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">{upgradeProgress}</p>
                      <p className="text-xs text-blue-700 mt-1">Cette opération peut prendre quelques instants...</p>
                    </div>
                  </div>
                </div>
              )}
              {!isUpgrading && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Cette opération va créer une nouvelle instance avec la nouvelle version et migrer toutes vos données (formulaires, soumissions, tableaux de bord, etc.).
                  </p>
                </div>
              )}
            </div>
          ) : null
        }
        confirmText={isUpgrading ? "Mise à jour en cours..." : "Mettre à jour"}
        cancelText="Annuler"
        variant="warning"
        isLoading={isUpgrading}
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
        variant="info"
        isLoading={isInstantiating}
      />

      {toast && <Toast {...toast} />}
    </>
  );
};

