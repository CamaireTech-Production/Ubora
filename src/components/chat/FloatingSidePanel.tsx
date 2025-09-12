import React, { useEffect, useState } from 'react';
import { X, Home, History, FileText, Users, Clipboard, UserPlus, Copy, Check } from 'lucide-react';
import { Button } from '../Button';
import { useAuth } from '../../contexts/AuthContext';

type TabId = "history" | "forms" | "employees" | "entries";

interface ChatFilters {
  period: string;
  formId: string;
  userId: string;
}

interface FloatingSidePanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeTab: TabId | null;
  onTabChange: (t: TabId | null) => void;

  // Données et callbacks déjà utilisés par InfoTabs
  filters: ChatFilters;
  onFiltersChange: (f: ChatFilters) => void;
  conversations: any[];
  forms: any[];
  employees: any[];
  formEntries: any[];
  onLoadConversation: (id: string) => Promise<void>;
  onCreateConversation: () => Promise<string | void>;

  onGoDashboard: () => void; // nouveau : bouton vers tableau de bord
}

export const FloatingSidePanel: React.FC<FloatingSidePanelProps> = ({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  filters,
  onFiltersChange,
  conversations,
  forms,
  employees,
  formEntries,
  onLoadConversation,
  onCreateConversation,
  onGoDashboard
}) => {
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Fermeture avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
        onTabChange(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange, onTabChange]);

  // Actions disponibles
  const actions = [
    {
      id: 'dashboard' as const,
      label: 'Tableau de bord',
      icon: Home,
      onClick: () => {
        onGoDashboard();
        onOpenChange(false);
      },
      count: null
    },
    {
      id: 'history' as TabId,
      label: 'Historique',
      icon: History,
      onClick: () => handleTabClick('history'),
      count: conversations.length
    },
    {
      id: 'forms' as TabId,
      label: 'Formulaires',
      icon: FileText,
      onClick: () => handleTabClick('forms'),
      count: forms.length
    },
    {
      id: 'employees' as TabId,
      label: 'Employés',
      icon: Users,
      onClick: () => handleTabClick('employees'),
      count: employees.length
    },
    {
      id: 'entries' as TabId,
      label: 'Entrées',
      icon: Clipboard,
      onClick: () => handleTabClick('entries'),
      count: formEntries.length
    },
    {
      id: 'invite' as const,
      label: 'Inviter des collaborateurs',
      icon: UserPlus,
      onClick: () => {
        setShowInviteModal(true);
        onOpenChange(false);
      },
      count: null
    }
  ];

  const handleTabClick = (tabId: TabId) => {
    if (activeTab === tabId) {
      // Toggle : fermer si déjà actif
      onTabChange(null);
    } else {
      // Ouvrir le nouvel onglet
      onTabChange(tabId);
    }
  };

  const handleOverlayClick = () => {
    onOpenChange(false);
    onTabChange(null);
  };

  const generateInviteLink = () => {
    if (!user?.agencyId) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/login?invite=true&agencyId=${user.agencyId}&role=employe`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generateInviteLink());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  const handleShareLink = async () => {
    const link = generateInviteLink();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Invitation à rejoindre Multi-Agences',
          text: 'Rejoignez notre équipe sur la plateforme Multi-Agences',
          url: link
        });
      } catch (err) {
        console.error('Erreur lors du partage:', err);
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };


  const renderTabContent = () => {
    if (!activeTab) return null;

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

      case 'entries':
        return (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Entrées récentes</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {formEntries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucune entrée
                </p>
              ) : (
                formEntries.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="p-2 rounded-lg border border-gray-100">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      Entrée #{entry.id.slice(-6)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {entry.submittedAt?.toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-40 bg-black/10"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Panneau latéral */}
      <div 
        className="fixed top-0 left-0 z-50 h-screen w-72 max-w-[80vw] bg-white border-r border-gray-200 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="panel-title" className="text-lg font-semibold text-gray-900">
            Actions
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-blue-300"
            aria-label="Fermer le panneau"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Liste d'actions */}
        <div className="p-3">
          <div className="space-y-1">
            {actions.map((action) => {
              const Icon = action.icon;
              const isActive = activeTab === action.id && action.id !== 'dashboard';
              
              return (
                <div key={action.id} className="space-y-1">
                  <button
                    onClick={action.onClick}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-blue-300 ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-label={action.label}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{action.label}</span>
                    {action.count !== null && (
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {action.count}
                      </span>
                    )}
                  </button>
                  
                  {/* Contenu de l'onglet actif directement sous l'item */}
                  {isActive && (
                    <div className="ml-3 mr-1 rounded-xl border border-gray-200 p-3 max-h-[55vh] overflow-auto">
                      {renderTabContent()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal d'invitation */}
      {showInviteModal && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <UserPlus className="h-6 w-6 text-blue-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Inviter des collaborateurs
              </h3>
              
              <p className="text-sm text-gray-600 mb-6">
                Partagez ce lien pour permettre à vos collaborateurs de créer un compte employé dans votre agence.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 text-left mb-2">Lien d'invitation :</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={generateInviteLink()}
                    readOnly
                    className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 text-gray-700"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Copier le lien"
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button
                  onClick={handleShareLink}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Partager
                </Button>
                <Button
                  onClick={() => setShowInviteModal(false)}
                  variant="secondary"
                  className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};