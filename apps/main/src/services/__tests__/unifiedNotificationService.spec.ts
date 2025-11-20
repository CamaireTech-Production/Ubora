import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browserNotificationService to avoid using Notification API in Node
vi.mock('../browserNotificationService', () => {
  return {
    browserNotificationService: {
      isBrowserNotificationSupported: () => false,
      getPermissionStatus: () => 'denied',
      showNotification: vi.fn(async () => true),
      showFormAssignmentNotification: vi.fn(async () => true),
      showFormReminderNotification: vi.fn(async () => true),
      showMetricReminderNotification: vi.fn(async () => true),
      showProgrammedInstructionNotification: vi.fn(async () => true),
    }
  };
});

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<any>('firebase/firestore');
  let docs: any[] = [];
  return {
    ...actual,
    collection: vi.fn((db, name) => ({ db, name })),
    addDoc: vi.fn(async (collRef: any, data: any) => {
      const id = `doc_${docs.length + 1}`;
      docs.push({ id, data });
      return { id };
    }),
    query: vi.fn((...args: any[]) => ({ args })),
    where: vi.fn((...args: any[]) => ({ type: 'where', args })),
    limit: vi.fn((...args: any[]) => ({ type: 'limit', args })),
    getDocs: vi.fn(async (q: any) => {
      // Very naive: detect idempotencyKey from query args
      const whereClause = q?.args?.find((a: any) => a?.type === 'where');
      const key = whereClause?.args?.[2];
      const matching = docs.find((d) => d.data?.idempotencyKey === key);
      return {
        empty: !matching,
        docs: matching ? [{ id: 'existing', data: () => matching.data }] : [],
      };
    }),
    serverTimestamp: vi.fn(() => new Date()),
  };
});

import { unifiedNotificationService } from '../notifications/unifiedNotificationService';

describe('unifiedNotificationService idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates once, returns existing on duplicate with same idempotency key', async () => {
    const payload = {
      title: 'Test',
      body: 'Body',
      type: 'form_assignment' as const,
      recipientId: 'user1',
      recipientRole: 'employe' as const,
      agencyId: 'agency1',
      data: { formId: 'form1', action: 'assigned' },
      redirectUrl: '/forms',
    };

    const id1 = await unifiedNotificationService.sendNotification(payload);
    const id2 = await unifiedNotificationService.sendNotification(payload);

    expect(id1).toBeTruthy();
    expect(id2).toBe('existing');
  });
});


