import React, { createContext, useContext, useState, useEffect } from 'react';
import { signOut, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';
import { signup } from '../auth/services/signupService';
import { login, loginWithGoogle } from '../auth/services/loginService';
import { authStateService, AuthStateCallbacks } from '../auth/services/authStateService';
import { sanitizeSensitiveErrorMessage } from '../utils/errorSanitizer';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (email: string, password: string, name: string, role: 'admin' | 'directeur' | 'employe', agencyId: string) => Promise<{ success: boolean; error?: string; action?: 'login' | 'recover'; universCreated?: boolean; directorInfo?: { id: string; name: string; email: string } }>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateTokensLocally: (tokensUsed: number) => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [firestoreErrorCount] = useState(0);
  const [firestoreDisabled] = useState(false);
  const [firestoreCircuitBreaker, setFirestoreCircuitBreaker] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Initialize Firestore readiness with more robust testing
  useEffect(() => {
    const initFirestore = async () => {
      try {
        // Wait longer for Firestore to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test Firestore connection with a simple operation
        try {
          const testDoc = doc(db, '_test', 'connection');
          await getDoc(testDoc);
        } catch {
          // Even if test fails, we can still proceed
        }
        
        setFirestoreReady(true);
        // Reset circuit breaker on successful initialization
        setFirestoreCircuitBreaker(false);
      } catch (error) {
        console.error('Firestore initialization failed:', error);
        // Still allow app to continue after a delay
        setTimeout(() => setFirestoreReady(true), 3000);
      }
    };
    
    initFirestore();
  }, []);

  // Global error handler for Firebase errors with graceful degradation
  useEffect(() => {
    const handleFirebaseError = (event: ErrorEvent) => {
      if (event.error && event.error.message && 
          (event.error.message.includes('INTERNAL ASSERTION FAILED') || 
           event.error.message.includes('Firestore') ||
           event.error.message.includes('Firebase'))) {
        
        console.warn('🔥 [AuthContext] Firebase error detected, using graceful degradation');
        
        // Use cached data instead of failing
        const cached = localStorage.getItem('ubora_cached_user');
        if (cached) {
          try {
            const userData = JSON.parse(cached);
            setUser(userData);
            console.info('🔥 [AuthContext] Using cached user data due to Firebase error');
          } catch (e) {
            console.warn('🔥 [AuthContext] Failed to parse cached user data');
          }
        }
        
        // Prevent the error from crashing the app
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleFirebaseError);
    return () => window.removeEventListener('error', handleFirebaseError);
  }, []);

  // Initialize authStateService when Firestore is ready
  useEffect(() => {
    if (!firestoreReady) return;

    const callbacks: AuthStateCallbacks = {
      onUserLoaded: (loadedUser, loadedFirebaseUser) => {
        setUser(loadedUser);
        setFirebaseUser(loadedFirebaseUser);
        // Start listening to user document changes
        authStateService.startUserSnapshot(loadedFirebaseUser);
      },
      onUserUpdated: (updatedUser) => {
        setUser(updatedUser);
      },
      onUserSignedOut: () => {
        setUser(null);
        setFirebaseUser(null);
        authStateService.stopUserSnapshot();
      },
      onError: (errorMessage) => {
        setError(errorMessage);
      },
      onLoadingChange: (loading) => {
        setIsLoading(loading);
      }
    };

    authStateService.initialize(callbacks, {
      firestoreReady,
      firestoreDisabled,
      firestoreCircuitBreaker,
      firestoreErrorCount,
      isRegistering
    });

    // Cleanup on unmount
    return () => {
      authStateService.cleanup();
    };
  }, [firestoreReady, firestoreDisabled, firestoreCircuitBreaker, firestoreErrorCount, isRegistering]);

  // Update authStateService when isRegistering changes
  useEffect(() => {
    authStateService.updateOptions({ isRegistering });
  }, [isRegistering]);

  // Fonction de connexion avec email/mot de passe
  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const result = await login({ email, password });
      
      if (result.success && result.user && result.firebaseUser) {
        setUser(result.user);
        setFirebaseUser(result.firebaseUser);
        authStateService.startUserSnapshot(result.firebaseUser);
        return true;
      } else {
        setError(result.error || 'Erreur de connexion');
        return false;
      }
    } catch (err: any) {
      console.error('Erreur de connexion:', err);
      setError('Une erreur est survenue lors de la connexion');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de connexion avec Google
  const handleLoginWithGoogle = async (): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const result = await loginWithGoogle();
      
      if (result.success && result.user && result.firebaseUser) {
        setUser(result.user);
        setFirebaseUser(result.firebaseUser);
        authStateService.startUserSnapshot(result.firebaseUser);
        return true;
      } else {
        setError(result.error || 'Erreur de connexion Google');
        return false;
      }
    } catch (err: any) {
      console.error('Erreur de connexion Google:', err);
      setError('Une erreur est survenue lors de la connexion Google');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction d'inscription
  const handleRegister = async (
    email: string,
    password: string,
    name: string,
    role: 'admin' | 'directeur' | 'employe',
    agencyId: string
  ): Promise<{ success: boolean; error?: string; action?: 'login' | 'recover'; universCreated?: boolean; directorInfo?: { id: string; name: string; email: string } }> => {
    try {
      setError(null);
      setIsLoading(true);
      setIsRegistering(true); // Activer le flag pour éviter les race conditions
      
      const result = await signup({
        email,
        password,
        name,
        role,
        agencyId
      });
      
      if (result.success) {
        // Attendre un court délai pour que le document Firestore soit écrit
        // puis forcer le chargement de l'utilisateur avec retry
        const attemptLoadUser = async (retryCount = 0) => {
          const currentFirebaseUser = auth.currentUser;
          if (currentFirebaseUser) {
            console.log(`🔄 [AuthContext] Force loading user after successful signup (attempt ${retryCount + 1})`);
            try {
              await authStateService.forceLoadUserAfterSignup(currentFirebaseUser);
              // Désactiver isRegistering après le chargement
              setIsRegistering(false);
            } catch (err) {
              console.error('❌ [AuthContext] Error loading user after signup:', err);
              // Retry après 1 seconde si moins de 3 tentatives
              if (retryCount < 2) {
                setTimeout(() => attemptLoadUser(retryCount + 1), 1000);
              } else {
                setIsRegistering(false);
                setError('Erreur lors du chargement du profil. Veuillez rafraîchir la page.');
              }
            }
          } else {
            console.warn('⚠️ [AuthContext] No Firebase user found after signup');
            setIsRegistering(false);
          }
        };
        
        // Premier essai après 500ms
        setTimeout(() => attemptLoadUser(), 500);
        
        return {
          success: true,
          universCreated: result.universCreated
        };
      } else {
        setIsRegistering(false); // Désactiver le flag en cas d'erreur
        setError(result.error || 'Erreur lors de l\'inscription');
        return {
          success: false,
          error: result.error,
          action: result.action,
          directorInfo: result.directorInfo
        };
      }
    } catch (err: any) {
      console.error('❌ Erreur d\'inscription:', err);
      setIsRegistering(false); // Désactiver le flag en cas d'erreur
      setError('Une erreur est survenue lors de l\'inscription');
      return {
        success: false,
        error: 'Une erreur est survenue lors de l\'inscription'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Désactiver isRegistering après que l'utilisateur soit chargé
  useEffect(() => {
    if (user && isRegistering) {
      // Attendre un peu pour s'assurer que tout est chargé
      const timer = setTimeout(() => {
        setIsRegistering(false);
        console.log('✅ [AuthContext] isRegistering désactivé après chargement utilisateur');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user, isRegistering]);

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err: any) {
      console.error('Erreur de réinitialisation du mot de passe:', err);
      setError(sanitizeSensitiveErrorMessage(err?.message || 'Erreur lors de la réinitialisation du mot de passe'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      authStateService.stopUserSnapshot();
      try { sessionStorage.removeItem('show_welcome_after_login'); } catch {}
    } catch (err) {
      console.error('Erreur de déconnexion:', err);
    }
  };

  const refreshUserData = async (): Promise<void> => {
    if (!firebaseUser) {
      return;
    }

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<User, 'id'>;
        
        // Vérifier l'approbation pour les employés
        if (userData.role === 'employe' && userData.isApproved === false) {
          setUser({
            id: firebaseUser.uid,
            ...userData
          });
          return;
        }
        
        // Only update if there are actual changes to prevent unnecessary rerenders
        const newUser = {
          id: firebaseUser.uid,
          ...userData
        };
        
        // Check if user data has actually changed
        if (user && 
            user.payAsYouGoTokens === userData.payAsYouGoTokens &&
            user.role === userData.role) {
          return;
        }
        
        setUser(newUser);
      } else {
        console.error('❌ AUTH: User document not found');
      }
    } catch (err) {
      console.error('❌ AUTH: Erreur lors du rafraîchissement des données utilisateur:', err);
    }
  };

  const updateTokensLocally = (_tokensUsed: number): void => {
    // Note: Cette fonction n'est plus utilisée pour les directeurs
    // Les tokens sont maintenant gérés dans subscriptionSessions
    // Conservée pour compatibilité avec l'ancien système si nécessaire
    if (!user) {
      return;
    }

    // Pour les directeurs, les tokens sont gérés dans subscriptionSessions
    // Cette fonction ne devrait plus être appelée pour les directeurs
    if (user.role === 'directeur') {
      console.warn('⚠️ updateTokensLocally called for director - tokens should be managed in subscriptionSessions');
      return;
    }

    console.warn('updateTokensLocally est obsolète - les tokens sont gérés via subscriptionSessions');
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      login: handleLogin,
      loginWithGoogle: handleLoginWithGoogle,
      register: handleRegister,
      resetPassword,
      logout,
      refreshUserData,
      updateTokensLocally,
      isLoading,
      error
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

