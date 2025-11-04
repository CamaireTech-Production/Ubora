import React, { useState, useEffect } from 'react';
import { Univers } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { universService } from '../services/universService';
import { UniversInstance } from '@ubora/shared/types';
import { Edit, Trash2, Eye, Globe, Lock, Building2, CheckCircle, Clock, XCircle, Power, Download, AlertCircle } from 'lucide-react';

interface UniversCardProps {
  univers: Univers;
  onEdit?: (univers: Univers) => void;
  onDelete?: (universId: string) => void;
  onView?: (univers: Univers) => void;
  disabled?: boolean;
}

export const UniversCard: React.FC<UniversCardProps> = ({
  univers,
  onEdit,
  onDelete,
  onView,
  disabled = false
}) => {
  const { user } = useAuth();
  const { activeUniversId } = useApp();
  const { showSuccess, showError } = useToast();
  const [isActivating, setIsActivating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState<string>('');
  const [userInstance, setUserInstance] = useState<UniversInstance | null>(null);
  const [isLoadingInstance, setIsLoadingInstance] = useState(false);

  const isActive = univers.id === activeUniversId;
  const isDirecteur = user?.role === 'directeur';
  const hasUpdateAvailable = userInstance?.updateAvailable === true;
  const currentVersion = userInstance?.universVersion || userInstance?.metadata?.universVersion || univers.metadata.version || 1;
  const latestVersion = userInstance?.latestAvailableVersion || univers.metadata.version || 1;

  const handleActivateClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmActivation = async () => {
    if (!user?.id || !user?.agencyId) return;

    setIsActivating(true);
    try {
      await universService.activateUnivers(univers.id, user.id, user.agencyId);
      showSuccess(`Univers "${univers.metadata.name}" activé avec succès`);
      setShowConfirmModal(false);
      
      // Recharger la page pour mettre à jour les données filtrées
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de l\'activation du Univers:', error);
      showError('Erreur lors de l\'activation du Univers');
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
      showError(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du Univers');
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
    <div className={`bg-white rounded-xl border p-6 hover:shadow-md transition-shadow relative group ${
      isActive ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'
    }`}>
      {/* Actions buttons - shown on hover */}
      <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
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
        {onEdit && !disabled && (
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

      {/* Icon */}
      {univers.metadata.iconUrl ? (
        <div className="mb-4">
          <img 
            src={univers.metadata.iconUrl} 
            alt={univers.metadata.name}
            className="h-16 w-16 rounded-lg object-cover"
          />
        </div>
      ) : (
        <div className="mb-4 h-16 w-16 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {univers.metadata.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Title and Description */}
      <div className="mb-4 pr-20">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
            {univers.metadata.name}
          </h3>
          {isActive && isDirecteur && (
            <span className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex-shrink-0">
              <CheckCircle className="h-3 w-3" />
              <span>Actif</span>
            </span>
          )}
          {hasUpdateAvailable && isDirecteur && (
            <span className="flex items-center space-x-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex-shrink-0 animate-pulse">
              <AlertCircle className="h-3 w-3" />
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

        {/* Approval Status (for marketplace) */}
        {univers.ownership.isMarketplaceTemplate && (
          <div className="flex items-center space-x-2 text-sm">
            {getApprovalStatusIcon()}
            <span className={`font-medium ${
              univers.ownership.approvalStatus === 'approved' ? 'text-green-600' :
              univers.ownership.approvalStatus === 'pending' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {getApprovalStatusLabel()}
            </span>
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

      {/* Aspects summary */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <span className="font-medium">{univers.definitions.forms.length}</span>
            <span>Formulaire(s)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-medium">{univers.definitions.dashboards.length}</span>
            <span>Tableau(x) de bord</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-medium">{univers.definitions.instructions.length}</span>
            <span>Instruction(s)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-medium">{univers.definitions.lists.length}</span>
            <span>Liste(s)</span>
          </div>
        </div>
      </div>

      {/* Actions pour directeurs */}
      {isDirecteur && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          {hasUpdateAvailable && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpgradeClick}
              className="w-full flex items-center justify-center space-x-2 bg-orange-500 hover:bg-orange-600"
              disabled={disabled || isUpgrading}
            >
              <Download className="h-4 w-4" />
              <span>Mettre à jour vers v{latestVersion}</span>
            </Button>
          )}
          {!isActive && !hasUpdateAvailable && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleActivateClick}
              className="w-full flex items-center justify-center space-x-2"
              disabled={disabled}
            >
              <Power className="h-4 w-4" />
              <span>Activer ce Univers</span>
            </Button>
          )}
        </div>
      )}
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

