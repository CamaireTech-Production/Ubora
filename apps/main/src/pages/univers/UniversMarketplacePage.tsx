import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { Layout } from '../components/layout/Layout';
import { UniversCard } from '../components/univers/UniversCard';
import { MarketplaceFilters, MarketplaceFiltersState } from '../components/MarketplaceFilters';
import { Univers } from '../types';
import { universService } from '@ubora/shared/services/universService';
import { useToast } from '@ubora/shared/hooks/useToast';
import { Toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { WireframeLoader } from '../components/loading/WireframeLoader';

export const UniversMarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showError } = useToast();
  const [marketplaceUnivers, setMarketplaceUnivers] = useState<Univers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [filters, setFilters] = useState<MarketplaceFiltersState>({
    searchQuery: '',
    category: 'all',
    priceFilter: 'all',
    sortBy: 'popularity',
    tags: []
  });

  useEffect(() => {
    if (user?.id && user?.agencyId) {
      loadMarketplaceUnivers();
    }
  }, [user]);

  const loadMarketplaceUnivers = async () => {
    if (!user?.id || !user?.agencyId) return;

    setIsLoading(true);
    try {
      const templates = await universService.getMarketplaceTemplates();
      setMarketplaceUnivers(templates);
    } catch (error) {
      console.error('Erreur lors du chargement du marketplace:', error);
      showError('Erreur lors du chargement du marketplace');
    } finally {
      setIsLoading(false);
    }
  };

  // Extract available categories and tags
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    marketplaceUnivers.forEach(u => {
      if (u.metadata.category) {
        categories.add(u.metadata.category);
      }
    });
    return Array.from(categories).sort();
  }, [marketplaceUnivers]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    marketplaceUnivers.forEach(u => {
      if (u.metadata.tags && Array.isArray(u.metadata.tags)) {
        u.metadata.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [marketplaceUnivers]);

  // Filter and sort Univers
  const filteredUnivers = useMemo(() => {
    let filtered = [...marketplaceUnivers];

    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.metadata.name.toLowerCase().includes(query) ||
        u.metadata.description?.toLowerCase().includes(query) ||
        u.metadata.category?.toLowerCase().includes(query) ||
        u.metadata.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(u => u.metadata.category === filters.category);
    }

    // Price filter
    if (filters.priceFilter === 'free') {
      filtered = filtered.filter(u => 
        u.metadata.price === 0 || u.metadata.price === null || u.metadata.price === undefined
      );
    } else if (filters.priceFilter === 'paid') {
      filtered = filtered.filter(u => 
        u.metadata.price !== null && u.metadata.price !== undefined && u.metadata.price > 0
      );
    }

    // Tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(u =>
        u.metadata.tags?.some(tag => filters.tags.includes(tag))
      );
    }

    // Sort
    switch (filters.sortBy) {
      case 'popularity':
        filtered.sort((a, b) => (b.usage.totalUsages || 0) - (a.usage.totalUsages || 0));
        break;
      case 'newest':
        filtered.sort((a, b) => 
          b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
        );
        break;
      case 'price-asc':
        filtered.sort((a, b) => {
          const priceA = a.metadata.price ?? 0;
          const priceB = b.metadata.price ?? 0;
          return priceA - priceB;
        });
        break;
      case 'price-desc':
        filtered.sort((a, b) => {
          const priceA = a.metadata.price ?? 0;
          const priceB = b.metadata.price ?? 0;
          return priceB - priceA;
        });
        break;
    }

    return filtered;
  }, [marketplaceUnivers, filters]);

  // Pagination logic
  const totalPages = Math.ceil(filteredUnivers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUnivers = filteredUnivers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleView = (univers: Univers) => {
    navigate(`/univers/${univers.id}`, { state: { from: 'marketplace' } });
  };

  const handlePurchase = (univers: Univers) => {
    // Rediriger vers la page de création depuis template
    navigate(`/univers/create-from-template/${univers.id}`);
  };

  if (!user?.id || !user?.agencyId) {
    return (
      <Layout title="Marketplace">
        <WireframeLoader type="univers" />
      </Layout>
    );
  }

  return (
    <>
      <Layout title="Marketplace">
        <div className="space-y-6">
          {/* Header avec design moderne */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-8 border border-purple-100">
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/univers')}
                    className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm hover:bg-white border border-gray-200 shadow-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center space-x-2">
                      <Globe className="h-8 w-8 text-purple-600" />
                      <span>Marketplace</span>
                    </h1>
                    <p className="text-sm text-gray-600 mt-2">
                      Découvrez et achetez des Univers créés par la communauté
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Pattern décoratif */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
          </div>

          {/* Filters */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 shadow-sm">
            <MarketplaceFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableCategories={availableCategories}
              availableTags={availableTags}
            />
          </div>

          {/* Univers grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <WireframeLoader type="univers-card" count={6} />
            </div>
          ) : filteredUnivers.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full mb-4">
                <Globe className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Aucun Univers trouvé
              </h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Aucun Univers ne correspond à vos critères de recherche. Essayez de modifier vos filtres.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {paginatedUnivers.map((univers) => (
                  <UniversCard
                    key={univers.id}
                    univers={univers}
                    onView={handleView}
                    onPurchase={handlePurchase}
                    hideApprovalStatus={true}
                    context="marketplace"
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} sur {totalPages} • {filteredUnivers.length} résultat{filteredUnivers.length > 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center space-x-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Précédent</span>
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "primary" : "secondary"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="min-w-[40px]"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center space-x-1"
                    >
                      <span className="hidden sm:inline">Suivant</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>

      {toast && <Toast {...toast} />}
    </>
  );
};

