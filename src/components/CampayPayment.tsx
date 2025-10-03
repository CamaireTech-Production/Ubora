import React, { useEffect, useRef, useState } from 'react';
import { PaymentRequest, CampayPaymentData } from '../types/payment';

// Global state to track Campay initialization
let campayInitialized = false;
let currentButtonId: string | null = null;

interface CampayPaymentProps {
  paymentRequest: PaymentRequest;
  onSuccess: (data: CampayPaymentData) => void;
  onFail: (data: CampayPaymentData) => void;
  onModalClose: (data: CampayPaymentData) => void;
  buttonText?: string;
  buttonClassName?: string;
  disabled?: boolean;
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
  disabled = false
}) => {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Generate unique button ID for this component instance (only once)
  const [buttonId] = useState(() => `campay-pay-button-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Load Campay SDK (only once globally)
  useEffect(() => {
    console.log('CampayPayment: Starting script load process');
    
    const loadCampayScript = () => {
      // Check if script is already loaded
      if (window.campay) {
        console.log('CampayPayment: Campay SDK already loaded');
        setScriptLoaded(true);
        return;
      }

      // Check if script is already in the DOM
      const existingScript = document.querySelector('script[src*="campay.net/sdk/js"]');
      if (existingScript) {
        console.log('CampayPayment: Script exists in DOM, waiting for load');
        // Script exists, wait for it to load
        const checkCampay = () => {
          if (window.campay) {
            console.log('CampayPayment: Campay SDK loaded from existing script');
            setScriptLoaded(true);
          } else {
            setTimeout(checkCampay, 100);
          }
        };
        checkCampay();
        return;
      }

      console.log('CampayPayment: Creating new script element');
      // Create new script element
      const script = document.createElement('script');
      // New demo account with 100 FCFA max limit
      script.src = 'https://demo.campay.net/sdk/js?app-id=Muw-QotZAcx8PbngvT7lbsnc1OomeDkw31sWjv5XftEBoSy_opiLcFz17UhClFC6ZNm8AOdL6xFCH7KoUEUN5Q';
      script.async = true;
      
      script.onload = () => {
        console.log('CampayPayment: Script loaded successfully');
        setScriptLoaded(true);
      };
      
      script.onerror = () => {
        console.error('CampayPayment: Failed to load Campay SDK');
        setScriptLoaded(false);
      };

      document.head.appendChild(script);
      console.log('CampayPayment: Script added to document head');
    };

    loadCampayScript();
  }, []);

  // Initialize Campay when script is loaded and payment request is ready
  useEffect(() => {
    console.log('CampayPayment: useEffect triggered', {
      scriptLoaded,
      hasCampay: !!window.campay,
      hasPaymentRequest: !!paymentRequest,
      buttonId,
      campayInitialized,
      currentButtonId
    });

    if (scriptLoaded && window.campay && paymentRequest) {
      // If this is a different button, reset the initialization
      if (currentButtonId !== buttonId) {
        console.log('CampayPayment: New button detected, resetting initialization');
        campayInitialized = false;
        currentButtonId = buttonId;
      }

      if (!campayInitialized) {
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

                // For demo mode, always use 10 FCFA for all transactions
                const demoAmount = 10;
                const actualAmount = demoAmount; // Always use 10 FCFA for demo
        
        console.log('CampayPayment: Using demo account with amount:', {
          originalAmount: paymentRequest.amount,
          demoAmount: actualAmount,
          isDemoMode: true,
          displayAmount: paymentRequest.metadata?.displayAmount
        });

        window.campay.options({
          payButtonId: buttonId,
          description: paymentRequest.description,
          amount: actualAmount.toString(),
          currency: paymentRequest.currency,
          externalReference: paymentRequest.externalReference,
          redirectUrl: "",
        });

        console.log('CampayPayment: Campay options set successfully');

                // Set up callbacks
                window.campay.onSuccess = (data: CampayPaymentData) => {
                  console.log('CampayPayment: Payment success callback triggered:', data);
                  onSuccess(data);
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
        campayInitialized = true;
        console.log('CampayPayment: Campay marked as initialized for button:', buttonId);
      } catch (error) {
        console.error('CampayPayment: Error initializing Campay:', error);
      }
      } else {
        console.log('CampayPayment: Campay already initialized for this button');
      }
    } else {
      console.log('CampayPayment: Not ready to initialize yet', {
        scriptLoaded,
        hasCampay: !!window.campay,
        hasPaymentRequest: !!paymentRequest
      });
    }
  }, [scriptLoaded, paymentRequest, onSuccess, onFail, onModalClose, buttonId]);

  // Remove the onClick handler - let Campay handle clicks directly
  // This prevents interference with Campay's own click handling

  if (!scriptLoaded) {
    return (
      <button
        disabled
        className={`${buttonClassName} opacity-50 cursor-not-allowed`}
      >
        Loading Payment...
      </button>
    );
  }

  return (
          <button
            ref={buttonRef}
            id={buttonId}
            disabled={disabled}
            className={`${buttonClassName} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {buttonText}
          </button>
  );
};
