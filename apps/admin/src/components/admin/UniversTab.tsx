import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Globe, ArrowRight, RefreshCw } from 'lucide-react';

interface UniversTabProps {
  onRefresh: () => void;
}

export const UniversTab: React.FC<UniversTabProps> = ({ onRefresh }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestion des Univers</h2>
        <p className="text-gray-600">
          Gérez tous les Univers du système, leurs états, leurs utilisations et leurs instances.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Tous les Univers</h3>
                <p className="text-sm text-gray-600">
                  Consultez tous les Univers du système avec leurs détails complets
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/univers-list')}
              className="w-full flex items-center justify-center space-x-2"
            >
              <span>Voir tous les Univers</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Globe className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Approbations Univers</h3>
                <p className="text-sm text-gray-600">
                  Gérez les Univers en attente d'approbation
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/univers-approvals')}
              variant="secondary"
              className="w-full flex items-center justify-center space-x-2"
            >
              <span>Voir les approbations</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Actions rapides</h3>
            <p className="text-sm text-gray-600">
              Accédez rapidement aux fonctionnalités de gestion des Univers
            </p>
          </div>
          <Button
            onClick={onRefresh}
            variant="secondary"
            size="sm"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Actualiser</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

