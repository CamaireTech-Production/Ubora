import React, { useState, useEffect } from 'react';
import { EnhancedAdminService } from '../admin/services/enhancedAdminService';
import { PushNotificationLog } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { 
  Bell, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  Calendar,
  Filter,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface PushNotificationsTabProps {
  onRefresh?: () => void;
}

export const PushNotificationsTab: React.FC<PushNotificationsTabProps> = ({ onRefresh }) => {
  const [notifications, setNotifications] = useState<PushNotificationLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'clicked' | 'unclicked'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const [notificationsData, statsData] = await Promise.all([
        EnhancedAdminService.getAllPushNotifications(),
        EnhancedAdminService.getPushNotificationStats()
      ]);

      setNotifications(notificationsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case 'form_reminder':
        return <Bell className="h-4 w-4 text-blue-600" />;
      case 'package_expiry':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'system_announcement':
        return <Bell className="h-4 w-4 text-purple-600" />;
      case 'chat_notification':
        return <Bell className="h-4 w-4 text-green-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'form_reminder':
        return 'bg-blue-100 text-blue-800';
      case 'package_expiry':
        return 'bg-orange-100 text-orange-800';
      case 'system_announcement':
        return 'bg-purple-100 text-purple-800';
      case 'chat_notification':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = filter === 'all' || 
      (filter === 'clicked' && notification.isClicked) ||
      (filter === 'unclicked' && !notification.isClicked);
    
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    
    return matchesFilter && matchesType;
  });

  const uniqueTypes = Array.from(new Set(notifications.map(n => n.type)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <Bell className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.totalSent}</p>
                <p className="text-sm text-gray-600">Total envoyées</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <MousePointer className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.totalClicked}</p>
                <p className="text-sm text-gray-600">Total cliquées</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.overallClickRate}%</p>
                <p className="text-sm text-gray-600">Taux de clic global</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((stats.totalSent - stats.totalClicked) / stats.totalSent * 100) || 0}%
                </p>
                <p className="text-sm text-gray-600">Non lues</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Type Statistics */}
      {stats && stats.byType && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiques par type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.byType).map(([type, typeStats]: [string, any]) => (
              <div key={type} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {getNotificationTypeIcon(type)}
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {type.replace('_', ' ')}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Envoyées:</span>
                    <span className="font-medium">{typeStats.sent}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cliquées:</span>
                    <span className="font-medium">{typeStats.clicked}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Taux:</span>
                    <span className="font-medium text-blue-600">{typeStats.rate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters and Actions */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1"
              >
                <option value="all">Toutes</option>
                <option value="clicked">Cliquées</option>
                <option value="unclicked">Non cliquées</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1"
              >
                <option value="all">Tous les types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={loadNotifications}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Actualiser</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Exporter</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Notifications List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Notifications ({filteredNotifications.length})
        </h3>
        
        <div className="space-y-4">
          {filteredNotifications.map((notification) => (
            <div key={notification.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                {notification.isClicked ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getNotificationTypeIcon(notification.type)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getNotificationTypeColor(notification.type)}`}>
                        {notification.type.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">{notification.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{notification.body}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>À: {notification.userName}</span>
                      <span>Envoyée: {formatDate(notification.sentAt)}</span>
                      {notification.clickedAt && (
                        <span>Cliquée: {formatDate(notification.clickedAt)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {notification.isClicked ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Cliquée
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                        Non cliquée
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune notification</h3>
            <p className="text-gray-600">
              {filter === 'all' ? 'Aucune notification trouvée.' : 
               filter === 'clicked' ? 'Aucune notification cliquée.' :
               'Aucune notification non cliquée.'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
