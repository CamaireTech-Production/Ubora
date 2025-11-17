import { describe, test, expect, vi, beforeEach } from 'vitest'
import { UserSessionService } from '../services/userSessionService'
import { User } from '../types'

const mockGetActiveSession = vi.fn()

vi.mock('@ubora/shared/services/subscriptionSessionCollectionService', () => ({
  SubscriptionSessionCollectionService: {
    getActiveSession: mockGetActiveSession
  }
}))

describe('UserSessionService - getPackageLimits', () => {
  beforeEach(() => {
    // Clear any mocks before each test
    vi.clearAllMocks()
    mockGetActiveSession.mockReset()
  })

  test('should return correct package limits for standard package director', async () => {
    // Arrange: Create a mock director user with standard package
    const mockDirector: User = {
      id: 'test-director-1',
      name: 'Test Director',
      email: 'director@test.com',
      role: 'directeur',
      agencyId: 'test-agency-1',
      createdAt: new Date(),
      updatedAt: new Date()
    }

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
    })

    // Act: Call the function we're testing
    const limits = await UserSessionService.getPackageLimits(mockDirector)
    
    // Assert: Verify the results match expected values from PACKAGE_LIMITS
    // Standard package: unlimited forms/dashboards, 7 users, 600k tokens
    expect(limits.maxTokens).toBe(600000) // From PACKAGE_LIMITS.standard.monthlyTokens
    expect(limits.maxForms).toBe(-1)      // Unlimited from PACKAGE_LIMITS.standard.maxForms
    expect(limits.maxDashboards).toBe(-1) // Unlimited from PACKAGE_LIMITS.standard.maxDashboards
    expect(limits.maxUsers).toBe(7)       // From PACKAGE_LIMITS.standard.maxUsers
  })

  test('should return zero limits for employee without director access', async () => {
    // Arrange: Create a mock employee user without director access
    const mockEmployee: User = {
      id: 'test-employee-1',
      name: 'Test Employee',
      email: 'employee@test.com',
      role: 'employe',
      agencyId: 'test-agency-1',
      hasDirectorDashboardAccess: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockGetActiveSession.mockResolvedValue(null)

    // Act: Call the function we're testing
    const limits = await UserSessionService.getPackageLimits(mockEmployee)
    
    // Assert: Verify the results are zero (no package access)
    expect(limits.maxTokens).toBe(0)
    expect(limits.maxForms).toBe(0)
    expect(limits.maxDashboards).toBe(0)
    expect(limits.maxUsers).toBe(0)
  })

  test('should handle director without subscription session', async () => {
    // Arrange: Create a director without any subscription sessions
    const mockDirectorNoSession: User = {
      id: 'test-director-2',
      name: 'Test Director No Session',
      email: 'director2@test.com',
      role: 'directeur',
      agencyId: 'test-agency-2',
      // No subscriptionSessions array
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Act: Call the function we're testing
    mockGetActiveSession.mockResolvedValue(null)

    const limits = await UserSessionService.getPackageLimits(mockDirectorNoSession)
    
    // Assert: Verify the results are zero (no active session)
    expect(limits.maxTokens).toBe(0)
    expect(limits.maxForms).toBe(0)
    expect(limits.maxDashboards).toBe(0)
    expect(limits.maxUsers).toBe(0)
  })

  test('should include pay-as-you-go resources in limits', async () => {
    // Arrange: Create a director with both package and pay-as-you-go resources
    const mockDirectorWithPayAsYouGo: User = {
      id: 'test-director-3',
      name: 'Test Director PayAsYouGo',
      email: 'director3@test.com',
      role: 'directeur',
      agencyId: 'test-agency-3',
      createdAt: new Date(),
      updatedAt: new Date()
    }

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
    })

    // Act: Call the function we're testing
    const limits = await UserSessionService.getPackageLimits(mockDirectorWithPayAsYouGo)
    
    // Assert: Verify pay-as-you-go resources are added to package limits
    // Starter package: 4 forms, 1 dashboard, 3 users, 300k tokens + pay-as-you-go
    expect(limits.maxTokens).toBe(300200) // 300000 + 200
    expect(limits.maxForms).toBe(7)       // 4 + 3
    expect(limits.maxDashboards).toBe(2)  // 1 + 1
    expect(limits.maxUsers).toBe(5)       // 3 + 2
  })
})
