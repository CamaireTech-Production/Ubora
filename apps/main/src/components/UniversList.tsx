import React, { useState, useMemo } from 'react';
import { Univers } from '../types';
import { UniversCard } from './UniversCard';
import { Search } from 'lucide-react';
import { Input } from './Input';

interface UniversListProps {
  univers: Univers[];
  onEdit?: (univers: Univers) => void;
  onDelete?: (universId: string) => void;
  onView?: (univers: Univers) => void;
  currentUserId: string;
  isLoading?: boolean;
}

export const UniversList: React.FC<UniversListProps> = ({
  univers,
  onEdit,
  onDelete,
  onView,
  currentUserId,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Univers based on search only
  const filteredUnivers = useMemo(() => {
    if (!searchQuery.trim()) {
      return univers;
    }

    const query = searchQuery.toLowerCase();
    return univers.filter(u => 
      u.metadata.name.toLowerCase().includes(query) ||
      u.metadata.description?.toLowerCase().includes(query) ||
      u.metadata.category?.toLowerCase().includes(query) ||
      u.metadata.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [univers, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton pour la recherche */}
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
        {/* Skeleton pour les cards */}
        <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 sm:h-72 lg:h-80 bg-white rounded-xl sm:rounded-2xl border border-gray-200 animate-pulse">
              <div className="h-20 sm:h-24 lg:h-32 bg-gray-200 rounded-t-xl sm:rounded-t-2xl"></div>
              <div className="p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-3 lg:space-y-4">
                <div className="h-4 sm:h-5 lg:h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar avec design moderne */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Rechercher un Univers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-12 text-base bg-white/80 backdrop-blur-sm border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl shadow-sm"
        />
      </div>

      {/* Results count avec style moderne */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">
          {filteredUnivers.length === 0 ? (
            <span className="text-gray-500">Aucun résultat</span>
          ) : (
            <span>
              <span className="text-blue-600 font-semibold">{filteredUnivers.length}</span>{' '}
              Univers{filteredUnivers.length > 1 ? 's' : ''} trouvé{filteredUnivers.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Univers grid avec design moderne */}
      {filteredUnivers.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mb-4">
            <Search className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Aucun Univers trouvé
          </h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            {searchQuery
              ? `Aucun résultat pour "${searchQuery}". Essayez une autre recherche.`
              : 'Vous n\'avez pas encore de Univers. Créez votre premier Univers pour commencer.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {filteredUnivers.map((univers) => (
            <UniversCard
              key={univers.id}
              univers={univers}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              context="my-univers"
            />
          ))}
        </div>
      )}
    </div>
  );
};
