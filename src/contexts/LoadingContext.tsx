import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingState {
  [key: string]: {
    isLoading: boolean;
    progress?: number;
    message?: string;
    error?: string;
  };
}

interface LoadingContextType {
  loadingStates: LoadingState;
  setLoading: (key: string, isLoading: boolean, options?: {
    progress?: number;
    message?: string;
    error?: string;
  }) => void;
  isLoading: (key: string) => boolean;
  getLoadingState: (key: string) => LoadingState[string] | undefined;
  clearLoading: (key: string) => void;
  clearAllLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = (
    key: string, 
    isLoading: boolean, 
    options?: {
      progress?: number;
      message?: string;
      error?: string;
    }
  ) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        isLoading,
        progress: options?.progress,
        message: options?.message,
        error: options?.error
      }
    }));
  };

  const isLoading = (key: string): boolean => {
    return loadingStates[key]?.isLoading || false;
  };

  const getLoadingState = (key: string) => {
    return loadingStates[key];
  };

  const clearLoading = (key: string) => {
    setLoadingStates(prev => {
      const newStates = { ...prev };
      delete newStates[key];
      return newStates;
    });
  };

  const clearAllLoading = () => {
    setLoadingStates({});
  };

  return (
    <LoadingContext.Provider value={{
      loadingStates,
      setLoading,
      isLoading,
      getLoadingState,
      clearLoading,
      clearAllLoading
    }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

// Loading keys constants
export const LOADING_KEYS = {
  DASHBOARD: 'dashboard',
  FORMS: 'forms',
  DASHBOARDS: 'dashboards',
  EMPLOYEES: 'employees',
  NOTIFICATIONS: 'notifications',
  CHAT_MESSAGES: 'chat_messages',
  PACKAGE_DATA: 'package_data',
  ADMIN_STATS: 'admin_stats',
  USER_DATA: 'user_data',
  SCHEDULED_QUESTIONS: 'scheduled_questions',
  SCHEDULED_INSTRUCTIONS: 'scheduled_instructions'
} as const;
