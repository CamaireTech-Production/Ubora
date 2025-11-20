import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';
import { logger } from '@ubora/shared/utils/logger';

export type TokenUsageType = 'image_extraction' | 'pdf_extraction' | 'other';

interface TokenUsageLogEntry {
  userId: string;
  amount: number;
  usageType: TokenUsageType;
  context?: Record<string, unknown>;
  createdAt: any;
}

export class TokenUsageLogService {
  static async logTokenUsage(
    userId: string,
    amount: number,
    usageType: TokenUsageType,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      if (!userId || amount <= 0) return false;

      const logRef = collection(db, 'users', userId, 'tokenUsageLogs');
      const entry: TokenUsageLogEntry = {
        userId,
        amount,
        usageType,
        context,
        createdAt: serverTimestamp()
      };
      await addDoc(logRef, entry as any);
      return true;
    } catch (error) {
      logger.error('Error logging token usage', error, 'tokenUsageLogService');
      return false;
    }
  }
}


