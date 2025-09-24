import React, { useState, useEffect } from 'react';
import { AdminService } from '../../services/adminService';
import { ActivityLog } from '../../types';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { 
  Activity, 
  RefreshCw, 
  Filter,
  Calendar,
  User,
  Building2,
  AlertTriangle,
  Info,
  CheckCircle
} from 'lucide-react';

interface ActivitiesTabProps {
  onRefresh: () => void;
}

export const ActivitiesTab: React.FC<ActivitiesTabProps> = ({ onRefresh }) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const activitiesData = await AdminService.getActivitySummary();
      // Convert AdminActivitySummary to ActivityLog format for display
      const formattedActivities: ActivityLog[] = activitiesData.map(activity => ({
        id: activity.type,
        type: activity.type as any,
        userId: 'system',
        userEmail: 'system@ubora.com',
        userName: 'Système',
        userRole: 'admin',
        description: activity.description,
        timestamp: new Date(),
        severity: 'medium',
        category: 'system',
        metadata: {
          count: activity.count,
          lastActivity: activity.lastActivity
        }
      }));
      setActivities(formattedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadActivities();
    onRefresh();
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSeverity = filter === 'all' || activity.severity === filter;
    const matchesType = typeFilter === 'all' || activity.type === typeFilter;
    return matchesSeverity && matchesType;
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

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'user_creation':
      case 'user_update':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'agency_creation':
      case 'agency_update':
        return <Building2 className="h-4 w-4 text-purple-500" />;
      case 'form_creation':
      case 'form_submission':
        return <Activity className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Chargement des activités...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Journal des activités</h2>
          <p className="text-sm text-gray-600">{activities.length} activités récentes</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh} className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-48">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes les priorités</option>
              <option value="high">Haute priorité</option>
              <option value="medium">Priorité moyenne</option>
              <option value="low">Basse priorité</option>
            </select>
          </div>
          <div className="sm:w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les types</option>
              <option value="user_creation">Création d'utilisateur</option>
              <option value="user_update">Mise à jour utilisateur</option>
              <option value="form_creation">Création de formulaire</option>
              <option value="form_submission">Soumission de formulaire</option>
              <option value="agency_creation">Création d'agence</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Activities List */}
      <div className="space-y-4">
        {filteredActivities.map((activity) => (
          <Card key={activity.id} className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                {getTypeIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {activity.description}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(activity.severity)}`}>
                      {getSeverityIcon(activity.severity)}
                      <span className="ml-1 capitalize">{activity.severity}</span>
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(activity.timestamp)}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <User className="h-3 w-3" />
                    <span>{activity.userName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Building2 className="h-3 w-3" />
                    <span>{activity.userRole}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{activity.category}</span>
                  </div>
                </div>
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <details>
                      <summary className="cursor-pointer hover:text-gray-700">Détails</summary>
                      <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">
                        {JSON.stringify(activity.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredActivities.length === 0 && (
        <Card className="p-12 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune activité trouvée</h3>
          <p className="text-gray-500">
            {filter !== 'all' || typeFilter !== 'all'
              ? 'Aucune activité ne correspond à vos critères de filtrage.'
              : 'Aucune activité récente à afficher.'
            }
          </p>
        </Card>
      )}
    </div>
  );
};
