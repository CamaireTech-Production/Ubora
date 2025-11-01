import { doc, serverTimestamp, setDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export class TokenStatsService {
  static async incrementUsage(userId: string, amount: number): Promise<boolean> {
    try {
      if (!userId || amount <= 0) return false;

      const statsRef = doc(db, 'users', userId, 'stats', 'current');
      const monthKey = getCurrentMonthKey();

      // Ensure the doc exists, then increment fields atomically
      const snap = await getDoc(statsRef);
      if (!snap.exists()) {
        await setDoc(statsRef, {
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          month: monthKey,
          tokensUsedMonthly: 0
        }, { merge: true });
      }

      await updateDoc(statsRef, {
        updatedAt: serverTimestamp(),
        month: monthKey,
        tokensUsedMonthly: increment(amount),
        lastTokenUsedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error incrementing token stats:', error);
      return false;
    }
  }
}


