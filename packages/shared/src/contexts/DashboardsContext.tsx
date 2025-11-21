import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Dashboard } from '../types';
import { useAuth } from './AuthContext';
import { usePackageAccess } from '../hooks/usePackageAccess';
import { PermissionManager } from '../utils/PermissionManager';
import { SubscriptionSessionService } from '../services/subscriptionSessionService';
import { universService } from '../services/universService';
import { useUnivers } from './UniversContext';
import { logger } from '../utils/logger';
import { universInstanceResourceService } from '../services/universInstanceResourceService';

interface DashboardsContextType {
  dashboards: Dashboard[];
  createDashboard: (dashboard: Omit<Dashboard, 'id' | 'createdAt'>) => Promise<void>;
  updateDashboard: (dashboardId: string, dashboard: Partial<Omit<Dashboard, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => Promise<void>;
  deleteDashboard: (dashboardId: string) => Promise<void>;
  getDashboardsForDirector: (directorId: string) => Dashboard[];
  isLoading: boolean;
  error: string | null;
}

const DashboardsContext = createContext<DashboardsContextType | undefined>(undefined);

export const DashboardsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  const { activeUniversId, activeInstanceId } = useUnivers();
  const { canCreateDashboard } = usePackageAccess();
  
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les tableaux de bord depuis Firestore
  useEffect(() => {
    // Guard: Vérifier que l'utilisateur Firebase et le profil utilisateur sont chargés
    if (!firebaseUser || !user || !user.agencyId) {
      setDashboards([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // NOUVELLE LOGIQUE : Pour les directeurs avec activeInstanceId, utiliser l'instance comme source de vérité
    if (user.role === 'directeur' && activeInstanceId) {
      // Utiliser le service pour récupérer les dashboards depuis l'instance
      const unsubscribe = universInstanceResourceService.subscribeToInstanceResources(
        activeInstanceId,
        (resources) => {
          // Trier par createdAt décroissant
          const sortedDashboards = resources.dashboards.sort((a, b) => {
            const aTime = a.createdAt?.getTime() || 0;
            const bTime = b.createdAt?.getTime() || 0;
            return bTime - aTime;
          });
          setDashboards(sortedDashboards);
          setIsLoading(false);
        }
      );

      return () => {
        unsubscribe();
      };
    }

    // ANCIENNE LOGIQUE : Pour les employés ou les directeurs sans instance (rétrocompatibilité)
    // Les directeurs et employés avec accès peuvent voir les tableaux de bord
    let unsubscribeDashboards: (() => void) | undefined;
    
    if (user.role === 'directeur' || PermissionManager.hasDirectorDashboardAccess(user)) {
      let dashboardsQuery;
      if (activeUniversId) {
        // Rétrocompatibilité : filtrer par universId si pas d'instance
        dashboardsQuery = query(
          collection(db, 'dashboards'),
          where('agencyId', '==', user.agencyId),
          where('universId', '==', activeUniversId),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Rétrocompatibilité temporaire : si pas de Univers actif, charger tous les dashboards
        dashboardsQuery = query(
          collection(db, 'dashboards'),
          where('agencyId', '==', user.agencyId),
          orderBy('createdAt', 'desc')
        );
      }

      unsubscribeDashboards = onSnapshot(dashboardsQuery, (snapshot) => {
        const allDashboardsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as Dashboard[];
        
        // Filtrer les tableaux de bord selon le rôle de l'utilisateur
        let filteredDashboards = allDashboardsData;
        if (user.role === 'employe') {
          // Les employés avec accès directeur voient TOUS les tableaux de bord de l'agence
          if (PermissionManager.hasDirectorDashboardAccess(user)) {
            filteredDashboards = allDashboardsData; // Voir tous les tableaux de bord
          } else {
            // Les employés normaux voient seulement leurs propres tableaux de bord
            filteredDashboards = allDashboardsData.filter(dashboard => 
              dashboard.createdByEmployeeId === user.id ||
              dashboard.createdBy === user.id
            );
          }
        }
        
        setDashboards(filteredDashboards);
        setIsLoading(false);
      }, (err) => {
        console.error('Erreur lors du chargement des tableaux de bord:', err);
        setError('Erreur lors du chargement des tableaux de bord');
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeDashboards) {
        unsubscribeDashboards();
      }
    };
  }, [user, firebaseUser, activeUniversId, activeInstanceId]);

  const createDashboard = async (dashboardData: Omit<Dashboard, 'id' | 'createdAt'>) => {
    if (!user || !user.agencyId) {
      throw new Error('Données utilisateur manquantes');
    }

    // Vérifier les permissions selon le rôle
    if (user.role === 'employe') {
      // Les employés peuvent créer des tableaux de bord s'ils ont la permission
      if (!PermissionManager.canCreateDashboards(user)) {
        throw new Error('Vous n\'avez pas la permission de créer des tableaux de bord');
      }
    } else if (user.role !== 'directeur') {
      throw new Error('Seuls les directeurs et employés autorisés peuvent créer des tableaux de bord');
    }

    // Vérifier les limites du package (pour les directeurs et employés avec accès directeur)
    // Note: Si un univers actif existe, canCreateDashboard() retourne true automatiquement
    // car les ressources dans un univers actif peuvent dépasser les limites du package
    if ((user.role === 'directeur' || (user.role === 'employe' && user.hasDirectorDashboardAccess)) && !canCreateDashboard(dashboards.length)) {
      if (user.role === 'employe') {
        throw new Error('Limite de tableaux de bord atteinte. Contactez votre directeur pour cette agence.');
      } else {
        throw new Error('Limite de tableaux de bord atteinte pour votre package. Veuillez mettre à niveau votre abonnement.');
      }
    }

    try {
      setError(null);
      
      // Récupérer l'Univers actif pour associer automatiquement la ressource
      let universIdToAssociate: string | null = null;
      let universInstanceIdToAssociate: string | null = null;
      
      if (user.role === 'directeur' && activeUniversId) {
        // Pour les directeurs, utiliser l'Univers actif déjà chargé
        universIdToAssociate = activeUniversId;
        
        // Créer l'instance à la demande si elle n'existe pas encore
        try {
          const activeUnivers = await universService.getActiveUnivers(user.id, user.agencyId);
          if (activeUnivers && !activeUnivers.activeInstanceId) {
            // Créer l'instance à la demande pour la première ressource
            const instanceId = await universService.ensureInstanceForActiveUnivers(user.id, user.agencyId);
            if (instanceId) {
              universInstanceIdToAssociate = instanceId;
            }
          } else if (activeUnivers?.activeInstanceId) {
            universInstanceIdToAssociate = activeUnivers.activeInstanceId;
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors de la création de l\'instance à la demande (non bloquant):', error);
        }
      } else if (user.role === 'employe') {
        // Pour les employés, récupérer l'Univers actif de l'agence (via le directeur)
        try {
          const directorsSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('agencyId', '==', user.agencyId),
              where('role', '==', 'directeur')
            )
          );
          if (!directorsSnapshot.empty) {
            const directorId = directorsSnapshot.docs[0].id;
            const activeUnivers = await universService.getActiveUnivers(directorId, user.agencyId);
            if (activeUnivers) {
              universIdToAssociate = activeUnivers.activeUniversId;
              universInstanceIdToAssociate = activeUnivers.activeInstanceId || null;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'Univers actif pour l\'employé:', error);
          // Continue sans associer au Univers si erreur
        }
      }

      // Nettoyer les métriques pour supprimer les valeurs undefined
      const cleanedMetrics = (dashboardData.metrics || []).map(metric => {
        const cleanedMetric: any = {
          createdAt: new Date()
        };
        
        // Copier uniquement les propriétés définies (non undefined)
        Object.keys(metric || {}).forEach(key => {
          const value = (metric as any)[key];
          if (value !== undefined) {
            cleanedMetric[key] = value;
          }
        });
        
        return cleanedMetric;
      });

      const docData: any = {
        name: dashboardData.name?.trim() || '',
        description: dashboardData.description?.trim() || '',
        metrics: cleanedMetrics,
        createdBy: user.id,
        createdByRole: user.role,
        agencyId: user.agencyId,
        isDefault: dashboardData.isDefault || false,
        createdAt: serverTimestamp()
      };

      // Associer automatiquement au Univers actif si disponible
      if (universIdToAssociate) {
        docData.universId = universIdToAssociate;
      }
      
      // Associer à l'instance si disponible
      if (universInstanceIdToAssociate) {
        docData.universInstanceId = universInstanceIdToAssociate;
      }

      // Only add createdByEmployeeId if the user is an employee
      if (user.role === 'employe') {
        docData.createdByEmployeeId = user.id;
      }
      
      // Nettoyer le docData final pour supprimer toutes les valeurs undefined
      const finalDocData: any = {};
      Object.keys(docData).forEach(key => {
        const value = docData[key];
        if (value !== undefined) {
          finalDocData[key] = value;
        }
      });

      const dashboardRef = await addDoc(collection(db, 'dashboards'), finalDocData);
      
      // Ajouter la ressource à l'instance si elle existe
      if (universInstanceIdToAssociate && user.role === 'directeur') {
        try {
          await universService.addResourceToInstance(user.id, user.agencyId, dashboardRef.id, 'dashboard');
        } catch (error) {
          console.warn('⚠️ Erreur lors de l\'ajout de la ressource à l\'instance (non bloquant):', error);
        }
      }
      
      // Track dashboard creation in subscription session (only for directors)
      // Only track if this is NOT a Univers instantiation (instantiation doesn't use this context)
      // Check: if fromUnivers is set, this means it's from instantiation - don't track
      // Since DashboardsContext is only used for new creations (not instantiation), we always track
      if (user.role === 'directeur' && firebaseUser) {
        try {
          // Only track if this is a new creation, not from Univers instantiation
          // Univers instantiation creates dashboards directly and doesn't call this context
          // So if we're here, it's always a new creation that should be tracked
          await SubscriptionSessionService.updateUsage(firebaseUser.uid, 'dashboards', 1);
          logger.debug('Dashboard creation usage tracked', {
            userId: firebaseUser.uid,
            dashboardId: dashboardRef.id,
            universId: universIdToAssociate
          }, 'DashboardsContext');
        } catch (trackingError) {
          logger.error('Error tracking dashboard creation usage', trackingError, 'DashboardsContext');
          // Silent fail - don't block dashboard creation
        }
      }
    } catch (err) {
      console.error('Erreur lors de la création du tableau de bord:', err);
      setError('Erreur lors de la création du tableau de bord');
      throw err;
    }
  };

  const updateDashboard = async (dashboardId: string, dashboardData: Partial<Omit<Dashboard, 'id' | 'createdAt' | 'createdBy' | 'agencyId'>>) => {
    if (!user || !user.agencyId || !PermissionManager.canUpdateDashboards(user)) {
      throw new Error('Seuls les directeurs et employés avec accès directeur peuvent modifier des tableaux de bord');
    }

    try {
      setError(null);
      
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp()
      };

      if (dashboardData.name !== undefined) updateData.name = dashboardData.name.trim();
      if (dashboardData.description !== undefined) updateData.description = dashboardData.description?.trim() || '';
      if (dashboardData.metrics !== undefined) updateData.metrics = dashboardData.metrics;
      if (dashboardData.isDefault !== undefined) updateData.isDefault = dashboardData.isDefault;

      await updateDoc(doc(db, 'dashboards', dashboardId), updateData);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du tableau de bord:', err);
      setError('Erreur lors de la mise à jour du tableau de bord');
      throw err;
    }
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!user || !PermissionManager.canDeleteDashboards(user)) {
      throw new Error('Seuls les directeurs et employés avec accès directeur peuvent supprimer des tableaux de bord');
    }

    try {
      setError(null);
      await deleteDoc(doc(db, 'dashboards', dashboardId));
    } catch (err) {
      console.error('Erreur lors de la suppression du tableau de bord:', err);
      setError('Erreur lors de la suppression du tableau de bord');
      throw err;
    }
  };

  const getDashboardsForDirector = (directorId: string): Dashboard[] => {
    return dashboards.filter(dashboard => dashboard.createdBy === directorId);
  };

  return (
    <DashboardsContext.Provider value={{
      dashboards,
      createDashboard,
      updateDashboard,
      deleteDashboard,
      getDashboardsForDirector,
      isLoading,
      error
    }}>
      {children}
    </DashboardsContext.Provider>
  );
};

export const useDashboards = () => {
  const context = useContext(DashboardsContext);
  if (context === undefined) {
    // During initialization, return default values instead of throwing
    return {
      dashboards: [],
      createDashboard: async () => {},
      updateDashboard: async () => {},
      deleteDashboard: async () => {},
      getDashboardsForDirector: () => [],
      isLoading: true,
      error: null
    };
  }
  return context;
};

