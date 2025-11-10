import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenUsageLogService } from '../tokenUsageLogService';

vi.mock('../../firebaseConfig', () => ({
  db: {} as any
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<any>('firebase/firestore');
  return {
    ...actual,
    collection: vi.fn(() => ({} as any)),
    addDoc: vi.fn(async () => ({} as any)),
    serverTimestamp: vi.fn(() => ({ mock: 'ts' }))
  };
});

import { collection, addDoc } from 'firebase/firestore';

describe('TokenUsageLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs token usage successfully', async () => {
    (addDoc as any).mockResolvedValueOnce({ id: 'x' });
    const ok = await TokenUsageLogService.logTokenUsage('user1', 10, 'image_extraction', { foo: 'bar' });
    expect(ok).toBe(true);
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'tokenUsageLogs');
    expect(addDoc).toHaveBeenCalledTimes(1);
  });

  it('returns false for invalid params', async () => {
    const ok1 = await TokenUsageLogService.logTokenUsage('', 10, 'image_extraction');
    const ok2 = await TokenUsageLogService.logTokenUsage('user1', 0, 'image_extraction');
    expect(ok1).toBe(false);
    expect(ok2).toBe(false);
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('handles errors and returns false', async () => {
    (addDoc as any).mockRejectedValueOnce(new Error('fail'));
    const ok = await TokenUsageLogService.logTokenUsage('user1', 5, 'pdf_extraction');
    expect(ok).toBe(false);
  });
});


