import { useState, useEffect, useRef } from 'react';

interface UseChatStateReturn {
  inputMessage: string;
  setInputMessage: (value: string) => void;
  keyboardHeight: number;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showTokenLimitModal: boolean;
  setShowTokenLimitModal: (show: boolean) => void;
  showPayAsYouGoModal: boolean;
  setShowPayAsYouGoModal: (show: boolean) => void;
  showLogoutModal: boolean;
  setShowLogoutModal: (show: boolean) => void;
  isLoggingOut: boolean;
  setIsLoggingOut: (logging: boolean) => void;
  isLoadingMore: boolean;
  setIsLoadingMore: (loading: boolean) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  lastProcessedMessageIdRef: React.MutableRefObject<string | null>;
}

export const useChatState = (): UseChatStateReturn => {
  const [inputMessage, setInputMessage] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('conversations');
  const [showTokenLimitModal, setShowTokenLimitModal] = useState(false);
  const [showPayAsYouGoModal, setShowPayAsYouGoModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  // Keyboard detection for proper layout adjustment
  useEffect(() => {
    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const heightDiff = windowHeight - viewportHeight;
      
      // Only update if the difference is significant (keyboard is likely open)
      if (heightDiff > 150) {
        setKeyboardHeight(heightDiff);
      } else {
        setKeyboardHeight(0);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      };
    } else {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  return {
    inputMessage,
    setInputMessage,
    keyboardHeight,
    panelOpen,
    setPanelOpen,
    activeTab,
    setActiveTab,
    showTokenLimitModal,
    setShowTokenLimitModal,
    showPayAsYouGoModal,
    setShowPayAsYouGoModal,
    showLogoutModal,
    setShowLogoutModal,
    isLoggingOut,
    setIsLoggingOut,
    isLoadingMore,
    setIsLoadingMore,
    inputRef,
    lastProcessedMessageIdRef
  };
};

