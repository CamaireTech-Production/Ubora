import React from 'react';
import { Univers } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { Edit, Trash2, Eye, Globe, Lock, Building2, CheckCircle, Clock, XCircle } from 'lucide-react';

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
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow relative group">
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
        <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
          {univers.metadata.name}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-2">
          {univers.metadata.description || 'Aucune description'}
        </p>
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
    </div>
  );
};

