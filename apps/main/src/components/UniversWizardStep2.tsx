import React from 'react';
import { Card } from './Card';
import { UniversWizardStepProps } from './UniversWizard';
import { List, Sparkles } from 'lucide-react';

export const UniversWizardStep2: React.FC<UniversWizardStepProps> = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Listes
        </h2>
        <p className="text-gray-600">
          Les listes vous permettront de créer des options réutilisables pour les formulaires. Cette fonctionnalité sera disponible prochainement.
        </p>
      </div>

      <Card>
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
            <List className="h-12 w-12 text-blue-600" />
          </div>
          
          <div className="space-y-4 mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Listes - Bientôt disponible
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              La fonctionnalité Listes vous permettra de créer et gérer des listes d'options réutilisables pour vos formulaires.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto text-left">
            <div className="flex items-start space-x-3">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Fonctionnalités prévues
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>Création de listes personnalisées avec plusieurs champs (nom, description, etc.)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>Import CSV pour ajouter rapidement des éléments à vos listes</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>Association de listes aux champs de formulaire de type "liste déroulante"</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>Mise à jour automatique des options dans tous les formulaires utilisant la liste</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>Gestion centralisée des options réutilisables</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 text-sm text-gray-500">
            <p>Vous pouvez ignorer cette étape et continuer avec les formulaires</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

