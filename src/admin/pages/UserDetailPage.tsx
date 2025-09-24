import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EnhancedAdminService } from '../services/enhancedAdminService';
import { UserDetail } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { 
  ArrowLeft,
  User,
  Calendar,
  Package,
  Activity,
  Clock,
  Bell,
  TrendingUp,
  FileText,
  MessageSquare,
  CreditCard,
  RefreshCw,
  Edit
} from 'lucide-react';

export const UserDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'subscription' | 'notifications' | 'usage' | 'purchases' | 'sessions'>('overview');

  useEffect(() => {
    if (userId) {
      loadUserDetail();
    }
  }, [userId]);

  const loadUserDetail = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const detail = await EnhancedAdminService.getUserDetail(userId);
      setUserDetail(detail);
    } catch (error) {
      console.error('Error loading user detail:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const getSubscriptionStatusColor = (status?: string) => {
    return EnhancedAdminService.getSubscriptionStatusColor(status);
  };

  const getDaysUntilPayment = () => {
    if (!userDetail?.nextPaymentDate) return null;
    return EnhancedAdminService.getDaysUntilPayment(userDetail.nextPaymentDate);
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date?: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des détails utilisateur...</p>
        </div>
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Utilisateur non trouvé</h2>
          <p className="text-gray-600 mb-4">L'utilisateur demandé n'existe pas ou a été supprimé.</p>
          <Button onClick={() => navigate('/admin/dashboard')} variant="secondary">
            Retour au dashboard
          </Button>
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
              <Button
                onClick={() => navigate('/admin/dashboard')}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Retour</span>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{userDetail.name}</h1>
                <p className="text-sm text-gray-500">{userDetail.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={loadUserDetail}
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
                <Edit className="h-4 w-4" />
                <span>Modifier</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: User },
              { id: 'subscription', label: 'Abonnement', icon: Package },
              { id: 'activity', label: 'Activité', icon: Activity },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'usage', label: 'Utilisation', icon: Clock },
              { id: 'purchases', label: 'Achats', icon: CreditCard },
              { id: 'sessions', label: 'Sessions', icon: Calendar }
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
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* User Info */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <User className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{userDetail.name}</h2>
                    <p className="text-gray-600">{userDetail.email}</p>
                    <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full mt-2 ${
                      userDetail.role === 'admin' ? 'bg-red-100 text-red-800' :
                      userDetail.role === 'directeur' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {userDetail.role}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Membre depuis</p>
                  <p className="font-semibold">{formatDate(userDetail.createdAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{userDetail.totalLoginCount}</p>
                  <p className="text-sm text-gray-600">Connexions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{userDetail.totalFormSubmissions}</p>
                  <p className="text-sm text-gray-600">Soumissions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{userDetail.totalChatInteractions}</p>
                  <p className="text-sm text-gray-600">Interactions IA</p>
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Package</p>
                    <p className="text-lg font-semibold text-gray-900">{userDetail.package || 'N/A'}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Temps d'utilisation</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {EnhancedAdminService.formatDuration(userDetail.totalAppUsageTime)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <Bell className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Notifications</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {userDetail.pushNotificationsSent} envoyées
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Taux de clic</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {userDetail.pushNotificationClickRate}%
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Détails de l'abonnement</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Informations générales</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Package:</span>
                      <span className="font-medium">{userDetail.package || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Statut:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSubscriptionStatusColor(userDetail.subscriptionStatus)}`}>
                        {userDetail.subscriptionStatus || 'Inconnu'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tokens utilisés:</span>
                      <span className="font-medium">{userDetail.tokensUsedMonthly || 0}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Dates importantes</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Début:</span>
                      <span className="font-medium">{formatDate(userDetail.subscriptionStartDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Fin:</span>
                      <span className="font-medium">{formatDate(userDetail.subscriptionEndDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Prochain paiement:</span>
                      <span className="font-medium">{formatDate(userDetail.nextPaymentDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {userDetail.nextPaymentDate && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Prochain paiement dans {getDaysUntilPayment()} jours
                    </span>
                  </div>
                </div>
              )}

              {userDetail.packageFeatures && userDetail.packageFeatures.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Fonctionnalités incluses</h3>
                  <div className="flex flex-wrap gap-2">
                    {userDetail.packageFeatures.map((feature, index) => (
                      <span key={index} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Activité récente</h2>
              
              <div className="space-y-4">
                {userDetail.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {activity.type === 'user_login' && <User className="h-5 w-5 text-green-600" />}
                      {activity.type === 'form_submission' && <FileText className="h-5 w-5 text-blue-600" />}
                      {activity.type === 'chat_activity' && <MessageSquare className="h-5 w-5 text-purple-600" />}
                      {activity.type === 'package_selection' && <Package className="h-5 w-5 text-orange-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(activity.timestamp?.toDate())}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      activity.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      activity.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      activity.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {activity.severity}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Statistiques des notifications</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{userDetail.pushNotificationsSent}</p>
                  <p className="text-sm text-gray-600">Notifications envoyées</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{userDetail.pushNotificationsClicked}</p>
                  <p className="text-sm text-gray-600">Notifications cliquées</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">{userDetail.pushNotificationClickRate}%</p>
                  <p className="text-sm text-gray-600">Taux de clic</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Temps d'utilisation de l'application</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {EnhancedAdminService.formatDuration(userDetail.totalAppUsageTime)}
                  </p>
                  <p className="text-sm text-gray-600">Temps total</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {EnhancedAdminService.formatDuration(userDetail.averageSessionDuration)}
                  </p>
                  <p className="text-sm text-gray-600">Session moyenne</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    {EnhancedAdminService.formatDuration(userDetail.longestSession)}
                  </p>
                  <p className="text-sm text-gray-600">Session la plus longue</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Purchases Tab */}
        {activeTab === 'purchases' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Historique des achats</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {userDetail.purchaseHistory.map((purchase) => (
                      <tr key={purchase.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(purchase.purchaseDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            purchase.type === 'subscription' ? 'bg-blue-100 text-blue-800' :
                            purchase.type === 'tokens' ? 'bg-green-100 text-green-800' :
                            purchase.type === 'feature' ? 'bg-purple-100 text-purple-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {purchase.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{purchase.itemName}</div>
                            <div className="text-gray-500">{purchase.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {purchase.amount} {purchase.currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            purchase.status === 'completed' ? 'bg-green-100 text-green-800' :
                            purchase.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            purchase.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {purchase.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {purchase.transactionId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {userDetail.purchaseHistory.length === 0 && (
                <div className="text-center py-12">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun achat</h3>
                  <p className="text-gray-600">Aucun achat enregistré pour cet utilisateur.</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Sessions d'utilisation</h2>
              
              <div className="space-y-4">
                {userDetail.appUsageSessions.map((session) => (
                  <div key={session.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatDateTime(session.sessionStart)}
                          </span>
                          {session.sessionEnd && (
                            <>
                              <span className="text-gray-400">-</span>
                              <span className="text-sm text-gray-600">
                                {formatDateTime(session.sessionEnd)}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Durée:</span>
                            <span className="ml-2 font-medium">
                              {EnhancedAdminService.formatDuration(session.duration || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Pages visitées:</span>
                            <span className="ml-2 font-medium">{session.pagesVisited.length}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Actions:</span>
                            <span className="ml-2 font-medium">{session.actionsPerformed}</span>
                          </div>
                        </div>
                        {session.pagesVisited.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Pages:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {session.pagesVisited.map((page, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {page}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {session.isActive ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            Terminé
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {userDetail.appUsageSessions.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune session</h3>
                  <p className="text-gray-600">Aucune session d'utilisation enregistrée.</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
