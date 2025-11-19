import { describe, test, expect, vi, beforeEach } from 'vitest';
import { UserSessionService } from '../core/userSessionService';
import { User } from '../../types';

// Create mock function before vi.mock
const mockGetActiveSession = vi.fn();

vi.mock('@ubora/shared/services/subscriptionSessionCollectionService', () => ({
  SubscriptionSessionCollectionService: {
    getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args)
  }
}));

describe('UserSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockReset();
  });

  describe('getUserPackageInfo', () => {
    test('should return default package info for non-director user', async () => {
      const mockEmployee: User = {
        id: 'test-employee-1',
        name: 'Test Employee',
        email: 'employee@test.com',
        role: 'employe',
        agencyId: 'test-agency-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await UserSessionService.getUserPackageInfo(mockEmployee);

      expect(result.packageType).toBeNull();
      expect(result.subscriptionStatus).toBe('expired');
      expect(result.totalTokens).toBe(0);
      expect(result.totalForms).toBe(0);
      expect(result.totalDashboards).toBe(0);
      expect(result.totalUsers).toBe(0);
    });

    test('should return package info for director with active session', async () => {
      const mockDirector: User = {
        id: 'test-director-1',
        name: 'Test Director',
        email: 'director@test.com',
        role: 'directeur',
        agencyId: 'test-agency-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetActiveSession.mockResolvedValue({
        id: 'session-1',
        packageType: 'standard',
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        packageResources: {
          tokensIncluded: 300000,
          formsIncluded: -1,
          dashboardsIncluded: -1,
          usersIncluded: -1
        },
        payAsYouGoResources: {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0
        },
        usage: {
          tokensUsed: 50000,
          formsCreated: 10,
          dashboardsCreated: 5,
          usersAdded: 3
        },
        amountPaid: 50000,
        sessionType: 'subscription'
      });

      const result = await UserSessionService.getUserPackageInfo(mockDirector);

      expect(result.packageType).toBe('standard');
      expect(result.subscriptionStatus).toBe('active');
      expect(result.totalTokens).toBe(300000);
      expect(result.totalForms).toBe(-1); // Unlimited
      expect(result.totalDashboards).toBe(-1); // Unlimited
      expect(result.totalUsers).toBe(-1); // Unlimited
      expect(result.tokensUsed).toBe(50000);
      expect(result.tokensRemaining).toBe(250000);
    });

    test('should handle expired session', async () => {
      const mockDirector: User = {
        id: 'test-director-2',
        name: 'Test Director 2',
        email: 'director2@test.com',
        role: 'directeur',
        agencyId: 'test-agency-2',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      mockGetActiveSession.mockResolvedValue({
        id: 'session-2',
        packageType: 'starter',
        isActive: false,
        startDate: pastDate,
        endDate: pastDate,
        packageResources: {
          tokensIncluded: 100000,
          formsIncluded: 4,
          dashboardsIncluded: 1,
          usersIncluded: -1
        },
        payAsYouGoResources: {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 0
        },
        usage: {
          tokensUsed: 0,
          formsCreated: 0,
          dashboardsCreated: 0,
          usersAdded: 0
        },
        amountPaid: 20000,
        sessionType: 'subscription'
      });

      const result = await UserSessionService.getUserPackageInfo(mockDirector);

      expect(result.packageType).toBe('starter');
      expect(result.subscriptionStatus).toBe('expired');
      expect(result.daysRemaining).toBe(0);
    });
  });

  describe('getPackageLimits', () => {
    test('should return correct package limits for standard package director', async () => {
      const mockDirector: User = {
        id: 'test-director-1',
        name: 'Test Director',
        email: 'director@test.com',
        role: 'directeur',
        agencyId: 'test-agency-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetActiveSession.mockResolvedValue({
        id: 'session-1',
        packageType: 'standard',
        isActive: true,
        packageResources: {
          tokensIncluded: 1000,
          formsIncluded: -1,
          dashboardsIncluded: -1,
          usersIncluded: -1
        },
        payAsYouGoResources: {
          tokens: 0,
          forms: 0,
          dashboards: 0,
          users: 7
        }
      });

      const limits = await UserSessionService.getPackageLimits(mockDirector);
      
      expect(limits.maxTokens).toBe(300000);
      expect(limits.maxForms).toBe(-1);
      expect(limits.maxDashboards).toBe(-1);
      expect(limits.maxUsers).toBe(-1);
    });

    test('should return zero limits for employee without director access', async () => {
      const mockEmployee: User = {
        id: 'test-employee-1',
        name: 'Test Employee',
        email: 'employee@test.com',
        role: 'employe',
        agencyId: 'test-agency-1',
        hasDirectorDashboardAccess: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetActiveSession.mockResolvedValue(null);

      const limits = await UserSessionService.getPackageLimits(mockEmployee);
      
      expect(limits.maxTokens).toBe(0);
      expect(limits.maxForms).toBe(0);
      expect(limits.maxDashboards).toBe(0);
      expect(limits.maxUsers).toBe(0);
    });

    test('should handle director without subscription session', async () => {
      const mockDirectorNoSession: User = {
        id: 'test-director-2',
        name: 'Test Director No Session',
        email: 'director2@test.com',
        role: 'directeur',
        agencyId: 'test-agency-2',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetActiveSession.mockResolvedValue(null);

      const limits = await UserSessionService.getPackageLimits(mockDirectorNoSession);
      
      expect(limits.maxTokens).toBe(0);
      expect(limits.maxForms).toBe(0);
      expect(limits.maxDashboards).toBe(0);
      expect(limits.maxUsers).toBe(0);
    });

    test('should include pay-as-you-go resources in limits', async () => {
      const mockDirectorWithPayAsYouGo: User = {
        id: 'test-director-3',
        name: 'Test Director PayAsYouGo',
        email: 'director3@test.com',
        role: 'directeur',
        agencyId: 'test-agency-3',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetActiveSession.mockResolvedValue({
        id: 'session-2',
        packageType: 'starter',
        isActive: true,
        packageResources: {
          tokensIncluded: 300000,
          formsIncluded: 4,
          dashboardsIncluded: 1,
          usersIncluded: 3
        },
        payAsYouGoResources: {
          tokens: 200,
          forms: 3,
          dashboards: 1,
          users: 2
        }
      });

      const limits = await UserSessionService.getPackageLimits(mockDirectorWithPayAsYouGo);
      
      expect(limits.maxTokens).toBe(100200);
      expect(limits.maxForms).toBe(7);
      expect(limits.maxDashboards).toBe(2);
      expect(limits.maxUsers).toBe(-1);
    });
  });
});

