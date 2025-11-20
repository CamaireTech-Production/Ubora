import { useState, useCallback, useRef, useEffect } from 'react';
import { FormDefinition, DashboardDefinition, InstructionDefinition, ListDefinition, ReportDefinition } from '../../types';
import { logger } from '@ubora/shared/utils/logger';

const UNIVERS_WIZARD_PROGRESS_KEY = 'ubora_univers_wizard_progress';

export interface UniversWizardProgress {
  currentStep: number;
  metadata?: {
    name?: string;
    description?: string;
    iconUrl?: string;
    category?: string;
    tags?: string[];
  };
  forms?: FormDefinition[]; // Form definitions
  dashboards?: DashboardDefinition[]; // Dashboard definitions
  instructions?: InstructionDefinition[]; // Instruction definitions
  lists?: ListDefinition[]; // List definitions (empty for now)
  reports?: ReportDefinition[]; // Report definitions (empty for now)
  timestamp: number; // Last save timestamp
}

function getStorageKey(userId?: string | null) {
  return `${UNIVERS_WIZARD_PROGRESS_KEY}_${userId || 'anonymous'}`;
}

export function useUniversWizardProgress(userId?: string | null) {
  const storageKey = getStorageKey(userId);
  const [initialized, setInitialized] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const loadProgress = useCallback((): UniversWizardProgress | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as UniversWizardProgress;
      // Check if draft is older than 7 days
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (parsed.timestamp < sevenDaysAgo) {
        // Draft is too old, clear it
        localStorage.removeItem(storageKey);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [storageKey]);

  const saveProgress = useCallback((progress: Partial<UniversWizardProgress>) => {
    try {
      const existing = loadProgress();
      const updated: UniversWizardProgress = {
        currentStep: 1,
        ...existing,
        ...progress,
        timestamp: Date.now()
      } as UniversWizardProgress;
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (error) {
      logger.error('Error saving Univers wizard progress', error, 'useUniversWizardProgress');
    }
  }, [storageKey, loadProgress]);

  const saveProgressDebounced = useCallback((progress: Partial<UniversWizardProgress>, delayMs: number = 400) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveProgress(progress), delayMs);
  }, [saveProgress]);

  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      logger.error('Error clearing Univers wizard progress', error, 'useUniversWizardProgress');
    }
  }, [storageKey]);

  useEffect(() => {
    setInitialized(true);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  return {
    initialized,
    loadProgress,
    saveProgress,
    saveProgressDebounced,
    clearProgress
  } as const;
}

