import React from 'react';
import { 
  Calendar, 
  FileText, 
  BarChart3, 
  Users, 
  Zap, 
  Clock,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { User } from '../types';
import { SessionConsumptionService } from '../services/sessionConsumptionService';

interface SessionConsumptionDisplayProps {
  user: User;
  showAllSessions?: boolean;
  className?: string;
}

export const SessionConsumptionDisplay: React.FC<SessionConsumptionDisplayProps> = ({
  user,
  showAllSessions = false,
  className = ''
}) => {
  const currentConsumption = SessionConsumptionService.getCurrentSessionConsumption(user);
  const allSessionsConsumption = SessionConsumptionService.getAllSessionsConsumption(user);

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('fr-FR');
  };

  if (showAllSessions) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Consommation totale</h3>
        </div>

        {/* Total Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Formulaires</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatNumber(allSessionsConsumption.totalFormsCreated)}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Tableaux</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatNumber(allSessionsConsumption.totalDashboardsCreated)}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Utilisateurs</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {formatNumber(allSessionsConsumption.totalUsersAdded)}
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Tokens</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {formatNumber(allSessionsConsumption.totalTokensConsumed)}
            </p>
          </div>
        </div>

        {/* Total Amount Paid */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Montant total payé</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatNumber(allSessionsConsumption.totalAmountPaid)} FCFA
          </p>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Détail par session</h4>
          <div className="space-y-3">
            {allSessionsConsumption.sessions.map((session) => (
              <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 capitalize">
                      {session.packageType}
                    </span>
                    <span className="text-sm text-gray-500 capitalize">
                      ({session.sessionType})
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(session.startDate)} - {formatDate(session.endDate)}
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3 text-blue-500" />
                    <span>{session.consumption.formsCreated} formulaires</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3 text-green-500" />
                    <span>{session.consumption.dashboardsCreated} tableaux</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-purple-500" />
                    <span>{session.consumption.usersAdded} utilisateurs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-orange-500" />
                    <span>{formatNumber(session.consumption.tokensConsumed)} tokens</span>
                  </div>
                </div>
                
                <div className="mt-2 text-sm text-gray-600">
                  Montant payé: {formatNumber(session.amountPaid)} FCFA
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Consommation actuelle</h3>
      </div>

      {/* Session Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Session actuelle</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Début:</span>
            <span className="ml-2 text-blue-900">{formatDate(currentConsumption.sessionStartDate)}</span>
          </div>
          <div>
            <span className="text-blue-700">Fin:</span>
            <span className="ml-2 text-blue-900">{formatDate(currentConsumption.sessionEndDate)}</span>
          </div>
          <div>
            <span className="text-blue-700">Jours restants:</span>
            <span className="ml-2 text-blue-900">{currentConsumption.daysRemaining} jours</span>
          </div>
        </div>
      </div>

      {/* Current Consumption */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Formulaires</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {formatNumber(currentConsumption.formsCreated)}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">Tableaux</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(currentConsumption.dashboardsCreated)}
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900">Utilisateurs</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {formatNumber(currentConsumption.usersAdded)}
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Tokens</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {formatNumber(currentConsumption.tokensConsumed)}
          </p>
        </div>
      </div>
    </div>
  );
};
