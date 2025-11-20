import React, { createContext, useContext } from 'react';
import { DraftResponse } from '../types';
import { DraftService } from '../services/draftService';

interface AppContextType {
  // Draft management
  getDraftsForForm: (userId: string, formId: string) => DraftResponse[];
  saveDraft: (draft: DraftResponse) => void;
  deleteDraft: (draftId: string) => void;
  deleteDraftsForForm: (userId: string, formId: string) => void;
  createDraft: (formId: string, userId: string, agencyId: string, answers?: Record<string, any>, fileAttachments?: any[]) => DraftResponse;
  refreshData: () => void;
  isLoading: boolean;
  error: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Draft management functions
  const getDraftsForForm = (userId: string, formId: string): DraftResponse[] => {
    return DraftService.getDraftsForForm(userId, formId);
  };

  const saveDraft = (draft: DraftResponse): void => {
    DraftService.saveDraft(draft);
  };

  const deleteDraft = (draftId: string): void => {
    DraftService.deleteDraft(draftId);
  };

  const deleteDraftsForForm = (userId: string, formId: string): void => {
    DraftService.deleteDraftsForForm(userId, formId);
  };

  const createDraft = (
    formId: string, 
    userId: string, 
    agencyId: string, 
    answers: Record<string, any> = {}, 
    fileAttachments: any[] = []
  ): DraftResponse => {
    return DraftService.createDraft(formId, userId, agencyId, answers, fileAttachments);
  };

  const refreshData = () => {
    // This function is kept for backward compatibility
    // Components can call this to trigger a refresh, but actual data refresh
    // is handled by individual contexts (FormsContext, EntriesContext, etc.)
    // This is a no-op for now, but kept in case some components still call it
  };

  return (
    <AppContext.Provider value={{
      // Draft management
      getDraftsForForm,
      saveDraft,
      deleteDraft,
      deleteDraftsForForm,
      createDraft,
      refreshData,
      isLoading: false, // No loading state needed for draft management
      error: null
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    // During initialization, return default values instead of throwing
    return {
      getDraftsForForm: () => [],
      saveDraft: () => {},
      deleteDraft: () => {},
      deleteDraftsForForm: () => {},
      createDraft: () => ({ id: '', formId: '', userId: '', agencyId: '', answers: {}, fileAttachments: [], isDraft: true as const, createdAt: new Date(), updatedAt: new Date() }),
      refreshData: () => {},
      isLoading: false,
      error: null
    };
  }
  return context;
};
