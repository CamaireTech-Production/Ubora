import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

function getDraftStorageKey(formId: string, userId?: string | null) {
  return `formDraft:${formId}:${userId || 'anon'}`;
}

export function useFormDraft<T extends Record<string, unknown>>(formId: string, userId?: string | null) {
  // Mémoriser storageKey pour éviter recréation à chaque render
  const storageKey = useMemo(() => getDraftStorageKey(formId, userId), [formId, userId]);
  const [initialized, setInitialized] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const loadDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [storageKey]);

  const saveDraft = useCallback((values: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const saveDraftDebounced = useCallback((values: T, delayMs: number = 400) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveDraft(values), delayMs);
  }, [saveDraft]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  useEffect(() => {
    setInitialized(true);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  return {
    initialized,
    loadDraft,
    saveDraft,
    saveDraftDebounced,
    clearDraft
  } as const;
}


