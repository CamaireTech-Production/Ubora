import React from 'react';
import { List } from '../../types';
import { Button } from '../ui/Button';
import { Edit, Trash2, Database, Calendar, Eye } from 'lucide-react';

interface ListCardProps {
  list: List;
  onEdit?: (list: List) => void;
  onDelete?: (listId: string) => void;
  onView?: (list: List) => void;
  disabled?: boolean;
}

const ListCardComponent: React.FC<ListCardProps> = ({
  list,
  onEdit,
  onDelete,
  onView,
  disabled = false
}) => {
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
        {onView && !disabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onView(list)}
            className="p-1.5 h-8 w-8 shadow-lg"
            title="Voir les détails"
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
        {onEdit && !disabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(list)}
            className="p-1.5 h-8 w-8 shadow-lg"
            title="Modifier"
          >
            <Edit className="h-3 w-3" />
          </Button>
        )}
        {onDelete && !disabled && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(list.id)}
            className="p-1.5 h-8 w-8 shadow-lg"
            title="Supprimer"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Icon */}
      <div className="mb-4 h-16 w-16 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <Database className="h-8 w-8 text-white" />
      </div>

      {/* Title and Description */}
      <div className="mb-4 pr-20">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
          {list.name}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-2">
          {list.description || 'Aucune description'}
        </p>
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-4">
        {/* Columns and Rows count */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center space-x-2 text-gray-600">
            <span className="font-medium">{list.columns.length}</span>
            <span>Colonne(s)</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-600">
            <span className="font-medium">{list.rows.length}</span>
            <span>Ligne(s)</span>
          </div>
        </div>

        {/* Updated date */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>Modifié le {formatDate(list.updatedAt)}</span>
        </div>
      </div>

      {/* Column types preview */}
      {list.columns.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex flex-wrap gap-1">
            {list.columns.slice(0, 3).map((col) => (
              <span
                key={col.id}
                className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"
              >
                {col.name} ({col.type})
              </span>
            ))}
            {list.columns.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                +{list.columns.length - 3} autres
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Mémoriser le composant pour éviter les re-renders inutiles
export const ListCard = React.memo(ListCardComponent, (prevProps, nextProps) => {
  // Comparer les propriétés critiques pour déterminer si un re-render est nécessaire
  return (
    prevProps.list.id === nextProps.list.id &&
    prevProps.list.name === nextProps.list.name &&
    prevProps.list.description === nextProps.list.description &&
    prevProps.list.columns.length === nextProps.list.columns.length &&
    prevProps.list.rows.length === nextProps.list.rows.length &&
    prevProps.disabled === nextProps.disabled
  );
});

