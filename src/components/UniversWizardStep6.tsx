import React, { useEffect } from 'react';
import { UniversWizardStepProps } from './UniversWizard';
import { Card } from './Card';
import { FileText, CheckCircle } from 'lucide-react';

export const UniversWizardStep6: React.FC<UniversWizardStepProps> = ({
  markStepSkipped,
  step
}) => {
  // Mark this step as skippable/completed by default since it's "Coming Soon"
  useEffect(() => {
    markStepSkipped(step); // Mark as skipped initially
  }, [markStepSkipped, step]);

  return (
    <div className="space-y-6">
      <Card title="Rapports du Univers">
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Gérez vos rapports personnalisés
          </h3>
          <p className="text-gray-600 mb-4">
            Créez des rapports basés sur vos formulaires et tableaux de bord. 
            Définissez la structure du rapport avec des placeholders et mappez-les aux données de vos formulaires ou métriques de tableaux de bord.
          </p>
          <div className="mt-6 space-y-3 max-w-md mx-auto text-left">
            <div className="flex items-center space-x-3 text-green-700">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>Créez des rapports avec des templates PDF, Word ou texte.</span>
            </div>
            <div className="flex items-center space-x-3 text-green-700">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>Utilisez des placeholders <code className="bg-gray-100 px-1 rounded">{{placeholder}}</code> dans vos documents.</span>
            </div>
            <div className="flex items-center space-x-3 text-green-700">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>Mappez automatiquement les placeholders aux champs de formulaires ou métriques.</span>
            </div>
            <div className="flex items-center space-x-3 text-green-700">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>Générez des rapports dynamiques basés sur vos données.</span>
            </div>
            <div className="flex items-center space-x-3 text-green-700">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>Partagez des templates de rapports via le marketplace.</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-8">
            Cette fonctionnalité est en cours de développement et sera disponible prochainement.
          </p>
        </div>
      </Card>
    </div>
  );
};

