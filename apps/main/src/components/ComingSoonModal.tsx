import React, { useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { Button } from './Button';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  isOpen,
  onClose,
  title = "Fonctionnalité à venir",
  description = "Cette fonctionnalité sera bientôt disponible. Merci de votre patience !"
}) => {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="p-1"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Modal Content */}
        <div className="p-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-gray-600 text-sm mb-4">{description}</p>
            <div className="flex justify-center">
              <Button
                onClick={onClose}
                size="sm"
                className="px-4 py-1 text-sm"
              >
                Compris
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
