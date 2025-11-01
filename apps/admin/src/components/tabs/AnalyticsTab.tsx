import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '../../../services/analyticsService';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { 
  BarChart3, 
  Users, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Target,
  Eye,
  AlertTriangle,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  DollarSign,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  UserPlus,
  UserCheck,
  MousePointer
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface AnalyticsTabProps {
  onRefresh: () => void;
}

// Real Analytics Data Interfaces
interface RealAnalyticsOverview {
  totalUsers: number;
  totalSessions: number;
  totalEvents: number;
  averageSessionDuration: number;
  topEvents: Array<{ eventName: string; count: number; uniqueUsers: number }>;
  userEngagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
  };
  conversionRates: {
    registrationToLogin: number;
    loginToFormCreation: number;
    formCreationToSubmission: number;
  };
  newUsers: number;
  returningUsers: number;
  bounceRate: number;
}

interface RealEventAnalytics {
  events: Array<{
    eventName: string;
    count: number;
    uniqueUsers: number;
    timestamp: Date;
  }>;
  trends: Array<{
    date: string;
    events: number;
    users: number;
  }>;
  eventFunnel: Array<{
    step: string;
    users: number;
    conversionRate: number;
  }>;
}

interface RealUserAnalytics {
  newVsReturning: {
    newUsers: number;
    returningUsers: number;
  };
  userRetention: {
    day1: number;
    day7: number;
    day30: number;
  };
  userSegments: Array<{
    segment: string;
    count: number;
    percentage: number;
  }>;
  userJourney: Array<{
    step: string;
    users: number;
    dropoffRate: number;
  }>;
  geographicData: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
}

interface RealPerformanceAnalytics {
  pageViews: Array<{
    page: string;
    views: number;
    uniqueViews: number;
    averageTime: number;
    bounceRate: number;
  }>;
  loadTimes: {
    average: number;
    p50: number;
    p95: number;
  };
  errors: Array<{
    error: string;
    count: number;
    lastOccurred: Date;
  }>;
  deviceBreakdown: Array<{
    device: string;
    users: number;
    percentage: number;
  }>;
  browserBreakdown: Array<{
    browser: string;
    users: number;
    percentage: number;
  }>;
}

