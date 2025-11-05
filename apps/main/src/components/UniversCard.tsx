import React, { useState, useEffect } from 'react';
import { Univers } from '../types';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { universService } from '@ubora/shared/services/universService';
import { UniversInstance } from '@ubora/shared/types';
import { Edit, Trash2, Eye, Globe, Lock, Building2, CheckCircle, Clock, XCircle, Power, Download, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface UniversCardProps {
  univers: Univers;
  onEdit?: (univers: Univers) => void;
  onDelete?: (universId: string) => void;
  onView?: (univers: Univers) => void;
  disabled?: boolean;
  hideApprovalStatus?: boolean; // Masquer le badge de statut d'approbation (pour marketplace)
  context?: 'marketplace' | 'my-univers' | 'detail'; // Contexte d'affichage pour déterminer les boutons
  onPurchase?: (univers: Univers) => void; // Callback pour l'achat (marketplace)
}

export const UniversCard: React.FC<UniversCardProps> = ({
  univers,
  onEdit,
  onDelete,
  onView,
  disabled = false,
  hideApprovalStatus = false,
  context = 'my-univers',
  onPurchase
}) => {
  const { user } = useAuth();
  const { activeUniversId, refreshData } = useApp();
  const { showSuccess, showError } = useToast();
  const [isActivating, setIsActivating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState<string>('');
  const [userInstance, setUserInstance] = useState<UniversInstance | null>(null);
  const [isLoadingInstance, setIsLoadingInstance] = useState(false);
  const [showRejectionReason, setShowRejectionReason] = useState(false);

  const isActive = univers.id === activeUniversId;
  const isDirecteur = user?.role === 'directeur';
  const hasUpdateAvailable = userInstance?.updateAvailable === true;
  const currentVersion = userInstance?.universVersion || userInstance?.metadata?.universVersion || univers.metadata.version || 1;
  const latestVersion = userInstance?.latestAvailableVersion || univers.metadata.version || 1;
  
  // Déterminer si le Univers marketplace est acheté (a une instance)
  const isPurchased = !!userInstance;
  const isMarketplace = univers.ownership.isMarketplaceTemplate;
  const isOwned = univers.ownership.createdBy === user?.id; // Univers créé par l'utilisateur

  const handleActivateClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmActivation = async () => {
    if (!user?.id || !user?.agencyId) return;

    setIsActivating(true);
    try {
      await universService.activateUnivers(univers.id, user.id, user.agencyId);
      showSuccess(`Univers "${univers.metadata.name}" activé avec succès. Les ressources sont maintenant filtrées par cet Univers.`);
      setShowConfirmModal(false);
      
      // Rafraîchir le contexte AppContext pour recharger l'Univers actif et les données filtrées
      // Attendre un peu pour laisser Firestore se synchroniser
      await new Promise(resolve => setTimeout(resolve, 500));
      refreshData();
      
      // Recharger la page pour s'assurer que tout est à jour
      // (le contexte sera mis à jour automatiquement via useEffect)
      window.location.reload();
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
    setShowConfirmModal(false);
    setIsActivating(false);
  };

  const handleUpgradeClick = () => {
    setShowUpgradeModal(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!user?.id || !user?.agencyId || !userInstance) return;

    setIsUpgrading(true);
    setUpgradeProgress('Initialisation de la mise à jour...');
    
    try {
      setUpgradeProgress('Création de la nouvelle instance...');
      const newInstanceId = await universService.upgradeInstance(
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

  // Charger l'instance de l'utilisateur pour ce Univers
  useEffect(() => {
    if (!user?.id || !user?.agencyId || !isDirecteur) return;

    const loadUserInstance = async () => {
      setIsLoadingInstance(true);
      try {
        const instances = await universService.getInstancesByUser(user.id, user.agencyId);
        const instance = instances.find(inst => inst.universId === univers.id);
        if (instance) {
          setUserInstance(instance);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'instance:', error);
      } finally {
        setIsLoadingInstance(false);
      }
    };

    loadUserInstance();
  }, [user, univers.id, isDirecteur]);
  const getOwnershipIcon = () => {
    if (univers.ownership.isMarketplaceTemplate) {
      return <Globe className="h-4 w-4 text-blue-500" />;
    }
    if (univers.ownership.agencyId) {
      return <Building2 className="h-4 w-4 text-purple-500" />;
    }
    return <Lock className="h-4 w-4 text-gray-500" />;
  };

  const getOwnershipLabel = () => {
    if (univers.ownership.isMarketplaceTemplate) {
      return 'Marketplace';
    }
    if (univers.ownership.agencyId) {
      return 'Agence';
    }
    return 'Privé';
  };

  const getApprovalStatusIcon = () => {
    switch (univers.ownership.approvalStatus) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getApprovalStatusLabel = () => {
    switch (univers.ownership.approvalStatus) {
      case 'approved':
        return 'Approuvé';
      case 'pending':
        return 'En attente';
      case 'rejected':
        return 'Rejeté';
      default:
        return '';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  return (
    <>
    <div className={`relative group bg-white rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
      isActive ? 'border-blue-500 border-2 shadow-lg ring-2 ring-blue-500/20 bg-gradient-to-br from-blue-50 to-indigo-50' : 'border-gray-200 shadow-sm'
    }`}>
      {/* Gradient overlay pour effet glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-transparent pointer-events-none"></div>
      
      <div className="relative p-6">
      {/* Actions buttons - shown on hover avec design moderne */}
      <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex space-x-2 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow-lg border border-gray-200">
        {onView && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onView(univers)}
            className="p-1.5 h-8 w-8 shadow-lg"
            disabled={disabled}
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
        {onEdit && !disabled && !univers.metadata.isDefault && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(univers)}
            className="p-1.5 h-8 w-8 shadow-lg"
          >
            <Edit className="h-3 w-3" />
          </Button>
        )}
        {onDelete && !disabled && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(univers.id)}
            className="p-1.5 h-8 w-8 shadow-lg"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Icon avec design moderne */}
      {univers.metadata.iconUrl ? (
        <div className="mb-4 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-2xl blur-xl"></div>
          <img 
            src={univers.metadata.iconUrl} 
            alt={univers.metadata.name}
            className="relative h-20 w-20 rounded-2xl object-cover ring-2 ring-gray-100 shadow-lg"
          />
        </div>
      ) : (
        <div className="mb-4 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-indigo-500/30 rounded-2xl blur-xl animate-pulse"></div>
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg ring-2 ring-blue-100">
            <span className="text-3xl font-bold text-white drop-shadow-lg">
              {univers.metadata.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Title and Description */}
      <div className="mb-4 pr-20">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
            {univers.metadata.name}
          </h3>
          {isActive && isDirecteur && (
            <span className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full text-xs font-semibold flex-shrink-0 shadow-md ring-2 ring-blue-200">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Actif</span>
            </span>
          )}
          {hasUpdateAvailable && isDirecteur && (
            <span className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full text-xs font-semibold flex-shrink-0 shadow-md animate-pulse ring-2 ring-orange-200">
              <AlertCircle className="h-3.5 w-3.5 animate-bounce" />
              <span>Nouvelle version</span>
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 line-clamp-2">
          {univers.metadata.description || 'Aucune description'}
        </p>
        {hasUpdateAvailable && isDirecteur && (
          <div className="mt-2 text-xs text-orange-600">
            <span>Version actuelle: v{currentVersion}</span>
            <span className="mx-2">•</span>
            <span className="font-semibold">Version disponible: v{latestVersion}</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-4">
        {/* Ownership */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          {getOwnershipIcon()}
          <span>{getOwnershipLabel()}</span>
        </div>

        {/* Approval Status (for marketplace) - Masquer dans la marketplace publique */}
        {univers.ownership.isMarketplaceTemplate && !hideApprovalStatus && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              {getApprovalStatusIcon()}
              <span className={`font-medium ${
                univers.ownership.approvalStatus === 'approved' ? 'text-green-600' :
                univers.ownership.approvalStatus === 'pending' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {getApprovalStatusLabel()}
              </span>
              {/* Dropdown pour voir la raison du rejet */}
              {univers.ownership.approvalStatus === 'rejected' && univers.ownership.rejectionReason && (
                <button
                  onClick={() => setShowRejectionReason(!showRejectionReason)}
                  className="ml-2 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  title="Voir la raison du rejet"
                >
                  {showRejectionReason ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
            {/* Afficher la raison du rejet si le dropdown est ouvert */}
            {univers.ownership.approvalStatus === 'rejected' && 
             univers.ownership.rejectionReason && 
             showRejectionReason && (
              <div className="ml-6 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-900 mb-1">Raison du rejet:</p>
                <p className="text-xs text-red-700">{univers.ownership.rejectionReason}</p>
              </div>
            )}
          </div>
        )}

        {/* Category */}
        {univers.metadata.category && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              {univers.metadata.category}
            </span>
          </div>
        )}

        {/* Price (for marketplace) */}
        {univers.ownership.isMarketplaceTemplate && (
          <div className="flex items-center space-x-2 text-sm font-semibold">
            {univers.metadata.price === 0 || univers.metadata.price === null || univers.metadata.price === undefined ? (
              <span className="text-green-600">Gratuit</span>
            ) : (
              <span className="text-blue-600">
                {univers.metadata.price.toLocaleString('fr-FR')} {univers.metadata.currency || 'XAF'}
              </span>
            )}
          </div>
        )}

        {/* Usage stats */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>{univers.usage.totalUsages} utilisation(s)</span>
        </div>

        {/* Created date */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Créé le {formatDate(univers.metadata.createdAt)}</span>
        </div>
      </div>

      {/* Aspects summary avec design moderne */}
      <div className="border-t border-gray-200/50 pt-4 mt-4 bg-gradient-to-br from-gray-50/50 to-transparent rounded-xl p-3 -mx-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200/50">
            <span className="font-bold text-blue-600">{univers.definitions.forms.length}</span>
            <span className="text-gray-700">Formulaire(s)</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200/50">
            <span className="font-bold text-indigo-600">{univers.definitions.dashboards.length}</span>
            <span className="text-gray-700">Tableau(x) de bord</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200/50">
            <span className="font-bold text-purple-600">{univers.definitions.instructions.length}</span>
            <span className="text-gray-700">Instruction(s)</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200/50">
            <span className="font-bold text-pink-600">{univers.definitions.lists.length}</span>
            <span className="text-gray-700">Liste(s)</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200/50">
            <span className="font-bold text-teal-600">{univers.definitions.reports.length}</span>
            <span className="text-gray-700">Rapport(s)</span>
          </div>
        </div>
      </div>

      {/* Version badge - à la fin de la carte avec design moderne */}
      <div className="mt-4 pt-4 border-t border-gray-200/50 flex items-center justify-end">
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Version</span>
          <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md text-xs font-bold shadow-sm">
            v{univers.metadata.version || 1}
          </span>
        </div>
      </div>

      {/* Actions pour directeurs avec design moderne */}
      {isDirecteur && (
        <div className="mt-4 pt-4 border-t border-gray-200/50 space-y-2">
          {/* Boutons selon le contexte et le statut */}
          {hasUpdateAvailable && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpgradeClick}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={disabled || isUpgrading}
            >
              <Download className="h-4 w-4" />
              <span>Mettre à jour vers v{latestVersion}</span>
            </Button>
          )}
          {!hasUpdateAvailable && (
            <>
              {/* Marketplace : Acheter si non acheté, Activer si acheté */}
              {context === 'marketplace' && isMarketplace && (
                <>
                  {!isPurchased && !isOwned && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onPurchase ? onPurchase(univers) : onView?.(univers)}
                      className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={disabled}
                    >
                      <Globe className="h-4 w-4" />
                      <span>
                        {univers.metadata.price === 0 || univers.metadata.price === null || univers.metadata.price === undefined
                          ? 'Utiliser ce template'
                          : `Acheter (${univers.metadata.price?.toLocaleString('fr-FR')} ${univers.metadata.currency || 'XAF'})`}
                      </span>
                    </Button>
                  )}
                  {isPurchased && 
                   !isActive && 
                   univers.ownership.approvalStatus !== 'pending' && 
                   univers.ownership.approvalStatus !== 'rejected' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleActivateClick}
                      className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={disabled}
                    >
                      <Power className="h-4 w-4" />
                      <span>Activer ce Univers</span>
                    </Button>
                  )}
                </>
              )}
              
              {/* Mes Univers ou Detail : Activer si non actif, mais seulement si approuvé */}
              {(context === 'my-univers' || context === 'detail') && 
               !isActive && 
               univers.ownership.approvalStatus !== 'pending' && 
               univers.ownership.approvalStatus !== 'rejected' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleActivateClick}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={disabled}
                >
                  <Power className="h-4 w-4" />
                  <span>Activer ce Univers</span>
                </Button>
              )}
            </>
          )}
        </div>
      )}
      </div>
    </div>

    {/* Modal de confirmation activation */}
    <ConfirmationModal
      isOpen={showConfirmModal}
      onClose={handleCancelActivation}
      onConfirm={handleConfirmActivation}
      title="Activer ce Univers"
      message={
        <div className="space-y-2">
          <p>
            Êtes-vous sûr de vouloir activer le Univers <strong>"{univers.metadata.name}"</strong> ?
          </p>
          <p className="text-sm text-gray-600">
            L'Univers actif détermine quelles ressources (formulaires, tableaux de bord, etc.) sont visibles dans votre dashboard.
          </p>
        </div>
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
      }
      confirmText={isUpgrading ? "Mise à jour en cours..." : "Mettre à jour"}
      cancelText="Annuler"
      variant="warning"
      isLoading={isUpgrading}
    />
    </>
  );
};

