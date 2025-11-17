import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WelcomeScreen } from '../components/core/WelcomeScreen';
import { useAuth } from '@ubora/shared/contexts/AuthContext';
import { useApp } from '@ubora/shared/contexts/AppContext';
import { usePackageAccess } from '@ubora/shared/hooks/usePackageAccess';

// Mock the hooks
vi.mock('@ubora/shared/contexts/AuthContext');
vi.mock('@ubora/shared/contexts/AppContext');
vi.mock('@ubora/shared/hooks/usePackageAccess');

const mockUseAuth = useAuth as any;
const mockUseApp = useApp as any;
const mockUsePackageAccess = usePackageAccess as any;

describe('WelcomeScreen Package Restrictions', () => {
  const mockOnContinue = vi.fn();
  
  const defaultUser = {
    id: 'director-1',
    name: 'Test Director',
    email: 'director@test.com',
    role: 'directeur' as const,
    agencyId: 'agency-1',
    isApproved: true,
    hasDirectorDashboardAccess: false
  };

  const defaultEmployees = [
    { id: 'emp-1', name: 'Employee 1', role: 'employe' as const, agencyId: 'agency-1', isApproved: true },
    { id: 'emp-2', name: 'Employee 2', role: 'employe' as const, agencyId: 'agency-1', isApproved: true }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: defaultUser,
      firebaseUser: null,
      isLoading: false,
      error: null,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUserData: vi.fn(),
      checkAgencyUserLimit: vi.fn()
    });

    mockUseApp.mockReturnValue({
      forms: [],
      formEntries: [],
      employees: defaultEmployees,
      dashboards: [],
      createForm: vi.fn(),
      updateForm: vi.fn(),
      submitFormEntry: vi.fn(),
      updateFormEntry: vi.fn(),
      submitMultipleFormEntries: vi.fn(),
      deleteForm: vi.fn(),
      getFormsForEmployee: vi.fn(),
      getEntriesForForm: vi.fn(),
      getEntriesForEmployee: vi.fn(),
      getEmployeesForAgency: vi.fn(),
      getPendingEmployees: vi.fn(),
      refreshData: vi.fn(),
      createDashboard: vi.fn(),
      updateDashboard: vi.fn(),
      deleteDashboard: vi.fn(),
      getDashboardsForDirector: vi.fn(),
      getDraftsForForm: vi.fn(),
      saveDraft: vi.fn(),
      deleteDraft: vi.fn(),
      deleteDraftsForForm: vi.fn(),
      createDraft: vi.fn(),
      isLoading: false,
      error: null
    });
  });

  it('should show invite modal when user can add more users', async () => {
    // Mock package access - user can add more users (2 current, 5 max)
    mockUsePackageAccess.mockReturnValue({
      canAddUser: vi.fn().mockReturnValue(true),
      getLimit: vi.fn().mockReturnValue(5),
      getPayAsYouGoCapacity: vi.fn().mockReturnValue(0),
      packageType: 'starter',
      hasFeature: vi.fn(),
      checkLimit: vi.fn(),
      isLimitUnlimited: vi.fn(),
      getPackageType: vi.fn(),
      isLoadingDirectorInfo: false,
      canCreateForm: vi.fn(),
      canCreateDashboard: vi.fn(),
      getMonthlyTokens: vi.fn(),
      hasUnlimitedTokens: vi.fn(),
      canUseAdvancedAI: vi.fn(),
      canUseCustomBranding: vi.fn(),
      canUseCustomIntegrations: vi.fn(),
      getAdditionalUserCost: vi.fn(),
      getTotalLimit: vi.fn(),
      user: defaultUser,
      packageInfo: null
    });

    render(
      <WelcomeScreen
        userName="Test Director"
        onContinue={mockOnContinue}
        show={true}
      />
    );

    // Find and click the invite button (get the button element specifically)
    const inviteButton = screen.getByRole('button', { name: 'Inviter des collaborateurs' });
    fireEvent.click(inviteButton);

    // Should show invite modal
    await waitFor(() => {
      expect(screen.getByText('Partagez ce lien pour permettre à vos collaborateurs de créer un compte employé dans votre agence.')).toBeInTheDocument();
    });
  });

  it('should show user limit modal when user cannot add more users', async () => {
    // Mock package access - user cannot add more users (5 current, 5 max)
    const employeesAtLimit = Array.from({ length: 5 }, (_, i) => ({
      id: `emp-${i + 1}`,
      name: `Employee ${i + 1}`,
      role: 'employe' as const,
      agencyId: 'agency-1',
      isApproved: true
    }));

    mockUseApp.mockReturnValue({
      ...mockUseApp(),
      employees: employeesAtLimit
    });

    mockUsePackageAccess.mockReturnValue({
      canAddUser: vi.fn().mockReturnValue(false),
      getLimit: vi.fn().mockReturnValue(5),
      getPayAsYouGoCapacity: vi.fn().mockReturnValue(0),
      packageType: 'starter',
      hasFeature: vi.fn(),
      checkLimit: vi.fn(),
      isLimitUnlimited: vi.fn(),
      getPackageType: vi.fn(),
      isLoadingDirectorInfo: false,
      canCreateForm: vi.fn(),
      canCreateDashboard: vi.fn(),
      getMonthlyTokens: vi.fn(),
      hasUnlimitedTokens: vi.fn(),
      canUseAdvancedAI: vi.fn(),
      canUseCustomBranding: vi.fn(),
      canUseCustomIntegrations: vi.fn(),
      getAdditionalUserCost: vi.fn(),
      getTotalLimit: vi.fn(),
      user: defaultUser,
      packageInfo: null
    });

    render(
      <WelcomeScreen
        userName="Test Director"
        onContinue={mockOnContinue}
        show={true}
      />
    );

    // Find and click the invite button
    const inviteButton = screen.getByRole('button', { name: 'Inviter des collaborateurs' });
    fireEvent.click(inviteButton);

    // Should show user limit modal
    await waitFor(() => {
      expect(screen.getByText('Limite d\'utilisateurs atteinte')).toBeInTheDocument();
      expect(screen.getByText('Vous ne pouvez pas inviter plus d\'utilisateurs avec votre package actuel')).toBeInTheDocument();
    });
  });

  it('should disable invite button when user limit is reached', () => {
    // Mock package access - user cannot add more users
    mockUsePackageAccess.mockReturnValue({
      canAddUser: vi.fn().mockReturnValue(false),
      getLimit: vi.fn().mockReturnValue(2),
      getPayAsYouGoCapacity: vi.fn().mockReturnValue(0),
      packageType: 'starter',
      hasFeature: vi.fn(),
      checkLimit: vi.fn(),
      isLimitUnlimited: vi.fn(),
      getPackageType: vi.fn(),
      isLoadingDirectorInfo: false,
      canCreateForm: vi.fn(),
      canCreateDashboard: vi.fn(),
      getMonthlyTokens: vi.fn(),
      hasUnlimitedTokens: vi.fn(),
      canUseAdvancedAI: vi.fn(),
      canUseCustomBranding: vi.fn(),
      canUseCustomIntegrations: vi.fn(),
      getAdditionalUserCost: vi.fn(),
      getTotalLimit: vi.fn(),
      user: defaultUser,
      packageInfo: null
    });

    render(
      <WelcomeScreen
        userName="Test Director"
        onContinue={mockOnContinue}
        show={true}
      />
    );

    // Find the invite button
    const inviteButton = screen.getByRole('button', { name: 'Inviter des collaborateurs' });
    
    // Should be disabled
    expect(inviteButton).toHaveAttribute('disabled');
    expect(inviteButton).toHaveClass('cursor-not-allowed');
  });

  it('should handle unlimited users package correctly', async () => {
    // Mock package access - unlimited users
    mockUsePackageAccess.mockReturnValue({
      canAddUser: vi.fn().mockReturnValue(true),
      getLimit: vi.fn().mockReturnValue(-1), // -1 means unlimited
      getPayAsYouGoCapacity: vi.fn().mockReturnValue(0),
      packageType: 'premium',
      hasFeature: vi.fn(),
      checkLimit: vi.fn(),
      isLimitUnlimited: vi.fn(),
      getPackageType: vi.fn(),
      isLoadingDirectorInfo: false,
      canCreateForm: vi.fn(),
      canCreateDashboard: vi.fn(),
      getMonthlyTokens: vi.fn(),
      hasUnlimitedTokens: vi.fn(),
      canUseAdvancedAI: vi.fn(),
      canUseCustomBranding: vi.fn(),
      canUseCustomIntegrations: vi.fn(),
      getAdditionalUserCost: vi.fn(),
      getTotalLimit: vi.fn(),
      user: defaultUser,
      packageInfo: null
    });

    render(
      <WelcomeScreen
        userName="Test Director"
        onContinue={mockOnContinue}
        show={true}
      />
    );

    // Find and click the invite button
    const inviteButton = screen.getByRole('button', { name: 'Inviter des collaborateurs' });
    fireEvent.click(inviteButton);

    // Should show invite modal (not limit modal)
    await waitFor(() => {
      expect(screen.getByText('Partagez ce lien pour permettre à vos collaborateurs de créer un compte employé dans votre agence.')).toBeInTheDocument();
      expect(screen.queryByText('Limite d\'utilisateurs atteinte')).not.toBeInTheDocument();
    });
  });
});
