import React from 'react';
import { AdminStats } from '../../types';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { 
  Users, 
  FileText, 
  BarChart3, 
  Activity,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw
} from 'lucide-react';

interface OverviewTabProps {
  stats: AdminStats | null;
  onRefresh: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ stats, onRefresh }) => {
  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucune donnée disponible
      </div>
    );
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getHealthLabel = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Système en bonne santé';
      case 'warning':
        return 'Avertissement système';
      case 'critical':
        return 'Problème critique';
      default:
        return 'État inconnu';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vue d'ensemble</h2>
          <p className="text-gray-600">Statistiques générales de l'application</p>
        </div>
        <Button onClick={onRefresh} variant="secondary" size="sm" className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* System Health */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getHealthIcon(stats.systemHealth)}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">État du système</h3>
              <p className="text-sm text-gray-600">{getHealthLabel(stats.systemHealth)}</p>
            </div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(stats.systemHealth)}`}>
            {stats.systemHealth}
          </span>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Users */}
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-500">Utilisateurs</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
                <p className="ml-2 text-sm text-gray-500">
                  ({stats.activeUsers} actifs)
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Forms */}
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-green-100 p-3 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-500">Formulaires</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.totalForms}</p>
                <p className="ml-2 text-sm text-gray-500">
                  ({stats.activeForms} actifs)
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Submissions */}
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-purple-100 p-3 rounded-lg">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-500">Soumissions</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.totalSubmissions}</p>
                <p className="ml-2 text-sm text-gray-500">
                  ({stats.pendingSubmissions} en attente)
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Dashboards */}
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-medium text-gray-500">Tableaux de bord</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.totalDashboards}</p>
                <p className="ml-2 text-sm text-gray-500">
                  (total)
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé des activités</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Dernière mise à jour</span>
            <span className="text-sm font-medium text-gray-900">
              {stats.lastUpdated.toLocaleString('fr-FR')}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Utilisateurs actifs</span>
            <span className="text-sm font-medium text-gray-900">
              {stats.activeUsers} / {stats.totalUsers}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Formulaires actifs</span>
            <span className="text-sm font-medium text-gray-900">
              {stats.activeForms} / {stats.totalForms}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Soumissions en attente</span>
            <span className="text-sm font-medium text-gray-900">
              {stats.pendingSubmissions}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
