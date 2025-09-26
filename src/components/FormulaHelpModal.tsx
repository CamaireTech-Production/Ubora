import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { X, Calculator } from 'lucide-react';

interface FormulaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FormulaHelpModal: React.FC<FormulaHelpModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed bg-black bg-opacity-50 flex items-center justify-center z-50" 
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        width: '100vw', 
        height: '100vh',
        margin: 0,
        padding: 0
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Calculator className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Guide des Formules Calculées</h2>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Fermer</span>
            </Button>
          </div>

          <div className="space-y-6">
            {/* Basic Operations */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Opérations de Base</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Opérateurs Arithmétiques</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">+</code>
                      <span>Addition</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">-</code>
                      <span>Soustraction</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">*</code>
                      <span>Multiplication</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">/</code>
                      <span>Division</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">( )</code>
                      <span>Parenthèses</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Exemples</h4>
                  <div className="space-y-2 text-sm">
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">prix + frais</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">montant * 1.2</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">(prix + frais) * 0.1</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">total / quantité</code></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Mathematical Functions */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fonctions Mathématiques</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Fonctions Disponibles</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">SUM()</code>
                      <span>Somme de plusieurs valeurs</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">AVG()</code>
                      <span>Moyenne de plusieurs valeurs</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">MAX()</code>
                      <span>Valeur maximale</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">MIN()</code>
                      <span>Valeur minimale</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Exemples</h4>
                  <div className="space-y-2 text-sm">
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">SUM(prix, frais)</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">AVG(prix1, prix2, prix3)</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">MAX(prix, frais)</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">MIN(prix, frais)</code></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Constants */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilisation des Constantes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Types de Constantes</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">1500</code>
                      <span>Nombre entier</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">1.2</code>
                      <span>Nombre décimal</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">0.1</code>
                      <span>Pourcentage (10%)</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">-100</code>
                      <span>Nombre négatif</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Exemples</h4>
                  <div className="space-y-2 text-sm">
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">prix * 1500</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">montant + 100</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">total * 0.1</code></div>
                    <div><code className="bg-gray-100 px-2 py-1 rounded text-xs">prix - 50</code></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Complex Examples */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Exemples Complexes</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Calcul de TVA</h4>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">prix * 1.2</code>
                  <p className="text-gray-600 mt-1">Ajoute 20% de TVA au prix</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Calcul de Remise</h4>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">prix * 0.9</code>
                  <p className="text-gray-600 mt-1">Applique une remise de 10%</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Calcul Complexe</h4>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">(prix + frais) * 1.2 + 50</code>
                  <p className="text-gray-600 mt-1">Prix + frais, puis TVA, puis frais fixes</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Moyenne avec Constante</h4>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">AVG(prix1, prix2) * 1.1</code>
                  <p className="text-gray-600 mt-1">Moyenne de deux prix avec majoration de 10%</p>
                </div>
              </div>
            </Card>

            {/* Tips */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conseils d'Utilisation</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Utilisez des parenthèses pour clarifier l'ordre des opérations</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Les nombres décimaux utilisent le point (.) comme séparateur</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Les noms de champs sont insensibles à la casse</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Chaque formule doit contenir au moins une opération</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Testez vos formules avec des valeurs d'exemple</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