interface RealRevenueAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  averageOrderValue: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
  topProducts: Array<{
    product: string;
    revenue: number;
    orders: number;
  }>;
  customerLifetimeValue: number;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ onRefresh }) => {
  const [overview, setOverview] = useState<RealAnalyticsOverview | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<RealEventAnalytics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<RealUserAnalytics | null>(null);
  const [performanceAnalytics, setPerformanceAnalytics] = useState<RealPerformanceAnalytics | null>(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState<RealRevenueAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [activeView, setActiveView] = useState<'overview' | 'events' | 'users' | 'performance' | 'revenue'>('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const [overviewData, eventData, userData, performanceData, revenueData] = await Promise.all([
        AnalyticsService.getAnalyticsOverview(timeRange),
        AnalyticsService.getEventAnalytics(timeRange),
        AnalyticsService.getUserAnalytics(timeRange),
        AnalyticsService.getPerformanceAnalytics(timeRange),
        AnalyticsService.getRevenueAnalytics(timeRange)
      ]);

      setOverview(overviewData);
      setEventAnalytics(eventData);
      setUserAnalytics(userData);
      setPerformanceAnalytics(performanceData);
      setRevenueAnalytics(revenueData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAnalyticsData();
    onRefresh();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Chargement des données d'analyse...</span>
        </div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Firebase</h2>
          <p className="text-gray-600">Données d'analyse en temps réel depuis Firebase</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Dernière 24h</option>
            <option value="week">Dernière semaine</option>
            <option value="month">Dernier mois</option>
            <option value="year">Dernière année</option>
          </select>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
            { id: 'events', label: 'Événements', icon: Activity },
            { id: 'users', label: 'Utilisateurs', icon: Users },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
            { id: 'revenue', label: 'Revenus', icon: DollarSign }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeView === 'overview' && overview && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Utilisateurs</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(overview.totalUsers)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(overview.totalSessions)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MousePointer className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Événements</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(overview.totalEvents)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Durée Moyenne</p>
                  <p className="text-2xl font-bold text-gray-900">{formatDuration(overview.averageSessionDuration)}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* User Engagement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Utilisateurs</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600">Nouveaux utilisateurs</span>
                  </div>
                  <span className="font-semibold">{formatNumber(overview.newUsers)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-600">Utilisateurs récurrents</span>
                  </div>
                  <span className="font-semibold">{formatNumber(overview.returningUsers)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-gray-600">Taux de rebond</span>
                  </div>
                  <span className="font-semibold">{formatPercentage(overview.bounceRate)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilisateurs Actifs</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Quotidien (DAU)</span>
                  <span className="font-semibold">{formatNumber(overview.userEngagement.dailyActiveUsers)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Hebdomadaire (WAU)</span>
                  <span className="font-semibold">{formatNumber(overview.userEngagement.weeklyActiveUsers)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Mensuel (MAU)</span>
                  <span className="font-semibold">{formatNumber(overview.userEngagement.monthlyActiveUsers)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Conversion Rates */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Taux de Conversion</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(overview.conversionRates.registrationToLogin)}
                </div>
                <p className="text-sm text-gray-600">Inscription → Connexion</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(overview.conversionRates.loginToFormCreation)}
                </div>
                <p className="text-sm text-gray-600">Connexion → Création</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatPercentage(overview.conversionRates.formCreationToSubmission)}
                </div>
                <p className="text-sm text-gray-600">Création → Soumission</p>
              </div>
            </div>
          </Card>

          {/* Top Events */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Événements</h3>
            <div className="space-y-3">
              {overview.topEvents.slice(0, 5).map((event, index) => (
                <div key={event.eventName} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{event.eventName}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">{formatNumber(event.uniqueUsers)} utilisateurs</span>
                    <span className="text-sm font-semibold text-gray-900">{formatNumber(event.count)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Events Tab */}
      {activeView === 'events' && eventAnalytics && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendances des Événements</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={eventAnalytics.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="events" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="users" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Événements Récents</h3>
              <div className="space-y-3">
                {eventAnalytics.events.slice(0, 10).map((event, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.eventName}</p>
                      <p className="text-xs text-gray-500">
                        {formatNumber(event.uniqueUsers)} utilisateurs uniques
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatNumber(event.count)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Entonnoir de Conversion</h3>
              <div className="space-y-4">
                {eventAnalytics.eventFunnel.map((step, index) => (
                  <div key={step.step} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{step.step}</span>
                      <span className="text-sm text-gray-600">{formatNumber(step.users)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(step.users / eventAnalytics.eventFunnel[0]?.users || 1) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Taux: {formatPercentage(step.conversionRate)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeView === 'users' && userAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Nouveaux vs Récurrents</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Nouveaux', value: userAnalytics.newVsReturning.newUsers, color: '#3B82F6' },
                      { name: 'Récurrents', value: userAnalytics.newVsReturning.returningUsers, color: '#10B981' }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {[0, 1].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={[COLORS[0], COLORS[1]][index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rétention Utilisateurs</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Jour 1</span>
                  <span className="font-semibold">{formatPercentage(userAnalytics.userRetention.day1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Jour 7</span>
                  <span className="font-semibold">{formatPercentage(userAnalytics.userRetention.day7)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Jour 30</span>
                  <span className="font-semibold">{formatPercentage(userAnalytics.userRetention.day30)}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Segments d'Utilisateurs</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {userAnalytics.userSegments.map((segment, index) => (
                <div key={segment.segment} className="text-center">
                  <div className="text-2xl font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                    {formatNumber(segment.count)}
                  </div>
                  <p className="text-sm text-gray-600">{segment.segment}</p>
                  <p className="text-xs text-gray-500">{formatPercentage(segment.percentage / 100)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Parcours Utilisateur</h3>
            <div className="space-y-4">
              {userAnalytics.userJourney.map((step, index) => (
                <div key={step.step} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{step.step}</span>
                    <span className="text-sm text-gray-600">{formatNumber(step.users)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(step.users / userAnalytics.userJourney[0]?.users || 1) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Abandon: {formatPercentage(step.dropoffRate)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Performance Tab */}
      {activeView === 'performance' && performanceAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Temps de Chargement</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Moyenne</span>
                  <span className="font-semibold">{performanceAnalytics.loadTimes.average}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">P50</span>
                  <span className="font-semibold">{performanceAnalytics.loadTimes.p50}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">P95</span>
                  <span className="font-semibold">{performanceAnalytics.loadTimes.p95}ms</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pages Populaires</h3>
              <div className="space-y-3">
                {performanceAnalytics.pageViews.slice(0, 5).map((page, index) => (
                  <div key={page.page} className="flex items-center justify-between">
                    <span className="text-sm text-gray-900 truncate">{page.page}</span>
                    <span className="text-sm font-semibold">{formatNumber(page.views)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Erreurs</h3>
              <div className="space-y-3">
                {performanceAnalytics.errors.slice(0, 5).map((error, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-900 truncate">{error.error}</span>
                    <span className="text-sm font-semibold text-red-600">{error.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {performanceAnalytics.deviceBreakdown.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Appareils</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={performanceAnalytics.deviceBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="device" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="users" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Navigateurs</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={performanceAnalytics.browserBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="browser" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="users" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {activeView === 'revenue' && revenueAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Revenus Totaux</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {revenueAnalytics.totalRevenue > 0 ? `$${formatNumber(revenueAnalytics.totalRevenue)}` : 'Aucun revenu'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Revenus Mensuels</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {revenueAnalytics.monthlyRevenue > 0 ? `$${formatNumber(revenueAnalytics.monthlyRevenue)}` : 'Aucun revenu'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Valeur Moyenne</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {revenueAnalytics.averageOrderValue > 0 ? `$${formatNumber(revenueAnalytics.averageOrderValue)}` : 'Aucune donnée'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {revenueAnalytics.totalRevenue > 0 ? (
            <>
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendances des Revenus</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueAnalytics.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Produits Populaires</h3>
                <div className="space-y-3">
                  {revenueAnalytics.topProducts.map((product, index) => (
                    <div key={product.product} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{product.product}</span>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">{product.orders} commandes</span>
                        <span className="text-sm font-semibold text-gray-900">${formatNumber(product.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-6">
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun revenu enregistré</h3>
                <p className="text-gray-600">
                  Les données de revenus apparaîtront ici une fois que vous aurez configuré un système de paiement.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};