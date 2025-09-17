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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (email: string, password: string, name: string, role: 'directeur' | 'employe', agencyId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour créer ou mettre à jour le document utilisateur
  const createOrUpdateUserDoc = async (firebaseUser: FirebaseUser, additionalData?: Partial<User>) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Si le document n'existe pas et qu'on n'a pas de données additionnelles, on ne peut pas le créer
        if (!additionalData) {
          throw new Error('Données utilisateur manquantes pour la création du profil');
        }
        
        // Créer le document utilisateur avec tous les champs requis
        const userData: Omit<User, 'id'> = {
          name: additionalData.name || firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          role: additionalData.role || 'employe',
          agencyId: additionalData.agencyId || '',
          ...(additionalData.role === 'directeur' && {
            package: additionalData.package || 'starter', // Package seulement pour les directeurs
            tokensUsedMonthly: 0,
            tokensResetDate: serverTimestamp()
          }),
          ...(additionalData.role === 'employe' && {
            accessLevels: [],
            hasDirectorDashboardAccess: false
          }),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(userDocRef, userData);
        return userData;
      } else {
        // Le document existe, le retourner
        return userDoc.data() as Omit<User, 'id'>;
      }
    } catch (err) {
      console.error('Erreur lors de la création/mise à jour du document utilisateur:', err);
      throw err;
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
              console.log('Employee not approved yet');
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
            console.warn('Document utilisateur manquant pour UID:', firebaseUser.uid);
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
    role: 'directeur' | 'employe',
    agencyId: string
  ): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Créer le compte Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Créer le document utilisateur dans Firestore avec tous les champs requis
      const userData: Omit<User, 'id'> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        agencyId: agencyId.trim(),
        ...(role === 'directeur' && {
          package: 'starter', // Package seulement pour les directeurs
          tokensUsedMonthly: 0,
          tokensResetDate: serverTimestamp()
        }),
        ...(role === 'employe' && {
          accessLevels: [],
          hasDirectorDashboardAccess: false
        }),
        isApproved: role === 'directeur' ? true : false, // Les directeurs sont automatiquement approuvés
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
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

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Aucun utilisateur trouvé avec cet email';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/email-already-in-use':
        return 'Cet email est déjà utilisé';
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