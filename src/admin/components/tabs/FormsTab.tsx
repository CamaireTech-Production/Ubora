import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminService } from '../../services/adminService';
import { AdminForm } from '../../types';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { 
  FileText, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Calendar,
  Users,
  Activity,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface FormsTabProps {
  onRefresh: () => void;
}

export const FormsTab: React.FC<FormsTabProps> = ({ onRefresh }) => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<AdminForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    setIsLoading(true);
    try {
      const formsData = await AdminService.getAllForms();
      setForms(formsData);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadForms();
    onRefresh();
  };

  const filteredForms = forms.filter(form => {
    const matchesSearch = (form.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (form.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && form.isActive) ||
                         (statusFilter === 'inactive' && !form.isActive);
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Chargement des formulaires...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Gestion des formulaires</h2>
          <p className="text-sm text-gray-600">{forms.length} formulaires au total</p>
        </div>
        <Button size="sm" className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Nouveau formulaire</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher un formulaire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>
          <Button variant="secondary" size="sm" onClick={handleRefresh} className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Actualiser</span>
          </Button>
        </div>
      </Card>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredForms.map((form) => (
          <Card key={form.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{form.title}</h3>
                  <p className="text-sm text-gray-500">{form.agencyName || form.agencyId}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(form.isActive)}`}>
                {getStatusIcon(form.isActive)}
                <span className="ml-1">{form.isActive ? 'Actif' : 'Inactif'}</span>
              </span>
            </div>

            {form.description && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{form.description}</p>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Soumissions</span>
                <span className="font-medium text-gray-900">{form.submissionsCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Champs</span>
                <span className="font-medium text-gray-900">{form.fields.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Créé le</span>
                <span className="font-medium text-gray-900">{formatDate(form.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/admin/forms/${form.id}`)}
                  className="flex items-center space-x-1"
                >
                  <Eye className="h-3 w-3" />
                  <span>Voir</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <Edit className="h-3 w-3" />
                  <span>Modifier</span>
                </Button>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="text-red-600 hover:text-red-700 flex items-center space-x-1"
              >
                <Trash2 className="h-3 w-3" />
                <span>Supprimer</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredForms.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun formulaire trouvé</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Aucun formulaire ne correspond à vos critères de recherche.'
              : 'Commencez par créer votre premier formulaire.'
            }
          </p>
          <Button size="sm" className="flex items-center space-x-2 mx-auto">
            <Plus className="h-4 w-4" />
            <span>Créer un formulaire</span>
          </Button>
        </Card>
      )}
    </div>
  );
};
