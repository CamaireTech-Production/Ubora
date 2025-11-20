import { useEffect, useState, useMemo } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';

export interface TokenStatsCurrent {
  tokensUsedMonthly?: number;
  month?: string;
}

export function useTokenStats(userId?: string | null) {
  const [stats, setStats] = useState<TokenStatsCurrent | null>(null);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      return;
    }

    const ref = doc(db, 'users', userId, 'stats', 'current');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as TokenStatsCurrent;
        setStats({
          tokensUsedMonthly: typeof data.tokensUsedMonthly === 'number' ? data.tokensUsedMonthly : 0,
          month: data.month
        });
      } else {
        setStats({ tokensUsedMonthly: 0 });
      }
    }, () => {
      // On error, keep previous stats
    });

    return () => unsub();
  }, [userId]);

  // Mémoriser le résultat pour éviter recréation d'objet si valeurs identiques
  const memoizedStats = useMemo(() => stats, [stats?.tokensUsedMonthly, stats?.month]);

  return memoizedStats;
}


