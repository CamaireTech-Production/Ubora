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
    campay: {
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
      close?: () => void; // Add close method if available
    };
  }
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
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Generate unique button ID for this component instance (only once)
  const [buttonId] = useState(() => `campay-pay-button-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Unified Campay SDK loading - always ensure script is loaded
  useEffect(() => {
    const loadCampaySDK = async () => {
      // Check if already available
      if (window.campay) {
        console.log('CampayPayment: Campay SDK already available');
        setScriptLoaded(true);
        return;
      }

      const appId = import.meta.env.VITE_CAMPAY_APP_ID || 'Muw-QotZAcx8PbngvT7lbsnc1OomeDkw31sWjv5XftEBoSy_opiLcFz17UhClFC6ZNm8AOdL6xFCH7KoUEUN5Q';
      const baseUrl = 'https://www.campay.net/sdk/js';
      const src = baseUrl + '?app-id=' + appId;
      
      console.log('CampayPayment: Loading Campay SDK from', src);

      // Check if script already exists
      const existingScript = document.querySelector('script[src="' + src + '"]');
      if (existingScript) {
        console.log('CampayPayment: Script already exists, waiting for campay to be available');
        // Wait for campay to be available
        const checkCampay = () => {
          if (window.campay) {
            console.log('CampayPayment: Campay became available');
            setScriptLoaded(true);
          } else {
            setTimeout(checkCampay, 100);
          }
        };
        checkCampay();
        return;
      }

      // Load script
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
          console.log('CampayPayment: Script loaded, waiting for campay object');
          // Wait for campay to be available
          const checkCampay = () => {
            if (window.campay) {
              console.log('CampayPayment: Campay available after script load');
              setScriptLoaded(true);
              resolve();
            } else {
              setTimeout(checkCampay, 100);
            }
          };
          checkCampay();
        };
        script.onerror = () => {
          console.error('CampayPayment: Script failed to load');
          reject(new Error('Failed to load Campay script'));
        };
        document.head.appendChild(script);
      });
    };

    loadCampaySDK().catch(error => {
      console.error('CampayPayment: Failed to load Campay SDK:', error);
    });
  }, []);

  // Initialize Campay when script is loaded and payment request is ready
  useEffect(() => {
    console.log('CampayPayment: useEffect (initialize) called', {
      scriptLoaded,
      hasCampay: !!window.campay,
      hasPaymentRequest: !!paymentRequest,
      buttonId,
      isInitialized
    });

    if (scriptLoaded && window.campay && paymentRequest && !isInitialized) {
      try {
        console.log('CampayPayment: Initializing Campay with config:', {
          payButtonId: buttonId,
          description: paymentRequest.description,
          amount: paymentRequest.amount.toString(),
          currency: paymentRequest.currency,
          externalReference: paymentRequest.externalReference
        });

        // Check if button exists in DOM
        const buttonElement = document.getElementById(buttonId);
        console.log('CampayPayment: Button element found:', !!buttonElement, buttonElement);

         // Get Campay configuration from environment variables
         const campayEnvironment = import.meta.env.VITE_CAMPAY_ENVIRONMENT || 'demo';
         const demoAmount = parseInt(import.meta.env.VITE_CAMPAY_DEMO_AMOUNT || '10');
         // Demo mode: show actual price in modal but charge 10 FCFA
         // Live mode: show and charge actual price
         const displayAmount = paymentRequest.amount; // Always show actual price in modal
         const chargeAmount = campayEnvironment === 'demo' ? demoAmount : paymentRequest.amount;
        
        console.log('CampayPayment: Using Campay account with amount:', {
          originalAmount: paymentRequest.amount,
          displayAmount: displayAmount,
          chargeAmount: chargeAmount,
          environment: campayEnvironment,
          isDemoMode: campayEnvironment === 'demo'
        });

        // Get redirect URL from environment or use empty string
        const redirectUrl = import.meta.env.VITE_CAMPAY_REDIRECT_URL || "";
        
        window.campay.options({
          payButtonId: buttonId,
          description: paymentRequest.description,
          amount: chargeAmount.toString(), // Use charge amount (10 FCFA in demo, actual in live)
          currency: paymentRequest.currency,
          externalReference: paymentRequest.externalReference,
          redirectUrl: redirectUrl,
        });

        console.log('CampayPayment: Campay options set successfully');

                // Set up callbacks
                window.campay.onSuccess = (data: CampayPaymentData) => {
                  console.log('CampayPayment: Payment success callback triggered:', data);
                  
                  // Set payment successful state to trigger auto-close
                  setPaymentSuccessful(true);
                  
                  // Call the success handler first
                  onSuccess(data);
                  
                  // Close the modal after a short delay
                  setTimeout(() => {
                    console.log('CampayPayment: Attempting to close modal after successful payment');
                    
                    // Try multiple methods to close the modal
                    let modalClosed = false;
                    
                    // Method 1: Try to use Campay's close method
                    if (window.campay.close) {
                      try {
                        console.log('CampayPayment: Using Campay close method');
                        window.campay.close();
                        modalClosed = true;
                      } catch (error) {
                        console.log('CampayPayment: Campay close method failed:', error);
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
                          console.log('CampayPayment: Found modal with selector:', selector);
                          modal.remove();
                          modalClosed = true;
                          break;
                        }
                      }
                    }
                    
                    // Method 3: Try to close by pressing Escape key
                    if (!modalClosed) {
                      console.log('CampayPayment: Trying to close modal with Escape key');
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

                window.campay.onFail = (data: CampayPaymentData) => {
                  console.log('CampayPayment: Payment fail callback triggered:', data);
                  onFail(data);
                };

                window.campay.onModalClose = (data: CampayPaymentData) => {
                  console.log('CampayPayment: Modal close callback triggered:', data);
                  onModalClose(data);
                };

        console.log('CampayPayment: All callbacks set up successfully');
        setIsInitialized(true);
      } catch (error) {
        console.error('CampayPayment: Error initializing Campay:', error);
      }
    } else {
      console.log('CampayPayment: Not ready to initialize yet', {
        scriptLoaded,
        hasCampay: !!window.campay,
        hasPaymentRequest: !!paymentRequest,
        isInitialized
      });
    }
  }, [scriptLoaded, paymentRequest, onSuccess, onFail, onModalClose, buttonId, isInitialized]);

  // Auto-open payment modal when autoOpen is true
  useEffect(() => {
    if (autoOpen && isInitialized && buttonRef.current && !disabled) {
      console.log('CampayPayment: Auto-opening payment modal');
      // Small delay to ensure everything is ready
      setTimeout(() => {
        if (buttonRef.current) {
          console.log('CampayPayment: Triggering button click to open modal');
          buttonRef.current.click();
          onAutoOpened?.();
          // Notify that modal is opening
          setTimeout(() => {
            onModalOpen?.();
          }, 100);
        }
      }, 500);
    }
  }, [autoOpen, isInitialized, disabled, onAutoOpened, onModalOpen]);

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
                console.log('CampayPayment: Modal detected, will auto-close in 2 seconds');
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

  if (!scriptLoaded) {
    // Don't render anything when loading to avoid showing "Loading Payment..." button
    return null;
  }

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
