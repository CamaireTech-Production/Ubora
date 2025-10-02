import React from 'react';
import { X, Calendar, CreditCard, Zap, Package, TrendingUp, TrendingDown, FileText, BarChart3, Users } from 'lucide-react';
import { SubscriptionSession } from '../types';
import { getPackageDisplayName } from '../config/packageFeatures';

interface SubscriptionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SubscriptionSession[];
  currentSession: SubscriptionSession | null;
}

export const SubscriptionHistoryModal: React.FC<SubscriptionHistoryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSession
}) => {
  if (!isOpen) return null;

  // Helper function to convert Firestore timestamps to Date objects
  const convertToDate = (date: any): Date => {
    if (date instanceof Date) {
      return date;
    }
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    if (date && typeof date === 'string') {
      return new Date(date);
    }
    if (date && typeof date === 'number') {
      return new Date(date);
    }
    return new Date();
  };

  const formatDate = (date: any) => {
    const jsDate = convertToDate(date);
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(jsDate);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Illimité' : limit.toLocaleString();
  };

  const getSessionTypeIcon = (sessionType: string) => {
    switch (sessionType) {
      case 'subscription':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'pay_as_you_go':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'upgrade':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'downgrade':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'renewal':
        return <Calendar className="h-4 w-4 text-purple-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSessionTypeLabel = (sessionType: string) => {
    switch (sessionType) {
      case 'subscription':
        return 'Abonnement';
      case 'pay_as_you_go':
        return 'Pay-as-you-go';
      case 'upgrade':
        return 'Upgrade';
      case 'downgrade':
        return 'Downgrade';
      case 'renewal':
        return 'Renouvellement';
      default:
        return sessionType;
    }
  };

  const getSessionStatusColor = (session: SubscriptionSession) => {
    if (session.isActive) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (new Date() > convertToDate(session.endDate)) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getSessionStatusText = (session: SubscriptionSession) => {
    if (session.isActive) {
      return 'Actif';
    }
    if (new Date() > convertToDate(session.endDate)) {
      return 'Expiré';
    }
    return 'Inactif';
  };

  // Calculate summary statistics
  const totalSessions = sessions.length;
  const totalAmountPaid = sessions.reduce((sum, session) => sum + session.amountPaid, 0);
  
  // Helper function to get usage data (fallback to consumption if usage is not available)
  const getUsageData = (session: any) => {
    // Try usage field first, then fallback to consumption field
    const usage = session.usage || session.consumption || {};
    return {
      tokensUsed: usage.tokensUsed || usage.tokensConsumed || 0,
      formsCreated: usage.formsCreated || 0,
      dashboardsCreated: usage.dashboardsCreated || 0,
      usersAdded: usage.usersAdded || 0
    };
  };

  // Calculate totals for all package aspects
  const totalTokensPurchased = sessions.reduce((sum, session) => {
    const packageTokens = session.packageResources?.tokensIncluded || 0;
    const payAsYouGoTokens = session.payAsYouGoResources?.tokens || 0;
    return sum + packageTokens + payAsYouGoTokens;
  }, 0);
  const totalTokensUsed = sessions.reduce((sum, session) => {
    const usage = getUsageData(session);
    return sum + usage.tokensUsed;
  }, 0);
  
  const totalFormsPurchased = sessions.reduce((sum, session) => {
    const packageForms = session.packageResources?.formsIncluded || 0;
    const payAsYouGoForms = session.payAsYouGoResources?.forms || 0;
    return sum + packageForms + payAsYouGoForms;
  }, 0);
  const totalFormsUsed = sessions.reduce((sum, session) => {
    const usage = getUsageData(session);
    return sum + usage.formsCreated;
  }, 0);
  
  const totalDashboardsPurchased = sessions.reduce((sum, session) => {
    const packageDashboards = session.packageResources?.dashboardsIncluded || 0;
    const payAsYouGoDashboards = session.payAsYouGoResources?.dashboards || 0;
    return sum + packageDashboards + payAsYouGoDashboards;
  }, 0);
  const totalDashboardsUsed = sessions.reduce((sum, session) => {
    const usage = getUsageData(session);
    return sum + usage.dashboardsCreated;
  }, 0);
  
  const totalUsersPurchased = sessions.reduce((sum, session) => {
    const packageUsers = session.packageResources?.usersIncluded || 0;
    const payAsYouGoUsers = session.payAsYouGoResources?.users || 0;
    return sum + packageUsers + payAsYouGoUsers;
  }, 0);
  const totalUsersUsed = sessions.reduce((sum, session) => {
    const usage = getUsageData(session);
    return sum + usage.usersAdded;
  }, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Historique des Abonnements</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalSessions}</div>
              <div className="text-sm text-gray-600">Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatAmount(totalAmountPaid)}</div>
              <div className="text-sm text-gray-600">Total Payé</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{totalTokensPurchased.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Tokens Achetés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{totalTokensUsed.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Tokens Utilisés</div>
            </div>
          </div>
          
          {/* Additional Package Resources Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{totalFormsUsed.toLocaleString()} / {totalFormsPurchased.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Formulaires</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{totalDashboardsUsed.toLocaleString()} / {totalDashboardsPurchased.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Tableaux de bord</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{totalUsersUsed.toLocaleString()} / {totalUsersPurchased.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Utilisateurs</div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="overflow-y-auto max-h-96">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Aucun historique d'abonnement disponible</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions
                .sort((a, b) => convertToDate(b.startDate).getTime() - convertToDate(a.startDate).getTime())
                .map((session) => (
                  <div
                    key={session.id}
                    className={`p-6 hover:bg-gray-50 transition-colors ${
                      session.isActive ? 'bg-green-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          {getSessionTypeIcon(session.sessionType)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {getPackageDisplayName(session.packageType)}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full border ${getSessionStatusColor(
                                session
                              )}`}
                            >
                              {getSessionStatusText(session)}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {getSessionTypeLabel(session.sessionType)}
                            </span>
                          </div>
                          
                          <div className="space-y-3">
                            {/* Date and Amount */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {formatDate(session.startDate)} - {formatDate(session.endDate)}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <CreditCard className="h-4 w-4" />
                              <span>{formatAmount(session.amountPaid)}</span>
                              </div>
                            </div>
                            
                            {/* Package Resources Usage */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {/* Tokens */}
                            <div className="flex items-center space-x-2">
                                <Zap className="h-4 w-4 text-yellow-500" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {getUsageData(session).tokensUsed.toLocaleString()} / {
                                  (session.packageResources?.tokensIncluded || 0) + (session.payAsYouGoResources?.tokens || 0)
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">Tokens</div>
                                {(session.payAsYouGoResources?.tokens || 0) > 0 && (
                                    <div className="text-xs text-green-600">
                                    (+{session.payAsYouGoResources.tokens} pay-as-you-go)
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Forms */}
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-blue-500" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {getUsageData(session).formsCreated.toLocaleString()} / {
                                      formatLimit((session.packageResources?.formsIncluded || 0) + (session.payAsYouGoResources?.forms || 0))
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">Formulaires</div>
                                  {(session.payAsYouGoResources?.forms || 0) > 0 && (
                                    <div className="text-xs text-green-600">
                                      (+{session.payAsYouGoResources.forms} pay-as-you-go)
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Dashboards */}
                              <div className="flex items-center space-x-2">
                                <BarChart3 className="h-4 w-4 text-green-500" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {getUsageData(session).dashboardsCreated.toLocaleString()} / {
                                      formatLimit((session.packageResources?.dashboardsIncluded || 0) + (session.payAsYouGoResources?.dashboards || 0))
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">Tableaux de bord</div>
                                  {(session.payAsYouGoResources?.dashboards || 0) > 0 && (
                                    <div className="text-xs text-green-600">
                                      (+{session.payAsYouGoResources.dashboards} pay-as-you-go)
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Users */}
                              <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4 text-purple-500" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {getUsageData(session).usersAdded.toLocaleString()} / {
                                      formatLimit((session.packageResources?.usersIncluded || 0) + (session.payAsYouGoResources?.users || 0))
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">Utilisateurs</div>
                                  {(session.payAsYouGoResources?.users || 0) > 0 && (
                                    <div className="text-xs text-green-600">
                                      (+{session.payAsYouGoResources.users} pay-as-you-go)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-500">
                              Durée: {session.durationDays} jours
                            </div>
                          </div>
                          
                          {session.notes && (
                            <div className="mt-2 text-sm text-gray-500 italic">
                              {session.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {currentSession && (
                <span>
                  Session actuelle: <strong>{getPackageDisplayName(currentSession.packageType)}</strong>
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
