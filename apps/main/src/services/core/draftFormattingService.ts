import { logger } from '@ubora/shared/utils/logger';
import { db } from '@ubora/shared/firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

export interface DraftFormattingResult {
  submissionId: string;
  formattedText: string;
  status: 'ready' | 'processing' | 'failed';
  createdAt: Date;
}

export class DraftFormattingService {
  /**
   * Check if formatted text is available for a draft submission
   */
  static async getFormattedTextForDraft(submissionId: string): Promise<string | null> {
    try {
      logger.debug('Checking draftFormatting collection for submission', { submissionId }, 'DraftFormattingService');
      const draftDoc = await getDoc(doc(db, 'draftFormatting', submissionId));
      
      if (draftDoc.exists()) {
        const data = draftDoc.data();
        logger.debug('Found draft formatting document', { submissionId, status: data.status }, 'DraftFormattingService');
        if (data.status === 'ready' && data.formattedText) {
          logger.debug('Found ready formatted text for submission', { submissionId }, 'DraftFormattingService');
          return data.formattedText;
        } else {
          logger.debug('Draft formatting document exists but not ready', { submissionId, status: data.status }, 'DraftFormattingService');
        }
      } else {
        logger.debug('No draft formatting document found for submission', { submissionId }, 'DraftFormattingService');
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting formatted text for draft', error, 'DraftFormattingService');
      return null;
    }
  }

  /**
   * Save formatted text for a draft submission
   */
  static async saveFormattedTextForDraft(
    submissionId: string, 
    formattedText: string
  ): Promise<void> {
    try {
      await setDoc(doc(db, 'draftFormatting', submissionId), {
        submissionId,
        formattedText,
        status: 'ready',
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Error saving formatted text for draft', error, 'DraftFormattingService');
      throw error;
    }
  }

  /**
   * Remove formatted text record after draft is submitted
   */
  static async removeFormattedTextForDraft(submissionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'draftFormatting', submissionId));
    } catch (error) {
      logger.error('Error removing formatted text for draft', error, 'DraftFormattingService');
      // Don't throw error as this is cleanup
    }
  }

  /**
   * Get all pending draft formatting results for a user
   */
  static async getPendingDraftFormatting(userId: string): Promise<DraftFormattingResult[]> {
    try {
      // This would need to be implemented based on how you track user submissions
      // For now, we'll return empty array as the submissionId is generated server-side
      return [];
    } catch (error) {
      logger.error('Error getting pending draft formatting', error, 'DraftFormattingService');
      return [];
    }
  }

  /**
   * Check if a FormEntry exists in Firebase
   */
  static async checkFormEntryExists(submissionId: string): Promise<boolean> {
    try {
      const entryDoc = await getDoc(doc(db, 'formEntries', submissionId));
      return entryDoc.exists();
    } catch (error) {
      logger.error('Error checking FormEntry existence', error, 'DraftFormattingService');
      return false;
    }
  }

  /**
   * Update FormEntry with formatted text
   */
  static async updateFormEntryWithFormattedText(
    submissionId: string, 
    formattedText: string
  ): Promise<void> {
    try {
      const entryRef = doc(db, 'formEntries', submissionId);
      await setDoc(entryRef, {
        'fileAttachments.0.extractedText': formattedText,
        formattedAt: new Date(),
        formattingStatus: 'completed'
      }, { merge: true });
    } catch (error) {
      logger.error('Error updating FormEntry with formatted text', error, 'DraftFormattingService');
      throw error;
    }
  }
}
