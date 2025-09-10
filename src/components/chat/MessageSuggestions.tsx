import React from 'react';
import { BarChart3, FileText, TrendingUp, PieChart } from 'lucide-react';
import { Button } from '../Button';

interface MessageSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

const suggestions = [
  {
    id: 'graph-submissions',
    title: 'Soumissions par jour',
    description: 'Analyser les soumissions quotidiennes',
    icon: BarChart3,
    prompt: 'Analyse les soumissions de formulaires par jour pour la période sélectionnée. Utilise les données des formulaires créés par le directeur et remplis par les employés. Génère un graphique en barres montrant le nombre de soumissions par jour. Retourne les données dans le format JSON suivant: {"type": "bar", "title": "Soumissions par jour", "data": [{"day": "Lun", "count": 5, "users": 3}], "xAxisKey": "day", "yAxisKey": "count", "colors": ["#3B82F6", "#10B981"]}.',
    type: 'graph'
  },
  {
    id: 'graph-trends',
    title: 'Tendances des données',
    description: 'Visualiser l\'évolution temporelle',
    icon: TrendingUp,
    prompt: 'Analyse l\'évolution des soumissions de formulaires sur la période sélectionnée. Utilise les données des formulaires et employés disponibles. Génère un graphique linéaire montrant les tendances. Retourne les données dans le format JSON suivant: {"type": "line", "title": "Évolution des soumissions", "data": [{"period": "Sem 1", "submissions": 10, "users": 5}], "xAxisKey": "period", "yAxisKey": "submissions", "colors": ["#EF4444", "#8B5CF6"]}.',
    type: 'graph'
  },
  {
    id: 'graph-distribution',
    title: 'Répartition par formulaire',
    description: 'Voir la distribution des formulaires',
    icon: PieChart,
    prompt: 'Crée un graphique en secteurs montrant la répartition des soumissions par type de formulaire. Utilise les données des formulaires créés par le directeur. Retourne les données dans le format JSON suivant: {"type": "pie", "title": "Répartition des formulaires", "data": [{"name": "Formulaire A", "value": 25, "count": 25}], "dataKey": "value", "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"]}.',
    type: 'graph'
  },
  {
    id: 'report-summary',
    title: 'Rapport de synthèse',
    description: 'Générer un rapport complet',
    icon: FileText,
    prompt: 'Génère un rapport complet avec analyse des données de formulaires pour la période sélectionnée. Inclus les métriques clés, tendances et recommandations basées sur les formulaires créés par le directeur et remplis par les employés. Crée un document détaillé avec sections, statistiques et insights.',
    type: 'pdf'
  }
];

export const MessageSuggestions: React.FC<MessageSuggestionsProps> = ({ 
  onSuggestionClick, 
  disabled = false 
}) => {
  const handleSuggestionClick = (suggestion: typeof suggestions[0]) => {
    onSuggestionClick(suggestion.prompt);
  };

  return (
    <div className="px-4 pb-1">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-1.5 border border-blue-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-gray-900">Suggestions rapides</h3>
          <span className="text-xs text-gray-500">Cliquez pour envoyer</span>
        </div>
        
        {/* Horizontal scrollable row */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">
          {suggestions.map((suggestion) => {
            const IconComponent = suggestion.icon;
            return (
              <Button
                key={suggestion.id}
                variant="secondary"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={disabled}
                className="flex-shrink-0 h-10 w-36 p-1 text-left justify-start bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-300 transition-all duration-200"
              >
                <div className="flex items-center space-x-1.5 w-full">
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
                    <div className="text-xs text-gray-500 truncate">
                      {suggestion.description}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        
        <div className="mt-1 pt-1 border-t border-blue-200">
          <p className="text-xs text-gray-600 text-center">
            💡 Prompts optimisés
          </p>
        </div>
      </div>
    </div>
  );
};
