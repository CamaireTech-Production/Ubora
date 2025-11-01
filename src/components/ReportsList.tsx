import React, { useState, useMemo } from 'react';
import { Report } from '../types';
import { ReportCard } from './ReportCard';
import { Button } from './Button';
import { Plus, Search, Filter, FileText } from 'lucide-react';
import { Input } from './Input';

interface ReportsListProps {
  reports: Report[];
  onEdit?: (report: Report) => void;
  onDelete?: (reportId: string) => void;
  onView?: (report: Report) => void;
  onCreate?: () => void;
  currentUserId: string;
  isLoading?: boolean;
}

type FilterType = 'all' | 'my' | 'fromUnivers';
type TemplateTypeFilter = 'all' | 'pdf' | 'word' | 'text';

export const ReportsList: React.FC<ReportsListProps> = ({
  reports,
  onEdit,
  onDelete,
  onView,
  onCreate,
  currentUserId,
  isLoading = false
}) => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [templateTypeFilter, setTemplateTypeFilter] = useState<TemplateTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter reports based on ownership, type, and search
  const filteredReports = useMemo(() => {
    let filtered = reports;

    // Filter by ownership type
    if (filterType === 'my') {
      filtered = filtered.filter(r => r.createdBy === currentUserId);
    } else if (filterType === 'fromUnivers') {
      filtered = filtered.filter(r => r.fromUnivers === true);
    }

    // Filter by template type
    if (templateTypeFilter !== 'all') {
      filtered = filtered.filter(r => r.templateType === templateTypeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.placeholders.some(p => p.placeholder.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [reports, filterType, templateTypeFilter, searchQuery, currentUserId]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-sm text-gray-600">Chargement des rapports...</p>
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
              placeholder="Rechercher un rapport..."
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
            Mes rapports
          </Button>
          <Button
            variant={filterType === 'fromUnivers' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterType('fromUnivers')}
          >
            Depuis Univers
          </Button>
          
          {/* Template type filter */}
          <Button
            variant={templateTypeFilter !== 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              // Cycle through template types
              const types: TemplateTypeFilter[] = ['all', 'pdf', 'word', 'text'];
              const currentIndex = types.indexOf(templateTypeFilter);
              setTemplateTypeFilter(types[(currentIndex + 1) % types.length]);
            }}
            className="flex items-center space-x-1"
          >
            <FileText className="h-4 w-4" />
            <span>
              {templateTypeFilter === 'all' ? 'Tous types' :
               templateTypeFilter === 'pdf' ? 'PDF' :
               templateTypeFilter === 'word' ? 'Word' : 'Texte'}
            </span>
          </Button>
        </div>

        {/* Create button */}
        {onCreate && (
          <Button onClick={onCreate} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Créer un rapport</span>
            <span className="sm:hidden">Créer</span>
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        {filteredReports.length === 0 ? (
          <span>
            {searchQuery || filterType !== 'all' || templateTypeFilter !== 'all'
              ? 'Aucun rapport ne correspond à vos filtres.' 
              : 'Aucun rapport trouvé.'}
          </span>
        ) : (
          <span>
            {filteredReports.length} rapport{filteredReports.length > 1 ? 's' : ''} trouvé{filteredReports.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Reports grid */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="inline-block p-3 bg-gray-100 rounded-full mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun rapport trouvé
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            {searchQuery || filterType !== 'all' || templateTypeFilter !== 'all'
              ? 'Essayez de modifier vos filtres ou votre recherche.'
              : 'Commencez par créer votre premier rapport.'}
          </p>
          {onCreate && (
            <Button onClick={onCreate} className="flex items-center space-x-2 mx-auto">
              <Plus className="h-4 w-4" />
              <span>Créer un rapport</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
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
