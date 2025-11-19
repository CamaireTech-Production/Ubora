import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@ubora/shared/contexts/AuthContext'
import { User } from '../types'

// Mock Firebase Auth
const mockSignInWithEmailAndPassword = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChanged = vi.fn()
const mockCreateUserWithEmailAndPassword = vi.fn()
const mockSignInWithPopup = vi.fn()

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  signInWithPopup: mockSignInWithPopup,
  GoogleAuthProvider: vi.fn()
}))

// Mock Firebase Firestore
const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockOnSnapshot = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  onSnapshot: mockOnSnapshot,
  serverTimestamp: vi.fn(() => new Date()),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn()
}))

// Mock Firebase Config
vi.mock('../firebaseConfig', () => ({
  auth: {},
  db: {},
  storage: {}
}))

describe('🔍 AuthContext - Bug Detection & Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset all mocks to default behavior
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'test-uid' } })
    mockSignOut.mockResolvedValue(undefined)
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'test-uid' } })
    mockSignInWithPopup.mockResolvedValue({ user: { uid: 'test-uid' } })
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) })
    mockSetDoc.mockResolvedValue(undefined)
    mockOnSnapshot.mockReturnValue(() => {})
    mockOnAuthStateChanged.mockReturnValue(() => {})
  })

  // 🚨 SECURITY TESTS - Authentication bypasses and vulnerabilities
  describe('🚨 Security Vulnerabilities', () => {
    test('SECURITY: Should not allow login with empty credentials', async () => {
      // BUG DETECTION: Can we login with empty credentials?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Attempt login with empty credentials
      await act(async () => {
        const success = await result.current.login('', '')
        expect(success).toBe(false)
      })

      // Should not call Firebase with empty credentials
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled()
    })

    test('SECURITY: Should not allow login with SQL injection attempts', async () => {
      // BUG DETECTION: Can we bypass authentication with SQL injection?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      const sqlInjectionAttempts = [
        "admin'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin'/**/OR/**/1=1#",
        "'; EXEC xp_cmdshell('dir'); --"
      ]

      for (const injection of sqlInjectionAttempts) {
        await act(async () => {
          const success = await result.current.login(injection, 'password')
          expect(success).toBe(false)
        })
      }

      // Should not call Firebase with injection attempts
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled()
    })

    test('SECURITY: Should not allow registration with malicious data', async () => {
      // BUG DETECTION: Can we register with malicious data?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      const maliciousData = [
        { email: '<script>alert("xss")</script>', name: 'XSS Test', role: 'directeur' as const, agencyId: 'test' },
        { email: 'test@test.com', name: '<img src=x onerror=alert(1)>', role: 'directeur' as const, agencyId: 'test' },
        { email: 'test@test.com', name: 'Normal User', role: 'directeur' as const, agencyId: '<script>alert("xss")</script>' }
      ]

      for (const data of maliciousData) {
        await act(async () => {
          const success = await result.current.register(
            data.email,
            'password123',
            data.name,
            data.role,
            data.agencyId
          )
          // Should fail or sanitize the data
          expect(success).toBe(false)
        })
      }
    })

    test('SECURITY: Should not expose user data in error messages', async () => {
      // BUG DETECTION: Do error messages leak sensitive information?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Mock Firebase to return error
      mockSignInWithEmailAndPassword.mockRejectedValueOnce({
        code: 'auth/user-not-found',
        message: 'No user record found for email test@example.com'
      })

      await act(async () => {
        const success = await result.current.login('test@example.com', 'wrongpassword')
        expect(success).toBe(false)
      })

      // Check if error message is user-friendly and doesn't leak info
      expect(result.current.error).not.toContain('test@example.com')
      expect(result.current.error).not.toContain('No user record found')
    })

    test('SECURITY: Should handle Firebase connection failures gracefully', async () => {
      // BUG DETECTION: What happens when Firebase is down?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Mock Firebase connection failure
      mockSignInWithEmailAndPassword.mockRejectedValueOnce({
        code: 'auth/network-request-failed',
        message: 'Network error'
      })

      await act(async () => {
        const success = await result.current.login('test@test.com', 'password')
        expect(success).toBe(false)
      })

      // Should provide user-friendly error message
      expect(result.current.error).toBeTruthy()
      expect(result.current.error).not.toContain('Network error')
    })
  })

  // 🔶 FUNCTIONAL ANOMALIES - Test edge cases and error conditions
  describe('🔶 Functional Anomalies', () => {
    test('FUNCTIONAL: Should handle corrupted user document gracefully', async () => {
      // BUG DETECTION: What happens with corrupted user data?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Mock corrupted user document
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          // Missing required fields
          name: null,
          email: undefined,
          role: 'invalid-role',
          agencyId: '',
          // Corrupted data
          createdAt: 'invalid-date',
          updatedAt: null
        })
      })

      // Simulate auth state change with corrupted user
      await act(async () => {
        mockOnAuthStateChanged.mock.calls[0][0]({ uid: 'test-uid' })
      })

      // Should handle corrupted data without crashing
      expect(result.current.user).toBeNull()
      expect(result.current.error).toBeTruthy()
    })

    test('FUNCTIONAL: Should handle rapid login/logout cycles', async () => {
      // BUG DETECTION: Can rapid auth changes cause issues?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Rapid login/logout cycles
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await result.current.login('test@test.com', 'password')
        })
        
        await act(async () => {
          await result.current.logout()
        })
      }

      // Should handle rapid cycles without issues
      expect(result.current.user).toBeNull()
    })

    test('FUNCTIONAL: Should handle concurrent login attempts', async () => {
      // BUG DETECTION: Can concurrent logins cause race conditions?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Start multiple concurrent login attempts
      const loginPromises = Array.from({ length: 5 }, () =>
        act(async () => {
          return await result.current.login('test@test.com', 'password')
        })
      )

      const results = await Promise.all(loginPromises)

      // Should handle concurrent attempts gracefully
      expect(results.every(success => typeof success === 'boolean')).toBe(true)
    })

    test('FUNCTIONAL: Should handle Firestore permission errors', async () => {
      // BUG DETECTION: What happens with Firestore permission errors?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Mock Firestore permission error
      mockGetDoc.mockRejectedValueOnce({
        code: 'permission-denied',
        message: 'Missing or insufficient permissions'
      })

      await act(async () => {
        const success = await result.current.login('test@test.com', 'password')
        expect(success).toBe(false)
      })

      // Should handle permission errors gracefully
      expect(result.current.error).toBeTruthy()
      expect(result.current.error).not.toContain('permission-denied')
    })
  })

  // 🔵 BEST PRACTICE VIOLATIONS - Test code quality and standards
  describe('🔵 Best Practice Violations', () => {
    test('BEST_PRACTICE: Should validate email format before sending to Firebase', async () => {
      // BUG DETECTION: Are emails validated before Firebase calls?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      const invalidEmails = [
        'not-an-email',
        'test@',
        '@test.com',
        'test..test@test.com',
        'test@test..com',
        'test@test.com.',
        'test@test.com ',
        ' test@test.com'
      ]

      for (const email of invalidEmails) {
        await act(async () => {
          const success = await result.current.login(email, 'password')
          expect(success).toBe(false)
        })
      }

      // Should not call Firebase with invalid emails
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled()
    })

    test('BEST_PRACTICE: Should validate password strength', async () => {
      // BUG DETECTION: Are passwords validated for strength?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'qwerty',
        'abc',
        '',
        'a'.repeat(1000) // Too long
      ]

      for (const password of weakPasswords) {
        await act(async () => {
          const success = await result.current.register(
            'test@test.com',
            password,
            'Test User',
            'directeur',
            'test-agency'
          )
          // Should reject weak passwords
          expect(success).toBe(false)
        })
      }
    })

    test('BEST_PRACTICE: Should sanitize user input', async () => {
      // BUG DETECTION: Is user input properly sanitized?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      const maliciousInputs = [
        { name: 'Test<script>alert(1)</script>User', agencyId: 'test-agency' },
        { name: 'Test User', agencyId: 'test-agency<script>alert(1)</script>' },
        { name: 'Test\nUser', agencyId: 'test-agency' },
        { name: 'Test\tUser', agencyId: 'test-agency' },
        { name: 'Test User', agencyId: 'test-agency\0' }
      ]

      for (const input of maliciousInputs) {
        await act(async () => {
          const success = await result.current.register(
            'test@test.com',
            'password123',
            input.name,
            'directeur',
            input.agencyId
          )
          // Should sanitize or reject malicious input
          expect(success).toBe(false)
        })
      }
    })

    test('BEST_PRACTICE: Should handle loading states properly', async () => {
      // BUG DETECTION: Are loading states managed correctly?
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Mock slow Firebase response
      mockSignInWithEmailAndPassword.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve({ user: { uid: 'test-uid' } }), 100))
      )

      let loginPromise: Promise<boolean>
      await act(async () => {
        loginPromise = result.current.login('test@test.com', 'password')
        // Should be loading
        expect(result.current.isLoading).toBe(true)
      })

      await act(async () => {
        await loginPromise!
        // Should not be loading after completion
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  // 📊 PERFORMANCE & SCALABILITY TESTS
  describe('📊 Performance & Scalability', () => {
    test('PERFORMANCE: Should handle multiple rapid auth state changes', async () => {
      // BUG DETECTION: Performance with rapid auth changes
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      const startTime = performance.now()

      // Simulate rapid auth state changes
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          mockOnAuthStateChanged.mock.calls[0][0]({ uid: `user-${i}` })
        })
      }

      const endTime = performance.now()
      const executionTime = endTime - startTime

      console.log(`Execution time for 100 auth state changes: ${executionTime}ms`)
      
      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(1000) // Under 1 second
    })

    test('PERFORMANCE: Should not leak memory with repeated auth operations', async () => {
      // BUG DETECTION: Memory leaks in auth operations
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Perform many auth operations
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          await result.current.login('test@test.com', 'password')
          await result.current.logout()
        })
      }

      // Should not crash or have memory issues
      expect(result.current.user).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })
})
