import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useUnivers } from '@ubora/shared/contexts/UniversContext';
import { useToast } from '@ubora/shared/hooks/useToast';
import { universService } from '@ubora/shared/services/universService';
import { Univers } from '../../types';
import { Button } from '../ui/Button';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { CheckCircle, ChevronDown, Loader2 } from 'lucide-react';
import { logger } from '@ubora/shared/utils/logger';

export const UniversSwitcher: React.FC = () => {
  const { user } = useAuth();
  const { activeUniversId } = useUnivers();
  const { showSuccess, showError } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [availableUnivers, setAvailableUnivers] = useState<Univers[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [universToActivate, setUniversToActivate] = useState<Univers | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Charger les Univers disponibles
  useEffect(() => {
    if (!user?.id || !user?.agencyId || user.role !== 'directeur') return;

    const loadUnivers = async () => {
      setIsLoading(true);
      try {
        const [myUnivers, marketplaceUnivers] = await Promise.all([
          universService.getByUser(user.id, user.agencyId),
          universService.getMarketplaceTemplates()
        ]);

        // Combiner et dédupliquer
        const allUnivers = new Map<string, Univers>();
        [...myUnivers, ...marketplaceUnivers].forEach(u => {
          allUnivers.set(u.id, u);
        });

        setAvailableUnivers(Array.from(allUnivers.values()));
      } catch (error) {
        logger.error('Erreur lors du chargement des Univers', error, 'UniversSwitcher');
        showError('Erreur lors du chargement des Univers');
      } finally {
        setIsLoading(false);
      }
    };

    loadUnivers();
  }, [user]);

  // Fermer le dropdown quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Trouver le Univers actif
  const activeUniversObj = availableUnivers.find(u => u.id === activeUniversId);

  const handleActivateClick = (univers: Univers) => {
    setUniversToActivate(univers);
    setShowConfirmModal(true);
    setIsOpen(false);
  };

  const handleConfirmActivation = async () => {
    if (!universToActivate || !user?.id || !user?.agencyId) return;

    setIsActivating(true);
    try {
      await universService.activateUnivers(universToActivate.id, user.id, user.agencyId);
      showSuccess(`Univers "${universToActivate.metadata.name}" activé avec succès`);
      setShowConfirmModal(false);
      setUniversToActivate(null);
      
      // Recharger la page pour mettre à jour les données filtrées
      window.location.reload();
    } catch (error) {
      logger.error('Erreur lors de l\'activation du Univers', error, 'UniversSwitcher');
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Une erreur est survenue lors de l\'activation du Univers. Veuillez réessayer.';
      showError(errorMessage);
      setIsActivating(false);
    }
  };

  const handleCancelActivation = () => {
    setShowConfirmModal(false);
    setUniversToActivate(null);
    setIsActivating(false);
  };

  // Ne pas afficher si l'utilisateur n'est pas un directeur
  if (user?.role !== 'directeur') {
    return null;
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2"
        >
          <span className="text-xs font-medium text-gray-700">
            {activeUniversObj ? activeUniversObj.metadata.name : 'Sélectionner Univers'}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[calc(100vh-100px)] overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Univers disponibles
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : availableUnivers.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  Aucun Univers disponible
                </div>
              ) : (
                <div className="space-y-1">
                  {availableUnivers.map((univers) => {
                    const isActive = univers.id === activeUniversId;
                    return (
                      <div
                        key={univers.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-50 border border-blue-200 shadow-sm'
                            : 'hover:bg-gray-50 hover:shadow-sm cursor-pointer border border-transparent'
                        }`}
                        onClick={() => !isActive && handleActivateClick(univers)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {univers.metadata.name}
                            </span>
                            {isActive && (
                              <span className="flex items-center space-x-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                <CheckCircle className="h-3 w-3" />
                                <span>Actif</span>
                              </span>
                            )}
                          </div>
                          {univers.metadata.description && (
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {univers.metadata.description}
                            </p>
                          )}
                        </div>
                        {!isActive && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateClick(univers);
                            }}
                            className="ml-2 flex-shrink-0"
                          >
                            Activer
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancelActivation}
        onConfirm={handleConfirmActivation}
        title="Changer d'Univers actif"
        message={
          universToActivate ? (
            <div className="space-y-2">
              <p>
                Êtes-vous sûr de vouloir activer le Univers <strong>"{universToActivate.metadata.name}"</strong> ?
              </p>
              <p className="text-sm text-gray-600">
                L'Univers actif détermine quelles ressources (formulaires, tableaux de bord, etc.) sont visibles dans votre dashboard.
              </p>
              {activeUniversObj && (
                <p className="text-sm text-yellow-600 font-medium">
                  L'Univers actuel "{activeUniversObj.metadata.name}" sera désactivé.
                </p>
              )}
            </div>
          ) : null
        }
        confirmText="Activer"
        cancelText="Annuler"
        variant="info"
        isLoading={isActivating}
      />
    </>
  );
};

