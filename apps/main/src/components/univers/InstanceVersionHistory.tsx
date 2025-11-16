import React from 'react';
import { UniversInstance } from '@ubora/shared/types';
import { Card } from './Card';
import { CheckCircle, Clock, History } from 'lucide-react';

interface InstanceVersionHistoryProps {
  instance: UniversInstance;
}

export const InstanceVersionHistory: React.FC<InstanceVersionHistoryProps> = ({ instance }) => {
  const versionHistory = instance.versionHistory || [];
  const currentVersion = instance.universVersion || instance.metadata?.universVersion || 1;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (versionHistory.length === 0) {
    return (
      <Card title="Historique des versions">
        <div className="text-center py-8 text-gray-500">
          <History className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-sm">Aucun historique de version disponible</p>
          <p className="text-xs text-gray-400 mt-2">
            L'historique apparaîtra après la première mise à jour
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Historique des versions">
      <div className="space-y-4">
        {/* Version actuelle */}
        <div className="flex items-start space-x-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900">
                Version actuelle: v{currentVersion}
              </h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                Actuelle
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Instance créée le {formatDate(instance.createdAt)}
            </p>
            {instance.updatedAt && (
              <p className="text-xs text-gray-600">
                Dernière mise à jour: {formatDate(instance.updatedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Versions précédentes */}
        <div className="space-y-3">
          {versionHistory.map((historyEntry, index) => (
            <div
              key={index}
              className="flex items-start space-x-4 p-4 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gray-400 flex items-center justify-center">
                  <History className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Version précédente: v{historyEntry.previousVersion}
                  </h3>
                  {historyEntry.dataMigrated && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center space-x-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>Données migrées</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-1">
                  Mise à jour effectuée le {formatDate(historyEntry.upgradedAt)}
                </p>
                {historyEntry.upgradedFromInstanceId && (
                  <p className="text-xs text-gray-500">
                    Instance source: {historyEntry.upgradedFromInstanceId.substring(0, 8)}...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Légende */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-start space-x-2 text-xs text-gray-600">
            <Clock className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">À propos de l'historique des versions</p>
              <ul className="list-disc list-inside space-y-1 text-gray-500">
                <li>L'historique montre toutes les mises à jour effectuées sur cette instance</li>
                <li>Les données sont automatiquement migrées lors de chaque mise à jour</li>
                <li>Les versions précédentes sont archivées pour référence</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

