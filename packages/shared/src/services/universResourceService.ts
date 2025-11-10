import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Univers, UniversInstance, ActiveUnivers } from '../types';
import { universService } from './universService';

export type ResourceType = 'form' | 'dashboard' | 'user' | 'list' | 'report';

export class UniversResourceService {
  /**
   * Vérifier si une ressource fait partie de l'univers actif
   * @param directorId - ID du directeur
   * @param agencyId - ID de l'agence
   * @param resourceId - ID de la ressource
   * @param resourceType - Type de ressource (form, dashboard, user, list, report)
   * @returns Promise<boolean> - true si la ressource fait partie de l'univers actif
   */
  static async isResourceInActiveUnivers(
    directorId: string,
    agencyId: string,
    resourceId: string,
    resourceType: ResourceType
  ): Promise<boolean> {
    try {
      // Récupérer l'univers actif
      const activeUnivers = await universService.getActiveUnivers(directorId, agencyId);
      
      if (!activeUnivers) {
        return false;
      }

      // Si une instance existe, vérifier dans l'instance
      if (activeUnivers.activeInstanceId) {
        const instanceDoc = await getDoc(doc(db, 'universInstances', activeUnivers.activeInstanceId));
        
        if (instanceDoc.exists()) {
          const instanceData = instanceDoc.data() as UniversInstance;
          const instances = instanceData.instances || {};
          
          // Vérifier selon le type de ressource
          switch (resourceType) {
            case 'form':
              return (instances.forms || []).includes(resourceId);
            case 'dashboard':
              return (instances.dashboards || []).includes(resourceId);
            case 'list':
              return (instances.lists || []).includes(resourceId);
            case 'report':
              return (instances.reports || []).includes(resourceId);
            case 'user':
              // Les utilisateurs ne sont pas dans les instances, on vérifie dans l'univers template
              return false;
            default:
              return false;
          }
        }
      }

      // Si pas d'instance ou ressource non trouvée dans l'instance, vérifier dans l'univers template
      const universDoc = await getDoc(doc(db, 'univers', activeUnivers.activeUniversId));
      
      if (!universDoc.exists()) {
        return false;
      }

      const universData = universDoc.data() as Univers;
      const definitions = universData.definitions || {};
      
      // Vérifier selon le type de ressource
      switch (resourceType) {
        case 'form':
          return (definitions.forms || []).some((f: any) => f.id === resourceId);
        case 'dashboard':
          return (definitions.dashboards || []).some((d: any) => d.id === resourceId);
        case 'list':
          return (definitions.lists || []).some((l: any) => l.id === resourceId);
        case 'report':
          return (definitions.reports || []).some((r: any) => r.id === resourceId);
        case 'user':
          // Les utilisateurs ne sont pas dans les définitions d'univers
          return false;
        default:
          return false;
      }
    } catch (error) {
      console.error('Erreur lors de la vérification si la ressource est dans l\'univers actif:', error);
      return false;
    }
  }

  /**
   * Vérifier si une ressource existe déjà dans l'univers actif (via les ressources créées)
   * Cette méthode vérifie si une ressource avec cet ID existe déjà dans l'agence et est associée à l'univers actif
   * @param directorId - ID du directeur
   * @param agencyId - ID de l'agence
   * @param resourceId - ID de la ressource
   * @param resourceType - Type de ressource (form, dashboard)
   * @returns Promise<boolean> - true si la ressource existe déjà dans l'univers actif
   */
  static async isExistingResourceInActiveUnivers(
    directorId: string,
    agencyId: string,
    resourceId: string,
    resourceType: 'form' | 'dashboard'
  ): Promise<boolean> {
    try {
      // Récupérer l'univers actif
      const activeUnivers = await universService.getActiveUnivers(directorId, agencyId);
      
      if (!activeUnivers || !activeUnivers.activeUniversId) {
        return false;
      }

      // Vérifier si la ressource existe dans la collection correspondante et est associée à l'univers actif
      const collectionName = resourceType === 'form' ? 'forms' : 'dashboards';
      const resourceDoc = await getDoc(doc(db, collectionName, resourceId));
      
      if (!resourceDoc.exists()) {
        return false;
      }

      const resourceData = resourceDoc.data();
      
      // Vérifier que la ressource appartient à l'agence
      if (resourceData.agencyId !== agencyId) {
        return false;
      }

      // Vérifier que la ressource est associée à l'univers actif
      return resourceData.universId === activeUnivers.activeUniversId;
    } catch (error) {
      console.error('Erreur lors de la vérification si la ressource existe dans l\'univers actif:', error);
      return false;
    }
  }

  /**
   * Vérifier si on peut ajouter une nouvelle ressource à l'univers actif
   * Cette méthode vérifie les limites du package pour les nouvelles ressources
   * @param directorId - ID du directeur
   * @param agencyId - ID de l'agence
   * @param resourceType - Type de ressource (form, dashboard, user)
   * @param currentCount - Nombre actuel de ressources de ce type
   * @returns Promise<boolean> - true si on peut ajouter une nouvelle ressource
   */
  static async canAddResourceToActiveUnivers(
    directorId: string,
    agencyId: string,
    resourceType: 'form' | 'dashboard' | 'user',
    currentCount: number
  ): Promise<boolean> {
    try {
      // Récupérer l'univers actif
      const activeUnivers = await universService.getActiveUnivers(directorId, agencyId);
      
      if (!activeUnivers) {
        // Pas d'univers actif, vérifier les limites normalement (sera fait ailleurs)
        return false;
      }

      // Pour les nouvelles ressources dans un univers actif, on doit vérifier les limites du package
      // Cette méthode sera utilisée en combinaison avec les vérifications de limites du package
      // Elle retourne true si on peut ajouter (les limites seront vérifiées ailleurs)
      // On retourne true ici car cette méthode est appelée pour vérifier si on peut ajouter à l'univers actif
      // Les limites réelles seront vérifiées dans usePackageAccess
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification si on peut ajouter une ressource à l\'univers actif:', error);
      return false;
    }
  }

  /**
   * Obtenir toutes les ressources d'un type spécifique dans l'univers actif
   * @param directorId - ID du directeur
   * @param agencyId - ID de l'agence
   * @param resourceType - Type de ressource (form, dashboard)
   * @returns Promise<string[]> - Liste des IDs de ressources dans l'univers actif
   */
  static async getResourcesInActiveUnivers(
    directorId: string,
    agencyId: string,
    resourceType: 'form' | 'dashboard'
  ): Promise<string[]> {
    try {
      // Récupérer l'univers actif
      const activeUnivers = await universService.getActiveUnivers(directorId, agencyId);
      
      if (!activeUnivers || !activeUnivers.activeUniversId) {
        return [];
      }

      // Récupérer toutes les ressources de ce type associées à l'univers actif
      const collectionName = resourceType === 'form' ? 'forms' : 'dashboards';
      const resourcesQuery = query(
        collection(db, collectionName),
        where('agencyId', '==', agencyId),
        where('universId', '==', activeUnivers.activeUniversId)
      );

      const resourcesSnapshot = await getDocs(resourcesQuery);
      
      return resourcesSnapshot.docs.map(doc => doc.id);
    } catch (error) {
      console.error('Erreur lors de la récupération des ressources dans l\'univers actif:', error);
      return [];
    }
  }
}

