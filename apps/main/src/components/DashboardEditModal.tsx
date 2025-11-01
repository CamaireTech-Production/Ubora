import React, { useState, useEffect } from 'react';
import { Dashboard } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { X } from 'lucide-react';

interface DashboardEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dashboardId: string, updates: Partial<Dashboard>) => void;
  dashboard: Dashboard | null;
}

export const DashboardEditModal: React.FC<DashboardEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  dashboard
}) => {
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens/closes or dashboard changes
  useEffect(() => {
    if (isOpen && dashboard) {
      setDashboardName(dashboard.name);
      setDashboardDescription(dashboard.description || '');
      setErrors([]);
      setIsLoading(false);
    }
  }, [isOpen, dashboard]);


  const validateForm = () => {
    const newErrors: string[] = [];

    if (!dashboardName.trim()) {
      newErrors.push('Le nom du tableau de bord est requis');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !dashboard) return;

    setIsLoading(true);
    try {
      await onSave(dashboard.id, {
        name: dashboardName,
        description: dashboardDescription
      });
      
      // Small delay to show loading animation
      await new Promise(resolve => setTimeout(resolve, 500));
      onClose();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du tableau de bord:', error);
      setErrors(['Erreur lors de la mise à jour du tableau de bord. Veuillez réessayer.']);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !dashboard) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Modifier le tableau de bord</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <ul className="text-sm text-red-600">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Dashboard Info */}
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du tableau de bord *
                </label>
                <Input
                  value={dashboardName}
                  onChange={(e) => setDashboardName(e.target.value)}
                  placeholder="Nom du tableau de bord"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Textarea
                  value={dashboardDescription}
                  onChange={(e) => setDashboardDescription(e.target.value)}
                  placeholder="Description du tableau de bord"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              💡 <strong>Note:</strong> Pour modifier les métriques, utilisez les boutons d'édition individuels sur chaque métrique dans la page principale.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className={isLoading ? 'opacity-75 cursor-not-allowed' : ''}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Mise à jour...
                </>
              ) : (
                'Mettre à jour le tableau de bord'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
