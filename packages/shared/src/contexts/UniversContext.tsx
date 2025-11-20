import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { universService } from '../services/universService';
import { ActiveUnivers } from '../types';

interface UniversContextType {
  activeUnivers: ActiveUnivers | null;
  activeUniversId: string | null;
  activeInstanceId: string | null;
}

const UniversContext = createContext<UniversContextType | undefined>(undefined);

export const UniversProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  
  const [activeUnivers, setActiveUnivers] = useState<ActiveUnivers | null>(null);
  const [activeUniversId, setActiveUniversId] = useState<string | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);

  // Charger l'Univers actif pour les directeurs
  useEffect(() => {
    let isMounted = true;

    const resetState = () => {
      if (!isMounted) return;
      setActiveUnivers(null);
      setActiveUniversId(null);
      setActiveInstanceId(null);
    };

    const toDate = (value: any) => {
      if (!value) return new Date();
      if (value instanceof Date) return value;
      if (typeof value?.toDate === 'function') {
        return value.toDate();
      }
      return new Date(value);
    };

    const applyUserFields = () => {
      if (!user?.activeUniversId) {
        return false;
      }

      const derivedActiveUnivers: ActiveUnivers = {
        directorId: user.id,
        agencyId: user.agencyId,
        activeUniversId: user.activeUniversId,
        activeInstanceId: user.activeInstanceId || null,
        updatedAt: toDate(user.updatedAt)
      };

      if (!isMounted) {
        return true;
      }

      setActiveUnivers(derivedActiveUnivers);
      setActiveUniversId(derivedActiveUnivers.activeUniversId);
      setActiveInstanceId(derivedActiveUnivers.activeInstanceId || null);

      // Assurer qu'une instance existe si elle n'est pas définie sur le profil utilisateur
      if (!derivedActiveUnivers.activeInstanceId) {
        universService.ensureInstanceForActiveUnivers(user.id, user.agencyId)
          .then(async (ensuredInstanceId) => {
            if (!ensuredInstanceId || !isMounted) return;
            setActiveInstanceId(ensuredInstanceId);
            setActiveUnivers(prev => prev ? {
              ...prev,
              activeInstanceId: ensuredInstanceId,
              updatedAt: new Date()
            } : prev);
          })
          .catch(error => {
            console.warn('⚠️ Impossible d\'assurer l\'instance de l\'univers actif (non bloquant):', error);
          });
      }

      return true;
    };

    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      resetState();
      return () => { isMounted = false; };
    }

    // Seuls les directeurs ont un Univers actif
    if (user.role !== 'directeur') {
      resetState();
      return () => { isMounted = false; };
    }

    // Utiliser en priorité les champs du document utilisateur
    if (applyUserFields()) {
      return () => { isMounted = false; };
    }

    // Charger ActiveUnivers depuis Firestore en fallback
    const loadActiveUnivers = async () => {
      try {
        let activeUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
        
        // Si aucun Univers actif, essayer de l'activer (il devrait déjà exister, créé dans AuthContext)
        // Ne pas créer l'univers ici pour éviter les duplications
        if (!activeUnivers) {
          try {
            // Chercher l'univers par défaut existant
            const defaultUnivers = await universService.getDefaultUnivers(user.id);
            if (defaultUnivers) {
              // Essayer d'activer l'univers par défaut existant
              try {
                await universService.activateUnivers(defaultUnivers.id, user.id, user.agencyId);
                activeUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
              } catch (activationError) {
                console.warn('⚠️ Impossible d\'activer l\'univers par défaut (non bloquant):', activationError);
                // Continuer sans univers actif (l'utilisateur pourra en créer un plus tard)
              }
            }
            // Ne JAMAIS créer l'univers ici - il sera créé dans AuthContext uniquement
            // Cela évite les duplications
          } catch (error) {
            console.warn('⚠️ Impossible de charger/activer l\'univers actif:', error);
            // Continuer sans univers actif (l'utilisateur pourra en créer un plus tard)
          }
        }

        if (activeUnivers && isMounted) {
          let ensuredActiveUnivers: ActiveUnivers | null = activeUnivers;

          // S'assurer qu'une instance est disponible : si absente, en créer/récupérer une immédiatement
          try {
            if (!ensuredActiveUnivers.activeInstanceId) {
              const ensuredInstanceId = await universService.ensureInstanceForActiveUnivers(user.id, user.agencyId);
              if (ensuredInstanceId) {
                // Recharger l'univers actif pour récupérer les nouvelles valeurs
                const refreshedUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
                ensuredActiveUnivers = refreshedUnivers || ensuredActiveUnivers;
              }
            }
          } catch (ensureError) {
            console.warn('⚠️ Impossible d\'assurer l\'instance de l\'univers actif (non bloquant):', ensureError);
          }

          if (!isMounted) return;
          setActiveUnivers(ensuredActiveUnivers);
          setActiveUniversId(ensuredActiveUnivers.activeUniversId);
          setActiveInstanceId(ensuredActiveUnivers.activeInstanceId || null);
        } else if (isMounted) {
          resetState();
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'Univers actif:', error);
        resetState();
      }
    };

    loadActiveUnivers();

    return () => {
      isMounted = false;
    };
  }, [firebaseUser, user]);

  return (
    <UniversContext.Provider value={{
      activeUnivers,
      activeUniversId,
      activeInstanceId
    }}>
      {children}
    </UniversContext.Provider>
  );
};

export const useUnivers = () => {
  const context = useContext(UniversContext);
  if (context === undefined) {
    // During initialization, return default values instead of throwing
    return {
      activeUnivers: null,
      activeUniversId: null,
      activeInstanceId: null
    };
  }
  return context;
};

