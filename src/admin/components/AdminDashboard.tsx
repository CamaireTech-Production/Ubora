import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminService } from '../services/adminService';
import { AdminStats } from '../types';
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

// Import tab components
import { OverviewTab } from './tabs/OverviewTab';
import { UsersTab } from './tabs/UsersTab';
import { FormsTab } from './tabs/FormsTab';
import { DashboardsTab } from './tabs/DashboardsTab';
import { ActivitiesTab } from './tabs/ActivitiesTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { UsageTab } from './tabs/UsageTab';
import { SystemTab } from './tabs/SystemTab';
import { AnalyticsTab } from './tabs/AnalyticsTab';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'forms' | 'dashboards' | 'activities' | 'notifications' | 'usage' | 'analytics' | 'system'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const statsData = await AdminService.getAdminStats();
      setStats(statsData);
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                  <p className="text-sm text-gray-500">Gestion de l'application</p>
                </div>
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
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
              { id: 'users', label: 'Utilisateurs', icon: Users },
              { id: 'forms', label: 'Formulaires', icon: FileText },
              { id: 'dashboards', label: 'Tableaux de bord', icon: BarChart3 },
              { id: 'activities', label: 'Activités', icon: Activity },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'usage', label: 'Utilisation', icon: Clock },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
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
        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab stats={stats} onRefresh={loadDashboardData} />}
        {activeTab === 'users' && <UsersTab onRefresh={loadDashboardData} />}
        {activeTab === 'forms' && <FormsTab onRefresh={loadDashboardData} />}
        {activeTab === 'dashboards' && <DashboardsTab onRefresh={loadDashboardData} />}
        {activeTab === 'activities' && <ActivitiesTab onRefresh={loadDashboardData} />}
        {activeTab === 'notifications' && <NotificationsTab onRefresh={loadDashboardData} />}
        {activeTab === 'usage' && <UsageTab onRefresh={loadDashboardData} />}
        {activeTab === 'analytics' && <AnalyticsTab onRefresh={loadDashboardData} />}
        {activeTab === 'system' && <SystemTab onRefresh={loadDashboardData} />}
      </div>
    </div>
  );
};
