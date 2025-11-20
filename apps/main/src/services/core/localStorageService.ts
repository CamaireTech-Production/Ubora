import { logger } from '@ubora/shared/utils/logger';
import { FileAttachment } from '../../types';

export interface LocalFormResponse {
  id: string;
  formId: string;
  answers: Record<string, any>;
  fileAttachments: FileAttachment[];
  submittedAt: Date;
  userId: string;
  agencyId: string;
  status: 'draft' | 'ready_to_submit';
}

export class LocalStorageService {
  private static readonly STORAGE_KEY = 'ubora_form_responses';

  /**
   * Store a form response in localStorage
   */
  static storeFormResponse(response: LocalFormResponse): void {
    try {
      const existingResponses = this.getAllFormResponses();
      const updatedResponses = [...existingResponses, response];
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedResponses));
    } catch (error) {
      logger.error('Error storing form response in localStorage', error, 'LocalStorageService');
      throw new Error(`Failed to store form response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all form responses from localStorage
   */
  static getAllFormResponses(): LocalFormResponse[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const responses = JSON.parse(stored);
      // Convert date strings back to Date objects
      return responses.map((response: any) => ({
        ...response,
        submittedAt: new Date(response.submittedAt)
      }));
    } catch (error) {
      logger.error('Error reading form responses from localStorage', error, 'LocalStorageService');
      return [];
    }
  }

  /**
   * Get form responses by form ID
   */
  static getFormResponsesByFormId(formId: string): LocalFormResponse[] {
    const allResponses = this.getAllFormResponses();
    return allResponses.filter(response => response.formId === formId);
  }

  /**
   * Get a specific form response by ID
   */
  static getFormResponseById(responseId: string): LocalFormResponse | null {
    const allResponses = this.getAllFormResponses();
    return allResponses.find(response => response.id === responseId) || null;
  }

  /**
   * Update a form response in localStorage
   */
  static updateFormResponse(responseId: string, updates: Partial<LocalFormResponse>): void {
    try {
      const allResponses = this.getAllFormResponses();
      const responseIndex = allResponses.findIndex(response => response.id === responseId);
      
      if (responseIndex === -1) {
        throw new Error(`Form response with ID ${responseId} not found`);
      }

      allResponses[responseIndex] = { ...allResponses[responseIndex], ...updates };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allResponses));
    } catch (error) {
      logger.error('Error updating form response in localStorage', error, 'LocalStorageService');
      throw error;
    }
  }

  /**
   * Remove a form response from localStorage
   */
  static removeFormResponse(responseId: string): void {
    try {
      const allResponses = this.getAllFormResponses();
      const filteredResponses = allResponses.filter(response => response.id !== responseId);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredResponses));
    } catch (error) {
      logger.error('Error removing form response from localStorage', error, 'LocalStorageService');
      throw error;
    }
  }

  /**
   * Clear all form responses from localStorage
   */
  static clearAllFormResponses(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      logger.error('Error clearing form responses from localStorage', error, 'LocalStorageService');
      throw error;
    }
  }

  /**
   * Get localStorage usage statistics
   */
  static getStorageStats(): {
    totalResponses: number;
    totalSize: number;
    responsesByStatus: Record<string, number>;
  } {
    const responses = this.getAllFormResponses();
    const totalSize = JSON.stringify(responses).length;
    const responsesByStatus = responses.reduce((acc, response) => {
      acc[response.status] = (acc[response.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalResponses: responses.length,
      totalSize,
      responsesByStatus
    };
  }

  /**
   * Generate a unique ID for form responses
   */
  static generateResponseId(): string {
    return `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
