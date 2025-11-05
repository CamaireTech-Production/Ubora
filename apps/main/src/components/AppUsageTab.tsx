import React, { useState, useEffect } from 'react';
import { EnhancedAdminService } from '../admin/services/enhancedAdminService';
import { Card } from './Card';
import { Button } from './Button';
import { 
  Clock, 
  Users, 
  TrendingUp, 
  Activity,
  Filter,
  RefreshCw,
  Download
} from 'lucide-react';

interface AppUsageTabProps {
  onRefresh?: () => void;
}

export const AppUsageTab: React.FC<AppUsageTabProps> = () => {
  const [usageStats, setUsageStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'time' | 'sessions'>('time');

  useEffect(() => {
    loadUsageStats();
  }, []);

  const loadUsageStats = async () => {
    setIsLoading(true);
    try {
      const stats = await EnhancedAdminService.getAppUsageStats();
      setUsageStats(stats);
    } catch (error) {
      console.error('Error loading usage stats:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const formatDuration = (minutes: number) => {
    return EnhancedAdminService.formatDuration(minutes);
  };

  const sortedUsers = usageStats?.byUser?.sort((a: any, b: any) => {
    if (sortBy === 'time') {
      return b.totalTime - a.totalTime;
    } else {
      return b.sessionCount - a.sessionCount;
    }
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des statistiques d'utilisation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      {usageStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{usageStats.totalSessions}</p>
                <p className="text-sm text-gray-600">Sessions totales</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(usageStats.totalUsageTime)}
                </p>
                <p className="text-sm text-gray-600">Temps total</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(usageStats.averageSessionDuration)}
                </p>
                <p className="text-sm text-gray-600">Session moyenne</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{usageStats.activeUsers}</p>
                <p className="text-sm text-gray-600">Utilisateurs actifs</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Usage Insights */}
      {usageStats && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights d'utilisation</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {usageStats.totalSessions > 0 ? Math.round(usageStats.totalUsageTime / usageStats.totalSessions) : 0} min
              </p>
              <p className="text-sm text-gray-600">Durée moyenne par session</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {usageStats.activeUsers > 0 ? Math.round(usageStats.totalSessions / usageStats.activeUsers) : 0}
              </p>
              <p className="text-sm text-gray-600">Sessions par utilisateur</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {usageStats.activeUsers > 0 ? Math.round(usageStats.totalUsageTime / usageStats.activeUsers) : 0} min
              </p>
              <p className="text-sm text-gray-600">Temps moyen par utilisateur</p>
            </div>
          </div>
        </Card>
      )}

      {/* User Usage Ranking */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Classement des utilisateurs</h3>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1"
              >
                <option value="time">Trier par temps</option>
                <option value="sessions">Trier par sessions</option>
              </select>
            </div>
            <Button
              onClick={loadUsageStats}
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Actualiser</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Exporter</span>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {sortedUsers.slice(0, 20).map((user: any, index: number) => (
            <div key={user.userId} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-800' :
                  index === 1 ? 'bg-gray-100 text-gray-800' :
                  index === 2 ? 'bg-orange-100 text-orange-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {index + 1}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate">{user.userName}</h4>
                  <span className="text-xs text-gray-500">({user.userId})</span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(user.totalTime)}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Activity className="h-3 w-3" />
                    <span>{user.sessionCount} sessions</span>
                  </span>
                </div>
              </div>
              
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-medium text-gray-900">
                  {formatDuration(user.totalTime)}
                </div>
                <div className="text-xs text-gray-500">
                  {user.sessionCount} sessions
                </div>
              </div>
            </div>
          ))}
        </div>

        {sortedUsers.length === 0 && (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune donnée d'utilisation</h3>
            <p className="text-gray-600">Aucune session d'utilisation enregistrée.</p>
          </div>
        )}
      </Card>

      {/* Usage Trends */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendances d'utilisation</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Utilisateurs les plus actifs</h4>
            <div className="space-y-2">
              {sortedUsers.slice(0, 5).map((user: any) => (
                <div key={user.userId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{user.userName}</span>
                  <span className="font-medium">{formatDuration(user.totalTime)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Sessions les plus longues</h4>
            <div className="space-y-2">
              {sortedUsers
                .sort((a: any, b: any) => b.totalTime / b.sessionCount - a.totalTime / a.sessionCount)
                .slice(0, 5)
                .map((user: any) => (
                <div key={user.userId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{user.userName}</span>
                  <span className="font-medium">
                    {formatDuration(Math.round(user.totalTime / user.sessionCount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
