import React from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Filter, Search, X } from 'lucide-react';

export interface MarketplaceFiltersState {
  searchQuery: string;
  category: string;
  priceFilter: 'all' | 'free' | 'paid';
  sortBy: 'popularity' | 'newest' | 'price-asc' | 'price-desc';
  tags: string[];
}

interface MarketplaceFiltersProps {
  filters: MarketplaceFiltersState;
  onFiltersChange: (filters: MarketplaceFiltersState) => void;
  availableCategories: string[];
  availableTags: string[];
}

export const MarketplaceFilters: React.FC<MarketplaceFiltersProps> = ({
  filters,
  onFiltersChange,
  availableCategories,
  availableTags
}) => {
  const handleFilterChange = (key: keyof MarketplaceFiltersState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    handleFilterChange('tags', newTags);
  };

  const clearFilters = () => {
    onFiltersChange({
      searchQuery: '',
      category: 'all',
      priceFilter: 'all',
      sortBy: 'popularity',
      tags: []
    });
  };

  const hasActiveFilters = 
    filters.searchQuery !== '' ||
    filters.category !== 'all' ||
    filters.priceFilter !== 'all' ||
    filters.sortBy !== 'popularity' ||
    filters.tags.length > 0;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Rechercher dans le marketplace..."
          value={filters.searchQuery}
          onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
          className="pl-12 h-12 text-base bg-white/80 backdrop-blur-sm border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl shadow-sm"
        />
      </div>

      {/* Filters row - scrollable on mobile */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        {/* Scrollable filters container for mobile */}
        <div className="w-full lg:w-auto overflow-x-auto lg:overflow-visible -mx-6 px-6 lg:mx-0 lg:px-0">
          <div className="flex gap-3 items-center min-w-max lg:min-w-0 lg:flex-wrap">
            {/* Category filter */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:inline">
                Catégorie:
              </label>
              <Select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="min-w-[150px]"
                options={[
                  { value: 'all', label: 'Toutes' },
                  ...availableCategories.map(cat => ({ value: cat, label: cat }))
                ]}
              />
            </div>

            {/* Price filter */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:inline">
                Prix:
              </label>
              <Select
                value={filters.priceFilter}
                onChange={(e) => handleFilterChange('priceFilter', e.target.value as any)}
                className="min-w-[120px]"
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'free', label: 'Gratuit' },
                  { value: 'paid', label: 'Payant' }
                ]}
              />
            </div>

            {/* Sort by */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:inline">
                Trier par:
              </label>
              <Select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value as any)}
                className="min-w-[160px]"
                options={[
                  { value: 'popularity', label: 'Popularité' },
                  { value: 'newest', label: 'Plus récents' },
                  { value: 'price-asc', label: 'Prix croissant' },
                  { value: 'price-desc', label: 'Prix décroissant' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            variant="secondary"
            size="sm"
            onClick={clearFilters}
            className="flex items-center space-x-2 flex-shrink-0 w-full sm:w-auto justify-center sm:justify-start"
          >
            <X className="h-4 w-4" />
            <span>Réinitialiser</span>
          </Button>
        )}
      </div>

      {/* Tags filter - scrollable row */}
      {availableTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Tags:</label>
          <div className="w-full overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0 lg:overflow-visible">
            <div className="flex gap-2 min-w-max lg:min-w-0 lg:flex-wrap">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
                    filters.tags.includes(tag)
                      ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

