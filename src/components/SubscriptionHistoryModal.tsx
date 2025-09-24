import React from 'react';
import { X, Calendar, CreditCard, Zap, Package, TrendingUp, TrendingDown } from 'lucide-react';
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
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
    if (new Date() > session.endDate) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getSessionStatusText = (session: SubscriptionSession) => {
    if (session.isActive) {
      return 'Actif';
    }
    if (new Date() > session.endDate) {
      return 'Expiré';
    }
    return 'Inactif';
  };

  // Calculate summary statistics
  const totalSessions = sessions.length;
  const totalAmountPaid = sessions.reduce((sum, session) => sum + session.amountPaid, 0);
  const totalTokensPurchased = sessions.reduce((sum, session) => sum + session.tokensIncluded, 0);
  const totalTokensUsed = sessions.reduce((sum, session) => sum + session.tokensUsed, 0);

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
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
                            
                            <div className="flex items-center space-x-2">
                              <Zap className="h-4 w-4" />
                              <span>
                                {session.tokensUsed.toLocaleString()} / {session.tokensIncluded.toLocaleString()} tokens
                              </span>
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
