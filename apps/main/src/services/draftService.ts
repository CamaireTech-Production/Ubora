import { DraftResponse } from '../types';

const DRAFT_STORAGE_KEY = 'form_drafts';

export class DraftService {
  static getDrafts(userId: string): DraftResponse[] {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!stored) return [];
      
      const allDrafts = JSON.parse(stored);
      const userDrafts = allDrafts.filter((draft: any) => draft.userId === userId);
      
      // Convert date strings back to Date objects
      return userDrafts.map((draft: any) => ({
        ...draft,
        createdAt: new Date(draft.createdAt),
        updatedAt: new Date(draft.updatedAt)
      }));
    } catch (error) {
      console.error('Error loading drafts:', error);
      return [];
    }
  }

  static getDraftsForForm(userId: string, formId: string): DraftResponse[] {
    const drafts = this.getDrafts(userId);
    return drafts.filter(draft => draft.formId === formId);
  }

  static saveDraft(draft: DraftResponse): void {
    try {
      const allDrafts = this.getAllDrafts();
      const existingIndex = allDrafts.findIndex(d => d.id === draft.id);
      
      if (existingIndex >= 0) {
        allDrafts[existingIndex] = draft;
      } else {
        allDrafts.push(draft);
      }
      
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(allDrafts));
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }

  static deleteDraft(draftId: string): void {
    try {
      const allDrafts = this.getAllDrafts();
      const filteredDrafts = allDrafts.filter(draft => draft.id !== draftId);
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  }

  static deleteDraftsForForm(userId: string, formId: string): void {
    try {
      const allDrafts = this.getAllDrafts();
      const filteredDrafts = allDrafts.filter(
        draft => !(draft.userId === userId && draft.formId === formId)
      );
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
    } catch (error) {
      console.error('Error deleting drafts for form:', error);
    }
  }

  static clearAllDrafts(userId: string): void {
    try {
      const allDrafts = this.getAllDrafts();
      const filteredDrafts = allDrafts.filter(draft => draft.userId !== userId);
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
    } catch (error) {
      console.error('Error clearing all drafts:', error);
    }
  }

  private static getAllDrafts(): any[] {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading all drafts:', error);
      return [];
    }
  }

  static createDraft(
    formId: string,
    userId: string,
    agencyId: string,
    answers: Record<string, any> = {},
    fileAttachments: any[] = []
  ): DraftResponse {
    const now = new Date();
    return {
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      formId,
      userId,
      agencyId,
      answers,
      fileAttachments,
      createdAt: now,
      updatedAt: now,
      isDraft: true
    };
  }
}
