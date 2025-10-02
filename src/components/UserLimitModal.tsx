import React from 'react';
import { X, Users, AlertTriangle, Crown, Star, Zap, Shield, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { getPackageDisplayName, getPackagePrice, PackageType } from '../config/packageFeatures';

interface UserLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (packageType: PackageType) => void;
  onPurchaseUsers: () => void;
  currentUserCount: number;
  maxUsers: number;
  payAsYouGoUsers: number;
}

export const UserLimitModal: React.FC<UserLimitModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  onPurchaseUsers,
  currentUserCount,
  maxUsers,
  payAsYouGoUsers
}) => {
  const { packageType } = usePackageAccess();

  if (!isOpen) return null;

  const totalCapacity = maxUsers + payAsYouGoUsers;
  const availableUpgrades: PackageType[] = [];

  // Determine available upgrades based on current package
  if (packageType === 'starter') {
    availableUpgrades.push('standard', 'premium');
  } else if (packageType === 'standard') {
    availableUpgrades.push('premium');
  }

  const getPackageIcon = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return <Zap className="h-5 w-5" />;
      case 'standard': return <Star className="h-5 w-5" />;
      case 'premium': return <Crown className="h-5 w-5" />;
      case 'custom': return <Shield className="h-5 w-5" />;
    }
  };

  const getPackageColor = (pkg: PackageType) => {
    switch (pkg) {
      case 'starter': return 'text-blue-600 bg-blue-100';
      case 'standard': return 'text-green-600 bg-green-100';
      case 'premium': return 'text-purple-600 bg-purple-100';
      case 'custom': return 'text-orange-600 bg-orange-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(2px)' }}>
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Limite d'utilisateurs atteinte
              </h2>
              <p className="text-sm text-gray-600">
                Vous ne pouvez pas inviter plus d'utilisateurs avec votre package actuel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Current Status */}
        <div className="p-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Users className="h-5 w-5 text-orange-600" />
              <h3 className="font-medium text-orange-800">Utilisation actuelle</h3>
            </div>
            <div className="space-y-2 text-sm text-orange-700">
              <div className="flex justify-between">
                <span>Utilisateurs actuels:</span>
                <span className="font-medium">{currentUserCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Limite de votre package:</span>
                <span className="font-medium">{maxUsers === -1 ? 'Illimité' : maxUsers}</span>
              </div>
              {payAsYouGoUsers > 0 && (
                <div className="flex justify-between">
                  <span>Utilisateurs pay-as-you-go:</span>
                  <span className="font-medium">+{payAsYouGoUsers}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Capacité totale:</span>
                <span>{totalCapacity === -1 ? 'Illimité' : totalCapacity}</span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-6">
            {/* Option 1: Purchase Additional Users */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Option 1: Acheter des utilisateurs supplémentaires</h3>
                  <p className="text-sm text-blue-700">Ajoutez des utilisateurs à votre package actuel</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Ajoutez 3, 5 ou 10 utilisateurs supplémentaires</p>
                  <p>• Facturation mensuelle jusqu'à désactivation</p>
                  <p>• Ressources ajoutées immédiatement</p>
                </div>
              </div>
              <Button
                onClick={onPurchaseUsers}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-3 px-4"
              >
                <Users className="h-5 w-5" />
                <span>Acheter des utilisateurs supplémentaires</span>
              </Button>
            </div>

            {/* Option 2: Upgrade Package */}
            {availableUpgrades.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Crown className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900">Option 2: Passer au package supérieur</h3>
                    <p className="text-sm text-green-700">Bénéficiez de plus d'utilisateurs et de fonctionnalités</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {availableUpgrades.map((pkg) => (
                    <div
                      key={pkg}
                      className="bg-white rounded-lg p-4 border border-gray-200 hover:border-green-300 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => onUpgrade(pkg)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${getPackageColor(pkg)} group-hover:scale-105 transition-transform`}>
                            {getPackageIcon(pkg)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 group-hover:text-green-700 transition-colors">
                              Package {getPackageDisplayName(pkg)}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {getPackagePrice(pkg)}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <p>💡 <strong>Conseil:</strong> L'upgrade de package vous donne accès à plus de fonctionnalités</p>
              </div>
              <Button
                variant="secondary"
                onClick={onClose}
                className="px-6 py-2"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
