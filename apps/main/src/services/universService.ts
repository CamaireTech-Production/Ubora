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
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Univers, UniversInstance, UniversDefinitions, UniversMetadata, UniversOwnership, UniversUsage } from '../types';

class UniversService {
  private readonly collectionName = 'univers';
  private readonly instancesCollectionName = 'universInstances';

  /**
   * Convertir les données Firestore en Univers
   */
  private convertFirestoreToUnivers(id: string, data: any): Univers {
    return {
      id,
      metadata: {
        ...data.metadata,
        createdAt: data.metadata?.createdAt?.toDate() || new Date()
      },
      ownership: {
        ...data.ownership,
        approvedAt: data.ownership?.approvedAt?.toDate() || undefined
      },
      definitions: data.definitions || {
        forms: [],
        dashboards: [],
        instructions: [],
        lists: [],
        reports: []
      },
      usage: {
        ...data.usage,
        lastUsedAt: data.usage?.lastUsedAt?.toDate() || undefined
      }
    } as Univers;
  }

  /**
   * Convertir les données Firestore en UniversInstance
   */
  private convertFirestoreToUniversInstance(id: string, data: any): UniversInstance {
    return {
      id,
      universId: data.universId,
      userId: data.userId,
      agencyId: data.agencyId,
      createdAt: data.createdAt?.toDate() || new Date(),
      instances: data.instances || {
        forms: [],
        dashboards: [],
        instructions: [],
        lists: [],
        reports: []
      },
      metadata: data.metadata || {
        universName: '',
        universVersion: 1
      }
    } as UniversInstance;
  }

