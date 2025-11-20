import React, { createContext, useContext, useState, useRef } from 'react';
import { logger } from '../utils/logger';

interface AIResponseContextType {
  isAIResponseActive: boolean;
  setAIResponseActive: (active: boolean) => void;
  aiResponseActiveRef: React.MutableRefObject<boolean>;
}

const AIResponseContext = createContext<AIResponseContextType | undefined>(undefined);

export const AIResponseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAIResponseActive, setIsAIResponseActive] = useState(false);
  const aiResponseActiveRef = useRef(false);

  const setAIResponseActive = (active: boolean) => {
    setIsAIResponseActive(active);
    aiResponseActiveRef.current = active;
    logger.debug('Setting AI response active', { 
      timestamp: Date.now(),
      active
    }, 'AIResponseContext');
  };

  return (
    <AIResponseContext.Provider value={{
      isAIResponseActive,
      setAIResponseActive,
      aiResponseActiveRef
    }}>
      {children}
    </AIResponseContext.Provider>
  );
};

export const useAIResponse = () => {
  const context = useContext(AIResponseContext);
  if (context === undefined) {
    throw new Error('useAIResponse must be used within an AIResponseProvider');
  }
  return context;
};
