import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { universService } from '@ubora/shared/services/universService';
import { Univers, UniversInstance } from '@ubora/shared/types';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@ubora/shared';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { 
  ArrowLeft,
  Globe,
  RefreshCw,
  FileText,
  AlertCircle,
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  BarChart3,
  BookOpen,
  List,
  FileCheck,
  Search,
  Filter
} from 'lucide-react';

export const UniversListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allUnivers, setAllUnivers] = useState<Univers[]>([]);
  const [universInstances, setUniversInstances] = useState<Map<string, UniversInstance[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterMarketplace, setFilterMarketplace] = useState<'all' | 'marketplace' | 'private'>('all');

  useEffect(() => {
    loadAllUnivers();
  }, []);

  const loadAllUnivers = async () => {
    setIsLoading(true);
    try {
      // Get all universes - we'll query directly since we need all universes for admin
      const universCollection = collection(db, 'univers');
      const q = query(universCollection, orderBy('metadata.createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const universes: Univers[] = [];
      snapshot.forEach((doc) => {
        try {
          const data = doc.data();
          // Convert Firestore data to Univers format
          const univers: Univers = {
            id: doc.id,
            metadata: {
              ...data.metadata,
              createdAt: data.metadata?.createdAt?.toDate() || new Date()
            },
            ownership: {
              ...data.ownership,
              approvedAt: data.ownership?.approvedAt?.toDate() || undefined
            },
            definitions: data.definitions || {
              forms: [],
              dashboards: [],
              instructions: [],
              lists: [],
              reports: []
            },
            usage: {
              ...data.usage,
              lastUsedAt: data.usage?.lastUsedAt?.toDate() || undefined
            }
          };
          universes.push(univers);
        } catch (error) {
          console.error(`Error converting univers ${doc.id}:`, error);
        }
      });
      
      setAllUnivers(universes);

      // Load instances for each univers
      const instancesMap = new Map<string, UniversInstance[]>();
      for (const univers of universes) {
        try {
          const instances = await universService.getInstancesByUnivers(univers.id);
          instancesMap.set(univers.id, instances);
        } catch (error) {
          console.error(`Error loading instances for univers ${univers.id}:`, error);
          instancesMap.set(univers.id, []);
        }
      }
      setUniversInstances(instancesMap);
    } catch (error) {
      console.error('Erreur lors du chargement des Univers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status?: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            En attente
          </span>
        );
      case 'approved':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
            Approuvé
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
            Rejeté
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
            N/A
          </span>
        );
    }
  };

  const filteredUnivers = allUnivers.filter((univers) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = univers.metadata.name.toLowerCase().includes(query);
      const matchesDescription = univers.metadata.description?.toLowerCase().includes(query) || false;
      if (!matchesName && !matchesDescription) return false;
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (univers.ownership.approvalStatus !== filterStatus) return false;
    }

    // Marketplace filter
    if (filterMarketplace !== 'all') {
      if (filterMarketplace === 'marketplace' && !univers.ownership.isMarketplaceTemplate) return false;
      if (filterMarketplace === 'private' && univers.ownership.isMarketplaceTemplate) return false;
    }

    return true;
  });

  const getPendingCount = () => {
    return allUnivers.filter(u => u.ownership.approvalStatus === 'pending').length;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Retour</span>
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Tous les Univers
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  Vue d'ensemble de tous les Univers dans le système
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => navigate('/univers-approvals')}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <Clock className="h-4 w-4" />
                <span>Approbations</span>
                {getPendingCount() > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                    {getPendingCount()}
                  </span>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadAllUnivers}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Actualiser</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher par nom ou description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
                <option value="rejected">Rejeté</option>
              </select>
            </div>

            {/* Marketplace Filter */}
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-gray-400" />
              <select
                value={filterMarketplace}
                onChange={(e) => setFilterMarketplace(e.target.value as any)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les Univers</option>
                <option value="marketplace">Marketplace</option>
                <option value="private">Privé</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{allUnivers.length}</div>
              <div className="text-sm text-gray-600">Total Univers</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{getPendingCount()}</div>
              <div className="text-sm text-gray-600">En attente</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {allUnivers.filter(u => u.ownership.approvalStatus === 'approved').length}
              </div>
              <div className="text-sm text-gray-600">Approuvés</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {allUnivers.filter(u => u.ownership.isMarketplaceTemplate).length}
              </div>
              <div className="text-sm text-gray-600">Marketplace</div>
            </div>
          </Card>
        </div>

        {/* Univers List */}
        {filteredUnivers.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Aucun Univers trouvé</p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery || filterStatus !== 'all' || filterMarketplace !== 'all'
                  ? 'Essayez de modifier vos filtres'
                  : 'Aucun Univers n\'a été créé'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredUnivers.map((univers) => {
              const instances = universInstances.get(univers.id) || [];
              const activeInstances = instances.filter(i => i.isActive).length;

              return (
                <Card key={univers.id} className="hover:shadow-md transition-shadow">
                  <div className="space-y-4">
                    {/* Univers Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Globe className="h-5 w-5 text-blue-600" />
                          <h2 className="text-xl font-semibold text-gray-900">
                            {univers.metadata.name}
                          </h2>
                          {getStatusBadge(univers.ownership.approvalStatus)}
                          {univers.ownership.isMarketplaceTemplate && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Marketplace
                            </span>
                          )}
                        </div>
                        {univers.metadata.description && (
                          <p className="text-gray-600 text-sm mb-3">{univers.metadata.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>Créé le: {formatDate(univers.metadata.createdAt)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>Version:</span>
                            <span className="font-medium">{univers.metadata.version}</span>
                          </div>
                          {univers.metadata.price !== undefined && univers.metadata.price !== null && (
                            <div className="flex items-center space-x-1">
                              <span>Prix:</span>
                              <span className="font-medium">
                                {univers.metadata.price === 0 
                                  ? 'Gratuit' 
                                  : `${univers.metadata.price} ${univers.metadata.currency || 'XAF'}`}
                              </span>
                            </div>
                          )}
                          {univers.usage.lastUsedAt && (
                            <div className="flex items-center space-x-1">
                              <span>Dernière utilisation:</span>
                              <span>{formatDate(univers.usage.lastUsedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Definitions Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="text-lg font-semibold">{univers.definitions.forms?.length || 0}</div>
                          <div className="text-xs text-gray-600">Formulaires</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="text-lg font-semibold">{univers.definitions.dashboards?.length || 0}</div>
                          <div className="text-xs text-gray-600">Tableaux</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <BookOpen className="h-4 w-4 text-purple-600" />
                        <div>
                          <div className="text-lg font-semibold">{univers.definitions.instructions?.length || 0}</div>
                          <div className="text-xs text-gray-600">Instructions</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <List className="h-4 w-4 text-orange-600" />
                        <div>
                          <div className="text-lg font-semibold">{univers.definitions.lists?.length || 0}</div>
                          <div className="text-xs text-gray-600">Listes</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileCheck className="h-4 w-4 text-indigo-600" />
                        <div>
                          <div className="text-lg font-semibold">{univers.definitions.reports?.length || 0}</div>
                          <div className="text-xs text-gray-600">Rapports</div>
                        </div>
                      </div>
                    </div>

                    {/* Usage and Instances */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="text-lg font-semibold">{instances.length}</div>
                          <div className="text-xs text-gray-600">Total instances</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="text-lg font-semibold">{activeInstances}</div>
                          <div className="text-xs text-gray-600">Instances actives</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4 text-purple-600" />
                        <div>
                          <div className="text-lg font-semibold">{univers.usage.totalUsages || 0}</div>
                          <div className="text-xs text-gray-600">Total utilisations</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                      {univers.ownership.approvalStatus === 'pending' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/univers-approvals/${univers.id}`)}
                          className="flex items-center space-x-2"
                        >
                          <Eye className="h-4 w-4" />
                          <span>Voir approbation</span>
                        </Button>
                      )}
                      {univers.ownership.isMarketplaceTemplate && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/univers-approvals/${univers.id}`)}
                          className="flex items-center space-x-2"
                        >
                          <Eye className="h-4 w-4" />
                          <span>Voir détails</span>
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/univers-approvals/${univers.id}`)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Voir les détails</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

