import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTokenStats } from '../core/useTokenStats';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@ubora/shared/firebaseConfig';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
  doc: vi.fn(),
}));

vi.mock('@ubora/shared/firebaseConfig', () => ({
  db: {},
}));

const mockOnSnapshot = vi.mocked(onSnapshot);
const mockDoc = vi.mocked(doc);

describe('useTokenStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return null when userId is not provided', () => {
    const { result } = renderHook(() => useTokenStats(null));

    expect(result.current).toBeNull();
  });

  test('should return null when userId is undefined', () => {
    const { result } = renderHook(() => useTokenStats(undefined));

    expect(result.current).toBeNull();
  });

  test('should subscribe to token stats document', () => {
    const userId = 'test-user-1';
    const mockUnsubscribe = vi.fn();
    
    mockDoc.mockReturnValue({} as any);
    mockOnSnapshot.mockImplementation((ref, callback) => {
      // Simulate snapshot with data
      setTimeout(() => {
        callback({
          exists: () => true,
          data: () => ({
            tokensUsedMonthly: 50000,
            month: '2024-01'
          })
        } as any);
      }, 0);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useTokenStats(userId));

    expect(mockDoc).toHaveBeenCalledWith(db, 'users', userId, 'stats', 'current');
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  test('should update stats when snapshot data changes', async () => {
    const userId = 'test-user-1';
    let snapshotCallback: ((snapshot: any) => void) | null = null;
    
    mockDoc.mockReturnValue({} as any);
    mockOnSnapshot.mockImplementation((ref, callback) => {
      snapshotCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useTokenStats(userId));

    // Simulate snapshot update
    if (snapshotCallback) {
      snapshotCallback({
        exists: () => true,
        data: () => ({
          tokensUsedMonthly: 75000,
          month: '2024-02'
        })
      } as any);
    }

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current?.tokensUsedMonthly).toBe(75000);
    expect(result.current?.month).toBe('2024-02');
  });

  test('should return default stats when document does not exist', async () => {
    const userId = 'test-user-1';
    let snapshotCallback: ((snapshot: any) => void) | null = null;
    
    mockDoc.mockReturnValue({} as any);
    mockOnSnapshot.mockImplementation((ref, callback) => {
      snapshotCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useTokenStats(userId));

    // Simulate snapshot with no data
    if (snapshotCallback) {
      snapshotCallback({
        exists: () => false,
        data: () => null
      } as any);
    }

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current?.tokensUsedMonthly).toBe(0);
  });

  test('should handle snapshot errors gracefully', async () => {
    const userId = 'test-user-1';
    let errorCallback: ((error: any) => void) | null = null;
    
    mockDoc.mockReturnValue({} as any);
    mockOnSnapshot.mockImplementation((ref, callback, onError) => {
      if (onError) {
        errorCallback = onError;
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useTokenStats(userId));

    // Simulate error
    if (errorCallback) {
      errorCallback(new Error('Firestore error'));
    }

    // Should not crash, previous stats should be maintained
    expect(result.current).toBeDefined();
  });

  test('should unsubscribe on unmount', () => {
    const userId = 'test-user-1';
    const mockUnsubscribe = vi.fn();
    
    mockDoc.mockReturnValue({} as any);
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useTokenStats(userId));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  test('should memoize stats when values do not change', async () => {
    const userId = 'test-user-1';
    let snapshotCallback: ((snapshot: any) => void) | null = null;
    
    mockDoc.mockReturnValue({} as any);
    mockOnSnapshot.mockImplementation((ref, callback) => {
      snapshotCallback = callback;
      return vi.fn();
    });

    const { result, rerender } = renderHook(() => useTokenStats(userId));

    // Set initial stats
    if (snapshotCallback) {
      snapshotCallback({
        exists: () => true,
        data: () => ({
          tokensUsedMonthly: 50000,
          month: '2024-01'
        })
      } as any);
    }

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    const firstResult = result.current;

    // Rerender with same userId
    rerender();

    // Result should be memoized (same reference)
    expect(result.current).toBe(firstResult);
  });
});


