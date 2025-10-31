import React, { useState, useMemo } from 'react';
import { Univers } from '../types';
import { UniversCard } from './UniversCard';
import { Button } from './Button';
import { Plus, Search, Filter } from 'lucide-react';
import { Input } from './Input';

interface UniversListProps {
  univers: Univers[];
  onEdit?: (univers: Univers) => void;
  onDelete?: (universId: string) => void;
  onView?: (univers: Univers) => void;
  onCreate?: () => void;
  currentUserId: string;
  isLoading?: boolean;
}

type FilterType = 'all' | 'my' | 'agency' | 'marketplace';

export const UniversList: React.FC<UniversListProps> = ({
  univers,
  onEdit,
  onDelete,
  onView,
  onCreate,
  currentUserId,
  isLoading = false
}) => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Univers based on ownership and search
  const filteredUnivers = useMemo(() => {
    let filtered = univers;

    // Filter by ownership type
    if (filterType === 'my') {
      filtered = filtered.filter(u => u.ownership.createdBy === currentUserId);
    } else if (filterType === 'agency') {
      filtered = filtered.filter(u => 
        u.ownership.agencyId && 
        !u.ownership.isMarketplaceTemplate &&
        u.ownership.createdBy !== currentUserId // Not my own
      );
    } else if (filterType === 'marketplace') {
      filtered = filtered.filter(u => 
        u.ownership.isMarketplaceTemplate && 
        u.ownership.approvalStatus === 'approved'
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.metadata.name.toLowerCase().includes(query) ||
        u.metadata.description?.toLowerCase().includes(query) ||
        u.metadata.category?.toLowerCase().includes(query) ||
        u.metadata.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [univers, filterType, searchQuery, currentUserId]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-sm text-gray-600">Chargement des Univers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters and search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="flex-1 w-full sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher un Univers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterType === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            <Filter className="h-4 w-4 mr-2" />
            Tous
          </Button>
          <Button
            variant={filterType === 'my' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterType('my')}
          >
            Mes Univers
          </Button>
          <Button
            variant={filterType === 'agency' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterType('agency')}
          >
            Agence
          </Button>
          <Button
            variant={filterType === 'marketplace' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterType('marketplace')}
          >
            Marketplace
          </Button>
        </div>

        {/* Create button */}
        {onCreate && (
          <Button onClick={onCreate} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Créer un Univers</span>
            <span className="sm:hidden">Créer</span>
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        {filteredUnivers.length === 0 ? (
          <span>
            {searchQuery || filterType !== 'all' 
              ? 'Aucun Univers ne correspond à vos filtres.' 
              : 'Aucun Univers trouvé.'}
          </span>
        ) : (
          <span>
            {filteredUnivers.length} Univers trouvé{filteredUnivers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Univers grid */}
      {filteredUnivers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="inline-block p-3 bg-gray-100 rounded-full mb-4">
            <Filter className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun Univers trouvé
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            {searchQuery || filterType !== 'all'
              ? 'Essayez de modifier vos filtres ou votre recherche.'
              : 'Commencez par créer votre premier Univers.'}
          </p>
          {onCreate && (
            <Button onClick={onCreate} className="flex items-center space-x-2 mx-auto">
              <Plus className="h-4 w-4" />
              <span>Créer un Univers</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnivers.map((univers) => (
            <UniversCard
              key={univers.id}
              univers={univers}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  );
};

