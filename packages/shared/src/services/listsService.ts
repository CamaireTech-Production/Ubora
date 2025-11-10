import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { List, ListColumn, ListRow } from '../types';

class ListsService {
  private readonly collectionName = 'lists';

  /**
   * Convertir les données Firestore en List
   */
  private convertFirestoreToList(id: string, data: any): List {
    return {
      id,
      name: data.name,
      description: data.description || undefined,
      columns: data.columns || [],
      rows: data.rows || [],
      createdBy: data.createdBy,
      createdByRole: data.createdByRole || 'directeur',
      createdByEmployeeId: data.createdByEmployeeId || undefined,
      agencyId: data.agencyId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      universId: data.universId || undefined,
      universInstanceId: data.universInstanceId || undefined,
      fromUnivers: data.fromUnivers || false
    } as List;
  }

  /**
   * Créer une nouvelle List
   * 
   * @param list - Les données de la List à créer (sans l'ID qui sera généré)
   * @returns L'ID de la List créée
   * @throws Error si la validation échoue ou si la création échoue
   */
  async create(list: Omit<List, 'id'>): Promise<string> {
    try {
      // Validation des prérequis
      if (!list.name || !list.name.trim()) {
        throw new Error('Le nom de la List est requis');
      }

      if (!list.createdBy) {
        throw new Error('Le créateur de la List est requis');
      }

      if (!list.agencyId) {
        throw new Error('L\'agence de la List est requise');
      }

      // Validation: au moins une colonne est requise
      if (!list.columns || list.columns.length === 0) {
        throw new Error('Au moins une colonne est requise pour créer une List');
      }

      // Validation: chaque colonne doit avoir un id, name et type
      for (const column of list.columns) {
        if (!column.id || !column.name || !column.type) {
          throw new Error('Chaque colonne doit avoir un id, un nom et un type');
        }
      }

      // Validation: les rows doivent correspondre aux colonnes
      if (list.rows && list.rows.length > 0) {
        const columnIds = new Set(list.columns.map(c => c.id));
        for (const row of list.rows) {
          // Vérifier que chaque row a des valeurs pour toutes les colonnes (optionnel mais recommandé)
          for (const columnId of columnIds) {
            if (!(columnId in row)) {
              // Avertissement mais pas d'erreur - certaines valeurs peuvent être vides
              console.warn(`Row missing value for column ${columnId}`);
            }
          }
        }
      }

      // Récupérer l'Univers actif pour associer automatiquement si universId n'est pas fourni
      let universIdToAssociate: string | null = list.universId || null;
      if (!universIdToAssociate && list.agencyId) {
        try {
          // Trouver le directeur de l'agence
          const directorsSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('agencyId', '==', list.agencyId),
              where('role', '==', 'directeur')
            )
          );
          if (!directorsSnapshot.empty) {
            const directorId = directorsSnapshot.docs[0].id;
            // Récupérer l'Univers actif du directeur
            const { universService } = await import('./universService');
            const activeUnivers = await universService.getActiveUnivers(directorId, list.agencyId);
            if (activeUnivers) {
              universIdToAssociate = activeUnivers.activeUniversId;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'Univers actif pour la List:', error);
          // Continue sans associer au Univers si erreur
        }
      }

      // Préparer les données avec valeurs par défaut
      const now = new Date();
      const listData = {
        name: list.name.trim(),
        description: list.description?.trim() || undefined,
        columns: list.columns,
        rows: list.rows || [],
        createdBy: list.createdBy,
        createdByRole: list.createdByRole || 'directeur',
        createdByEmployeeId: list.createdByEmployeeId || undefined,
        agencyId: list.agencyId,
        createdAt: Timestamp.fromDate(list.createdAt || now),
        updatedAt: Timestamp.fromDate(list.updatedAt || now),
        universId: universIdToAssociate,
        universInstanceId: list.universInstanceId || null,
        fromUnivers: list.fromUnivers || false
      };

      // Helper function to remove undefined values
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) return obj.map(removeUndefined);
        if (typeof obj === 'object' && obj.constructor === Object) {
          return Object.keys(obj).reduce((acc, key) => {
            const value = obj[key];
            if (value !== undefined) {
              acc[key] = removeUndefined(value);
            }
            return acc;
          }, {} as any);
        }
        return obj;
      };

      // Créer le document dans Firestore
      const docRef = await addDoc(collection(db, this.collectionName), removeUndefined(listData));

      console.log(`List créée avec succès: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de la List:', error);
      
      // Re-throw avec un message plus explicite si c'est notre erreur
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Erreur lors de la création de la List. Veuillez réessayer.');
    }
  }

  /**
   * Mettre à jour une List
   */
  async update(id: string, updates: Partial<List>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      
      // Filter out undefined values to prevent Firestore errors
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const updateData: any = { ...filteredUpdates };
      
      // Toujours mettre à jour updatedAt
      updateData.updatedAt = Timestamp.fromDate(new Date());
      
      // Convertir les dates en Timestamps Firestore
      if (updateData.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updateData.createdAt);
      }
      if (updateData.updatedAt && !(updateData.updatedAt instanceof Timestamp)) {
        updateData.updatedAt = Timestamp.fromDate(updateData.updatedAt);
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la List:', error);
      throw error;
    }
  }

  /**
   * Supprimer une List
   */
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
      console.log(`List supprimée avec succès: ${id}`);
    } catch (error) {
      console.error('Erreur lors de la suppression de la List:', error);
      throw error;
    }
  }

  /**
   * Récupérer une List par ID
   */
  async getById(id: string): Promise<List | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertFirestoreToList(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la List:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les Lists d'une agence
   * Filtrer par Univers actif et instance active si fournis
   */
  async getByAgency(agencyId: string, activeUniversId?: string | null, activeInstanceId?: string | null): Promise<List[]> {
    try {
      const conditions: any[] = [where('agencyId', '==', agencyId)];
      
      if (activeUniversId) {
        conditions.push(where('universId', '==', activeUniversId));
      }
      
      // Ne pas filtrer par universInstanceId dans Firestore si activeInstanceId est fourni
      // car on veut aussi inclure les listes sans instance spécifique (universInstanceId === null)
      // On fera le filtrage côté client
      
      conditions.push(orderBy('updatedAt', 'desc'));
      const q = query(collection(db, this.collectionName), ...conditions);
      
      const querySnapshot = await getDocs(q);
      const lists = querySnapshot.docs.map(doc => 
        this.convertFirestoreToList(doc.id, doc.data())
      );
      
      // Filtrage côté client si activeInstanceId est fourni
      // Inclure les listes de l'instance active OU les listes sans instance spécifique de l'univers actif
      if (activeInstanceId && activeUniversId) {
        return lists.filter(list => 
          list.universInstanceId === activeInstanceId || 
          (list.universInstanceId === null && list.universId === activeUniversId)
        );
      }
      
      return lists;
    } catch (error) {
      console.error('Erreur lors de la récupération des Lists de l\'agence:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les Lists créées par un utilisateur
   * Inclut toutes les Lists de l'agence si l'utilisateur est directeur
   * Filtrer par Univers actif et instance active si fournis
   */
  async getByUser(userId: string, agencyId: string, userRole?: 'directeur' | 'employe' | 'admin', activeUniversId?: string | null, activeInstanceId?: string | null): Promise<List[]> {
    try {
      // Si c'est un directeur, retourner toutes les Lists de l'agence (filtrées par Univers actif et instance active)
      if (userRole === 'directeur' || userRole === 'admin') {
        return await this.getByAgency(agencyId, activeUniversId, activeInstanceId);
      }

      // Sinon, retourner seulement les Lists créées par l'utilisateur (filtrées par Univers actif et instance active)
      const conditions: any[] = [
        where('createdBy', '==', userId),
        where('agencyId', '==', agencyId)
      ];
      
      if (activeUniversId) {
        conditions.push(where('universId', '==', activeUniversId));
      }
      
      // Ne pas filtrer par universInstanceId dans Firestore si activeInstanceId est fourni
      // car on veut aussi inclure les listes sans instance spécifique (universInstanceId === null)
      // On fera le filtrage côté client
      
      conditions.push(orderBy('updatedAt', 'desc'));
      const q = query(collection(db, this.collectionName), ...conditions);
      
      const querySnapshot = await getDocs(q);
      const lists = querySnapshot.docs.map(doc => 
        this.convertFirestoreToList(doc.id, doc.data())
      );
      
      // Filtrage côté client si activeInstanceId est fourni
      // Inclure les listes de l'instance active OU les listes sans instance spécifique de l'univers actif
      if (activeInstanceId && activeUniversId) {
        return lists.filter(list => 
          list.universInstanceId === activeInstanceId || 
          (list.universInstanceId === null && list.universId === activeUniversId)
        );
      }
      
      return lists;
    } catch (error) {
      console.error('Erreur lors de la récupération des Lists de l\'utilisateur:', error);
      throw error;
    }
  }
}

export const listsService = new ListsService();

