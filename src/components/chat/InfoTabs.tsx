import React, { useEffect } from 'react';
import { History, Filter, FileText, Users, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../Button';
import { Select } from '../Select';

type TabId = "history" | "filters" | "forms" | "employees";

interface InfoTabsProps {
  collapsed: boolean;                 // true = fermé (drawer caché)
  onCollapsedChange: (v: boolean) => void;
  activeTab: TabId | null;            // onglet sélectionné ou null
  onTabChange: (t: TabId | null) => void;

  // données déjà utilisées aujourd'hui par InfoTabs:
  filters: {
    period: string;
    formId: string;
    userId: string;
  };
  onFiltersChange: (filters: any) => void;
  conversations: any[];
  forms: any[];
  employees: any[];
  formEntries: any[];
  onLoadConversation?: (id: string) => void;
  onCreateConversation?: () => void;
}

export const InfoTabs: React.FC<InfoTabsProps> = ({
  collapsed,
  onCollapsedChange,
  activeTab,
  onTabChange,
  filters,
  onFiltersChange,
  conversations,
  forms,
  employees,
  formEntries,
  onLoadConversation,
  onCreateConversation
}) => {
  // Fermeture avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !collapsed) {
        onCollapsedChange(true);
        onTabChange(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [collapsed, onCollapsedChange, onTabChange]);

  const tabs = [
    {
      id: 'history' as TabId,
      label: 'Historique',
      icon: History,
      count: conversations.length
    },
    {
      id: 'filters' as TabId,
      label: 'Filtres',
      icon: Filter,
      count: null
    },
    {
      id: 'forms' as TabId,
      label: 'Formulaires',
      icon: FileText,
      count: forms.length
    },
    {
      id: 'employees' as TabId,
      label: 'Équipe',
      icon: Users,
      count: employees.length
    }
  ];

  const quickPeriods = [
    { value: 'today', label: 'Aujourd\'hui' },
    { value: 'yesterday', label: 'Hier' },
    { value: 'this_week', label: 'Cette semaine' },
    { value: 'this_month', label: 'Ce mois' },
    { value: 'last_30d', label: '30 derniers jours' }
  ];

  const handleTabClick = (tabId: TabId) => {
    if (activeTab === tabId && !collapsed) {
      // Fermer si déjà ouvert
      onCollapsedChange(true);
      onTabChange(null);
    } else {
      // Ouvrir avec ce tab
      onCollapsedChange(false);
      onTabChange(tabId);
    }
  };

  const handleClose = () => {
    onCollapsedChange(true);
    onTabChange(null);
  };

  const renderTabContent = () => {
    if (!activeTab || collapsed) return null;

    switch (activeTab) {
      case 'history':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Conversations récentes</h4>
              {onCreateConversation && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCreateConversation}
                  className="text-xs px-2 py-1"
                >
                  Nouvelle
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucune conversation
                </p>
              ) : (
                conversations.slice(0, 10).map((conv) => (
                  <div
                    key={conv.id}
                    className="p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onLoadConversation?.(conv.id)}
                  >
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {conv.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {conv.lastMessageAt?.toLocaleDateString('fr-FR')} • {conv.messageCount} messages
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'filters':
        return (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Paramètres d'analyse</h4>
            
            {/* Quick period buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Période
              </label>
              <div className="flex flex-wrap gap-1">
                {quickPeriods.map(period => (
                  <button
                    key={period.value}
                    onClick={() => onFiltersChange({ ...filters, period: period.value })}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      filters.period === period.value
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form filter */}
            <Select
              label="Formulaire spécifique"
              value={filters.formId}
              onChange={(e) => onFiltersChange({ ...filters, formId: e.target.value })}
              options={[
                { value: '', label: 'Tous les formulaires' },
                ...forms.map(form => ({ value: form.id, label: form.title }))
              ]}
            />

            {/* Employee filter */}
            <Select
              label="Employé spécifique"
              value={filters.userId}
              onChange={(e) => onFiltersChange({ ...filters, userId: e.target.value })}
              options={[
                { value: '', label: 'Tous les employés' },
                ...employees.map(emp => ({ value: emp.id, label: emp.name }))
              ]}
            />
          </div>
        );

      case 'forms':
        return (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Formulaires actifs</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {forms.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucun formulaire
                </p>
              ) : (
                forms.slice(0, 8).map((form) => (
                  <div key={form.id} className="p-2 rounded-lg border border-gray-100">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {form.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {form.fields?.length || 0} champs • {form.assignedTo?.length || 0} employés
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'employees':
        return (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Aperçu des données</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-lg font-bold text-blue-700">{forms.length}</div>
                <div className="text-xs text-blue-600">Formulaires</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-lg font-bold text-green-700">{employees.length}</div>
                <div className="text-xs text-green-600">Employés</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-lg font-bold text-purple-700">{formEntries.length}</div>
                <div className="text-xs text-purple-600">Réponses</div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="text-lg font-bold text-orange-700">
                  {conversations.length}
                </div>
                <div className="text-xs text-orange-600">Conversations</div>
              </div>
            </div>
            
            {/* Team members */}
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Équipe</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {employees.slice(0, 5).map((emp) => (
                  <div key={emp.id} className="flex items-center space-x-2 text-sm">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {emp.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-gray-700 truncate">{emp.name}</span>
                  </div>
                ))}
                {employees.length > 5 && (
                  <div className="text-xs text-gray-500 pl-8">
                    +{employees.length - 5} autres
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Panneau/drawer */}
      {!collapsed && activeTab && (
        <div className="fixed bottom-20 left-0 right-0 z-30">
          <div className="max-w-screen-md mx-auto px-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-3 sm:p-4 max-h-[60vh] sm:max-h-[420px] overflow-auto">
              {/* Header avec titre et bouton fermeture */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  {(() => {
                    const tab = tabs.find(t => t.id === activeTab);
                    const Icon = tab?.icon || History;
                    return (
                      <>
                        <Icon className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-gray-900">{tab?.label}</span>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Contenu */}
              {renderTabContent()}
            </div>
          </div>
        </div>
      )}

      {/* Onglets compacts en bas */}
      <div className="fixed bottom-16 left-0 right-0 z-20">
        <div className="max-w-screen-md mx-auto px-4 py-3">
          <div className="flex items-center justify-center space-x-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id && !collapsed;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 shadow-sm ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                  {isActive && !collapsed ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronUp className="h-3 w-3" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};