import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePackageAccess } from '../packages/usePackageAccess';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useTokenStats } from '../core/useTokenStats';
import { UserSessionService } from '../../services/core/userSessionService';

// Mock dependencies
vi.mock('@ubora/shared/contexts/AuthContext');
vi.mock('../core/useTokenStats');
vi.mock('../../services/core/userSessionService');
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseTokenStats = vi.mocked(useTokenStats);
const mockUserSessionService = vi.mocked(UserSessionService);

describe('usePackageAccess', () => {
  const mockUser = {
    id: 'test-user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'directeur' as const,
    agencyId: 'test-agency-1',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockPackageInfo = {
    packageType: 'standard' as const,
    packageFeatures: ['unlimitedForms', 'unlimitedDashboards'],
    subscriptionStartDate: new Date(),
    subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subscriptionStatus: 'active' as const,
    daysRemaining: 30,
    packageTokens: 300000,
    packageForms: -1,
    packageDashboards: -1,
    packageUsers: -1,
    payAsYouGoTokens: 0,
    payAsYouGoForms: 0,
    payAsYouGoDashboards: 0,
    payAsYouGoUsers: 0,
    totalTokens: 300000,
    totalForms: -1,
    totalDashboards: -1,
    totalUsers: -1,
    tokensUsed: 50000,
    formsCreated: 10,
    dashboardsCreated: 5,
    usersAdded: 3,
    tokensRemaining: 250000,
    formsRemaining: -1,
    dashboardsRemaining: -1,
    usersRemaining: -1,
    amountPaid: 50000,
    sessionType: 'subscription'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      firebaseUser: null,
      isLoading: false,
      logout: vi.fn(),
      refreshUserData: vi.fn(),
      login: vi.fn(),
      signInWithEmailAndPassword: vi.fn(),
      signInWithGoogle: vi.fn(),
    });
    mockUseTokenStats.mockReturnValue(null);
    mockUserSessionService.getUserPackageInfo = vi.fn().mockResolvedValue(mockPackageInfo);
  });

  test('should return package access information for director', async () => {
    const { result } = renderHook(() => usePackageAccess());

    await waitFor(() => {
      expect(result.current.packageInfo).toBeTruthy();
    });

    expect(result.current.packageType).toBe('standard');
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.hasFeature).toBeDefined();
    expect(result.current.getLimit).toBeDefined();
    expect(result.current.checkLimit).toBeDefined();
  });

  test('should check if user can create form', async () => {
    const { result } = renderHook(() => usePackageAccess());

    await waitFor(() => {
      expect(result.current.packageInfo).toBeTruthy();
    });

    // With unlimited forms, should always return true
    const canCreate = result.current.canCreateForm(100);
    expect(canCreate).toBe(true);
  });

  test('should check if user can create dashboard', async () => {
    const { result } = renderHook(() => usePackageAccess());

    await waitFor(() => {
      expect(result.current.packageInfo).toBeTruthy();
    });

    // With unlimited dashboards, should always return true
    const canCreate = result.current.canCreateDashboard(50);
    expect(canCreate).toBe(true);
  });

  test('should check if user can add user', async () => {
    const { result } = renderHook(() => usePackageAccess());

    await waitFor(() => {
      expect(result.current.packageInfo).toBeTruthy();
    });

    // With unlimited users, should always return true
    const canAdd = result.current.canAddUser(100);
    expect(canAdd).toBe(true);
  });

  test('should return correct limit values', async () => {
    const { result } = renderHook(() => usePackageAccess());

    await waitFor(() => {
      expect(result.current.packageInfo).toBeTruthy();
    });

    expect(result.current.getLimit('maxForms')).toBe(-1);
    expect(result.current.getLimit('maxDashboards')).toBe(-1);
    expect(result.current.getLimit('maxUsers')).toBe(-1);
    expect(result.current.getLimit('monthlyTokens')).toBe(300000);
  });

  test('should check if limit is unlimited', async () => {
    const { result } = renderHook(() => usePackageAccess());

    await waitFor(() => {
      expect(result.current.packageInfo).toBeTruthy();
    });

    expect(result.current.isLimitUnlimited('maxForms')).toBe(true);
    expect(result.current.isLimitUnlimited('maxDashboards')).toBe(true);
    expect(result.current.isLimitUnlimited('maxUsers')).toBe(true);
    expect(result.current.isLimitUnlimited('monthlyTokens')).toBe(false);
  });

  test('should return monthly tokens', async () => {
    const { result } = renderHook(() => usePackageAccess());

    await waitFor(() => {
      expect(result.current.packageInfo).toBeTruthy();
    });

    expect(result.current.getMonthlyTokens()).toBe(300000);
    expect(result.current.hasUnlimitedTokens()).toBe(false);
  });

  test('should handle employee without director access', () => {
    const mockEmployee = {
      ...mockUser,
      role: 'employe' as const,
      hasDirectorDashboardAccess: false
    };

    mockUseAuth.mockReturnValue({
      user: mockEmployee,
      firebaseUser: null,
      isLoading: false,
      logout: vi.fn(),
      refreshUserData: vi.fn(),
      login: vi.fn(),
      signInWithEmailAndPassword: vi.fn(),
      signInWithGoogle: vi.fn(),
    });

    mockUserSessionService.getUserPackageInfo = vi.fn().mockResolvedValue({
      ...mockPackageInfo,
      packageType: null,
      subscriptionStatus: 'expired' as const,
      totalTokens: 0,
      totalForms: 0,
      totalDashboards: 0,
      totalUsers: 0,
    });

    const { result } = renderHook(() => usePackageAccess());

    expect(result.current.packageType).toBeNull();
    expect(result.current.getLimit('maxForms')).toBe(0);
  });
});

