import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { X, Lock, ArrowRight } from 'lucide-react';

interface AccessDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'programmed-instructions' | 'push-indicators';
}

export const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
  isOpen,
  onClose,
  feature
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getFeatureInfo = () => {
    switch (feature) {
      case 'programmed-instructions':
        return {
          title: 'Instructions Programmées',
          description: 'Cette fonctionnalité n\'est pas disponible dans votre package actuel.',
          upgradeMessage: 'Passez au package Starter ou Standard pour accéder aux instructions programmées.'
        };
      case 'push-indicators':
        return {
          title: 'Indicateurs Push',
          description: 'Cette fonctionnalité n\'est pas disponible dans votre package actuel.',
          upgradeMessage: 'Passez au package Starter ou Standard pour configurer des notifications push sur vos métriques.'
        };
      default:
        return {
          title: 'Fonctionnalité Restreinte',
          description: 'Cette fonctionnalité n\'est pas disponible dans votre package actuel.',
          upgradeMessage: 'Passez à un package supérieur pour accéder à cette fonctionnalité.'
        };
    }
  };

  const featureInfo = getFeatureInfo();

  const handleUpgrade = () => {
    onClose();
    navigate('/packages');
  };

  const handleClose = () => {
    onClose();
    navigate('/packages');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {featureInfo.title}
          </h3>
          
          <p className="text-gray-600 mb-4">
            {featureInfo.description}
          </p>
          
          <p className="text-sm text-gray-500 mb-6">
            {featureInfo.upgradeMessage}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleUpgrade}
              className="flex items-center justify-center space-x-2 flex-1"
            >
              <span>Voir les Packages</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
            >
              Fermer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
