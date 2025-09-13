import React from 'react';
import { Dashboard } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { BarChart3, ChevronDown, Check } from 'lucide-react';

interface DashboardSelectorProps {
  dashboards: Dashboard[];
  selectedDashboardId: string | null;
  onDashboardSelect: (dashboardId: string | null) => void;
  className?: string;
}

export const DashboardSelector: React.FC<DashboardSelectorProps> = ({
  dashboards,
  selectedDashboardId,
  onDashboardSelect,
  className = ''
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedDashboard = dashboards.find(d => d.id === selectedDashboardId);
  const defaultDashboard = dashboards.find(d => d.isDefault);

  const handleSelect = (dashboardId: string | null) => {
    onDashboardSelect(dashboardId);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Tableau de bord principal</h3>
              <p className="text-xs text-gray-500">
                {selectedDashboard 
                  ? selectedDashboard.name 
                  : defaultDashboard 
                    ? `Par défaut: ${defaultDashboard.name}`
                    : 'Aucun tableau de bord sélectionné'
                }
              </p>
            </div>
          </div>
          
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center space-x-2"
            >
              <span className="text-sm">
                {selectedDashboard ? 'Changer' : 'Sélectionner'}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  {/* Default option */}
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedDashboardId === null ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                    onClick={() => handleSelect(null)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          Tableau de bord par défaut
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {defaultDashboard 
                          ? `Affiche les statistiques générales (${defaultDashboard.name})`
                          : 'Affiche les statistiques générales de l\'agence'
                        }
                      </p>
                    </div>
                    {selectedDashboardId === null && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>

                  {/* Custom dashboards */}
                  {dashboards.length > 0 && (
                    <>
                      <div className="border-t border-gray-200 my-2"></div>
                      <div className="text-xs font-medium text-gray-500 px-3 py-1">
                        Tableaux de bord personnalisés
                      </div>
                      
                      {dashboards.map((dashboard) => (
                        <div
                          key={dashboard.id}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedDashboardId === dashboard.id ? 'bg-blue-50 border border-blue-200' : ''
                          }`}
                          onClick={() => handleSelect(dashboard.id)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <BarChart3 className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {dashboard.name}
                              </span>
                              {dashboard.isDefault && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Par défaut
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {dashboard.description || `${dashboard.metrics.length} métrique${dashboard.metrics.length > 1 ? 's' : ''}`}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-400">
                                {dashboard.metrics.length} métrique{dashboard.metrics.length > 1 ? 's' : ''}
                              </span>
                              <span className="text-xs text-gray-400">
                                Créé le {dashboard.createdAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {selectedDashboardId === dashboard.id && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {dashboards.length === 0 && (
                    <div className="p-4 text-center">
                      <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        Aucun tableau de bord personnalisé créé
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
