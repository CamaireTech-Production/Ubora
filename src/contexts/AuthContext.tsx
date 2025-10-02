import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';
import { getPackageLimit, isUnlimited, PackageType } from '../config/packageFeatures';
import { AnalyticsService } from '../services/analyticsService';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (email: string, password: string, name: string, role: 'admin' | 'directeur' | 'employe', agencyId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour vérifier les limites d'utilisateurs d'une agence
  const checkAgencyUserLimit = async (agencyId: string): Promise<{ canAddUser: boolean; error?: string }> => {
    try {
      // Récupérer le directeur de l'agence pour connaître son package
      const directorsQuery = query(
        collection(db, 'users'),
        where('agencyId', '==', agencyId),
        where('role', '==', 'directeur')
      );
      
      const directorsSnapshot = await getDocs(directorsQuery);
      
      if (directorsSnapshot.empty) {
        return { canAddUser: false, error: 'Aucun directeur trouvé pour cette agence' };
      }
      
      const director = directorsSnapshot.docs[0].data() as User;
      const packageType = director.package as PackageType;
      
      if (!packageType) {
        return { canAddUser: false, error: 'Le directeur n\'a pas sélectionné de package' };
      }
      
      // Vérifier si le package a des utilisateurs illimités
      if (isUnlimited(packageType, 'maxUsers')) {
        return { canAddUser: true };
      }
      
      // Récupérer le nombre d'employés actuels (approuvés)
      const employeesQuery = query(
        collection(db, 'users'),
        where('agencyId', '==', agencyId),
        where('role', '==', 'employe'),
        where('isApproved', '!=', false) // Inclut les employés approuvés (true) et ceux en attente (undefined)
      );
      
      const employeesSnapshot = await getDocs(employeesQuery);
      const currentEmployeeCount = employeesSnapshot.size;
      
      // Récupérer la limite du package
      const maxUsers = getPackageLimit(packageType, 'maxUsers');
      
      // Vérifier les ressources pay-as-you-go
      const payAsYouGoUsers = director.payAsYouGoResources?.users || 0;
      const totalCapacity = maxUsers + payAsYouGoUsers;
      
      if (currentEmployeeCount >= totalCapacity) {
        return { 
          canAddUser: false, 
          error: 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.' 
        };
      }
      
      return { canAddUser: true };
    } catch (error: any) {
      console.error('Erreur lors de la vérification des limites:', error);
      
      // Handle specific Firebase permission errors
      if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
        return { 
          canAddUser: false, 
          error: 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.' 
        };
      }
      
      // For other errors, show a user-friendly message
      return { 
        canAddUser: false, 
        error: 'Limite d\'utilisateurs atteinte. Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.' 
      };
    }
  };


  // Écouter les changements d'authentification Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      setError(null);
      
      if (firebaseUser) {
        try {
          // Récupérer ou créer le document utilisateur
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          
          // Ajouter un timeout pour éviter les blocages
          const userDoc = await Promise.race([
            getDoc(userDocRef),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout: Impossible de se connecter à Firestore')), 10000)
            )
          ]) as any;
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as Omit<User, 'id'>;
            
            // Vérifier l'approbation pour les employés
            if (userData.role === 'employe' && userData.isApproved === false) {
              // Ne pas déconnecter, laisser l'utilisateur voir la page d'attente
              setUser({
                id: firebaseUser.uid,
                ...userData
              });
              setFirebaseUser(firebaseUser);
              return;
            }
            
            setUser({
              id: firebaseUser.uid,
              ...userData
            });
            setFirebaseUser(firebaseUser);
          } else {
            // Document utilisateur manquant, déconnecter
            await signOut(auth);
            setError('Profil utilisateur non trouvé. Veuillez vous réinscrire.');
          }
        } catch (err) {
          console.error('Erreur lors de la récupération des données utilisateur:', err);
          
          if (err instanceof Error) {
            if (err.message.includes('offline') || err.message.includes('Timeout')) {
              setError('Impossible de se connecter à la base de données. Vérifiez votre connexion internet et la configuration Firebase.');
            } else if (err.message.includes('permission-denied')) {
              setError('Accès refusé. Vérifiez les règles de sécurité Firestore.');
            } else {
              setError('Erreur de connexion à la base de données. Vérifiez votre configuration Firebase.');
            }
          } else {
            setError('Erreur lors de la connexion');
          }
          
          await signOut(auth);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Écouter les changements du document utilisateur en temps réel
  useEffect(() => {
    if (!firebaseUser) return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (userDoc) => {
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
        
        setUser({
          id: firebaseUser.uid,
          ...userData
        });
      }
    }, (error) => {
      console.error('Erreur lors de l\'écoute des changements utilisateur:', error);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Vérifier que le document utilisateur existe
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await signOut(auth);
        setError('Profil utilisateur non trouvé. Veuillez vous réinscrire.');
        return false;
      }
      
      // Marquer pour afficher l'écran de bienvenue juste après la connexion
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return true;
    } catch (err: any) {
      console.error('Erreur de connexion:', err);
      setError(getErrorMessage(err.code));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Vérifier si l'utilisateur existe dans Firestore
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Créer un profil basique pour Google Auth (sera complété lors de la première connexion)
        const userData: Omit<User, 'id'> = {
          name: result.user.displayName || '',
          email: result.user.email || '',
          role: 'employe', // Rôle par défaut
          agencyId: '', // L'utilisateur devra saisir son ID d'agence
          // Pas de package pour les employés
          isApproved: false, // Les employés Google Auth doivent être approuvés
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(userDocRef, userData);
      }
      
      // Marquer pour afficher l'écran de bienvenue juste après la connexion
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return true;
    } catch (err: any) {
      console.error('Erreur de connexion Google:', err);
      setError(getErrorMessage(err.code));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string, 
    password: string, 
    name: string, 
    role: 'admin' | 'directeur' | 'employe',
    agencyId: string
  ): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Vérifier les limites d'utilisateurs pour les employés
      if (role === 'employe') {
        try {
          const limitCheck = await checkAgencyUserLimit(agencyId);
          if (!limitCheck.canAddUser) {
            setError(limitCheck.error || 'Limite d\'utilisateurs atteinte');
            return false;
          }
        } catch (error) {
          // Si on ne peut pas vérifier les limites (permissions, etc.), on bloque par sécurité
          setError('Limite d\'utilisateurs atteinte. Contactez votre directeur pour mettre à niveau le package ou acheter des utilisateurs supplémentaires.');
          return false;
        }
      }
      
      // Créer le compte Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Créer le document utilisateur dans Firestore avec tous les champs requis
      const userData: Omit<User, 'id'> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        agencyId: agencyId.trim(),
        ...(role === 'admin' && {
          isSuperAdmin: true,
          adminPermissions: [
            'user_management',
            'system_monitoring',
            'analytics_access',
            'settings_management',
            'backup_restore',
            'log_access'
          ],
          isActive: true
        }),
        ...(role === 'directeur' && {
          needsPackageSelection: true, // New directors need to select a package
          tokensUsedMonthly: 0,
          tokensResetDate: new Date()
        }),
        ...(role === 'employe' && {
          accessLevels: [],
          hasDirectorDashboardAccess: false
        }),
        isApproved: role === 'directeur' || role === 'admin' ? true : false, // Les directeurs et admins sont automatiquement approuvés
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      // Track user addition in subscription session (only for employees added by directors)
      if (role === 'employe') {
        try {
          // Find the director of this agency to track the user addition
          const directorsQuery = query(
            collection(db, 'users'),
            where('agencyId', '==', agencyId),
            where('role', '==', 'directeur')
          );
          const directorsSnapshot = await getDocs(directorsQuery);
          
          if (!directorsSnapshot.empty) {
            const director = directorsSnapshot.docs[0];
            await SubscriptionSessionService.updateUsage(director.id, 'users', 1);
          }
        } catch (trackingError) {
        }
      }
      
      // Track registration analytics
      try {
        await AnalyticsService.logUserRegistration(userCredential.user.uid, role, agencyId);
      } catch (analyticsError) {
      }
      
      // Marquer pour afficher l'écran de bienvenue juste après l'inscription
      try { sessionStorage.setItem('show_welcome_after_login', 'true'); } catch {}

      return true;
    } catch (err: any) {
      console.error('Erreur d\'inscription:', err);
      setError(getErrorMessage(err.code));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
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
        
        setUser({
          id: firebaseUser.uid,
          ...userData
        });
      } else {
        console.error('❌ AUTH: User document not found');
      }
    } catch (err) {
      console.error('❌ AUTH: Erreur lors du rafraîchissement des données utilisateur:', err);
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Aucun utilisateur trouvé avec cet email';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/email-already-in-use':
        return 'ACCOUNT_EXISTS'; // Special flag for existing account
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères';
      case 'auth/invalid-email':
        return 'Email invalide';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Réessayez plus tard';
      case 'auth/network-request-failed':
        return 'Erreur de connexion réseau';
      default:
        return 'Une erreur est survenue';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshUserData,
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