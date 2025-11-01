import React from 'react';
import { Report } from '../types';
import { Button } from './Button';
import { Edit, Trash2, Eye, FileText, FileBarChart, Hash, MapPin, Calendar } from 'lucide-react';
import { UniversBadge } from './UniversBadge';

interface ReportCardProps {
  report: Report;
  onEdit?: (report: Report) => void;
  onDelete?: (reportId: string) => void;
  onView?: (report: Report) => void;
  disabled?: boolean;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  report,
  onEdit,
  onDelete,
  onView,
  disabled = false
}) => {
  const getTemplateTypeIcon = () => {
    switch (report.templateType) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'word':
        return <FileBarChart className="h-5 w-5 text-blue-500" />;
      case 'text':
        return <Hash className="h-5 w-5 text-gray-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTemplateTypeLabel = () => {
    switch (report.templateType) {
      case 'pdf':
        return 'PDF';
      case 'word':
        return 'Word';
      case 'text':
        return 'Texte';
      default:
        return 'Inconnu';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const mappedPlaceholdersCount = report.mappings.filter(
    m => report.placeholders.some(p => p.id === m.placeholderId)
  ).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow relative group">
      {/* Actions buttons - shown on hover */}
      <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
        {onView && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onView(report)}
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
            onClick={() => onEdit(report)}
            className="p-1.5 h-8 w-8 shadow-lg"
          >
            <Edit className="h-3 w-3" />
          </Button>
        )}
        {onDelete && !disabled && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(report.id)}
            className="p-1.5 h-8 w-8 shadow-lg"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Icon */}
      <div className="mb-4">
        <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          {getTemplateTypeIcon()}
        </div>
      </div>

      {/* Title and Description */}
      <div className="mb-4 pr-20">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
          {report.name}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-2">
          {report.description || 'Aucune description'}
        </p>
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-4">
        {/* Template Type */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          {getTemplateTypeIcon()}
          <span>Type: {getTemplateTypeLabel()}</span>
        </div>

        {/* Univers Badge */}
        {report.fromUnivers && report.universId && (
          <div className="flex items-center space-x-2">
            <UniversBadge
              universId={report.universId}
              size="sm"
            />
          </div>
        )}

        {/* Placeholders count */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>
            {report.placeholders.length} placeholder(s) détecté(s)
          </span>
        </div>

        {/* Mapped placeholders */}
        {report.placeholders.length > 0 && (
          <div className="flex items-center space-x-2 text-sm">
            <span className={`font-medium ${
              mappedPlaceholdersCount === report.placeholders.length 
                ? 'text-green-600' 
                : mappedPlaceholdersCount > 0 
                  ? 'text-yellow-600' 
                  : 'text-red-600'
            }`}>
              {mappedPlaceholdersCount} / {report.placeholders.length} mappé(s)
            </span>
          </div>
        )}

        {/* Created date */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>Créé le {formatDate(report.createdAt)}</span>
        </div>

        {/* Updated date */}
        {report.updatedAt && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Modifié le {formatDate(report.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${
              mappedPlaceholdersCount === report.placeholders.length 
                ? 'bg-green-500' 
                : mappedPlaceholdersCount > 0 
                  ? 'bg-yellow-500' 
                  : 'bg-gray-400'
            }`}></div>
            <span className="text-xs text-gray-600">
              {mappedPlaceholdersCount === report.placeholders.length 
                ? 'Complètement configuré' 
                : mappedPlaceholdersCount > 0 
                  ? 'Partiellement configuré' 
                  : 'Nécessite configuration'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
