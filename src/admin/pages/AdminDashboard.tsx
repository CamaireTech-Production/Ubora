import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminService } from '../services/adminService';
import { EnhancedAdminService } from '../services/enhancedAdminService';
import { ActivityLogService } from '../../services/activityLogService';
import { AdminService as BaseAdminService } from '../../services/adminService';
import { AdminDashboardStats, AdminUser, AdminActivitySummary, ActivityLog } from '../../types';
import { PushNotificationsTab } from '../../components/PushNotificationsTab';
import { AppUsageTab } from '../../components/AppUsageTab';
import { UsersTable } from '../../components/UsersTable';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { 
  Users, 
  Building2, 
  FileText, 
  BarChart3, 
  Activity, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Download,
  Settings,
  UserPlus,
  LogOut,
  Menu,
  X,
  Bell
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitySummary, setActivitySummary] = useState<AdminActivitySummary[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'activities' | 'notifications' | 'usage' | 'system'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsData, usersData, activitiesData, summaryData, healthData] = await Promise.all([
        AdminService.getAdminStats(),
        EnhancedAdminService.getAllUsersWithDetails(),
        ActivityLogService.getRecentActivities(50),
        BaseAdminService.getActivitySummary(),
        BaseAdminService.getSystemHealth()
      ]);

      setStats(statsData);
      setUsers(usersData);
      setActivities(activitiesData);
      setActivitySummary(summaryData);
      setSystemHealth(healthData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };


  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Bienvenue, {user?.name}</p>
              </div>
            </div>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-4">
                <Button
                  onClick={loadDashboardData}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Actualiser</span>
                </Button>
              {/* <Button
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Exporter</span>
              </Button> */}
              <Button
                onClick={handleLogout}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2 text-red-600 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-3">
            <Button
              onClick={loadDashboardData}
              variant="secondary"
              size="sm"
              className="w-full flex items-center justify-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Actualiser</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full flex items-center justify-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Exporter</span>
            </Button>
            <Button
              onClick={handleLogout}
              variant="secondary"
              size="sm"
              className="w-full flex items-center justify-center space-x-2 text-red-600 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Déconnexion</span>
            </Button>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
              { id: 'users', label: 'Utilisateurs', icon: Users },
              { id: 'activities', label: 'Activités', icon: Activity },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'usage', label: 'Utilisation', icon: Clock },
              { id: 'system', label: 'Système', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* System Health */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">État du système</h2>
                {getHealthIcon(systemHealth?.status || 'unknown')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.uptime}%</p>
                  <p className="text-sm text-gray-600">Uptime</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
                  <p className="text-sm text-gray-600">Utilisateurs actifs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{stats.totalTokensUsed}</p>
                  <p className="text-sm text-gray-600">Tokens utilisés</p>
                </div>
              </div>
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="p-4 sm:p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                    <p className="text-sm text-gray-600">Utilisateurs total</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center">
                  <Building2 className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalAgencies}</p>
                    <p className="text-sm text-gray-600">Agences</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalForms}</p>
                    <p className="text-sm text-gray-600">Formulaires</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalSubmissions}</p>
                    <p className="text-sm text-gray-600">Soumissions</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Activity Summary */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Résumé des activités</h2>
              <div className="space-y-3">
                {activitySummary.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getTrendIcon(activity.trend)}
                      <span className="text-sm font-medium text-gray-900">{activity.type}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{activity.count}</span>
                      <span className="text-xs text-gray-500">
                        {activity.lastActivity.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Gestion des utilisateurs</h2>
              <Button size="sm" className="flex items-center space-x-2">
                <UserPlus className="h-4 w-4" />
                <span>Nouvel utilisateur</span>
              </Button>
            </div>

            <UsersTable users={users} onRefresh={loadDashboardData} />
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Activités récentes</h2>
            <div className="space-y-4">
              {activities.map((activity) => (
                <Card key={activity.id} className="p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(activity.severity)}`}>
                          {activity.severity}
                        </span>
                        <span className="text-sm text-gray-500">{activity.type}</span>
                        <span className="text-xs text-gray-400">
                          {activity.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mb-2">{activity.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Utilisateur: {activity.userName}</span>
                        <span>Rôle: {activity.userRole}</span>
                        {activity.agencyId && <span>Agence: {activity.agencyId}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <PushNotificationsTab onRefresh={loadDashboardData} />
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <AppUsageTab onRefresh={loadDashboardData} />
        )}

        {/* System Tab */}
        {activeTab === 'system' && systemHealth && (
          <div className="space-y-6">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">État du système</h2>
                {getHealthIcon(systemHealth.status)}
              </div>
              
              {systemHealth.issues.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Problèmes détectés:</h3>
                  <ul className="space-y-1">
                    {systemHealth.issues.map((issue: string, index: number) => (
                      <li key={index} className="text-sm text-red-600 flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(systemHealth.metrics).map(([key, value]) => (
                  <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{value as number}</p>
                    <p className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
