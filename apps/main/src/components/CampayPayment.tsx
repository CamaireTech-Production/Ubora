import React, { useEffect, useRef, useState } from 'react';
import { PaymentRequest, CampayPaymentData } from '../types/payment';

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

declare global {
  interface Window {
    campay?: {
      options: (config: {
        payButtonId: string;
        description: string;
        amount: string;
        currency: string;
        externalReference: string;
        redirectUrl?: string;
      }) => void;
      onSuccess: (data: CampayPaymentData) => void;
      onFail: (data: CampayPaymentData) => void;
      onModalClose: (data: CampayPaymentData) => void;
      close?: () => void;
    };
  }
  // Campay SDK exposes 'campay' directly in global scope (not window.campay)
  const campay: {
    options: (config: {
      payButtonId: string;
      description: string;
      amount: string;
      currency: string;
      externalReference: string;
      redirectUrl?: string;
    }) => void;
    onSuccess: (data: CampayPaymentData) => void;
    onFail: (data: CampayPaymentData) => void;
    onModalClose: (data: CampayPaymentData) => void;
    close?: () => void;
  };
}

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Generate unique button ID for this component instance (only once)
  const [buttonId] = useState(() => `campay-pay-button-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Helper function to get campay object (script is loaded in index.html)
  const getCampay = (): any => {
    // Campay SDK exposes 'campay' directly in global scope
    if (typeof (globalThis as any).campay !== 'undefined') {
      return (globalThis as any).campay;
    }
    if ((window as any).campay) {
      return (window as any).campay;
    }
    if ((window as any).Campay) {
      return (window as any).Campay;
    }
    if ((window as any).CAMPAY) {
      return (window as any).CAMPAY;
    }
    return null;
  };

  // Initialize Campay when payment request is ready (script is already loaded in index.html)
  useEffect(() => {
    // Only initialize once when campay is available and payment request is ready
    if (isInitialized || !paymentRequest) return;

    const campayObj = getCampay();

    if (campayObj && typeof campayObj.options === 'function') {
      try {
        // Get Campay configuration from environment variables
        const campayEnvironment = import.meta.env.VITE_CAMPAY_ENVIRONMENT || 'demo';
        const demoAmount = parseInt(import.meta.env.VITE_CAMPAY_DEMO_AMOUNT || '10');
        // Demo mode: show actual price in modal but charge 10 FCFA
        // Live mode: show and charge actual price
        const chargeAmount = campayEnvironment === 'demo' ? demoAmount : paymentRequest.amount;

        // Get redirect URL from environment or use empty string
        const redirectUrl = import.meta.env.VITE_CAMPAY_REDIRECT_URL || "";
        
        // Use campay object (script is loaded in index.html)
        campayObj.options({
          payButtonId: buttonId,
          description: paymentRequest.description,
          amount: chargeAmount.toString(), // Use charge amount (10 FCFA in demo, actual in live)
          currency: paymentRequest.currency,
          externalReference: paymentRequest.externalReference,
          redirectUrl: redirectUrl,
        });

        // Set up callbacks
        campayObj.onSuccess = (data: CampayPaymentData) => {
          // Set payment successful state to trigger auto-close
          setPaymentSuccessful(true);
          
          // Call the success handler first
          onSuccess(data);
          
          // Close the modal after a short delay
          setTimeout(() => {
            // Try multiple methods to close the modal
            let modalClosed = false;
            
            // Method 1: Try to use Campay's close method
            if (window.campay?.close) {
              try {
                window.campay.close();
                modalClosed = true;
              } catch (error) {
                // Ignore errors
              }
            }
            
            // Method 2: Try to find and close modal by class/id
            if (!modalClosed) {
              const modalSelectors = [
                '[class*="campay"]',
                '[id*="campay"]',
                '.modal',
                '[class*="modal"]',
                '[class*="overlay"]',
                '[class*="popup"]'
              ];
              
              for (const selector of modalSelectors) {
                const modal = document.querySelector(selector);
                if (modal) {
                  modal.remove();
                  modalClosed = true;
                  break;
                }
              }
            }
            
            // Method 3: Try to close by pressing Escape key
            if (!modalClosed) {
              const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true
              });
              document.dispatchEvent(escapeEvent);
            }
            
            // Notify parent that modal is closed
            setTimeout(() => {
              onModalClosed?.();
            }, 500);
            
          }, 1500); // Wait 1.5 seconds before closing
        };

        campayObj.onFail = (data: CampayPaymentData) => {
          onFail(data);
        };

        campayObj.onModalClose = (data: CampayPaymentData) => {
          onModalClose(data);
        };

        setIsInitialized(true);
      } catch (error) {
        console.error('CampayPayment: Error initializing Campay:', error);
      }
    }
  }, [paymentRequest, onSuccess, onFail, onModalClose, buttonId, isInitialized]);

  // Auto-open payment modal when autoOpen is true
  useEffect(() => {
    if (autoOpen && paymentRequest && buttonRef.current && !disabled && isInitialized) {
      const campayObj = getCampay();
      
      // Only auto-open if campay is available and initialized
      if (campayObj && typeof campayObj.options === 'function') {
        // Small delay to ensure everything is ready
        setTimeout(() => {
          if (buttonRef.current) {
            buttonRef.current.click();
            onAutoOpened?.();
            // Notify that modal is opening
            setTimeout(() => {
              onModalOpen?.();
            }, 100);
          }
        }, 500);
      }
    }
  }, [autoOpen, isInitialized, paymentRequest, disabled, onAutoOpened, onModalOpen]);

  // Monitor for modal appearance and auto-close after successful payment
  useEffect(() => {
    if (!paymentSuccessful) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check if this is a Campay modal
              if (element.classList.contains('campay-modal') || 
                  element.querySelector('[class*="campay"]') ||
                  element.querySelector('[id*="campay"]')) {
                setTimeout(() => {
                  // Try to close the modal
                  if (element.remove) {
                    element.remove();
                  } else if (element.parentNode) {
                    element.parentNode.removeChild(element);
                  }
                  onModalClosed?.();
                }, 2000);
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [paymentSuccessful, onModalClosed]);

  // Remove the onClick handler - let Campay handle clicks directly
  // This prevents interference with Campay's own click handling

  // When autoOpen is enabled, render the trigger button visually hidden to avoid UI artifacts
  const hiddenStyles = autoOpen
    ? 'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 clip-[rect(0,0,0,0)]'
    : '';

  return (
          <button
            ref={buttonRef}
            id={buttonId}
            disabled={disabled}
            className={`${buttonClassName} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${hiddenStyles}`}
            onClick={() => {
              // Notify that modal is opening when button is clicked manually
              setTimeout(() => {
                onModalOpen?.();
              }, 100);
            }}
          >
            {buttonText}
          </button>
  );
};