  /**
   * Créer un nouveau Univers
   * 
   * @param univers - Les données du Univers à créer (sans l'ID qui sera généré)
   * @returns L'ID du Univers créé
   * @throws Error si la validation échoue ou si la création échoue
   */
  async create(univers: Omit<Univers, 'id'>): Promise<string> {
    try {
      // Validation des prérequis
      if (!univers.metadata?.name || !univers.metadata.name.trim()) {
        throw new Error('Le nom du Univers est requis');
      }

      if (!univers.ownership?.createdBy) {
        throw new Error('Le créateur du Univers est requis');
      }

      // Validation: au moins un formulaire est requis
      const forms = univers.definitions?.forms || [];
      if (forms.length === 0) {
        throw new Error('Au moins un formulaire est requis pour créer un Univers');
      }

      // Préparer les définitions avec des tableaux vides pour Lists/Reports si non fournis
      const definitions: UniversDefinitions = {
        forms: forms,
        dashboards: univers.definitions?.dashboards || [],
        instructions: univers.definitions?.instructions || [],
        lists: univers.definitions?.lists || [], // Peut être vide (Coming Soon)
        reports: univers.definitions?.reports || [] // Peut être vide (Coming Soon)
      };

      // Préparer les métadonnées avec valeurs par défaut
      const metadata: UniversMetadata = {
        name: univers.metadata.name.trim(),
        description: univers.metadata.description?.trim() || '',
        iconUrl: univers.metadata.iconUrl || undefined,
        category: univers.metadata.category || undefined,
        tags: univers.metadata.tags || [],
        version: univers.metadata.version || 1,
        createdAt: univers.metadata.createdAt || new Date()
      };

      // Préparer l'ownership avec valeurs par défaut
      const ownership: UniversOwnership = {
        createdBy: univers.ownership.createdBy,
        agencyId: univers.ownership.agencyId || undefined,
        isMarketplaceTemplate: univers.ownership.isMarketplaceTemplate || false,
        approvalStatus: univers.ownership.approvalStatus || 
          (univers.ownership.isMarketplaceTemplate ? 'pending' : 'approved'),
        approvedBy: univers.ownership.approvedBy || undefined,
        approvedAt: univers.ownership.approvedAt || undefined,
        rejectionReason: univers.ownership.rejectionReason || undefined
      };

      // Préparer l'usage avec valeurs par défaut
      const usage: UniversUsage = {
        totalUsages: univers.usage?.totalUsages || 0,
        lastUsedAt: univers.usage?.lastUsedAt || undefined
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

      // Créer le document dans Firestore (en omettant les valeurs undefined)
      const docRef = await addDoc(collection(db, this.collectionName), removeUndefined({
        metadata: {
          ...metadata,
          createdAt: Timestamp.fromDate(metadata.createdAt)
        },
        ownership: {
          ...ownership,
          approvedAt: ownership.approvedAt ? Timestamp.fromDate(ownership.approvedAt) : null
        },
        definitions: definitions,
        usage: {
          totalUsages: usage.totalUsages,
          lastUsedAt: usage.lastUsedAt ? Timestamp.fromDate(usage.lastUsedAt) : null
        }
      }));

      console.log(`Univers créé avec succès: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création du Univers:', error);
      
      // Re-throw avec un message plus explicite si c'est notre erreur
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Erreur lors de la création du Univers. Veuillez réessayer.');
    }
  }

  /**
   * Mettre à jour un Univers
   */
  async update(id: string, updates: Partial<Univers>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      
      // Filter out undefined values to prevent Firestore errors
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const updateData: any = { ...filteredUpdates };
      
      // Convertir les dates en Timestamps Firestore
      if (updateData.metadata?.createdAt) {
        updateData.metadata.createdAt = Timestamp.fromDate(updateData.metadata.createdAt);
      }
      if (updateData.ownership?.approvedAt) {
        updateData.ownership.approvedAt = Timestamp.fromDate(updateData.ownership.approvedAt);
      }
      if (updateData.usage?.lastUsedAt) {
        updateData.usage.lastUsedAt = Timestamp.fromDate(updateData.usage.lastUsedAt);
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du Univers:', error);
      throw error;
    }
  }

  /**
   * Supprimer un Univers
   */
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, id));
    } catch (error) {
      console.error('Erreur lors de la suppression du Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer un Univers par ID
   */
  async getById(id: string): Promise<Univers | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertFirestoreToUnivers(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération du Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les Univers d'un utilisateur
   * Inclut les Univers privés (sans agencyId) et les Univers partagés avec l'agence
   */
  async getByUser(userId: string, agencyId?: string): Promise<Univers[]> {
    try {
      const allUnivers: Univers[] = [];
      
      // Requête 1: Récupérer tous les Univers créés par l'utilisateur
      // (on ne peut pas faire where sur un champ qui n'existe pas dans Firestore)
      const allQuery = query(
        collection(db, this.collectionName),
        where('ownership.createdBy', '==', userId),
        orderBy('metadata.createdAt', 'desc')
      );
      
      const allSnapshot = await getDocs(allQuery);
      
      // Filtrer côté client:
      // - Univers privés : ownership.agencyId est undefined, null, ou n'existe pas
      // - Univers partagés avec l'agence : ownership.agencyId === agencyId
      allSnapshot.docs.forEach(doc => {
        const universData = doc.data();
        const universAgencyId = universData.ownership?.agencyId;
        
        // Univers privé (agencyId n'existe pas, est null, ou undefined)
        const isPrivate = !universAgencyId || universAgencyId === null;
        
        // Univers partagé avec l'agence
        const isAgencyShared = agencyId && universAgencyId === agencyId;
        
        if (isPrivate || isAgencyShared) {
          allUnivers.push(this.convertFirestoreToUnivers(doc.id, universData));
        }
      });
      
      // Trier par date de création (décroissant)
      return allUnivers.sort((a, b) => 
        b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer les Univers d'une agence (agence-scoped)
   */
  async getByAgency(agencyId: string): Promise<Univers[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('ownership.agencyId', '==', agencyId),
        where('ownership.isMarketplaceTemplate', '==', false),
        orderBy('metadata.createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUnivers(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers de l\'agence:', error);
      throw error;
    }
  }

  /**
   * Récupérer les Univers du marketplace (approved templates)
   */
  async getMarketplaceTemplates(): Promise<Univers[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('ownership.isMarketplaceTemplate', '==', true),
        where('ownership.approvalStatus', '==', 'approved'),
        orderBy('usage.totalUsages', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUnivers(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des Univers du marketplace:', error);
      throw error;
    }
  }

  /**
   * Créer une instance Univers (quand un utilisateur utilise un template)
   */
  async createInstance(instance: Omit<UniversInstance, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.instancesCollectionName), {
        ...instance,
        createdAt: serverTimestamp()
      });
      
      // Mettre à jour le compteur d'utilisation du Univers
      await this.incrementUsage(instance.universId);
      
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Incrémenter le compteur d'utilisation d'un Univers
   */
  async incrementUsage(universId: string): Promise<void> {
    try {
      const universRef = doc(db, this.collectionName, universId);
      const universSnap = await getDoc(universRef);
      
      if (universSnap.exists()) {
        const data = universSnap.data();
        const currentUsage = data.usage?.totalUsages || 0;
        
        await updateDoc(universRef, {
          'usage.totalUsages': currentUsage + 1,
          'usage.lastUsedAt': serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation de l\'utilisation:', error);
      // Ne pas faire échouer l'opération si cette mise à jour échoue
    }
  }

  /**
   * Récupérer les instances Univers d'un utilisateur
   */
  async getInstancesByUser(userId: string, agencyId: string): Promise<UniversInstance[]> {
    try {
      const q = query(
        collection(db, this.instancesCollectionName),
        where('userId', '==', userId),
        where('agencyId', '==', agencyId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUniversInstance(doc.id, doc.data())
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des instances Univers:', error);
      throw error;
    }
  }

  /**
   * Récupérer une instance Univers par ID
   */
  async getInstanceById(id: string): Promise<UniversInstance | null> {
    try {
      const docRef = doc(db, this.instancesCollectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertFirestoreToUniversInstance(docSnap.id, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Supprimer une instance Univers
   */
  async deleteInstance(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.instancesCollectionName, id));
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'instance Univers:', error);
      throw error;
    }
  }

  /**
   * Écouter les Univers d'un utilisateur en temps réel
   */
  subscribeToUserUnivers(
    userId: string,
    agencyId: string,
    callback: (univers: Univers[]) => void
  ): () => void {
    const q = query(
      collection(db, this.collectionName),
      where('ownership.createdBy', '==', userId),
      where('ownership.agencyId', '==', agencyId),
      orderBy('metadata.createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const univers = snapshot.docs.map(doc => 
        this.convertFirestoreToUnivers(doc.id, doc.data())
      );
      callback(univers);
    }, (error) => {
      console.error('Erreur lors de l\'écoute des Univers:', error);
    });
  }
}

export const universService = new UniversService();

