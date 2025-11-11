import React, { useEffect, useState } from 'react';
import { PaymentRequest, CampayPaymentData } from '../types/payment';
import { CampayService } from '../services/campayService';

interface CampayPaymentProps {
  paymentRequest: PaymentRequest;
  onSuccess: (data: CampayPaymentData) => void;
  onFail: (data: CampayPaymentData) => void;
  onModalClose: (data: CampayPaymentData) => void;
  buttonText?: string;
  buttonClassName?: string;
  disabled?: boolean;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
  onModalOpen?: () => void;
  onModalClosed?: () => void;
}

/**
 * Composant CampayPayment - Wrapper React pour le service Campay unifié
 * 
 * Ce composant utilise CampayService pour gérer les paiements.
 * Il peut être utilisé avec un bouton visible ou en mode autoOpen pour ouvrir automatiquement le modal.
 */
export const CampayPayment: React.FC<CampayPaymentProps> = ({
  paymentRequest,
  onSuccess,
  onFail,
  onModalClose,
  buttonText = "Pay Now",
  buttonClassName = "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors",
  disabled = false,
  autoOpen = false,
  onAutoOpened,
  onModalOpen,
  onModalClosed
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // Ouvrir automatiquement le modal si autoOpen est true
  useEffect(() => {
    if (autoOpen && paymentRequest && !disabled && !hasOpened && !isOpening) {
      setIsOpening(true);
      setHasOpened(true);
      
      // Ouvrir le modal via le service unifié
      CampayService.openPaymentModalFromRequest(paymentRequest, {
        onSuccess: (data) => {
          onSuccess(data);
          // Notifier que le modal est fermé après succès
          setTimeout(() => {
            onModalClosed?.();
          }, 1500);
        },
        onFail: (data) => {
          onFail(data);
        },
        onModalClose: (data) => {
          onModalClose(data);
          onModalClosed?.();
        }
      })
      .then(() => {
        onAutoOpened?.();
        setTimeout(() => {
          onModalOpen?.();
        }, 100);
      })
      .catch((error) => {
        setIsOpening(false);
        setHasOpened(false);
      })
      .finally(() => {
        setIsOpening(false);
      });
    }
  }, [autoOpen, paymentRequest, disabled, hasOpened, isOpening, onSuccess, onFail, onModalClose, onAutoOpened, onModalOpen, onModalClosed]);

  // Handler pour ouvrir le modal manuellement
  const handleOpenModal = async () => {
    if (disabled || isOpening || !paymentRequest) return;

    setIsOpening(true);
    try {
      await CampayService.openPaymentModalFromRequest(paymentRequest, {
        onSuccess: (data) => {
          onSuccess(data);
          setTimeout(() => {
            onModalClosed?.();
          }, 1500);
        },
        onFail: (data) => {
          onFail(data);
        },
        onModalClose: (data) => {
          onModalClose(data);
          onModalClosed?.();
        }
      });
      
      setTimeout(() => {
        onModalOpen?.();
      }, 100);
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setIsOpening(false);
    }
  };

  // Si autoOpen est activé, ne pas rendre le bouton visible
  if (autoOpen) {
    return null;
  }

  return (
    <button
      onClick={handleOpenModal}
      disabled={disabled || isOpening}
      className={`${buttonClassName} ${disabled || isOpening ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isOpening ? (
        <span className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Ouverture...</span>
        </span>
      ) : (
        buttonText
      )}
    </button>
  );
};
