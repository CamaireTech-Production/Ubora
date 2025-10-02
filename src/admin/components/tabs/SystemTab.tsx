import React, { useState, useEffect } from 'react';
import { AdminService } from '../../services/adminService';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { 
  Settings, 
  RefreshCw, 
  CheckCircle,
  AlertTriangle,
  XCircle,
  Server,
  Database,
  Activity,
  Users,
  FileText,
  BarChart3
} from 'lucide-react';

interface SystemTabProps {
  onRefresh: () => void;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  services: {
    database: 'up' | 'down' | 'slow';
    authentication: 'up' | 'down' | 'slow';
    storage: 'up' | 'down' | 'slow';
    analytics: 'up' | 'down' | 'slow';
  };
  metrics: {
    responseTime: number;
    uptime: number;
    errorRate: number;
    activeConnections: number;
  };
  lastChecked: Date;
}

export const SystemTab: React.FC<SystemTabProps> = ({ onRefresh }) => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSystemHealth();
  }, []);

  const loadSystemHealth = async () => {
    setIsLoading(true);
    try {
      const healthData = await AdminService.getSystemHealth();
      setSystemHealth(healthData);
    } catch (error) {
      console.error('Error loading system health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadSystemHealth();
    onRefresh();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'slow':
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'down':
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'slow':
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'down':
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'up':
        return 'Opérationnel';
      case 'slow':
        return 'Lent';
      case 'down':
        return 'Hors service';
      case 'healthy':
        return 'En bonne santé';
      case 'warning':
        return 'Avertissement';
      case 'critical':
        return 'Critique';
      default:
        return 'Inconnu';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Chargement de l'état du système...
      </div>
    );
  }

  if (!systemHealth) {
    return (
      <div className="text-center py-12 text-red-500">
        Impossible de charger l'état du système
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">État du système</h2>
          <p className="text-sm text-gray-600">Surveillance des services et performances</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh} className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Overall Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(systemHealth.status)}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">État général</h3>
              <p className="text-sm text-gray-600">
                Dernière vérification: {systemHealth.lastChecked.toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.status)}`}>
            {getStatusLabel(systemHealth.status)}
          </span>
        </div>
      </Card>

      {/* Services Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Database className="h-5 w-5 text-blue-500" />
              <span className="font-medium text-gray-900">Base de données</span>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemHealth.services.database)}`}>
              {getStatusIcon(systemHealth.services.database)}
              <span className="ml-1">{getStatusLabel(systemHealth.services.database)}</span>
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-green-500" />
              <span className="font-medium text-gray-900">Authentification</span>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemHealth.services.authentication)}`}>
              {getStatusIcon(systemHealth.services.authentication)}
              <span className="ml-1">{getStatusLabel(systemHealth.services.authentication)}</span>
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Server className="h-5 w-5 text-purple-500" />
              <span className="font-medium text-gray-900">Stockage</span>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemHealth.services.storage)}`}>
              {getStatusIcon(systemHealth.services.storage)}
              <span className="ml-1">{getStatusLabel(systemHealth.services.storage)}</span>
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-gray-900">Analytics</span>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemHealth.services.analytics)}`}>
              {getStatusIcon(systemHealth.services.analytics)}
              <span className="ml-1">{getStatusLabel(systemHealth.services.analytics)}</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Métriques de performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{systemHealth.metrics.responseTime}ms</div>
            <div className="text-sm text-gray-500">Temps de réponse</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{systemHealth.metrics.uptime}%</div>
            <div className="text-sm text-gray-500">Disponibilité</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{systemHealth.metrics.errorRate}%</div>
            <div className="text-sm text-gray-500">Taux d'erreur</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{systemHealth.metrics.activeConnections}</div>
            <div className="text-sm text-gray-500">Connexions actives</div>
          </div>
        </div>
      </Card>

      {/* System Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations système</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Version de l'application</span>
            <span className="text-sm font-medium text-gray-900">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Environnement</span>
            <span className="text-sm font-medium text-gray-900">Production</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Serveur</span>
            <span className="text-sm font-medium text-gray-900">Firebase</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Dernière mise à jour</span>
            <span className="text-sm font-medium text-gray-900">
              {systemHealth.lastChecked.toLocaleString('fr-FR')}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
