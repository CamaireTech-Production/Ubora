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
   */
  async create(univers: Omit<Univers, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        metadata: {
          ...univers.metadata,
          createdAt: serverTimestamp()
        },
        ownership: {
          ...univers.ownership,
          approvedAt: univers.ownership.approvedAt ? Timestamp.fromDate(univers.ownership.approvedAt) : null
        },
        definitions: univers.definitions || {
          forms: [],
          dashboards: [],
          instructions: [],
          lists: [],
          reports: []
        },
        usage: {
          totalUsages: 0,
          lastUsedAt: null
        }
      });
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création du Univers:', error);
      throw error;
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
   */
  async getByUser(userId: string, agencyId?: string): Promise<Univers[]> {
    try {
      let q;
      
      if (agencyId) {
        q = query(
          collection(db, this.collectionName),
          where('ownership.createdBy', '==', userId),
          where('ownership.agencyId', '==', agencyId),
          orderBy('metadata.createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, this.collectionName),
          where('ownership.createdBy', '==', userId),
          orderBy('metadata.createdAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => 
        this.convertFirestoreToUnivers(doc.id, doc.data())
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

