import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, FileText, TrendingUp, PieChart, Info } from 'lucide-react';
import { Button } from '../Button';

interface MessageSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

const suggestions = [
  {
    id: 'employee-submissions',
    title: 'Soumissions par employé',
    icon: BarChart3,
    prompt: 'Analyse les soumissions de formulaires par employé pour la période sélectionnée. Utilise les données réelles des formulaires soumis par chaque employé. Génère un graphique en barres montrant le nombre de soumissions par employé avec leurs noms. Retourne les données dans le format JSON suivant: {"type": "bar", "title": "Soumissions par employé", "data": [{"employee": "Ambassira Ryan", "submissions": 3, "email": "ambassiraambassira@gmail.com"}], "xAxisKey": "employee", "yAxisKey": "submissions", "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]}.',
    type: 'graph',
    explanation: {
      title: 'Graphique des Soumissions par Employé',
      description: 'Ce graphique affiche le nombre de formulaires soumis par chaque employé sous forme de barres.',
      whatItShows: '• Nombre de soumissions par employé\n• Noms des employés sur l\'axe X\n• Nombre de soumissions sur l\'axe Y\n• Emails des employés dans les tooltips',
      dataSource: 'Utilise les données réelles des formulaires soumis par les employés de votre agence.',
      expectedOutput: 'Un graphique en barres interactif avec les noms des employés et leurs statistiques de soumission.'
    }
  },
  {
    id: 'employee-timeline',
    title: 'Évolution temporelle',
    icon: TrendingUp,
    prompt: 'Analyse l\'évolution des soumissions de formulaires dans le temps pour la période sélectionnée. Utilise les données réelles des formulaires soumis par les employés avec leurs dates de soumission. Génère un graphique linéaire montrant l\'évolution des soumissions par jour/semaine avec les noms des employés. Retourne les données dans le format JSON suivant: {"type": "line", "title": "Évolution des soumissions dans le temps", "data": [{"date": "2024-01-15", "submissions": 5, "employees": ["Ambassira Ryan", "Essengue lea carine"]}], "xAxisKey": "date", "yAxisKey": "submissions", "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]}.',
    type: 'graph',
    explanation: {
      title: 'Graphique d\'Évolution Temporelle',
      description: 'Ce graphique montre l\'évolution des soumissions de formulaires dans le temps.',
      whatItShows: '• Dates sur l\'axe X (inclinées pour la lisibilité)\n• Nombre de soumissions sur l\'axe Y\n• Ligne connectant les points temporels\n• Employés actifs par jour dans les tooltips',
      dataSource: 'Utilise les données de soumissions avec leurs dates exactes de soumission.',
      expectedOutput: 'Un graphique linéaire montrant les tendances d\'activité des employés dans le temps.'
    }
  },
  {
    id: 'report-summary',
    title: 'Rapport de synthèse',
    icon: FileText,
    prompt: 'Génère un rapport PDF complet avec analyse des données de formulaires pour la période sélectionnée. Inclus les métriques clés, tendances et recommandations basées sur les formulaires créés par le directeur et remplis par les employés. Crée un document détaillé avec sections, statistiques et insights.',
    type: 'pdf',
    explanation: {
      title: 'Rapport PDF de Synthèse',
      description: 'Ce rapport génère un document PDF complet avec une analyse détaillée des données.',
      whatItShows: '• Métriques clés et statistiques\n• Tendances et analyses\n• Recommandations basées sur les données\n• Sections organisées avec titres et sous-titres',
      dataSource: 'Utilise toutes les données disponibles : soumissions, employés, formulaires et leurs réponses.',
      expectedOutput: 'Un document PDF téléchargeable avec une analyse complète et professionnelle des données.'
    }
  }
];

export const MessageSuggestions: React.FC<MessageSuggestionsProps> = ({ 
  onSuggestionClick, 
  disabled = false 
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const handleSuggestionClick = (suggestion: typeof suggestions[0]) => {
    onSuggestionClick(suggestion.prompt);
  };

  const handleTooltipToggle = (suggestionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    // console.log('Tooltip toggle clicked for:', suggestionId, 'Current active:', activeTooltip);
    
    if (activeTooltip === suggestionId) {
      setActiveTooltip(null);
      setTooltipPosition(null);
    } else {
      const button = buttonRefs.current[suggestionId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setTooltipPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
      }
      setActiveTooltip(suggestionId);
    }
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveTooltip(null);
        setTooltipPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="px-4 pb-1" ref={containerRef}>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-1.5 border border-blue-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-gray-900">Suggestions rapides</h3>
          <span className="text-xs text-gray-500">Cliquez pour envoyer</span>
        </div>
        
        {/* Horizontal scrollable row */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">
          {suggestions.map((suggestion) => {
            const IconComponent = suggestion.icon;
            const isTooltipActive = activeTooltip === suggestion.id;
            
            return (
              <div key={suggestion.id} className="relative flex-shrink-0">
                <Button
                  variant="secondary"
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={disabled}
                  className="h-10 w-32 p-2 text-left justify-start bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-300 transition-all duration-200"
                >
                  <div className="flex items-center space-x-2 w-full">
                    <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center ${
                      suggestion.type === 'graph' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      <IconComponent className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {suggestion.title}
                      </div>
                    </div>
                    <button
                      ref={(el) => (buttonRefs.current[suggestion.id] = el)}
                      onClick={(e) => handleTooltipToggle(suggestion.id, e)}
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isTooltipActive 
                          ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-200' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                      }`}
                      title="Cliquer pour plus de détails"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </div>
                </Button>

              </div>
            );
          })}
        </div>
        
        <div className="mt-1 pt-1 border-t border-blue-200">
          <p className="text-xs text-gray-600 text-center">
            💡 Cliquez sur l'icône ℹ️ pour plus de détails
          </p>
        </div>
      </div>
      
      {/* Portal-based Tooltip */}
      {activeTooltip && tooltipPosition && (() => {
        const suggestion = suggestions.find(s => s.id === activeTooltip);
        if (!suggestion) return null;
        
        return createPortal(
          <div 
            className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] p-4 max-h-96 overflow-y-auto w-80"
            style={{
              left: tooltipPosition.x - 160, // Center the tooltip (320px / 2 = 160px)
              top: tooltipPosition.y - 20,
              transform: 'translateY(-100%)'
            }}
          >
            {/* Debug indicator */}
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              !
            </div>
            
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              {suggestion.explanation.title}
            </h4>
            
            <p className="text-xs text-gray-600 mb-3">
              {suggestion.explanation.description}
            </p>
            
            <div className="space-y-2">
              <div>
                <h5 className="text-xs font-medium text-gray-800 mb-1">Ce que ça montre :</h5>
                <div className="text-xs text-gray-600 whitespace-pre-line">
                  {suggestion.explanation.whatItShows}
                </div>
              </div>
              
              <div>
                <h5 className="text-xs font-medium text-gray-800 mb-1">Source des données :</h5>
                <p className="text-xs text-gray-600">
                  {suggestion.explanation.dataSource}
                </p>
              </div>
              
              <div>
                <h5 className="text-xs font-medium text-gray-800 mb-1">Résultat attendu :</h5>
                <p className="text-xs text-gray-600">
                  {suggestion.explanation.expectedOutput}
                </p>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
