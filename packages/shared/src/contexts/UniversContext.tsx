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
    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      setActiveUnivers(null);
      setActiveUniversId(null);
      setActiveInstanceId(null);
      return;
    }

    // Seuls les directeurs ont un Univers actif
    if (user.role !== 'directeur') {
      setActiveUnivers(null);
      setActiveUniversId(null);
      setActiveInstanceId(null);
      return;
    }

    // Charger ActiveUnivers depuis Firestore
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

        if (activeUnivers) {
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

          setActiveUnivers(ensuredActiveUnivers);
          setActiveUniversId(ensuredActiveUnivers.activeUniversId);
          setActiveInstanceId(ensuredActiveUnivers.activeInstanceId || null);
        } else {
          setActiveUnivers(null);
          setActiveUniversId(null);
          setActiveInstanceId(null);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'Univers actif:', error);
        setActiveUnivers(null);
        setActiveUniversId(null);
        setActiveInstanceId(null);
      }
    };

    loadActiveUnivers();
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

