import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, ArrowRight, CreditCard } from 'lucide-react';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Button } from '../ui/Button';
import { PackageType } from '@ubora/shared/config/packageFeatures';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'forms' | 'dashboards' | 'users' | 'tokens';
  current: number;
  limit: number;
  onUpgrade: () => void;
  onPayAsYouGo?: (type: 'forms' | 'dashboards' | 'users' | 'tokens', quantity: number) => void;
}

export const LimitReachedModal: React.FC<LimitReachedModalProps> = ({
  isOpen,
  onClose,
  type,
  current,
  limit,
  onUpgrade,
  onPayAsYouGo
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  if (!isOpen) return null;

  const getTypeLabel = () => {
    switch (type) {
      case 'forms': return 'formulaires';
      case 'dashboards': return 'tableaux de bord';
      case 'users': return 'utilisateurs';
      case 'tokens': return 'tokens';
      default: return 'éléments';
    }
  };

  const getResourceSpecificText = () => {
    switch (type) {
      case 'forms': return 'Acheter des formulaires en plus';
      case 'dashboards': return 'Acheter des tableaux de bord en plus';
      case 'users': return 'Acheter des utilisateurs en plus';
      case 'tokens': return 'Acheter des tokens en plus';
      default: return 'Acheter des ressources supplémentaires';
    }
  };

  const getCurrentPackage = (): PackageType | null => {
    if (!user) return null;
    const legacyPackage = user.package;
    const supportedPackages: PackageType[] = ['free', 'starter', 'standard'];
    if (legacyPackage && supportedPackages.includes(legacyPackage as PackageType)) {
      return legacyPackage as PackageType;
    }
    return null;
  };

  const getNextPackage = (): PackageType | null => {
    const currentPackage = getCurrentPackage();
    if (!currentPackage) return 'starter';
    
    switch (currentPackage) {
      case 'free': return 'starter';
      case 'starter': return 'standard';
      case 'standard': return null;
      default: return null;
    }
  };

  const getNextPackageDisplayName = (): string => {
    const nextPackage = getNextPackage();
    if (!nextPackage) return 'Voir les packages';
    
    switch (nextPackage) {
      case 'starter': return 'Passer au Starter';
      case 'standard': return 'Passer au Standard';
      default: return 'Voir les packages';
    }
  };

  const getMessage = () => {
    if (limit === 0) {
      return `Vous avez actuellement ${current} ${getTypeLabel()}, mais votre package actuel ne permet pas de créer de nouveaux ${getTypeLabel()}.`;
    } else {
      return `Vous avez atteint la limite de ${limit} ${getTypeLabel()} pour votre package actuel. Vous avez actuellement ${current} ${getTypeLabel()}.`;
    }
  };

  const handleUpgrade = () => {
    onClose();
    onUpgrade();
    const nextPackage = getNextPackage();
    if (nextPackage) {
      // Navigate to package page with next package highlighted
      navigate(`/packages/manage?section=packages&highlight=${nextPackage}`);
    } else {
      // If no next package (premium), just show all packages
      navigate('/packages/manage?section=packages');
    }
  };

  const handlePayAsYouGo = () => {
    onClose();
    if (onPayAsYouGo) {
      onPayAsYouGo(type, 1);
      return;
    }
    // Navigate to package page with specific pay-as-you-go section highlighted
    navigate(`/packages/manage?section=pay-as-you-go&type=${type}`);
  };



  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-lg max-w-lg w-full p-8 relative shadow-2xl">
        {/* Bouton de fermeture */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icône d'alerte */}
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4">
          <AlertCircle className="h-6 w-6 text-blue-600" />
        </div>

        {/* Titre */}
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-4">
          Limite de package atteinte
        </h2>

        {/* Message */}
        <div className="text-center mb-6">
          <p className="text-gray-600 mb-3">
            {getMessage()}
          </p>
          <p className="text-gray-800 font-medium">
            Mettez à niveau votre package pour créer plus de {getTypeLabel()}.
          </p>
          
          {/* Message for employees with director access */}
          {user?.role === 'employe' && user?.hasDirectorDashboardAccess && (
            <div className="mt-3 p-3 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <strong>💡 Contactez votre directeur :</strong> En tant qu'employé avec accès directeur, vous ne pouvez pas effectuer de paiements. Veuillez contacter votre directeur pour mettre à niveau le package.
            </div>
          )}
          
          {/* USSD payment instructions - only for directors */}
          {user?.role === 'directeur' && (
            <div className="mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <strong>Important :</strong> lors de la validation USSD sur votre téléphone, le nom du marchand doit être <strong>"TAKWID GROUP"</strong>. Si un autre nom apparaît, annulez.
            </div>
          )}
        </div>

        {/* Actions */}
        {user?.role === 'directeur' && (
          <div className="flex flex-row gap-3">
            <Button
              onClick={handleUpgrade}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {getNextPackageDisplayName()}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={handlePayAsYouGo}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              {getResourceSpecificText()}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
};
