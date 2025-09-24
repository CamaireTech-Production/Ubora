import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, Zap, Package, CreditCard } from 'lucide-react';
import { getPackageDisplayName } from '../config/packageFeatures';

interface PackageTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: any;
  isProcessing: boolean;
}

export const PackageTransitionModal: React.FC<PackageTransitionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  preview,
  isProcessing
}) => {
  if (!isOpen || !preview) return null;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  const getTransitionType = () => {
    // Always show as upgrade/downgrade based on package type, no proration
    return 'upgrade'; // Simplified since no proration
  };

  const getTransitionIcon = () => {
    const type = getTransitionType();
    switch (type) {
      case 'upgrade':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'downgrade':
        return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      default:
        return <Info className="h-6 w-6 text-blue-500" />;
    }
  };

  const getTransitionTitle = () => {
    return 'Changement de Package';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            {getTransitionIcon()}
            <h2 className="text-2xl font-bold text-gray-900">{getTransitionTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Package Transition */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="font-medium text-gray-900">Transition de Package</span>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  {getPackageDisplayName(preview.currentPackage)} → {getPackageDisplayName(preview.newPackage)}
                </div>
              </div>
            </div>
          </div>

          {/* Token Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Gestion des Tokens</h3>
            
            {/* Token Cards Grid - 2 per row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* New Package Tokens */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-green-900 text-sm">Nouveaux Tokens Package</div>
                    <div className="text-xs text-green-700">
                      {preview.newPackageTokens.toLocaleString()} tokens (réinitialisés)
                    </div>
                  </div>
                </div>
              </div>

              {/* Preserved Pay-as-you-go */}
              {preview.preservedPayAsYouGoTokens > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-blue-900 text-sm">Pay-as-you-go Préservé</div>
                      <div className="text-xs text-blue-700">
                        {preview.preservedPayAsYouGoTokens.toLocaleString()} tokens non utilisés
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lost Package Tokens */}
              {preview.unusedPackageTokens > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-red-900 text-sm">Tokens Package Perdus</div>
                      <div className="text-xs text-red-700">
                        {preview.unusedPackageTokens.toLocaleString()} tokens non utilisés seront perdus
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Available Tokens */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm">Total Tokens Disponibles</div>
                    <div className="text-xs text-gray-700">
                      {preview.newPackageTokens.toLocaleString()} + {preview.preservedPayAsYouGoTokens.toLocaleString()} = {(preview.newPackageTokens + preview.preservedPayAsYouGoTokens).toLocaleString()} tokens
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Informations Financières</h3>
            
            {/* Financial Cards Grid - 2 per row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Total Amount */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-blue-900 text-sm">Coût Total</div>
                    <div className="text-xs text-blue-700">
                      {formatAmount(preview.totalAmount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Résumé de la Transition</h4>
            <p className="text-sm text-gray-700">{preview.summary}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Traitement...</span>
              </>
            ) : (
              <span>Confirmer la Transition</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
